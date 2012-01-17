var io = require('socket.io');
var fileServer = require('./fileServer');
var EventEmitter = require('events').EventEmitter;
var nowUtil = require('./nowUtil').nowUtil;

/**
 * @name nowjs
 * @constructor
 * @description The object returned by require('now').
 */
var Now = function () {
  this.closures = {};
  this.groups = {};
  this.users = {};
  this.sessions = {};
  this.options = {
    clientWrite: true,
    autoHost: true,
    socketio: {"log level" : 1},
    client: {},
    scope: 'window',
    cookieKey: 'connect.sid',
    closureTimeout: 30000,
    debug: false
  };
};

Now.prototype.__proto__ = EventEmitter.prototype;

Now.prototype._readConfigFile = function (path) {
  path = path || process.cwd() + "/nowjs.json";
  try {
    var conf = require('fs').readFileSync(path), parsedConf;
    try {
      parsedConf = JSON.parse(conf);
    } catch (e) {
      //throw new logging.NowError("Malformed configuration file.");
      //throw e;
    }
    return parsedConf;
  } catch (err) {
    //throw e;
    //logging.log("No configuration file found");
    return undefined;
  }
};

/**
 * @memberOf nowjs#
 * @function
 * @name getClient

 * @description Retrieves a user from the given client ID and executes
 * of several actions in the context of that user.

 * @param {String} id The client ID associated with the target user.
 * @param {Function} callback Takes no arguments. Called in the
 * context of the user corresponding to the given id.
 * @example nowjs.getClient('1234567890' function () {
 *   this.now.receiveMessage('SERVER', 'Anything is possible with NowJS.');
 * });
 */
Now.prototype.getClient = function (id, callback) {
  callback.apply(this.users[id]);
};

/**
 * @memberOf nowjs#
 * @function
 * @name getGroups

 * @description Retrieves a list (represented in Javascript as an
 * array) of all groups that have been created and passes it in to the
 * supplied callback.

 * @param {Function} callback Takes one argument, an array of all
 * groups that have been created.

 * @example nowjs.on('connect', function () {
 *   var self = this;
 *   nowjs.getGroups(function (groups) {
 *     nowjs.getGroup(groups[Math.floor(groups.length * Math.random())]).addUser(self);
 *   });
 * });
 */
Now.prototype.getGroups = function (callback) {
  callback(Object.keys(this.groups));
};

/**
 * @memberOf nowjs#
 * @function
 * @name getGroup
 * @description Retrieves and returns a group from its name, creating it if
 * necessary.
 * @param {String} name The name of the group to be retrieved.
 * @type Group
 * @example var new_group = nowjs.getGroup('a new group');
 */
Now.prototype.getGroup = function (name) {
  if (!nowUtil.hasProperty(this.groups, name)) {
    this.groups[name] = new this.Group(name);
    /**
     * @name nowjs#newgroup
     * @event
     * @param {Group} group The group created by {@link nowjs#getGroup}.
     * @description Called when a new group is created.
     * @example nowjs.on('newgroup', function (group) {
     *   console.log('You have successfully created the group `' + group.groupName + '`');
     * });
     */

    this.emit('newgroup', this.groups[name]);
  }
  return this.groups[name];
};

/**
 * @memberOf nowjs#
 * @function
 * @name removeGroup
 * @description Removes all traces of a group.
 * @param {String} name The name of the group to be retrieved.
 * @type Group
 * @example var new_group = nowjs.getGroup('a new group');
 */
Now.prototype.removeGroup = function (name) {
  /**
   * @name nowjs#removegroup
   * @event
   * @param {Group} group The group removed by {@link nowjs#getGroup}.
   * @description Called when a group is removed.
   * @example nowjs.on('removegroup', function (group) {
   *   console.log('Group `' + group.groupName + '` eliminated from existence.');
   * });
   */
  this.emit('removegroup', name);
};


