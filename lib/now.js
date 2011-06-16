var Now = function (io) {
  this.io = io;
  this.groups = {};
  this.users = io.store.clientsMap;
};

Now.prototype.getClient = function (id, callback) {
  callback.apply(users[id].user);
};

Now.prototype.getGroup = function (name, callback) {
  callback.apply(groups[name]);
};

exports.Now = Now;