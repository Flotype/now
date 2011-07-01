var nowUtil = require('./nowUtil').nowUtil;

exports.initialize = function (now) {
    now.on('multicall', function (e) {
      var user, func;
      
      for (var i = 0, k = Object.keys(e.users), l = k.length; i < l; i++) {
      
      console.log("MULTICALLLLLL");
      console.log(e.groupName);
      
        user = e.users[k[i]];
        
        
        if (e.excludes[user.user.clientId]) {
          continue;
        }
        func = user.get(e.fqn);
        user = nowUtil.clone(user);
        user.fqn = e.fqn;        
        
        // Call the function with e.now and e.user
        if (typeof func === 'function') {
          func.apply(user, arguments);
        } else {
          // err
        }
      }    
    });
};