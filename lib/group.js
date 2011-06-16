var EventEmitter = require('events').EventEmitter;
var fn;
var nowUtil = require('./nowUtil').nowUtil;
var Proxy = require('./proxy');
var ScopeTable = require('./scopeTable').ScopeTable;

exports.initialize = function(now) {
  fn = require('./function').init(now);
  function Group (groupName, isSuperGroup) {
    //all users in the group
    this.users = {};

    this.groupName = groupName;

    this.count = 0;
    //group proxy obj;
    this.now = Proxy.wrap(this);
    //group scope table
    this.scopeTable = new ScopeTable();

  }

  Group.prototype.__proto__ = EventEmitter.prototype;

  //adds a user to the group
  Group.prototype.addUser = function(clientId) {
    var self = this;
    if(this.hasClient(clientId)) {
      return;
    }
    now.getClient(clientId, function() {
      self.users[this.user.clientId] = this;
      this.groups[self.groupName] = self;

      var toSend = {};
      var keys = Object.keys(self.scopeTable.data);
      for(var i = 0, ll = keys.length; i < ll; i++){
        var key = keys[i];
        var val = self.scopeTable.get(key);
        if(val !== nowUtil.noop && !nowUtil.hasProperty(this.scopeTable.data, key)){
          toSend[key] = nowUtil.getVarOrFqn(val, key);
        }
      }

      this.socket.emit('rv', toSend);
      var user = nowUtil.clone(this);
      user._events = self._events;
      self.emit.apply(user, ['connect']);
      self.count++;
    });
  };

  //removes a user from the group
  Group.prototype.removeUser = function(clientId) {
    if(! this.hasClient(clientId)) {
      return;
    }
    this.count--;
    var self = this;
    now.getClient(clientId, function() {
      var user = nowUtil.clone(this);
      user._events = self._events;
      self.emit.apply(user, ['disconnect']);
      delete self.users[this.user.clientId];
      delete this.groups[this.groupName];
    });
  };

  //alias for on('connect')
  Group.prototype.connected = function(func) {
    this.on('connect', func);
  };

  Group.prototype.disconnected = function(func) {
    this.on('disconnect', func);
  };

  //returns boolean whether or not user is in a group
  Group.prototype.hasClient = function(clientId) {
    return nowUtil.hasProperty(this.users, clientId);
  };

  Group.prototype.get = function(fqn) {
    var value = this.scopeTable.get(fqn);
    // If this is a regular group, look in `everyone` for the value
    if(value === undefined && !this.isSuperGroup) {
      value = now.getGroup('everyone').scopeTable.get(fqn);
    }

    // If this is a function, return a multicaller.
    if(typeof value === 'function') {
      var group = nowUtil.clone(this);
      group.fqn = fqn;
      value = fn.multicall.bind(group);
    }
    return value;
  };

  Group.prototype.set = function(fqn, val) {
    if(typeof val === 'object') {
      var flattenedVal = nowUtil.flatten(val, fqn);
      for(var i = 0, key = Object.keys(flattenedVal), ll = key.length; i < ll; i++) {
	fqn = key[i];
	val = flattenedVal[fqn];
	this.scopeTable.set(fqn, val);

	var keys = Object.keys(this.users);
	for(var j = 0, ll = keys.length; j < ll; j++){
	  var user = this.users[keys[j]];
	  delete user.scopeTable[fqn];
	}
      }
      // If this is `everyone`, invalidate the values in the lesser groups
      if(this.isSuperGroup) {
	keys = Object.keys(now.groups);
	for(var i = 0, ll = keys.length; i < ll; i++) {
	  var group = now.groups[keys[i]];
	  if(!group.isSuperGroup) {

	    for(var j = 0, key = Object.keys(flattenedVal), ll = key.length; j < ll; j++) {
	      fqn = key[j];
	      delete group.scopeTable[fqn];
	    }
	  }
	}
      }
      user.socket.emit('rv', flattenedVal);
    } else {
      // Invalidate the values in the group user's scopeTables
      var keys = Object.keys(this.users);
      for(var i = 0, ll = keys.length; i < ll; i++){
	var user = this.users[keys[i]];
	delete user.scopeTable[fqn];
	user.socket.emit('rv', nowUtil.getVarOrFqn(val));

      }

      // If this is `everyone`, invalidate the values in the lesser groups
      if(this.isSuperGroup) {
	keys = Object.keys(now.groups);
	for(var i = 0, ll = keys.length; i < ll; i++) {
	  var group = now.groups[keys[i]];
	  if(!group.isSuperGroup) {
	    delete group.scopeTable[fqn];
	  }
	}
      }
      this.scopeTable.set(fqn, val);
    }
  };

  return Group;
};
