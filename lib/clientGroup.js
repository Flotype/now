var proxy = require('./wrap.js');
var nowUtil = require('./nowUtil.js').nowUtil;
var EventEmitter = require('events').EventEmitter;

function ClientGroup(nowCore, socket, groupName){

  this.groupName = groupName;
  this._socket = socket;
  this._nowCore = nowCore;

  // Contains references to scopes of clients that belong to group
  this._groupScopes = {};

  // The scope of the group itself
  this.nowScope = {};

  // The default scope. This is merged to all new users joining the group. Differs from nowScope because it stores original functions, not multicallers
  this.defaultScope = {};

  // Whether the group is `everyone`
  this._isSuperGroup = false;

  this.count = 0;
  this.now = this._generateProxy();
}


ClientGroup.prototype.__proto__ = EventEmitter.prototype;

// Set super group
ClientGroup.prototype.setAsSuperGroup = function(){
  this._isSuperGroup = true;
}

// Connected is alias for .on `connect`
ClientGroup.prototype.connected = function(func) {
  this.on('connect', func);
};

// Connected is alias for .on `disconnect`
ClientGroup.prototype.disconnected = function(func) {
  this.on('disconnect', func);
};

// Return boolean whether group contains a particular clientId
ClientGroup.prototype.hasClient = function(clientId) {
    return nowUtil.hasProperty(this._groupScopes, clientId);
};


// Generate the multicaller function, a special function that calls
// functions at a particular fqn for some group of users
ClientGroup.prototype.generateMultiCaller = function(fqn){
  nowUtil.debug("generateMultiCaller", fqn);

  var self = this;
  // Return the actual function
  return function multicall(){
    var args = Array.prototype.slice.call(arguments);
    for(var clientId in self._groupScopes){
      nowUtil.debug("Multicaller", "Calling "+fqn+" on client " + clientId);
      var clientScope = self._groupScopes[clientId];

      // Retrieve the target function
      var theFunction = nowUtil.getVarFromFqn(fqn, clientScope);

      // Call the function with this.now and this.user
      if(theFunction !== false) {
        theFunction.apply({now: clientScope, user: self._nowCore.userObjects[clientId]}, args);
      } else {
        nowUtil.debug("Multicaller", "No function found for client " + clientId);
      }
    }
  };

};

// Add a clientId to the group, if it isn't already there
ClientGroup.prototype.addUser = function(clientId){
  if (this.hasClient(clientId)) {
    // User already in the group.
    return;
  }
  if(nowUtil.hasProperty(this._nowCore.scopes, clientId)){

    if(!this._isSuperGroup){

      // If not a super group, merge functions in the new user's
      // scope to the group scope
      nowUtil.multiMergeFunctionsToMulticallers([this], this._nowCore.scopes[clientId]);

      // Add the group to the user's list of groups
      this._nowCore.clientGroups[clientId][this.groupName] = this;

      // Merge the items in the group's default scope to the proxy,
      // triggering a replaceVar to the client for any changes
      nowUtil.mergeScopes(this._nowCore.proxies[clientId], this.defaultScope);
    } else {

      // Merge default scope to the user's scope, not triggering a
      // replaceVar to the client. The user already gets the
      // replaceVar in initalizeScope
      nowUtil.mergeScopes(this._nowCore.scopes[clientId], this.defaultScope);

    }

    // Add user's scope reference to this users groupScopes
    this._groupScopes[clientId] = this._nowCore.scopes[clientId];

    this.count++;

    nowUtil.debug(this.groupName+" addUser", "adding " + clientId);

    // Emit the connect event, along with this.now and this.user
    this.emit.apply({_events: this._events, now:this._nowCore.proxies[clientId], user:this._nowCore.userObjects[clientId]}, ['connect', clientId]);
  } else {
    throw new Error("Invalid client id");
  }

};

ClientGroup.prototype.removeUser = function(clientId){
  if(nowUtil.hasProperty(this._groupScopes, clientId)){
    nowUtil.debug(this.groupName+" removeUser", "removing " + clientId);

    this.count--;

    // Emit disconnect event
    this.emit.apply({_events: this._events, now: this._nowCore.proxies[clientId], user: this._nowCore.userObjects[clientId]}, ['disconnect', clientId]);

    // Delete this clientId from clientGroups
    delete this._nowCore.clientGroups[clientId][this.groupName];

    // Delete the reference from groupScopes after disconnect event,
    // so any changes can still be made in groupScopes event handler
    delete this._groupScopes[clientId];
  }
};


ClientGroup.prototype._generateProxy = function(){
  // Store function is called by the proxy object upon variables changes.
  // Key contains the top level key of the change (ex 'x' if now.x or
  // a child of it was changed).
  // Val contains the new value.
  // Callback contains a callback for use in proxy internals.
  // Changes contains a key value map of fqn's to new values.

  var self = this;

  var processChanges = function(key, val, changes){
    var currScopes = [];

    // Create multicallers for the current group
    var data = nowUtil.decycle(val, "now."+key, [function(fqn, func){
      var multiCaller = self.generateMultiCaller(fqn);
      nowUtil.createVarAtFqn(fqn, self.nowScope, multiCaller);
      return nowUtil.serializeFunction(fqn, func);
    }]);

    // Send the changes to everybody in the group
    for(var clientId in self._groupScopes){
      self._socket.clients[clientId].send({type: 'replaceVar', data: {key: key, value: data[0]}});
    }

    // Put all relevant nowCore.scopes in array so we traverse only once
    for(var i in self._groupScopes) {
      currScopes.push(self._groupScopes[i]);
    }
    // Don't forget the default scope of the server, which is merged
    // into scopes of new users of group
    currScopes.push(self.defaultScope);

    nowUtil.mergeChanges(currScopes, changes);

    // If is `everyone`, add multicallers to all groups for the change
    if(self._isSuperGroup){
      var obj = {};
      obj[key] = val;
      nowUtil.multiMergeFunctionsToMulticallers(self._nowCore.groups, obj);
    }

    return data;
  };

  var store = {
    set: function(key, val, callback, changes){

      nowUtil.debug(self.groupName+"Store", key + " => " + val);

      var data = processChanges(key, val, changes);

      callback();
    },
    remove: function(key){}
  };

  return proxy.wrap(store, this.nowScope)
}

exports.ClientGroup = ClientGroup;