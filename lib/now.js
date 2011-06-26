var io = require('socket.io');
var fileServer = require('./fileServer');
var nowUtil = require('./nowUtil').nowUtil;
var EventEmitter = require('events').EventEmitter;

// We need to work in require('./group') and './client' in order for
// this to actually work.

var Now = function () {
  this.Group = require('./group').initialize(this);
  this.User = require('./user').initialize(this);
  this.closures = {};
  this.groups = {};
  this.users = {};
  this.options = {
    clientWrite: true,
    autoHost: true,
    socketio: {},
    closureTimeout: 30000
  };
};


Now.prototype.__proto__ = EventEmitter.prototype;

Now.prototype.getClient = function (id, callback) {
  callback.apply(this.users[id]);
};

Now.prototype.getGroup = function (name) {
  if (!nowUtil.hasProperty(this.groups, name)) {
    this.groups[name] = new this.Group(name);
  }
  return this.groups[name];
};

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
  return everyone;
};

exports.Now = Now;
