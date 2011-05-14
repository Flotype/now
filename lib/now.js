var SERVER_ID = 'server';
var isIE = nowUtil.isLegacyIE();
var socket;

var nowCore = {

  // The client scope
  scopes: {},
  
  // Watcher objects for all variables in client
  watchers: {},
  
  // Blacklist of items to not trigger watcher callback for
  watchersBlacklist: {},
  
  
  // Contains references to closures passed in as pararmeters to remote calls
  // (Generated closure id) => reference to closure function
  closures: {},

  
  // All of the different client messages we'll handle
  messageHandlers: {
  
    // A remote function call from client
    remoteCall: function(client, data){
      nowUtil.debug("handleRemoteCall", data.callId);
      var clientScope = nowCore.scopes[client.sessionId];
      
      var theFunction;
      
      // Retrieve the function, either from closures hash or from the now scope
      if(data.fqn.split('_')[0] === 'closure'){
        theFunction = nowCore.closures[data.fqn];
      } else {
        theFunction = nowUtil.getVarFromFqn(data.fqn, clientScope);
      }
      
      var theArgs = data.args;
      
      // Search (only at top level) of args for functions parameters, and replace with wrapper remote call function
      for(var i in theArgs){
        if(Object.hasOwnProperty.call(theArgs[i], 'type') && theArgs[i].type === 'function'){
          theArgs[i] = nowCore.constructRemoteFunction(client, theArgs[i].fqn);
        }
      }
      
      // Call the function with this.now and this.user
      theFunction.apply({now: clientScope, clientId: client.sessionId}, theArgs);
     
      nowUtil.debug("handleRemoteCall" , "completed " + data.callId);
    },

    
    // Called by initializeScope from the client side
    createScope: function(client, data){
      
      // Initialize blacklist object
      nowCore.watchersBlacklist[client.sessionId] = {};
      
      // This is the now object as populated by the client
      // constructHandleFunctionForClientScope returns a function that will generate multicallers and remote call functions for this client
      var scope = nowUtil.retrocycle(data.scope, nowCore.constructHandleFunctionForClientScope(client));
      
      nowUtil.debug("handleCreateScope", "");
      nowUtil.print(scope);
      
      // Blacklist the entire scope so it is not sent back to the client
      nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], scope, "now");
      
      
      // Create the watcher object
      nowCore.watchers[client.sessionId] = new nowLib.NowWatcher("now", scope, {}, function(prop, fqn, oldVal, newVal){
        
        // Handle variable vale changes in this callback
        
        // If not on blacklist do changes
        if(!Object.hasOwnProperty.call(nowCore.watchersBlacklist[client.sessionId], fqn)){
          nowUtil.debug("clientScopeWatcherVariableChanged", fqn + " => " + newVal);
          if(oldVal && typeof oldVal === "object") {
            var oldFqns = nowUtil.getAllChildFqns(oldVal, fqn);
            
            for(var i in oldFqns) {
              delete nowCore.watchers[client.sessionId].data.watchedKeys[oldFqns[i]];  
            }
          }
          
          
          nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], newVal, fqn);
          
          var key = fqn.split(".")[1];
          var data = nowUtil.decycle(scope[key], "now."+key, [nowUtil.serializeFunction]);
          
          client.send({type: 'replaceVar', data: {key: key, value: data[0]}});    
        } else {
          // If on blacklist, remove from blacklist
          nowUtil.debug("clientScopeWatcherVariableChanged", fqn + " change ignored");
          delete nowCore.watchersBlacklist[client.sessionId][fqn];
        }
        
        // In case the object is an array, we delete from hashedArrays to prevent multiple watcher firing
        delete nowCore.watchers[client.sessionId].data.hashedArrays[fqn];
        
      });
      
      
      nowCore.scopes[client.sessionId] = scope;
      nowLib.nowJSReady();
    },

    replaceVar: function(client, data){
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
      
      if(Object.hasOwnProperty.call(data.value, "type") && data.value.type === 'function') {
        data.value = nowCore.constructRemoteFunction(client, data.value.fqn);
        newVal = data.value;
      }
      
      scope[data.key] = newVal;
    }
  },

  constructHandleFunctionForClientScope: function(client) {
    return function(funcObj) {
      return nowCore.constructRemoteFunction(client, funcObj.fqn);
    };
  },

  handleDisconnection: function(client) {
    nowUtil.debug("disconnect", "server disconnected");
  },

  constructRemoteFunction: function(client, fqn){
    
    nowUtil.debug("constructRemoteFunction", fqn);
      
    var remoteFn = function(){
      var callId = fqn+ "_"+ nowUtil.generateRandomString(10);
      
      nowUtil.debug("executeRemoteFunction", fqn + ", " + callId);

      var theArgs = Array.prototype.slice.call(arguments);
      
      for(var i in theArgs){
        if(typeof theArgs[i] === 'function' && Object.hasOwnProperty.call(theArgs, i)){
          var closureId = "closure" + "_" + theArgs[i].name + "_" + nowUtil.generateRandomString(10);
          nowCore.closures[closureId] = theArgs[i];
          theArgs[i] = {type: 'function', fqn: closureId};
        }
      }

      client.send({type: 'remoteCall', data: {callId: callId, fqn: fqn, args: theArgs}});
    };
    return remoteFn;
  },
  
  _events: {},
  
  // Event code from socket.io
  on: function(name, fn){
    if (!(name in nowCore._events)) {
      nowCore._events[name] = [];
    }
    nowCore._events[name].push(fn);
    return nowCore;
  },

  emit: function(name, args){
    if (name in nowCore._events){
      var events = nowCore._events[name].concat();
      for (var i = 0, ii = events.length; i < ii; i++) {
        events[i].apply(nowCore, args === undefined ? [] : args);
      }
    }
    return nowCore;
  },
  
  removeEvent: function(name, fn){
    if (name in nowCore._events){
      for (var a = 0, l = nowCore._events[name].length; a < l; a++) {
        if (nowCore._events[name][a] == fn) {
          nowCore._events[name].splice(a, 1);
        }
      }        
    }
    return nowCore;
  }
};

