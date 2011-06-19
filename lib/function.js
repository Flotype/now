var nowUtil = require('./nowUtil').nowUtil;

exports.init = function (nowjs) {
  return {
    multicall: function () {
      for (var i = 0, k = Object.keys(this.users), l = k.length; i < l; i++) {
        var user = this.users[k[i]];
        var func = user.get(this.fqn);
        user = nowUtil.clone(user);
        user.fqn = this.fqn;

        // Call the function with this.now and this.user
        if (typeof func === 'function') {
          func.apply(user, arguments);
        } else {
          // err
        }
      }
    },

    remotecall: function () {
      // Create a copy of the arguments
      arguments.__proto__ = nowUtil.arrayProto;

      // Find functions in the arguments, and store functions in
      // closure table and serialize functions.
      for (var i = 0, ii = arguments.length; i < ii; i++) {
        if (typeof arguments[i] === 'function') {
          var closureId = 'closure_' + arguments[i].name + '_' +
            nowUtil.generateRandombString();
          nowjs.closures[closureId] = arguments[i];
          arguments[i] = {closure: closureId};
          setTimeout(function() {
            nowjs.closures[closureId] = nowUtil.noop;
          }, 30000);
        }
      }
      // On the next tick, send the remoteCall request
      this.socket.emit('rfc', {fqn: this.fqn, args: arguments});
    }
  };
};
