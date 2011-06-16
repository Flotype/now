var nowUtil = require('./nowUtil').nowUtil;

exports.init = function(nowjs) {
  return {
    multicall: function(){
      for (var i = 0, k = Object.keys(this.users), l = k.length; i < l; i++){
        var user = this.users[k[i]];
        var func = user.get(this.fqn);
        user = nowUtil.clone(user);
        user.fqn = this.fqn;

        // Call the function with this.now and this.user
        if(typeof func === 'function') {
          func.apply(user, arguments);
        } else {
          // err
        }
      }
    },

    remotecall: function(){
      // Create a copy of the arguments
      var args = Array.prototype.slice.call(arguments);

      // Find functions in the arguments, and store functions in closure table and serialize functions
      for(var i = 0, ii = args.length; i < ii; i++){
        if(typeof args[i] === 'function'){
          var closureId = 'closure_' + args[i].name + '_' + nowUtil.generateRandomString();
          nowjs.closures[closureId] = args[i];
          args[i] = {closure: closureId};
          setTimeout(function(){
            nowjs.closures[closureId] = nowUtil.noop;
          }, 30000);
        }
      }
      // On the next tick, send the remoteCall request
      this.socket.emit('rfc', {fqn: this.fqn, args: args});
    }
  };
};
