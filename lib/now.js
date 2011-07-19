var io = require('socket.io');
var fileServer = require('./fileServer');
var nowUtil = require('./nowUtil').nowUtil;
var EventEmitter = require('events').EventEmitter;

var Now = function () {
  this.Group = require('./group').initialize(this);
  this.User = require('./user').initialize(this);
  this.Handlers = require('./handlers').initialize(this);
  this.closures = {};
  this.groups = {};
  this.users = {};
  this.options = {
    clientWrite: true,
    autoHost: true,
    socketio: {},
    client: {},
    scope: 'window',
    closureTimeout: 30000
  };
};

Now.prototype.__proto__ = EventEmitter.prototype;

/**
 * Retrieves a user from the given client ID and executes of several
 * actions in the context of that user.

 * @param {String} id The client ID associated with the target user.

 * @param {Function} callback Takes no arguments. Called in the
 * context of the user corresponding to id.
 */
Now.prototype.getClient = function (id, callback) {
  callback.apply(this.users[id]);
};

/**
 * Retrieves and returns a group from its name, creating it if
 * necessary.

 * @param {String} name The name of the group to be retrieved.

 * @type Group
 */
Now.prototype.getGroup = function (name) {
  if (!nowUtil.hasProperty(this.groups, name)) {
    this.groups[name] = new this.Group(name);
  }
  return this.groups[name];
};

/**
 * Returns a reference to the `everyone` object. The options object,
 * if supplied, will be automatically merged with the default values.

 * @static

 * @param {httpServer} server A Node.js http server (such as the one
 * available in the http module or a module like Express) on which to
 * run Now.

 * @param {Object} options = {
     "clientWrite" : true,   // Enable syncing of changes to variables that originate from the client (browser)
     "autoHost" : true,      // This flag enables NowJS to serve the client-side libraries using the provided httpServer
     "host" : undefined,     // Overrides the autodetected host information when autoHost is enabled. You may need to set this if the server behind a reverse proxy or other complex network setup.
     "port" : undefined,     // Overrides the autodetected port information when autoHost is enabled

     "socketio" : {},        // This is the options object passed into io.listen(port, options)
     "closureTimeout : 30000 // This specifies how long before references to callbacks expire.
     "client : {},           // This specifies which options are available by default in the client-side library.
     "scope" : "window"      // A string representing the default scope in which the now namespace will be established.
                             // Do note that the object that this points to should already exist by the time now.js is loaded.
   }

 * @type {Group}
 */
Now.prototype.initialize = function (server, options) {
  for (var i in options) {
    this.options[i] = options[i];
  }
  var self = this;
  fileServer.wrapServer(server, this.options);
  this.server = io.listen(server);
  for (i in this.options.socketio) {
    this.server.set(i, this.options.socketio[i]);
  }

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

  return everyone;
};

exports.Now = Now;