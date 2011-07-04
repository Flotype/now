var nowUtil = require('./nowUtil').nowUtil;

exports.initialize = function (now) {
  now.on('multicall', function (e) {
    var user, func;
    
    for (var i = 0, k = Object.keys(e.users), l = k.length; i < l; i++) {
     
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
  
  now.on('rv', function(e) {
  
    var exclusive = false;
    for (var j in e.excludes) {
      exclusive = true;
      break;
    }
    var users = Object.keys(e.users);
    var i = 0, ll = users.length;
    var toSend = {},
        flattenedVal = {},
        fqns,
        user;

        // Setup: generate flattenedVal and toSend.
        if (e.val && typeof e.val === 'object') {
          flattenedVal = nowUtil.flatten(e.val, e.fqn);
          fqns = Object.keys(flattenedVal);
          // Iterate through all leaves.
          for (i = 0, ll = fqns.length; i < ll; i++) {
            toSend[fqns[i]] = nowUtil.getValOrFqn(fqns[i]);
          }
        } else {
          // e.val is not an object.
          fqns = [e.fqn];
          toSend[e.fqn] = nowUtil.getValOrFqn(e.val, e.fqn);
          flattenedVal[e.fqn] = e.val;
        }

    var ff = fqns.length;
    if (exclusive) {
      for (i = 0, ll = users.length; i < ll; i++) {
        user = e.users[users[i]];
        if (e.excludes[user.user.clientId]) {
          continue;
        }
        // Clear the user's scopeTable entry before setting the new
        // value.
        user.scopeTable.deleteVar(e.fqn);
        user.socket.emit('rv', toSend);

        for (var k = 0; k < ff; k++) {
          // Set values for individual users.
          user.scopeTable.set(fqns[k], flattenedVal[fqns[k]]);
        }
      }
    } else {
      // Not an exclusive group.
      e.scopeTable.deleteVar(e.fqn);
      for (var k = 0; k < ff; k++) {
        // Set values for the group.
        e.scopeTable.set(fqns[k], flattenedVal[fqns[k]]);
      }

      // Invalidate the value in the group's users' scopeTables
      for (i = 0, ll = users.length; i < ll; i++) {
        user = e.users[users[i]];
        user.scopeTable.deleteVar(e.fqn);
        user.socket.emit('rv', toSend);
      }
    }

    // Do not do any additional processing if e is an exclusive group.
    if (exclusive) return;

    // If e is `everyone`, invalidate the values in the lesser groups
    if (e.isSuperGroup) {
      var groups = Object.keys(now.groups);
      for (i = 1, ll = groups.length; i < ll; i++) {
        // everyone is guaranteed to be the first group in keys.
        var group = now.groups[groups[i]];
        group.scopeTable.deleteVar(e.fqn);
      }
    }
  });
  
  
};