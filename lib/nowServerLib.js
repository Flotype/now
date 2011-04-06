var proxy = require('./wrap.js');

var io = require("socket.io");
var http = require("http");
var nowUtil = require("./nowUtil.js").nowUtil;
var fs = require('fs');

var serverScope = {};
var connectedFuncs = [];
var disconnectedFuncs = [];
var socket;

var fileServer = require('./fileServer.js');


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



function handleNewConnection(client){
  client.on('message', function(message){
    var messageObj = message;
    if(messageObj !== null && messageObj.hasOwnProperty('type') && nowCore.messageHandlers.hasOwnProperty(messageObj.type)) {
        nowCore.messageHandlers[messageObj.type](client, messageObj.data);
    }
  });
  client.on('disconnect', function(){
    nowCore.handleDisconnection(client);  
  });
};

exports.initialize = function(server, options, socketioOptions){
  var options = options || {};
  // Override the default HTTP server listeners
  fileServer.wrapServer(server);
  
  socket = io.listen(server, socketioOptions);
  socket.on('connection', function(client){
    nowUtil.initializeScope(serverScope, client);
    handleNewConnection(client);
  });
    
  return everyone;
};

// Handle uncaught exceptions
process.on('uncaughtException', function (err) {
  nowUtil.error(err);
});