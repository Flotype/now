var proxy = require('./wrap.js');

var io = require("socket.io");
var http = require("http");
var nowUtil = require("./nowUtil.js");
var fs = require('fs');

var serverScope = {};
var everyone = {nowScope: {}};
exports.everyone = everyone;


exports.initialize = function(server){

  // Override the default HTTP server listeners
  var defaultListeners = server.listeners('request');
  server.removeAllListeners('request');
  var path = module.filename.split('/');
  var directory = path.splice(0, path.length - 1).join('/');
  server.on('request', function(request, response){
    // Handle only GET requests for /nowjs/* files. Pass all other requests through
    if(request.method == "GET"){
      if(request.url == "/nowjs/nowUtil.js"){
        serveFile(directory + '/nowUtil.js', request, response); 
      } else if(request.url == "/nowjs/nowClientLib.js") {
        serveFile(directory + '/nowClientLib.js', request, response);
      } else {
        for(var i in defaultListeners){
          defaultListeners[i](request, response);
        }
      }
    } else {
      for(var i in defaultListeners){
        defaultListeners[i](request, response);
      }
    }
  });
  
  socket = io.listen(server);
  socket.on('connection', function(client){



  nowUtil.initializeScope(serverScope, client);

    // console.log("everyone: ");
    // console.log(everyone.now.z);
    exports.handleNewConnection(client);
  });
  
  return everyone;
}

function serveFile(filename, request, response){
  fs.readFile(filename, function(err, file){  
    if(err) {  
        response.writeHead(500, {"Content-Type": "text/plain"});  
        response.write(err + "\n");  
        response.end();  
        return;  
    }
    
    var host = request.headers.host.split(":");
    var hostServer = host[0]
    var hostPort = '80';
    if(host.length > 1){
      hostPort = host[1];
    }
    
    var parsedFile = file.toString().replace("**SERVER**", hostServer);
    parsedFile = parsedFile.replace("**PORT**", hostPort);    
    response.writeHead(200);  
    response.write(parsedFile);  
    response.end();
  });
}












exports.handleNewConnection = function(client){

  client.on('message', function(message){
    var messageObj = message;
    if(messageObj != null && "type" in messageObj && messageObj.type in nowCore.messageHandlers) {
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
nowCore.callbacks = {};
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
  var response = {type:"callReturn", data: {callId: callId}};
  try {
    var retval = theFunction.apply({now: clientScope}, theArgs);
    
    if(typeof retval == 'function'){
      var closureId = "closure" + "_" + retval.name + "_" + new Date().getTime();
      nowCore.closures[closureId] = retval;
      retval = {type: 'function', fqn: closureId};
    }
    
    response.data.retval = retval;
  } catch(err) {
    // console.log(err.stack);
    response.data.err = err;
  }
  if(data.callReturnExpected){
    client.send(nowUtil.decycle(response, '', [function(fqn, func){return func;}]));
  }
  nowUtil.debug("handleRemoteCall" , "completed " + callId);
}

nowCore.messageHandlers.callReturn = function(client, data){
  nowUtil.debug("handleCallReturn", data.callId);
  var callback = nowCore.callbacks[client.sessionId][data.callId];
  if('err' in data){
    callback(data.err);
  } else if ('retval' in data){
  
    if(data.retval.hasOwnProperty('type') && data.retval.type == 'function'){
      data.retval = nowCore.constructRemoteFunction(client, data.retval.fqn);
    }
    
    callback(data.retval);
  } else {
    callback();
  }
  delete nowCore.callbacks[client.sessionId][data.callId];
}

nowCore.messageHandlers.createScope = function(client, data){
  var scope = nowUtil.retrocycle(data.scope, nowCore.constructHandleFunctionForClientScope(client));
  
  nowUtil.debug("handleCreateScope", "");
  nowUtil.print(scope);
  
  
  // console.log("beforeMergeScope: " + JSON.stringify(scope));
  
  // Merge the server defaults into the incoming scope
  nowUtil.mergeScopes(scope, serverScope);
  // console.log("serverScope: " + JSON.stringify(serverScope));
  // Create proxy object
  nowCore.proxies[client.sessionId] = proxy.wrap(nowCore.constructClientScopeStore(client), scope);
  nowCore.scopes[client.sessionId] = scope;

}


nowCore.messageHandlers.replaceVar = function(client, data){

  var newVal = nowUtil.retrocycle(data.value, nowCore.constructHandleFunctionForClientScope(client));

  nowUtil.debug("handleReplaceVar", data.key + " => " + data.value);
  
  var scope = nowCore.scopes[client.sessionId];  
  scope[data.key] = newVal;
}

/* ===== END MESSAGE HANDLERS ====== */

nowCore.handleDisconnection = function(client) {
  //Remove scope and callbacks
  setTimeout(function(){
    if(!client.connected) {
      delete nowCore.scopes[client.sessionId];
      delete nowCore.proxies[client.sessionId];
      delete nowCore.callbacks[client.sessionId];
      delete nowCore.closures[client.sessionId];
    }    
  }, 10000)
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

    arguments = Array.prototype.slice.call(arguments);
    if(typeof arguments[arguments.length-1] == "function") {
      var callback = arguments.pop();
      var callReturnExpected = true;
    } else {
      var callReturnExpected = false;
    }
    
    for(var i in arguments){
      if(typeof arguments[i] == 'function'){
        var closureId = "closure" + "_" + arguments[i].name + "_" + new Date().getTime();
        nowCore.closures[closureId] = arguments[i];
        arguments[i] = {type: 'function', fqn: closureId};
      }
    }
    
    var theArgs = arguments;
    
    //Register the callback in the callbacks table
    if(!nowCore.callbacks[client.sessionId]){
      nowCore.callbacks[client.sessionId] = {};
    }
    if(callback){
      nowCore.callbacks[client.sessionId][callId] = callback;
    }
    process.nextTick(function(){
      client.send({type: 'remoteCall', data: {callId: callId, functionName: functionName, arguments: theArgs, callReturnExpected: callReturnExpected}});
    });
    
    return true;
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
  


  
  
  

everyone.now = proxy.wrap(nowCore.everyoneStore, everyone.nowScope);
  