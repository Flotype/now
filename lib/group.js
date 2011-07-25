var EventEmitter = require('events').EventEmitter;
var nowUtil = require('./nowUtil').nowUtil;
var Proxy = require('./proxy');
var ScopeTable = require('./scopeTable').ScopeTable;

exports.initialize = function (nowjs) {
  var fn = require('./function').init(nowjs);

  /**
   * @name Group

   * @class Represents a group containing some subset of all
     users. Each group has its own {@link Group#now} namespace.

   * @property {String} groupName The name associated with the group.
   * @see nowjs#getGroup
   * @see Group#now
   */
  var Group = function (groupName) {
    //all users in the group
    this.users = {};

    this.groupName = groupName;

    this.excludes = {};
    /**
     * @name Group#now
     * @namespace The now namespace for this particular group. Actions
     * to this namespace affect all users that are members of the
     * group. All functions that are called will be called in the
     * context of each individual user in the group.

     * @example everyone.now.prop = 42;
     * @example everyone.now.func = function () {
     *  console.log('hello!');
     * };
     */
    this.now = Proxy.wrap(this);
    //group scope table
    this.scopeTable = new ScopeTable();
  };

  Group.prototype.__proto__ = EventEmitter.prototype;

  /**
   * @name count
   * @function
   * @memberOf Group#

   * @description Used to find the cardinality of the group (how
   * many users it contains).

   * @param {Function} callback Called with a Number corresponding to
   * the group's user count.

   * @example everyone.count(function (ct) {
   *   console.log(ct);
   * });
   */
  Group.prototype.count = function (callback) {
    callback(Object.keys(this.users).length);
  };

  /**
   * @name getUsers
   * @function
   * @memberOf Group#

   * @description Used to retrieve a list of the client IDs
   * corresponding to all users in the group.

   * @param {Function} callback Called with an Array of Strings
   * corresponding to the client IDs of all users in the group.

   * @example everyone.getUsers(function (users) {
   *   for (var i = 0; i < users.length; i++) console.log(users[i]);
   * });

   * @see nowjs#getClient
   */
  Group.prototype.getUsers = function (callback) {
    callback(Object.keys(this.users));
  };

  /**
   * @name connected
   * @function
   * @memberOf Group#
   * @deprecated As of 0.7.0. Use nowjs:connect instead.
   */
  Group.prototype.connected = function (callback) {
    nowjs.on('connect', callback);
  };

  /**
   * @name disconnected
   * @function
   * @memberOf Group#
   * @deprecated As of 0.7.0. Use nowjs:disconnect instead.
   */
  Group.prototype.disconnected = function (callback) {
    nowjs.on('disconnect', callback);
  };

  /**
   * @name addUser
   * @function
   * @memberOf Group#
   * @description Adds the user identified by clientId to this group.

   * @param {String} clientId The client ID associated with the target
   * user.

   * @example everyone.addUser('1234567890');
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

        if (self.isSuperGroup || !nowUtil.isEmptyObj(toSend)) {
          this.socket.emit('rv', toSend);
        }
        var user = nowUtil.clone(this, {'_events': self._events});

        /**
         * @name Group#join
         * @event
         * @description Called in the context of a user who has just been
         * added to the group.

         * @example everyone.on('join', function () {
         *   otherGroup.addUser(this.user.clientId);
         * });
         */
        self.emit.apply(user, ['join']);
      });
    });
  };

  /**
   * @name removeUser
   * @function
   * @memberOf Group#
   * @version 0.7.0
   * @description Removes the user identified by clientId from this group.

   * @param {String} clientId The client ID associated with the target
   * user.

   * @example otherGroup.removeUser('1234567890');
   */
  Group.prototype.removeUser = function (clientId) {
    var self = this;
    this.hasClient(clientId, function (hasClient) {
      if (!hasClient) {
        return;
      }
      var user = nowUtil.clone(self.users[clientId], {'_events': self._events});

      /**
       * @name Group#leave
       * @event
       * @version 0.7.0
       * @description Called in the context of a user who has just been
       * removed from the group.

       * @example otherGroup.on('leave', function () {
       *   // Store the context, i.e. the user who has just left.
       *   var self = this;
       *   // Check that the user is still connected to the server.
       *   everyone.hasClient(this.user.clientId, function (bool) {
       *     if (bool) {
       *       // Send parting words to the client.
       *       this.now.receive('SERVER', 'Goodbye. I'll miss you dearly.');
       *     }
       *   });
       * });
       */
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
   * @memberOf Group#
   * @function
   * @name exclude
   * @version 0.7.0

   * @description Returns a new Group that is identical to the calling
   * group, except with the specified clients excluded. The returned
   * group automatically updates to accommodate any changes made to
   * its parent group.

   * @param {Array} clientIds A list of client IDs corresponding to
   * clients to exclude.

   * @example everyone.now.distribute = function (msg) {
   *   everyone.exclude([this.user.clientId]).now.receive(this.now.name, msg);
   * };
   * @example factionOne.now.distribute = function (msg) {
   *   factionTwo.getUsers(function (users) {
   *     factionOne.exclude(users).now.receive(this.user.clientId, msg);
   *   });
   * };

   * @type Group
   */
  Group.prototype.exclude = function (clientIds) {
    var excludes = {};
    if(typeof clientIds === 'string') {
      excludes[clientIds] = true;
    } else {
      for (var i = 0; i < clientIds.length; i++) {
        excludes[clientIds[i]] = true;
      }
    }
    var group = nowUtil.clone(this, {excludes: nowUtil.clone(this.excludes, excludes)});
    group.now = Proxy.wrap(group);
    return group;
  };

  /**
   * @memberOf Group#
   * @function
   * @name hasClient

   * @description Used to determine a given user's membership in the
   * group.

   * @param {String} clientId The client ID associated with the target
   * user.

   * @param {Function} callback Called with a Boolean indicating the
   * user's membership in the group.

   * @example group.hasClient('1234567890', function (bool) {
   *   if (bool) {
   *     console.log('User is a member of `group`.');
   *   }
   * });
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

/**
 * @name Group#connect
 * @event
 * @deprecated As of 0.7.0. Use nowjs#connect instead.
 * @description Called in the context of a user when the server
 * first receives a message from the given user.
 */

/**
 * @name Group#disconnect
 * @event
 * @deprecated As of 0.7.0. Use nowjs#disconnect instead.
 * @description Called in the context of a user who has just
 * disconnected from the server.
 */
