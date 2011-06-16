var io = require('socket.io');
var Group = require('./Group');
var User = require('./User');

exports.initialize = function (server, options) {
  return new Now(io.listen(server, options.socket));
};