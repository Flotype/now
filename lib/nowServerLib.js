var proxy = require('./wrap.js');

var io = require("socket.io");
var http = require("http");
var nowUtil = require("./nowUtil.js").nowUtil;

var fs = require('fs');

var EventEmitter = require('events').EventEmitter;

var NowEvents = function(){};
NowEvents.prototype = new EventEmitter();
var nowEvents = new NowEvents();

var serverScope = {};
var connectedFuncs = [];
var disconnectedFuncs = [];

var fileCache = {};
var nowFileCache;
var socket;


var everyone = {
  nowScope: {},
  connected: function(func) {
    // Instead of using events, we'll just add it to an array of functions that needs to be called
    if(arguments.length === 0) {
      for(var i in connectedFuncs) {
        connectedFuncs[i].apply(this);
      }
    } else {
      connectedFuncs.push(func); 
    }
  },
  disconnected: function(func) {
    // Instead of using events, we'll just add it to an array of functions that needs to be called
    if(arguments.length === 0) {
      for(var i in disconnectedFuncs) {
        disconnectedFuncs[i].apply(this);
      }
    } else {
      disconnectedFuncs.push(func); 
    }
  }
};

var nowCore = {
  scopes: {},
  proxies: {},
  closures: {},

  messageHandlers: {
    remoteCall: function(client, data){
      nowUtil.debug("handleRemoteCall", data.callId);
      var clientScope = nowCore.proxies[client.sessionId];
      var theFunction;
      
      if(data.fqn.split('_')[0] === 'closure'){
        theFunction = nowCore.closures[data.fqn];
      } else {
        theFunction = nowUtil.getVarFromFqn(data.fqn, clientScope);
      }
      
      var theArgs = data.args;
      
      for(var i in theArgs){
        if(theArgs[i] && theArgs[i].hasOwnProperty('type') && theArgs[i].type === 'function'){
          theArgs[i] = nowCore.constructRemoteFunction(client, theArgs[i].fqn);
        }
      }
      
      var callId = data.callId;
      
      
      theFunction.apply({now: clientScope, user:{clientId: client.sessionId} }, theArgs);
      
      nowUtil.debug("handleRemoteCall" , "completed " + callId);
    },

    createScope: function(client, data){
      var scope = nowUtil.retrocycle(data.scope, nowCore.constructHandleFunctionForClientScope(client));
      
      nowUtil.debug("handleCreateScope", "");
      nowUtil.print(scope);
      
      // Merge the server defaults into the incoming scope
      nowUtil.mergeScopes(scope, serverScope);
      // Create proxy object
      nowCore.proxies[client.sessionId] = proxy.wrap(nowCore.constructClientScopeStore(client), scope);
      nowCore.scopes[client.sessionId] = scope;

      everyone.connected.apply({now: scope, user:{clientId: client.sessionId}});
    },

    replaceVar: function(client, data){
      var newVal = nowUtil.retrocycle(data.value, nowCore.constructHandleFunctionForClientScope(client));
   
      nowUtil.debug("handleReplaceVar", data.key + " => " + data.value);
      nowUtil.print(data.value);
      
      var scope = nowCore.scopes[client.sessionId];  

      if(data.value.hasOwnProperty("type") && data.value.type === 'function') {
        var multiCaller = nowCore.generateMultiCaller(data.value.fqn);
        nowUtil.createVarAtFqn(data.value.fqn, everyone.nowScope, multiCaller);
        data.value = nowCore.constructRemoteFunction(client, data.value.fqn);
        newVal = data.value;
      }
      scope[data.key] = newVal;
    }
  },
  
  everyoneStore: {
    set: function(key, val, callback, changes){

      nowUtil.debug("everyoneStore", key + " => " + val);
      var scopes = [];
      
      // Put all relevant scopes in array so we traverse only once
      for(var i in nowCore.scopes) {
        scopes.push(nowCore.scopes[i]);
      }
      scopes.push(serverScope);
      
      nowUtil.mergeChanges(scopes, changes);
      
      var data = nowUtil.decycle(val, "now."+key, [function(fqn, func){
        var multiCaller = nowCore.generateMultiCaller(fqn);
        nowUtil.createVarAtFqn(fqn, everyone.nowScope, multiCaller);
        return nowUtil.serializeFunction(fqn, func); 
      }]);
      
      socket.broadcast({type: 'replaceVar', data: {key: key, value: data[0]}});
      
      callback();  
    },
    remove: function(key){
      // console.log("remove " + key);
    }
  },
  
  generateMultiCaller: function(fqn){
    nowUtil.debug("generateMultiCaller", fqn);
    return function multicall (){
      var outputs = {};
      for(var clientId in nowCore.scopes){
        nowUtil.debug("Multicaller", "Calling "+fqn+" on client " + clientId);
        var clientScope = nowCore.scopes[clientId];
        var theFunction = nowUtil.getVarFromFqn(fqn, clientScope);
        if(theFunction !== false) {
          outputs[clientId] = theFunction.apply({now: clientScope}, arguments);
        } else {
          nowUtil.debug("Multicaler", "No function found for client " + clientId);
        }
      }
      return outputs;
    };
  },

  handleDisconnection: function(client) {
    //Remove scope and other functions
    setTimeout(function(){
      if(!client.connected) {
        everyone.disconnected.apply({now: nowCore.scopes[client.sessionId], user:{clientId: client.sessionId} });
        delete nowCore.scopes[client.sessionId];
        delete nowCore.proxies[client.sessionId];
        delete nowCore.closures[client.sessionId];
      }    
    }, 2000);
  },

  constructHandleFunctionForClientScope: function(client) {
    return function(funcObj) {
      var multiCaller = nowCore.generateMultiCaller(funcObj.fqn);
      nowUtil.createVarAtFqn(funcObj.fqn, everyone.nowScope, multiCaller);
      return nowCore.constructRemoteFunction(client, funcObj.fqn);
    };
  },

  constructRemoteFunction: function(client, fqn) {  
    nowUtil.debug("constructRemoteFunction", fqn);  
    var remoteFn = function() {
      var callId = fqn+ "_"+ new Date().getTime();
      
      nowUtil.debug("executeRemoteFunction", fqn + ", " + callId);
      
      var theArgs = Array.prototype.slice.call(arguments);
      
      for(var i in theArgs){
        if(typeof theArgs[i] === 'function'){
          var closureId = "closure" + "_" + theArgs[i].name + "_" + new Date().getTime();
          nowCore.closures[closureId] = theArgs[i];
          theArgs[i] = {type: 'function', fqn: closureId};
        }
      }
      
      
      
      process.nextTick(function(){
        client.send({type: 'remoteCall', data: {callId: callId, fqn: fqn, args: theArgs}});
      });
    };
    return remoteFn;
  },

  constructClientScopeStore: function(client) {
    return {
      set: function(key, val, callback, changes){
        nowUtil.debug("clientScopeStore", key + " => " + val);
        
        var data =  nowUtil.decycle(val, "now."+key, [nowUtil.serializeFunction, function(fqn, func){ return nowCore.constructRemoteFunction(client, fqn); }]);       
        // data[0] = For client
        // data[1] = For Everyone
        client.send({type: 'replaceVar', data: {key: key, value: data[0]}});
        
        everyone.nowScope[key] = data[1];
        
        callback();  
      },  
      remove: function(key){
        // console.log("remove " + key);
      }
    }; 
  }
};

