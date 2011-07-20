var io = require('socket.io');
var fileServer = require('./fileServer');
var EventEmitter = require('events').EventEmitter;
var nowUtil = require('./nowUtil').nowUtil;

/**
 * @constructor
 * The object returned by require('now').
 */
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
    this.emit('newgroup', this.groups[name]);
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

 * @param {Object} [options={
  "clientWrite" : true,
  "autoHost" : true,
  "host" : undefined,
  "port" : undefined,
  "socketio" : {},
  "closureTimeout : 30000
  "client : {},
  "scope" : "window"
}]

 * @type Group
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
  var self = this;
  fileServer.wrapServer(server, this.options);
  this.server = io.listen(server);
  for (var i in this.options.socketio) {
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