var io = require('socket.io');
var fileServer = require('./fileServer');
var nowUtil = require('./nowUtil').nowUtil;

// We need to work in require('./group') and './client' in order for
// this to actually work.

var Now = function () {
  this.Group = require('./group').initialize(this);
  this.User = require('./user').initialize(this);
  this.groups = {};
};

Now.prototype.getClient = function (id, callback) {
  callback.apply(this.users[id].user);
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
  this.users = this.server.store.clientsMap;
  this.server.sockets.on('connection', function (socket) {
    var user = new self.User(socket);
    self.users[socket.id].user = user;
    self.getGroup('everyone').addUser(socket.id);
    // TODO: Figure out how to do createScope
  });

  return this.getGroup('everyone');
};

exports.Now = Now;
