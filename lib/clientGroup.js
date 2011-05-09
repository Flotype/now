var proxy = require('./wrap.js');
var nowUtil = require('./nowUtil.js').nowUtil;
var EventEmitter = require('events').EventEmitter;

exports.ClientGroup = function ClientGroup(nowCore, socket, groupName){

  // Contains references to scopes of clients that belong to group
  var groupScopes = {};
  
  // The scope of the group itself
  var nowScope = {};

  // The default scope. This is merged to all new users joining the group. Differs from nowScope because it stores original functions, not multicallers
  var defaultScope = {};
  
  // Whether the group is `everyone`
  var isSuperGroup = false;   

  // Connected is alias for .on `connect`
  function connected(func) {
    this.on('connect', func);
  };
  
  // Connected is alias for .on `disconnect` 
  function disconnected(func) {
    this.on('disconnect', func); 
  };
  
  // Store function is called by the proxy object upon variables changes
  // Key contains the top level key of the change (ex 'x' if now.x or a child of it was changed)
  // Val contains the new value
  // Callback contains a callback for use in proxy internals
  // Changes contains a key value map of fqn's to new values
  var store = {
    set: function(key, val, callback, changes){

      nowUtil.debug(groupName+"Store", key + " => " + val);

      var data = processChanges(key, val, changes);

      callback();  
    },
    remove: function(key){
      // console.log("remove " + key);
    }
  }

  function processChanges(key, val, changes){
     var currScopes = [];

      // Create multicallers for the current group
      var data = nowUtil.decycle(val, "now."+key, [function(fqn, func){
        var multiCaller = generateMultiCaller(fqn);
        nowUtil.createVarAtFqn(fqn, nowScope, multiCaller);
        return nowUtil.serializeFunction(fqn, func); 
      }]);

      // Send the changes to everybody in the group 
      for(var clientId in groupScopes){
        socket.clients[clientId].send({type: 'replaceVar', data: {key: key, value: data[0]}});
      }
      
      // Put all relevant nowCore.scopes in array so we traverse only once
      for(var i in groupScopes) {
        currScopes.push(groupScopes[i]);
      }
      // Don't forget the default scope of the server, which is merged into scopes of new users of group
      currScopes.push(defaultScope);
      
      nowUtil.mergeChanges(currScopes, changes);

      // If is `everyone`, add multicallers to all groups for the change
      if(isSuperGroup){
        var obj = {};
        obj[key] = val;
        nowUtil.multiMergeFunctionsToMulticallers(nowCore.groups, obj);
      }

    return data;
  }
  
  
  // Set super group
  function setAsSuperGroup(){
    isSuperGroup = true;
  }

  
  // Add a clientId to the group, if it isn't already there
  function addUser(clientId){
    if(Object.hasOwnProperty.call(nowCore.scopes, clientId)){
      
      if(!isSuperGroup){
        
        // If not a super group, merge functions in the new user's scope to the group scope
        nowUtil.multiMergeFunctionsToMulticallers([this], nowCore.scopes[clientId]);
        
        // Add the group to the user's list of groups
        nowCore.clientGroups[clientId][groupName] = this;
        
        // Merge the items in the group's default scope to the proxy, triggering a replaceVar to the client for any changes
        nowUtil.mergeScopes(nowCore.proxies[clientId], defaultScope);
      } else {
      
        // Merge default scope to the user's scope, not triggering a replaceVar to the client. The user already gets the replaceVar in initalizeScope
        nowUtil.mergeScopes(nowCore.scopes[clientId], defaultScope);
     
      }

      // Add user's scope reference to this users groupScopes
      groupScopes[clientId] = nowCore.scopes[clientId];
     
      this.count++;
     
      nowUtil.debug(groupName+" addUser", "adding " + clientId);
     
      // Emit the connect event, along with this.now and this.user
      this.emit.apply({_events: this._events, now: nowCore.proxies[clientId], user:nowCore.userObjects[clientId]}, ['connect', clientId]);
    } else {
      throw new Error("Invalid client id");
    }

  };
  
  function removeUser(clientId){
    if(Object.hasOwnProperty.call(groupScopes, clientId)){
      nowUtil.debug(groupName+" removeUser", "removing " + clientId);
      
      this.count--;
      
      // Emit disconnect event
      this.emit.apply({_events: this._events, now: nowCore.proxies[clientId], user:nowCore.userObjects[clientId]}, ['disconnect', clientId]);

      // Delete this clientId from clientGroups
      delete nowCore.clientGroups[clientId][groupName];
          
      // Delete the reference from groupScopes after disconnect event, so any changes can still be made in groupScopes event handler
      delete groupScopes[clientId];
    }
  };
  
  // Generate the multicaller function, a special function that calls functions at a particular fqn for some group of users
  function generateMultiCaller(fqn){
    nowUtil.debug("generateMultiCaller", fqn);
    
    // Return the actual function
    return function multicall(){
      for(var clientId in groupScopes){
        nowUtil.debug("Multicaller", "Calling "+fqn+" on client " + clientId);
        var clientScope = groupScopes[clientId];
        
        // Retrieve the target function
        var theFunction = nowUtil.getVarFromFqn(fqn, clientScope);
        
        // Call the function with this.now and this.user
        if(theFunction !== false) {
          theFunction.apply({now: clientScope, user: nowCore.userObjects[clientId]}, arguments);
        } else {
          nowUtil.debug("Multicaller", "No function found for client " + clientId);
        }
      }
    };
    
  };
  
  // Return boolean whether group contains a particular clientId
  function hasClient(clientId) {
    return Object.hasOwnProperty.call(groupScopes, clientId);
  };
  
  
  
  this.count = 0;
  this.defaultScope = defaultScope;
  this.now = proxy.wrap(store, nowScope);
  this.connected = connected;
  this.disconnected = disconnected;
  this.addUser = addUser;
  this.removeUser = removeUser;
  this.nowScope = nowScope;
  this.generateMultiCaller = generateMultiCaller;
  this.setAsSuperGroup = setAsSuperGroup;
  this.hasClient = hasClient;
}

exports.ClientGroup.prototype = new EventEmitter();