/**
 * @static
 * @memberOf nowjs
 * @function
 * @name initialize

 * @description Returns a reference to the `everyone` object. The
 * options object, if supplied, will be automatically merged with the
 * default values.

 * @param {httpServer} server A Node.js http server (such as the one
 * available in the http module or a module like Express) on which to
 * run Now.

 * @param {Object} [options={"clientWrite" : true, "autoHost" : true,
  "host" : undefined, "port" : undefined, "socketio" : {},
  "closureTimeout : 30000, "client : {},  "scope" : "window"}]

 * @type Group

 * @example nowjs.initialize(server, {clientWrite: false, socketio: {'log level': 2});
 */
Now.prototype.initialize = function (server, options) {
  // Merge options
  if (typeof options === 'object') {
    nowUtil.extend(this.options, options);
  } else {
    options = this._readConfigFile(options);
    if (options) {
      nowUtil.extend(this.options, options);
    }
  }

  this.Group = require('./group').initialize(this);
  this.User = require('./user').initialize(this);
  this.Handlers = require('./handlers').initialize(this);
  this.Support = require('./support').initialize(this);

  var self = this;

  fileServer.wrapServer(server, this.options);
  this.server = io.listen(server, this.options.socketio);

  // Need this to be separate from clientsMap.
  this.server.sockets.on('connection', function (socket) {
    var user = new self.User(socket);
    socket.user = self.users[socket.id] = user;
    self.getGroup('everyone').addUser(socket.id);
    socket.emit('rd');
  });

  var everyone = this.getGroup('everyone');
  everyone.isSuperGroup = true;

  // Shim for backwards compatibility.
  this.on('connect', function () {
    var user = nowUtil.clone(this);
    user._events = everyone._events;
    everyone.emit.apply(user, ['connect']);
  });

  this.on('disconnect', function () {
    var user = nowUtil.clone(this);
    user._events = everyone._events;
    everyone.emit.apply(user, ['disconnect']);
  });

  // Detect connect and add session middleware as necessary
  //   Use `in` so we look up the prototype chain
  if('use' in server && 'stack' in server && 'route' in server) {
    server.use(function(req, res, next) {
      self.sessions[req.sessionID] = req.session;
      next();
    });
  }

  return everyone;
};

Now.prototype.addSupportServer = function(host, port){
  var server = new this.Support(host, port);
  return server;
}

exports.Now = Now;

/**
 * @name nowjs#connect
 * @event
 * @version 0.7.0

 * @description Called in the context of a user when the server first
 * receives a message from the given user.

 * @example nowjs.on('connect', function () {
 *   this.now.receiveMessage('SERVER', 'Welcome to NowJS.');
 * });
 */

/**
 * @name nowjs#disconnect
 * @event
 * @version 0.7.0

 * @description Called in the context of a user who has just
 * disconnected from the server.

 * @example nowjs.on('disconnect, function () {
 *   delete myArray[this.user.clientId];
 * });
 */

/**
 * @name nowjs#groupdel
 * @event
 * @version 0.7.0

 * @param {Group} group Actually not quite a group; this parameter
 * refers to a clone of the group in question that also carries the
 * fully qualified name (fqn) of the variable to delete. Access the
 * fqn via `group.fqn`.

 * @description Called when deleting a variable from all members of
 * the group specified by this function's argument.

 * @example nowjs.on('groupdel', function (group) {
 *   if (group.groupName === 'everyone') {
 *     console.log('Everyone now no longer possesses ' + group.fqn);
 *   }
 * });
 */

/**
 * @name nowjs#grouprv
 * @event
 * @version 0.7.0

 * @param {Group} group Similar to {@link nowjs#groupdel}, this is also
 * a clone of the actual group. In addition to the fully qualified
 * name, this clone also possesses a serialized form of its target
 * value, accessible via `group.val`.

 * @description Called when replacing the value of a variable for all
 * members of the group specified by this function's argument.

 * @example nowjs.on('grouprv', function (group) {
 *   if (group.groupName === 'everyone') {
 *     console.log('Everyone now sees ' + group.fqn + ' as ' + group.val);
 *   }
 * });
 */

