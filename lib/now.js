var io = require('socket.io');
var fileServer = require('./fileServer');
var nowUtil = require('./nowUtil').nowUtil;

// We need to work in require('./group') and './client' in order for
// this to actually work.

var Now = function () {
  this.groups = {};
};

Now.prototype.getClient = function (id, callback) {
  callback.apply({}, users[id].user);
};

Now.prototype.getGroup = function (name) {
  if (!nowUtil.hasProperty(this.groups, name)) {
    this.groups[name] = new Group(name);
  }
  return this.groups[name];
};

Now.prototype.initialize = function (server, options) {
  options = options || {};
  var self = this;
  this.server = io.listen(server, options.socket);

  this.server.sockets.on('connection', function (socket) {
    var user = new User(socket);
    socket.user = user;
    self.getGroup('everyone').addUser(user);
    // TODO: Figure out how to do createScope
  });

  this.users = this.server.store.clientsMap;
  fileServer.wrapServer(server, options);
  return this.getGroup('everyone');
};

exports.Now = Now;