var serveFile = function(filename, request, response, options){
  var options = options || {};

  if(fileCache.hasOwnProperty(filename)) {
    response.writeHead(200);
    response.write(fileCache[filename]);
    response.end();
  } else { 
    if(filename.indexOf("/now.js") !== -1) {
      if(nowFileCache === undefined) {
        fs.readFile(filename, function(err, data){  
          var host = request.headers.host.split(":");
          var hostServer = options['host'] || host[0];
          var hostPort = '80';
          if(host.length > 1){
            hostPort = host[1];
          }
          hostPort = options['port'] || hostPort;

          var text = data.toString();
          text = text.replace(/\*\*SERVER\*\*/g, hostServer);
          text = text.replace(/\*\*PORT\*\*/g, hostPort);
          
          fs.readFile(__dirname + "/nowUtil.js", function(err, data){ 
            var textUtil = data.toString();
            nowFileCache = {nowUtil: textUtil, now: text};
            response.writeHead(200, {'content-type': 'text/javascript'});
            response.write(nowFileCache.nowUtil);
            response.write(nowFileCache.now);
            response.end();
          });
        });
      } else {
        response.writeHead(200, {'content-type': 'text/javascript'});
        response.write(nowFileCache.nowUtil);
        response.write(nowFileCache.now);
        response.end();
      }
    } else {
      fs.readFile(filename, function(err, data){
        var text = data.toString();
        response.writeHead(200);
        response.write(text);
        response.end();
        fileCache[filename] = text;
      });
    }
  }
};

var handleNewConnection = function(client){
  client.on('message', function(message){
    var messageObj = message;
    if(messageObj !== null && messageObj.hasOwnProperty('type') && nowCore.messageHandlers.hasOwnProperty(messageObj.type)) {
      nowCore.messageHandlers[messageObj.type](client, messageObj.data);
    }
  });
  client.on('disconnect', function(){
    nowCore.handleDisconnection(client);
    nowEvents.emit.apply({now: nowCore.proxies[client.sessionId], user:{clientId: client.sessionId}} , ['disconnect', client]);
  });
};

exports.initialize = function(server, options, socketioOptions){
  var options = options || {};
  // Override the default HTTP server listeners
  var defaultListeners = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', function(request, response){
    // Handle only GET requests for /nowjs/* files. Pass all other requests through
    var i;
    if(request.method === "GET"){
      if(request.url.split('?')[0] === "/nowjs/now.js") {
          serveFile(__dirname + '/now.js', request, response, options);
      } else {
        for(i in defaultListeners){
          defaultListeners[i].call(server, request, response);
        }
      }
    } else {
      for(i in defaultListeners){
        defaultListeners[i].call(server, request, response);
      }
    }
  });
  
  socket = io.listen(server, socketioOptions);
  socket.on('connection', function(client){
    nowUtil.initializeScope(serverScope, client);
    handleNewConnection(client);
    nowEvents.emit.apply({now: nowCore.proxies[client.sessionId], user:{clientId: client.sessionId}}, ['connect', client]);
});
    
  return everyone;
};

everyone.now = proxy.wrap(nowCore.everyoneStore, everyone.nowScope);
everyone.on = nowEvents.on;


// Handle uncaught exceptions
process.on('uncaughtException', function (err) {
  nowUtil.error(err);
});