var nowLib = {

  nowJSReady: function(){  
    // client initialized
    var nowOld = now;
    now = nowCore.scopes[SERVER_ID];
    var ready = nowOld.ready;
    var core = nowOld.core;
    
    delete nowOld.ready;
    delete nowOld.core;
    nowUtil.initializeScope(nowOld, socket);

    nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[SERVER_ID], nowOld, "now");
    
    for(var key in nowOld) {
      now[key] = nowOld[key];
    }
    now.core = core;
    now.ready = function(func){
      if(func && typeof func === "function") {
        func();
      } else {
        nowCore.emit('ready');
      }
    }
    
    
    setTimeout(function(){
      nowCore.watchers[SERVER_ID].processScope();
    }, 1000);

    // Call the ready handlers
    ready();
  },

  NowWatcher: function(fqnRoot, scopeObj, scopeClone, variableChanged) {
    this.data = {watchedKeys: {}, hashedArrays: {}};
    
    var badNames = {'now.ready': true, 'now.core': true };
    
    this.traverseObject = function(path, obj, arrayBlacklist, objClone) {
      // Prevent new array items from being double counted
      for(var key in obj){
        if(Object.hasOwnProperty.call(obj, key)){
          var fqn = path+"."+key;
          // Ignore ready function
          if(Object.hasOwnProperty.call(badNames, fqn)) {
            continue;
          }
          if(isIE && !nowUtil.isArray(obj) && typeof obj[key] !== "object" && Object.hasOwnProperty.call(objClone, key) && obj[key] !== objClone[key]) {
            this.variableChanged(key, fqn, objClone[key], obj[key]);
            objClone[key] = nowUtil.shallowCopy(obj[key]);
          }
          if(!Object.hasOwnProperty.call(this.data.watchedKeys, fqn)) {
            if(!isIE){
              nowUtil.watch(obj, key, fqn, this.variableChanged);
            } else {
              objClone[key] = nowUtil.shallowCopy(obj[key]);
            }
            if(!Object.hasOwnProperty.call(arrayBlacklist, fqn)) {
              this.variableChanged(key, fqn, "", obj[key]);
            }
            this.data.watchedKeys[fqn] = true;
          }
          
          if(obj[key] && typeof obj[key] === 'object') {
            if(nowUtil.isArray(obj[key])) {
              if(Object.hasOwnProperty.call(this.data.hashedArrays, fqn)){
                var diff = this.compareArray(this.data.hashedArrays[fqn], obj[key]);
                if(diff === false) {
                  // Replace the whole array
                  this.variableChanged(key, fqn, this.data.hashedArrays[fqn], obj[key]);
                } else if(diff !== true) {
                  for(var i in diff) {
                    if(Object.hasOwnProperty.call(diff, i)){
                      arrayBlacklist[fqn+"."+i] = true;
                      this.variableChanged(i, fqn+"."+i, this.data.hashedArrays[fqn][i], diff[i]);
                    }
                  }  
                }
              }
              this.data.hashedArrays[fqn] = obj[key].slice(0); 
            }
            if(isIE && (!Object.hasOwnProperty.call(objClone, key) || !(typeof objClone[key] === "object"))) {
              if(nowUtil.isArray(obj[key])) {
                objClone[key] = [];
              } else {
                objClone[key] = {};
              }
            }
            if(isIE){
              this.traverseObject(fqn, obj[key], arrayBlacklist, objClone[key]);
            } else {
              this.traverseObject(fqn, obj[key], arrayBlacklist);
            }
          }
        }
      }
    };

    this.processScope = function(){
      if(isIE) {
        this.traverseObject(fqnRoot, scopeObj, {}, scopeClone);
      } else {
        this.traverseObject(fqnRoot, scopeObj, {});
      }
      setTimeout(function(){
        nowCore.watchers[SERVER_ID].processScope();
      }, 1000);
    };

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
          if(!Object.hasOwnProperty.call(oldArr, i) || newArr[i] !== oldArr[i]) {
            result[i] = newArr[i];
            modified = true;
          }
        }
        return (modified) ? result : true;
      } else {
        return false;
      }
    };
  },

  handleNewConnection: function(client){
    client.on('message', function(message){
      var messageObj = message;
      if(Object.hasOwnProperty.call(messageObj, "type") && Object.hasOwnProperty.call(nowCore.messageHandlers, messageObj.type)) {
          nowCore.messageHandlers[messageObj.type](client, messageObj.data);
      }
    });
    client.on('disconnect', function(){
      nowCore.handleDisconnection(client);
      nowCore.emit('disconnect');
    });
    // Forward planning for socket io 0.7
    client.on('error', function(){
      nowCore.emit('error');
    });
    client.on('retry', function(){
      nowCore.emit('retry');
    });
    client.on('reconnect', function(){
      nowCore.emit('reconnect');
    });
  }
  
};

