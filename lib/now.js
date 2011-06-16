var io = require('socket.io');
var fileServer = require('fileServer');

var Now = function () {
  this.groups = {};
};

Now.prototype.getClient = function (id, callback) {
  callback.apply(users[id].user);
};

Now.prototype.getGroup = function (name) {
  if (!nowUtil.hasProperty(groups, name)) {
    groups[name] = new Group(name);
  }
  return groups[name];
};

Now.prototype.initialize = function (server, options) {
  this.server = io.listen(server, options.socket);
  this.users = io.store.clientsMap;
  fileServer.wrapServer(server, options);
  return this.getGroup('everyone');
};