var EventEmitter = require('events').EventEmitter;
var nowUtil = require('./nowUtil').nowUtil;
var Proxy = require('./proxy');
var ScopeTable = require('./scopeTable').ScopeTable;

exports.initialize = function (now) {
  var fn = require('./function').init(now);
  var Group = function (groupName) {
    //all users in the group
    this.users = {};

    this.groupName = groupName;

    this.excludes = {};

    this.count = 0;
    //group proxy obj;
    this.now = Proxy.wrap(this);
    //group scope table
    this.scopeTable = new ScopeTable();
  };

  Group.prototype.__proto__ = EventEmitter.prototype;

  //adds a user to the group
  Group.prototype.addUser = function (clientId) {
    var self = this;
    if (this.hasClient(clientId)) {
      return;
    }
    now.getClient(clientId, function () {
      // Scoping note: `self` refers to the group, `this` refers to the new client
      self.users[this.user.clientId] = this;
      this.groups[self.groupName] = self;

      // Send the client any new variables that it does not already have
      var toSend = {};
      var keys = Object.keys(self.scopeTable.data);
      var key, val;
      for (var i = 0, ll = keys.length; i < ll; i++) {
        key = keys[i];
        val = self.scopeTable.get(key);
        if (val !== nowUtil.noop && !Array.isArray(val) &&
            !nowUtil.hasProperty(this.scopeTable.data, key)) {
          toSend[key] = nowUtil.getValOrFqn(val, key);
        }
      }

      if(this.isSuperGroup || !nowUtil.isEmptyObj(toSend)) {
        this.socket.emit('rv', toSend);
      }
      var user = nowUtil.clone(this);
      user._events = self._events;
      self.emit.apply(user, ['connect']);
      self.count++;
    });
  };

  //removes a user from the group
  Group.prototype.removeUser = function (clientId) {
    if (!this.hasClient(clientId)) {
      return;
    }
    this.count--;
    var user = nowUtil.clone(this.users[clientId]);
    user._events = this._events;
    this.emit.apply(user, ['disconnect']);
    delete this.users[clientId];
    delete user.groups[this.groupName];
  };

  Group.prototype.exclude = function (clientIds) {
    var user = nowUtil.clone(this);
    user.excludes = nowUtil.clone(this.excludes);
    for (var i=0; i<clientIds.length; i++) {
      user.excludes[clientIds[i]] = true;
    }
    user.now = Proxy.wrap(user);
    return user;
  };

  //alias for on('connect')
  Group.prototype.connected = function (func) {
    this.on('connect', func);
  };

  Group.prototype.disconnected = function (func) {
    this.on('disconnect', func);
  };

  //returns boolean whether or not user is in a group
  Group.prototype.hasClient = function (clientId) {
    return this.users[clientId] !== undefined;
  };

  Group.prototype.get = function (fqn) {
    var value = this.scopeTable.get(fqn);
    // If this is a regular group, look in `everyone` for the value
    if (value === undefined && !this.isSuperGroup) {
      value = now.getGroup('everyone').scopeTable.get(fqn);
    }

    // If this is a function, return a multicaller.
    if (typeof value === 'function') {
      var group = nowUtil.clone(this);
      group.fqn = fqn;
      value = fn.multicall.bind(group);
    }
    return value;
  };

  Group.prototype.deleteVar = function (fqn) {
    var keys = Object.keys(this.users);
    var user;
    for (var i = 0, ll = keys.length; i < ll; i++) {
      user = this.users[keys[i]];
      // Only send to users who haven't overwritten the value at the
      // provided fqn.
      if (user.scopeTable[fqn] === undefined)
        user.socket.emit('del', fqn);
    }
    this.scopeTable.deleteVar(fqn);
  };

  Group.prototype.set = function (fqn, val) {
    var exclusive = false;
    for (var j in this.excludes) {
      exclusive = true;
      break;
    }
    var users = Object.keys(this.users);
    var i = 0, ll = users.length;
    var user;
    var toSend = {};
    if (typeof val === 'object') {
      var flattenedVal = nowUtil.flatten(val, fqn);
      // Set the enumerable object stub in the scopeTable
      if (!exclusive) {
        this.scopeTable.set(fqn, Object.keys(val));
      }

      // Recurse for all children
      var k = Object.keys(flattenedVal);
      for (ll = k.length; i < ll; i++) {
        fqn = k[i];
        this.set(fqn, flattenedVal[fqn]);
        // Send the serialized form of functions.
        toSend[fqn] = nowUtil.getValOrFqn(flattenedVal[fqn], fqn);
      }
    } else {
      toSend[fqn] = nowUtil.getValOrFqn(val, fqn);
      if (!exclusive) {
        this.scopeTable.set(fqn, val);
      }
    }

    // Invalidate the value in the group's users' scopeTables
    for (i = 0, ll = users.length; i < ll; i++) {
      user = this.users[users[i]];
      if (this.excludes[user.user.clientId]) {
        continue;
      }
      if (exclusive) {
        // If this is an exclusive group, instead, set the values in
        // the users' scopeTables.
        user.scopeTable.set(fqn);
        user.socket.emit('rv', toSend);
        continue;
      }
      user.scopeTable.deleteVar(fqn);
      user.socket.emit('rv', toSend);
    }

    // Do not do any additional processing if this is an exclusive group.
    if (exclusive) return;

    // If this is `everyone`, invalidate the values in the lesser groups
    if (this.isSuperGroup) {
      var groups = Object.keys(now.groups);
      for (i = 1, ll = groups.length; i < ll; i++) {
        // everyone is guaranteed to be the first group in keys.
        var group = now.groups[groups[i]];
        group.scopeTable.deleteVar(fqn);
      }
    }
  };

  return Group;
};