var now = {
  ready: function(func) {
    if(arguments.length === 0) {
      nowCore.emit('ready');
    } else {
      nowCore.on('ready', func); 
    }    
  },
  core: {
    on: nowCore.on,
    removeEvent: nowCore.removeEvent,
    clientId: undefined
  }
};

(function(){
  var dependencies = ["/socket.io/socket.io.js"];
  var dependenciesLoaded = 0;

  var nowJSScriptLoaded = function(){
    dependenciesLoaded++;
    if(dependenciesLoaded !== dependencies.length) {
      return;
    }
    
    nowUtil.debug("isIE", isIE);
   
    socket = new io.Socket('**SERVER**', {port: **PORT**}); 
    now.core.socketio = socket;
    socket.connect();
    socket.on('connect', function(){
      var client = socket;
      client.sessionId = SERVER_ID;
      now.core.clientId = socket.transport.sessionid;
      nowLib.handleNewConnection(client);
      nowCore.emit('connect');
    });
  };

  for(var i=0, ii = dependencies.length; i < ii; i++){
    var fileref=document.createElement('script');
    fileref.setAttribute("type","text/javascript");
    fileref.setAttribute("src", "http://**SERVER**:**PORT**"+dependencies[i]);
    fileref.onload = nowJSScriptLoaded;
    if(isIE) {
      fileref.onreadystatechange = function () {
        if(fileref.readyState === "loaded") {
          nowJSScriptLoaded();
        }
      };
    }
    document.getElementsByTagName("head")[0].appendChild(fileref);  
  }
}());
