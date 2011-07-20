var EventEmitter = require('events').EventEmitter;
var nowUtil = require('./nowUtil').nowUtil;
var Proxy = require('./proxy');
var ScopeTable = require('./scopeTable').ScopeTable;

exports.initialize = function (nowjs) {
  var fn = require('./function').init(nowjs);

  /**
   * @name Group
   * @class Represents a group containing some subset of all users.
   * @property {String} groupName The name associated with the group.
   */
  var Group = function (groupName) {
    //all users in the group
    this.users = {};

    this.groupName = groupName;

    this.excludes = {};
    /**
     * @name Group.now
     * @namespace The now namespace for this particular group. Actions
     * to this namespace affect all users that are members of the
     * group. All functions that are called will be called in the
     * context of each individual user in the group.
     */
    this.now = Proxy.wrap(this);
    //group scope table
    this.scopeTable = new ScopeTable();
  };

  Group.prototype.__proto__ = EventEmitter.prototype;

  /**
   * Used to find the cardinality of the group (i.e. how many users it
   * contains).

   * @param {Function} callback Called with a Number corresponding to
   * the group's user count.
   */
  Group.prototype.count = function (callback) {
    callback(Object.keys(this.users).length);
  };

  /**
   * Used to retrieve a list of the client IDs corresponding to all
   * users in the group.

   * @param {Function} callback Called with an Array of Strings
   * corresponding to the client IDs of all users in the group.
   */
  Group.prototype.getUsers = function (callback) {
    callback(Object.keys(this.users));
  };

  /**
   * @deprecated As of 0.7.0. Use nowjs.on('connect') instead.
   */
  Group.prototype.connected = function (callback) {
    nowjs.on('connect', callback);
  };

  /**
   * @deprecated As of 0.7.0. Use nowjs.on('disconnect') instead.
   */
  Group.prototype.disconnected = function (callback) {
    nowjs.on('disconnect', callback);
  };

  /**
   * Adds the user identified by clientId to this group.

   * @param {String} clientId The client ID associated with the target
   * user.
   */
  Group.prototype.addUser = function (clientId) {
    var self = this;
    this.hasClient(clientId, function (hasClient) {
      if (hasClient) {
        return;
      }
      nowjs.getClient(clientId, function () {
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

        if(self.isSuperGroup || !nowUtil.isEmptyObj(toSend)) {
          this.socket.emit('rv', toSend);
        }
        var user = nowUtil.clone(this, {'_events': self._events});
        self.emit.apply(user, ['join']);
      });
    });
  };

  /**
   * Removes the user identified by clientId from this group.

   * @param {String} clientId The client ID associated with the target
   * user.
   */
  Group.prototype.removeUser = function (clientId) {
    var self = this;
    this.hasClient(clientId, function (hasClient) {
      if (!hasClient) {
        return;
      }
      var user = nowUtil.clone(self.users[clientId], {'_events':self._events});
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

  /**
   * Returns a new Group that is identical to the calling group,
   * except with the specified clients excluded. The returned group
   * automatically updates to accommodate any changes made to its
   * parent group.

   * @param {Array} clientIds A list of client IDs corresponding to
   * clients to exclude.

   * @type Group
   */
  Group.prototype.exclude = function (clientIds) {
    var excludes = {};
    for (var i = 0; i<clientIds.length; i++) {
      excludes[clientIds[i]] = true;
    }
    var group = nowUtil.clone(this,
                              {excludes: nowUtil.clone(this.excludes,
                                                       {excludes: excludes}),
                               now: Proxy.wrap(user)});
    return group;
  };

  /**
   * Used to determine a given user's membership in the group.

   * @param {String} clientId The client ID associated with the target
   * user.

   * @param {Function} callback Called with a Boolean indicating the
   * user's membership in the group.
   */
  //returns boolean whether or not user is in a group
  Group.prototype.hasClient = function (clientId, callback) {
    callback(this.users[clientId] !== undefined);
  };

  Group.prototype.get = function (fqn) {
    var value = this.scopeTable.get(fqn);
    // If this is a regular group, look in `everyone` for the value
    if (value === undefined && !this.isSuperGroup) {
      value = nowjs.getGroup('everyone').scopeTable.get(fqn);
    }

    // If this is a function, return a multicaller.
    if (typeof value === 'function') {
      var group = nowUtil.clone(this, {fqn: fqn});
      value = fn.multicall.bind(group);
    }
    return value;
  };

  Group.prototype.deleteVar = function (fqn) {
    var obj = nowUtil.clone(this, {fqn: fqn});
    nowjs.emit('groupdel', obj);
  };

  Group.prototype.set = function (fqn, val) {
    var obj = nowUtil.clone(this, {fqn: fqn, val: val});
    nowjs.emit('grouprv', obj);
  };

  return Group;
};