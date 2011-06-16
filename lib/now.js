var io = require('socket.io');
var fileServer = require('fileServer');

var Now = function () {
  this.groups = {};
};

Now.prototype.getClient = function (id, callback) {
  callback.apply({}, users[id].user);
};

Now.prototype.getGroup = function (name) {
  if (!nowUtil.hasProperty(groups, name)) {
    groups[name] = new Group(name);
  }
  return groups[name];
};

Now.prototype.initialize = function (server, options) {
  var self = this;
  this.server = io.listen(server, options.socket);
  
  server.sockets.on('connection', function (socket) {
    var user = new User(socket);
    socket.user = user;
    self.getGroup('everyone').addUser(user);
    // TODO: Figure out how to do createScope
  });
  
  this.users = io.store.clientsMap;
  fileServer.wrapServer(server, options);
  return this.getGroup('everyone');
};