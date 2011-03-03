var nowUtil = require("./nowUtil.js");

exports.serverScope = {};


exports.handleNewConnection = function(client){

  client.on('message', function(message){
    var messageObj = JSON.parse(message);
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
    response.data.err = err;
  }
  if(data.callReturnExpected){
    client.send(JSON.stringify(nowUtil.decycle(response)));
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
  var scope = nowUtil.retrocycle(data.scope);
  
  nowUtil.debug("handleCreateScope", "");
  nowUtil.print(scope);
  
  // Merge the server defaults into the incoming scope
  nowUtil.mergeScopes(scope, exports.serverScope);
  
  
  
  
  
  
  // Create proxy object
  
  
  
  
  
  
  nowCore.scopes[client.sessionId] = scope;

}


nowCore.messageHandlers.replaceVar = function(client, data){

  nowUtil.debug("handleReplaceVar", data.fqn + " => " + data.newVal);
  
  var scope = nowCore.scopes[client.sessionId];
  
  // If function, inflate into a magic remote function
  if(data.newVal.hasOwnProperty('type') && data.newVal.type == "function"){
    var value = nowCore.constructRemoteFunction(client, data.fqn);
  } else {
    var value = data.newVal;
  }

  // Add to the client blacklist so the new variable is not sent back to the client
  nowCore.watchersBlacklist[client.sessionId][data.fqn] = true;
  
  // Set any child elements of the new variable as unwatched so new watchers can be set on thems
  if(typeof data.newVal == "object") {
    for(var i in data.oldFqns) {
      delete nowCore.watchers[client.sessionId].data.watchedKeys[data.oldFqns[i]]
    }
  }

  nowUtil.createVarAtFqn(data.fqn, scope, value);

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
    //Register the callback in the callbacks table
    if(!nowCore.callbacks[client.sessionId]){
      nowCore.callbacks[client.sessionId] = {};
    }
    
    if(callback){
      nowCore.callbacks[client.sessionId][callId] = callback;
    }
    
    client.send(JSON.stringify({type: 'remoteCall', data: {callId: callId, functionName: functionName, arguments: arguments, callReturnExpected: callReturnExpected}}));
    
    return true;
  }
  return remoteFn;
}



