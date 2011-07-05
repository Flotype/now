var nowUtil = require('./nowUtil').nowUtil;

exports.init = function (now) {
  return {
    multicall: function () {
      now.emit('multicall', this, arguments);
    },

    remotecall: function () {
      // Coerce arguments to an array.
      var args = Array.prototype.slice.call(arguments);
      // Find functions in the args, and store functions in
      // closure table and serialize functions.
      var closureId;
      for (var i = 0, ii = args.length; i < ii; i++) {
        if (typeof args[i] === 'function') {
          closureId = 'closure_' + args[i].name + '_' + nowUtil.generateRandomString();
          now.closures[closureId] = args[i];
          args[i] = {closure: closureId};
          setTimeout(function () {
            now.closures[closureId] = nowUtil.noop;
          }, now.options.closureTimeout);
        }
      }
      // On the next tick, send the remoteCall request
      this.socket.emit('rfc', {fqn: this.fqn, args: args});
    }
  };
};
