var nowUtil = require('./nowUtil').nowUtil;

exports.init = function (nowjs) {
  return {
    multicall: function () {
      var args = [];
      for (var i = 0, ii = arguments.length; i < ii; i++) {
        args[i] = arguments[i];
      }
      nowjs.emit('multicall', this, args);
    },

    remotecall: function () {
      // Coerce arguments to an array.
      var args = [];
      for (var i = 0, ii = arguments.length; i < ii; i++) {
        args[i] = arguments[i];
      }
      // Find functions in the args, and store functions in
      // closure table and serialize functions.
      var closureId;
      for (i = 0, ii = args.length; i < ii; i++) {
        if (typeof args[i] === 'function') {
          closureId = 'closure_' + args[i].name + '_' + nowUtil.generateRandomString();
          nowjs.closures[closureId] = args[i];
          args[i] = {fqn: closureId};
          setTimeout(function () {
            nowjs.closures[closureId] = nowUtil.noop;
          }, nowjs.options.closureTimeout);
        }
      }
      // On the next tick, send the remoteCall request
      this.socket.emit('rfc', {fqn: this.fqn, args: args});
    }
  };
};
