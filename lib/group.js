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

    //group proxy obj;
    this.now = Proxy.wrap(this);
    //group scope table
    this.scopeTable = new ScopeTable();
  };

  Group.prototype.__proto__ = EventEmitter.prototype;

  Group.prototype.count = function (callback) {
    callback(Object.keys(this.users).length);
  };

  // Shim for backwards compatibility.
  Group.prototype.connected = function (callback) {
    now.on('connect', callback);
  };

  Group.prototype.disconnected = function (callback) {
    now.on('disconnect', callback);
  };

 //adds a user to the group
  Group.prototype.addUser = function (clientId) {
    var self = this;
    this.hasClient(clientId, function (hasClient) {
      if (hasClient) {
        return;
      }
      now.getClient(clientId, function () {
        // Scoping note: `self` refers to the group, `this` refers to
        // the new client.
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
        self.emit.apply(user, ['join']);
      });
    });
  };

  //removes a user from the group
  Group.prototype.removeUser = function (clientId) {
    var self = this;
    this.hasClient(clientId, function (hasClient) {
      if (!hasClient) {
        return;
      }
      var user = nowUtil.clone(self.users[clientId]);
      user._events = self._events;
      self.emit.apply(user, ['leave']);
      // Delete all remote functions that are part of this group from
      // the user.
      var fqns = Object.keys(self.scopeTable.data);
      for (var i = 0; i < fqns.length; i++) {
        if (typeof self.scopeTable.data[fqns[i]] === 'function' &&
            self.scopeTable.data[fqns[i]] !== nowUtil.noop &&
            user.scopeTable.data[fqns[i]] === undefined) {
          // Tell the user to delete his function.
          user.deleteVar(fqns[i]);
        }
      }
      delete self.users[clientId];
      delete user.groups[self.groupName];
    });
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

  //returns boolean whether or not user is in a group
  Group.prototype.hasClient = function (clientId, callback) {
    callback(this.users[clientId] !== undefined);
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

    var obj = nowUtil.clone(this);
    obj.fqn = fqn;
    obj.val = val;

    now.emit('rv', obj);

  };

  return Group;
};