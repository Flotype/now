var proxy = require('./wrap.js');
var io = require("socket.io");
var http = require("http");
var nowUtil = require("./nowUtil.js").nowUtil;


var socket;
var everyone;

var fileServer = require('./fileServer.js');
var ClientGroup = require('./clientGroup.js').ClientGroup;

var nowCore = {
  scopes: {},
  proxies: {},
  closures: {},
  clientGroups : {},
  groups: {},
  defaultScopes: {everyone:{} },
  
  options: {
    clientWrite: true,
    socketio: {}
  },
  
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

           
      // Create proxy object
      nowCore.proxies[client.sessionId] = proxy.wrap(nowCore.constructClientScopeStore(client), scope, client.sessionId);
      nowCore.scopes[client.sessionId] = scope;
      nowCore.clientGroups[client.sessionId] = [];

      everyone.addUser(client.sessionId);

    },

    replaceVar: function(client, data){
      if(nowCore.options.clientWrite) {
        var newVal = nowUtil.retrocycle({key: data.value}, nowCore.constructHandleFunctionForClientScope(client));
     
        nowUtil.debug("handleReplaceVar", data.key + " => " + data.value);
        nowUtil.print(data.value);
        
        var scope = nowCore.scopes[client.sessionId];  

        var obj = {};
        obj[data.key] = newVal.key;
	      nowUtil.multiMergeFunctionsToMulticallers(nowCore.clientGroups[client.sessionId], obj);

        scope[data.key] = newVal.key;
      } else {
        nowUtil.debug("handleReplaceVar", "preventing client write");
      }
    }
  },

  handleDisconnection: function(client) {
    //Remove scope and other functions
    if(!client.connected) {
      everyone.removeUser(client.sessionId);
      delete nowCore.scopes[client.sessionId];
      delete nowCore.proxies[client.sessionId];
      delete nowCore.closures[client.sessionId];
    }
  },

  constructHandleFunctionForClientScope: function(client) {
    return function(funcObj) {
      var multiCaller = everyone.generateMultiCaller(funcObj.fqn);
      nowUtil.createVarAtFqn(funcObj.fqn, everyone.nowScope, multiCaller);
      return nowCore.constructRemoteFunction(client, funcObj.fqn);
    };
  },

  constructRemoteFunction: function(client, fqn) {  
    nowUtil.debug("constructRemoteFunction", fqn);  
    var remoteFn = function() {
    var callId = fqn+ "_"+ nowUtil.generateRandomString();
      
      nowUtil.debug("executeRemoteFunction", fqn + ", " + callId);
      
      var theArgs = Array.prototype.slice.call(arguments);
      
      for(var i in theArgs){
        if(typeof theArgs[i] === 'function'){
          var closureId = "closure" + "_" + theArgs[i].name + "_" + nowUtil.generateRandomString();
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
        
        var data =  nowUtil.decycle(val, "now."+key, [nowUtil.serializeFunction, everyone.generateMultiCaller]);
        // data[0] = For client
        // data[1] = For Everyone
      	client.send({type: 'replaceVar', data: {key: key, value: data[0]}});

        everyone.nowScope[key] = data[1];

        
        var obj = {};
        obj[key] = val;
	      nowUtil.multiMergeFunctionsToMulticallers(nowCore.clientGroups[client.sessionId], obj);

	      callback();  
	   },  
      remove: function(key){
		      // console.log("remove " + key);
      }
    }; 
  }
};

exports.getGroup = function(groupName){
    if(!nowCore.groups.hasOwnProperty(groupName)){
      nowCore.defaultScopes[groupName] = {};
      nowCore.groups[groupName] = new ClientGroup(nowCore, socket, groupName);
    }
    return nowCore.groups[groupName];
}

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

exports.initialize = function(server, options){
  // Merge user and default options
  nowUtil.mergeScopes(nowCore.options, options);
  
  // Override the default HTTP server listeners
  fileServer.wrapServer(server, nowCore.options);
  
  socket = io.listen(server, nowCore.options.socketio || {});
  
  everyone = new ClientGroup(nowCore, socket, "everyone");
  everyone.setAsSuperGroup();

  socket.on('connection', function(client){
    nowUtil.initializeScope(nowCore.defaultScopes.everyone, client);
    handleNewConnection(client);
  });
  
  return everyone;
};


// Handle uncaught exceptions
process.on('uncaughtException', function (err) {
  nowUtil.error(err);
});
