var proxy = require('./wrap.js');

var io = require("socket.io");
var http = require("http");
var nowUtil = require("./nowUtil.js");
var fs = require('fs');

var serverScope = {};
var connectedFuncs = [];
var disconnectedFuncs = [];

var everyone = {nowScope: {}};

var fileCache = {};
var nowFileCache;

everyone.connected = function(func) {
    // Instead of using events, we'll just add it to an array of functions that needs to be called
    if(arguments.length == 0) {
      for(var i in connectedFuncs) {
        connectedFuncs[i].apply(this);
      }
    } else {
      connectedFuncs.push(func); 
    }
}

everyone.disconnected = function(func) {
    // Instead of using events, we'll just add it to an array of functions that needs to be called
    if(arguments.length == 0) {
      for(var i in disconnectedFuncs) {
        disconnectedFuncs[i].apply(this);
      }
    } else {
      disconnectedFuncs.push(func); 
    }
}

exports.everyone = everyone;


exports.initialize = function(server){

  // Override the default HTTP server listeners
  var defaultListeners = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', function(request, response){
    // Handle only GET requests for /nowjs/* files. Pass all other requests through
    if(request.method == "GET"){
      if(request.url == "/nowjs/now.js") {
        serveFile(__dirname + '/now.js', request, response);
      } else {
        for(var i in defaultListeners){
          defaultListeners[i].call(server, request, response);
        }
      }
    } else {
      for(var i in defaultListeners){
        defaultListeners[i].call(server, request, response);
      }
    }
  });
  
  socket = io.listen(server);
  socket.on('connection', function(client){
    nowUtil.initializeScope(serverScope, client);
      exports.handleNewConnection(client);
  });
    
  return everyone;
}

function serveFile(filename, request, response){
  if(fileCache.hasOwnProperty(filename)) {
    response.writeHead(200);
    response.write(fileCache[filename]);
    response.end();
  } else { 
    if(filename.indexOf("/now.js") !== -1) {
      if(nowFileCache == undefined) {
        fs.readFile(filename, function(err, data){  

          var host = request.headers.host.split(":");
          var hostServer = host[0]
          var hostPort = '80';
          if(host.length > 1){
            hostPort = host[1];
          }
          
          var text = data.toString();
          text = text.replace(/\*\*SERVER\*\*/g, hostServer);
          text = text.replace(/\*\*PORT\*\*/g, hostPort);
          
          fs.readFile(__dirname + "/nowUtil.js", function(err, data){ 
            var textUtil = data.toString();
            nowFileCache = {nowUtil: textUtil, now: text};
            response.writeHead(200, {'content-type': 'text/javascript'});
            response.write(nowFileCache['nowUtil']);
            response.write(nowFileCache['now']);
            response.end();
          });
        });
      } else {
        response.writeHead(200, {'content-type': 'text/javascript'});
        response.write(nowFileCache['nowUtil']);
        response.write(nowFileCache['now']);
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
}


exports.handleNewConnection = function(client){

  client.on('message', function(message){
    var messageObj = message;
    if(messageObj != null && messageObj.hasOwnProperty('type') && nowCore.messageHandlers.hasOwnProperty(messageObj.type)) {
        nowCore.messageHandlers[messageObj.type](client, messageObj.data);
    }
  });
  
  client.on('disconnect', function(){
    nowCore.handleDisconnection(client);  
  });
}




var nowCore = {};
nowCore.scopes = {};
nowCore.proxies = {};
nowCore.messageHandlers = {};
nowCore.closures = {};

exports.nowCore = nowCore;



nowCore.generateMultiCaller = function(fqn){
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
  } 
}

/* ===== BEGIN MESSAGE HANDLERS ===== */
nowCore.messageHandlers.remoteCall = function(client, data){
  nowUtil.debug("handleRemoteCall", data.callId)
  var clientScope = nowCore.proxies[client.sessionId];
  var theFunction;
  if(data.functionName.split('_')[0] == 'closure'){
    theFunction = nowCore.closures[data.functionName];
  } else {
    theFunction = nowUtil.getVarFromFqn(data.functionName, clientScope);
  }
  
  var theArgs = data.arguments;
  
  for(var i in theArgs){
    if(theArgs[i].hasOwnProperty('type') && theArgs[i].type == 'function'){
      theArgs[i] = nowCore.constructRemoteFunction(client, theArgs[i].fqn);
    }
  }
  
  var callId = data.callId;
  theFunction.apply({now: clientScope, user:{clientId: client.sessionId} }, theArgs);
  
  nowUtil.debug("handleRemoteCall" , "completed " + callId);
}

nowCore.messageHandlers.createScope = function(client, data){
  var scope = nowUtil.retrocycle(data.scope, nowCore.constructHandleFunctionForClientScope(client));
  
  nowUtil.debug("handleCreateScope", "");
  nowUtil.print(scope);
  
  
  // Merge the server defaults into the incoming scope
  nowUtil.mergeScopes(scope, serverScope);
  // Create proxy object
  nowCore.proxies[client.sessionId] = proxy.wrap(nowCore.constructClientScopeStore(client), scope);
  nowCore.scopes[client.sessionId] = scope;

  everyone.connected.apply({now: scope, user:{clientId: client.sessionId}});
}


nowCore.messageHandlers.replaceVar = function(client, data){

  var newVal = nowUtil.retrocycle(data.value, nowCore.constructHandleFunctionForClientScope(client));

  nowUtil.debug("handleReplaceVar", data.key + " => " + data.value);
  
  var scope = nowCore.scopes[client.sessionId];  
  scope[data.key] = newVal;
}

/* ===== END MESSAGE HANDLERS ====== */

nowCore.handleDisconnection = function(client) {
  //Remove scope and other functions
  setTimeout(function(){
    if(!client.connected) {
      everyone.disconnected.apply({now: nowCore.scopes[client.sessionId], user:{clientId: client.sessionId} });
      delete nowCore.scopes[client.sessionId];
      delete nowCore.proxies[client.sessionId];
      delete nowCore.closures[client.sessionId];
    }    
  }, 2000)
}

nowCore.constructHandleFunctionForClientScope = function(client) {
  return function(funcObj) {
    var multiCaller = nowCore.generateMultiCaller(funcObj.fqn);
    nowUtil.createVarAtFqn(funcObj.fqn, everyone.nowScope, multiCaller);
    return nowCore.constructRemoteFunction(client, funcObj.fqn);
  }
}


nowCore.constructRemoteFunction = function(client, functionName){
  
  nowUtil.debug("constructRemoteFunction", functionName);
    
  var remoteFn = function(){
    var callId = functionName+ "_"+ new Date().getTime();
    
    nowUtil.debug("executeRemoteFunction", functionName + ", " + callId);
    
    for(var i in arguments){
      if(typeof arguments[i] == 'function'){
        var closureId = "closure" + "_" + arguments[i].name + "_" + new Date().getTime();
        nowCore.closures[closureId] = arguments[i];
        arguments[i] = {type: 'function', fqn: closureId};
      }
    }
    
    var theArgs = Array.prototype.slice.call(arguments);
    
    process.nextTick(function(){
      client.send({type: 'remoteCall', data: {callId: callId, functionName: functionName, arguments: theArgs}});
    });
  }
  
  return remoteFn;
}

nowCore.constructClientScopeStore = function(client) {

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

nowCore.everyoneStore = {
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
};
  

// Handle uncaught exceptions
process.on('uncaughtException', function (err) {
  nowUtil.error(err);
});
  
  

everyone.now = proxy.wrap(nowCore.everyoneStore, everyone.nowScope);