window.nowLib = {};
var exports = window.nowLib;


var now = {};
var socket;
var SERVER_ID = 'server';

var dependencies = ['/nowjs/nowUtil.js', "/socket.io/socket.io.js"];

for(var i in dependencies){
  var fileref=document.createElement('script');
  fileref.setAttribute("type","text/javascript");
  fileref.setAttribute("src", dependencies[i]);
  document.getElementsByTagName("head")[0].appendChild(fileref);
}
  
window.onload = function(){
  nowUtil.watch(nowCore.scopes, SERVER_ID, '', function(){
    
    // client initialized
    var nowOld = now;
    
    now = nowCore.scopes[SERVER_ID];
    
    nowUtil.initializeScope(nowOld, socket);
   
    nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[SERVER_ID], nowOld, "now");
    
    for(var key in nowOld) {
      now[key] = nowOld[key];
    }
   
    setInterval(function(){
      nowCore.watchers[SERVER_ID].processScope();
    }, 1000);

  });
  
  socket = new io.Socket('**SERVER**', {port: **PORT**}); 
  socket.connect();
  socket.on('connect', function(){ 
    var client = socket;
    client.sessionId = SERVER_ID;
    exports.handleNewConnection(client);
  });
  
}



exports.NowWatcher = function(fqnRoot, scopeObj, variableChanged) {
  this.data = {watchedKeys: {}, hashedArrays: {}};
  
  this.traverseObject = function(path, obj, arrayBlacklist) {
    // Prevent new array items from being double counted
    for(var key in obj){
      var fqn = path+"."+key;
      if(!(fqn in this.data.watchedKeys)) {
        nowUtil.watch(obj, key, fqn, this.variableChanged);
        if(!(fqn in arrayBlacklist)) {
          this.variableChanged(key, fqn, "", obj[key]);
        }
        this.data.watchedKeys[fqn] = true;
      }
      
      if(typeof obj[key] == 'object') {
        if(nowUtil.isArray(obj[key])) {
          if(fqn in this.data.hashedArrays){
            var diff = this.compareArray(this.data.hashedArrays[fqn], obj[key]);
            if(diff === false) {
              // Replace the whole array
              this.variableChanged(key, fqn, this.data.hashedArrays[fqn], []);
            } else if(diff !== true) {
              for(var i in diff) {
                arrayBlacklist[fqn+"."+i] = true;
                this.variableChanged(i, fqn+"."+i, this.data.hashedArrays[fqn][i], diff[i]);
              }  
            }
          }
          this.data.hashedArrays[fqn] = obj[key].slice(0); 
        } 
        this.traverseObject(fqn, obj[key], arrayBlacklist);
      }
    }
  }

  this.processScope = function(){
    this.traverseObject(fqnRoot, scopeObj, {});
  }

  this.variableChanged = variableChanged;

   /** 
   * Returns true if two the two arrays are identical. 
   * Returns an object of differences if keys have been added or the value at a key has changed
   * Returns false if keys have been deleted
   */
  this.compareArray = function(oldArr, newArr) {
    var result = {};
    var modified = false;
    if(newArr.length >= oldArr.length) {
      for(var i in newArr) {
        if(!(i in oldArr) || newArr[i] !== oldArr[i]) {
          result[i] = newArr[i];
          modified = true;
        }
      }
      return (modified) ? result : true;
    } else {
      return false;
    }
  }
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
nowCore.watchers = {};
nowCore.watchersBlacklist = {};
nowCore.callbacks = {};
nowCore.messageHandlers = {};
nowCore.closures = {};

exports.nowCore = nowCore;

/* ===== BEGIN MESSAGE HANDLERS ===== */
nowCore.messageHandlers.remoteCall = function(client, data){
  nowUtil.debug("handleRemoteCall", data.callId)
  var clientScope = nowCore.scopes[client.sessionId];
  
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
    nowUtil.debug("remoteCallReturn", err.stack);
    response.data.err = err;
  }
  if(data.callReturnExpected){
    client.send(nowUtil.decycle(response));
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
  nowCore.watchersBlacklist[client.sessionId] = {};
  var scope = nowUtil.retrocycle(data.scope, nowCore.constructHandleFunctionForClientScope(client));
  
  nowUtil.debug("handleCreateScope", "");
  nowUtil.print(scope);
  

  // Blacklist the entire scope so it is not sent back to the client
  nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], scope, "now");
  
  nowCore.watchers[client.sessionId] = new exports.NowWatcher("now", scope, function(prop, fqn, oldVal, newVal){
    if(!(fqn in nowCore.watchersBlacklist[client.sessionId])){
      nowUtil.debug("clientScopeWatcherVariableChanged", fqn + " => " + newVal);
      if(typeof oldVal == "object") {
        var oldFqns = nowUtil.getAllChildFqns(oldVal, fqn);
        
        for(var i in oldFqns) {
          delete nowCore.watchers[client.sessionId].data.watchedKeys[oldFqns[i]];  
        }
      }
      
      
      nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], newVal, fqn);
      
      var key = fqn.split(".")[1];
      var data = nowUtil.decycle(scope[key], key, [nowUtil.serializeFunction]);
      
      client.send({type: 'replaceVar', data: {key: key, value: data[0]}});    
    } else {
      nowUtil.debug("clientScopeWatcherVariableChanged", fqn + " change ignored");
      delete nowCore.watchersBlacklist[client.sessionId][fqn];
    }
    
    // In case the object is an array, we delete from hashedArrays to prevent multiple watcher firing
    delete nowCore.watchers[client.sessionId].data.hashedArrays[fqn];
    
  });
  
  nowCore.scopes[client.sessionId] = scope;

}


nowCore.constructHandleFunctionForClientScope = function(client) {
  return function(funcObj) {
    return nowCore.constructRemoteFunction(client, funcObj.fqn);
  }
}


nowCore.messageHandlers.replaceVar = function(client, data){

  nowUtil.debug("handleReplaceVar", data.key + " => " + data.value);
  
  var scope = nowCore.scopes[client.sessionId];
  
  
  var newVal = nowUtil.retrocycle(data.value, nowCore.constructHandleFunctionForClientScope(client));

  nowCore.watchersBlacklist[client.sessionId]["now."+data.key] = true;
  
  nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], newVal, "now."+data.key);
  
  for(var key in nowCore.watchers[client.sessionId].data.watchedKeys) {
    if(key.indexOf("now."+data.key+".") === 0) {
      delete nowCore.watchers[client.sessionId].data.watchedKeys[key];
    }
  }
    
  scope[data.key] = newVal;

}

/* ===== END MESSAGE HANDLERS ====== */

nowCore.handleDisconnection = function(client) {
  //Remove scope and callbacks
  setTimeout(function(){
    if(!client.connected) {
      delete nowCore.scopes[client.sessionId];
      delete nowCore.callbacks[client.sessionId];
      delete nowCore.watchers[client.sessionId];
      delete nowCore.watchersBlacklist[client.sessionId];
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
    
    client.send({type: 'remoteCall', data: {callId: callId, functionName: functionName, arguments: arguments, callReturnExpected: callReturnExpected}});
    
    return true;
  }
  return remoteFn;
}



