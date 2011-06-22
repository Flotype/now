var io = require('socket.io');
var fileServer = require('./fileServer');
var nowUtil = require('./nowUtil').nowUtil;

// We need to work in require('./group') and './client' in order for
// this to actually work.

var Now = function () {
  this.Group = require('./group').initialize(this);
  this.User = require('./user').initialize(this);
  this.closures = {};
  this.groups = {};
  this.users = {};
};

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
  options = options || {autoHost: true};
  var self = this;
  fileServer.wrapServer(server, options);
  this.server = io.listen(server, options.socket);
  // Need this to be separate from clientsMap.
  this.server.sockets.on('connection', function (socket) {
    var user = new self.User(socket);
    self.users[socket.id] = user;
    socket.user = user;
    self.getGroup('everyone').addUser(socket.id);
  });

  for (var i in this.server.store.clientsMap) {
    this.users[i] = this.server.store.clientsMap[i].user;
  }
  return this.getGroup('everyone');
};

exports.Now = Now;
