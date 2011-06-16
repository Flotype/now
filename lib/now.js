var Now = function (io) {
  this.io = io;
  this.groups = {};
  this.users = io.store.clientsMap;
};

Now.prototype.getClient = function (id, callback) {
  callback(users[id]);
};

Now.prototype.getGroup = function (name, callback) {
  callback(groups[name]);
};

exports.Now = Now;