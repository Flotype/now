var nowUtil = require('./nowUtil.js').nowUtil;
var Proxy = require('./proxy');
var ScopeTable = require('./scopeTable').ScopeTable;

exports.initialize = function (nowjs) {
  var fn = require('./function').init(nowjs);

  /**
   * @name User

   * @class Represents an individual user connected to the now
   * server. Exposed as the context in which group.now functions are
   * called, as well as the context in which the callback to
   * nowjs.getClient is executed. Each user has the {@link User#now}
   * and {@link User#user} namespaces.
   * @see Group#addUser
   * @see Group#removeUser
   * @see nowjs#getClient

   * @property {Socket} socket The user's Socket.IO socket.
   */
  var User = function (socket) {
    var self = this;
    // Set socket and the approprate handlers

    this.socket = socket;

    // groups that the user is in.
    /**
     * @private
     */
    this.groups = {};

    // the user's ScopeTable
    /**
     * @private
     */
    this.scopeTable = new ScopeTable();

    /**
     * @name User#user
     * @namespace Contains properties unique to each user. Can be used
     * to store information that should not be exposed to the
     * connected user.
     * @see User

     * @property {String} clientId The user's ID, as created by
     * Socket.IO.
     * @property {String} cookie The user's cookie, as determined by
     * Socket.IO.
     */
    this.user = { clientId: socket.id, cookie: nowUtil.parseCookie(socket.handshake.headers.cookie) };

    // set to true upon first replaceVar and emit connect event
    /**
     * @private
     */
    this.ready = false;

    /**
     * @name User#now
     * @namespace Synchronized with the connected user's local now
     * namespace; function calls with respect to this namespace will
     * only be executed for the current user.
     * @see User
     * @see User#user

     * @example everyone.now.prop = 42;
     * @example everyone.now.func = function () {
     *  console.log('hello!');
     * };
     */
    this.now = Proxy.wrap(this);

    // Remote function call handler
    socket.on('rfc', function rfcHandler(data) {
      var theFunction;
      if (data.fqn.split('_')[0] === 'closure') {
        theFunction = nowjs.closures[data.fqn];
      } else {
        theFunction = self.get(data.fqn);
      }
      var args = data.args;
      // Convert any remote function stubs into remote functions
      var user;
      for (var i = 0, ll = args.length; i < ll; i++) {
        if (nowUtil.hasProperty(args[i], 'fqn')) {
          user = nowUtil.clone(self, {fqn: args[i].fqn});
          args[i] = fn.remotecall.bind(user);
        }
      }
      theFunction.apply(self, args);
    });

    // Replace var handler
    if (nowjs.options.clientWrite) {
      socket.on('rv', function rvHandler(data) {
        var keys = Object.keys(data);
        var everyone = nowjs.getGroup('everyone');
        var fqn, user, value;
        for (var i = 0, ll = keys.length; i < ll ; i++) {
          fqn = keys[i];
          value = data[fqn];
          user = nowUtil.clone(self);
          user.fqn = fqn;
          if (nowUtil.hasProperty(value, 'fqn')) {
            value = fn.remotecall.bind(user);
          }
          // Set directly in scope table to avoid extra processing and
          // socket firing.
          self.scopeTable.set(fqn, (value && typeof value === 'object') ? [] : value);
          if (typeof value === 'function' &&
              everyone.scopeTable.get(fqn) === undefined) {
            everyone.scopeTable.set(fqn, nowUtil.noop);
          }
          if (Array.isArray(value)) {
            self.scopeTable.flagAsArray(fqn, 0);
          }
        }
      });

      // Called after initial scope sent. Ready handler
      socket.on('rd', function rdHandler() {
        var user = nowUtil.clone(self, {'_events': nowjs._events});
        nowjs.emit.call(user, 'connect');
      });

      // Variable deletion handler
      socket.on('del', function rfcHandler(data) {
        // Takes an array of fqns to delete.
        // Note: Does not handle deleting something that's a group
        // property (would need to override somehow).
        for (var i = 0; i < data.length; i++) {
          // delete straight from scopeTable to bypass emitting 'del'.
          self.scopeTable.deleteVar(data[i]);
        }
      });
    }

    socket.on('disconnect', function () {
      var user = nowUtil.clone(self, {'_events': nowjs._events});

      // trigger 'disconnect' in all groups.
      for (var g = Object.keys(self.groups), ll = g.length; ll--;) {
        self.groups[g[ll]].removeUser(self.user.clientId);
      }
      nowjs.emit.call(user, 'disconnect');

      delete nowjs.users[self.user.clientId];
    });
  };

  /**
   * @memberOf User#
   * @function
   * @name getGroups

   * @description Used to retrieve a list of the group names
   * corresponding to all groups the user is in.

   * @param {Function} callback Called with an Array of Strings
   * corresponding to the various group names.

   * @example everyone.now.broadcast = function (message) {
   * var name = this.now.name;
   * this.getGroups(function (groups) {
   *   for (var i = groups.length; i--;) {
   *     if (groups[i] !== 'everyone') {
   *       nowjs.getGroup(groups[i]).now.receive(name, message);
   *     }
   *   }
   * });
   */
  User.prototype.getGroups = function (callback) {
    callback(Object.keys(this.groups));
  };

  /** @private */
  User.prototype.get = function (fqn) {
    // First look in this user's scopeTable
    var value = this.scopeTable.get(fqn);
    if (value !== undefined) {
      return value;
    } else {
      // Look through all the groups for the value
      var i = 0;
      var keys = Object.keys(this.groups);
      var ll = keys.length;
      while (value === undefined && i < ll) {
        // Look in the scopeTable directly, rather than using Group.get
        // method. This resolves functions to the real functions
        // rather than a multicaller.
        value = this.groups[keys[i++]].scopeTable.get(fqn);
      }
      // If this is a function, bind to the current user
      if (typeof value === 'function') {
        var userClone = nowUtil.clone(this);
        userClone.fqn = fqn;
        value = value.bind(userClone);
      }

      // Cache it in this user's scopeTable for quicker access.
      this.scopeTable[fqn] = value;
      return value;
    }
  };

  /** @private */
  User.prototype.deleteVar = function (fqn) {
    this.scopeTable.deleteVar(fqn);
    this.socket.emit('del', fqn);
  };

  /** @private */
  User.prototype.set = function (fqn, val) {
    var everyone = nowjs.getGroup('everyone');
    if (typeof val === 'function' &&
        everyone.scopeTable.get(fqn) === undefined) {
      everyone.scopeTable.set(fqn, nowUtil.noop);
    }
    if (typeof val === 'object') {
      this.scopeTable.set(fqn, Object.keys(val));
      var flattenedVal = nowUtil.flatten(val, fqn);
      for (var i = 0, key = Object.keys(flattenedVal), ll = key.length; i < ll; i++) {
        this.scopeTable.set(key[i], flattenedVal[key[i]]);
        flattenedVal[key[i]] = nowUtil.getValOrFqn(flattenedVal[key[i]], key[i]);
        if (flattenedVal[key[i]] instanceof Array) {
          this.scopeTable.flagAsArray(key[i], 0);
        }
      }
      this.socket.emit('rv', flattenedVal);
    } else {
      this.scopeTable.set(fqn, val);
      var toSend = {};
      toSend[fqn] = nowUtil.getValOrFqn(val, fqn);
      this.socket.emit('rv', toSend);
    }
  };

  return User;
};
