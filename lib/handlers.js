var nowUtil = require('./nowUtil').nowUtil;

exports.initialize = function (nowjs) {
  function multicall(group, fqn, args) {
    var user, func;
    for (var i = 0, k = Object.keys(group.users), l = k.length; i < l; i++) {

      user = group.users[k[i]];
      if (group.excludes[user.user.clientId]) {
        continue;
      }
      func = user.get(fqn);
      user = nowUtil.clone(user, {fqn: fqn});

      // Call the function with group.now and group.user
      if (typeof func === 'function') {
        func.apply(user, args);
      } else {
        // err
      }
    }
  }

  function replaceVar(group, fqn, val) {
    var exclusive = false;
    for (var j in group.excludes) {
      exclusive = true;
      break;
    }
    var users = Object.keys(group.users);
    var i = 0, ll = users.length;
    var toSend = {},
    flattenedVal = {},
    fqns,
    user;

    // Setup: generate flattenedVal and toSend.
    if (val && typeof val === 'object') {
      flattenedVal = nowUtil.flatten(val, fqn);
      fqns = Object.keys(flattenedVal);
      // Iterate through all leaves.
      for (i = 0, ll = fqns.length; i < ll; i++) {
        toSend[fqns[i]] = nowUtil.getValOrFqn(fqns[i]);
      }      
    } else {
      // val is not an object.
      fqns = [fqn];
      toSend[fqn] = nowUtil.getValOrFqn(val, fqn);
      flattenedVal[fqn] = val;
    }

    var ff = fqns.length, k;
    if (exclusive) {
      for (i = 0, ll = users.length; i < ll; i++) {
        user = group.users[users[i]];
        if (group.excludes[user.user.clientId]) {
          continue;
        }
        // Clear the user's scopeTable entry before setting the new
        // value.
        user.scopeTable.deleteVar(fqn);
        user.socket.emit('rv', toSend);

        if (ff === 0) {
          group.scopeTable.set(fqn, []);
        }
        
        for (k = 0; k < ff; k++) {
          // Set values for individual users.
          user.scopeTable.set(fqns[k], flattenedVal[fqns[k]]);
        }
      }
      return;
    } else {
      // Not an exclusive group.
      group.scopeTable.deleteVar(fqn);
      for (k = 0; k < ff; k++) {
        // Set values for the group.
        group.scopeTable.set(fqns[k], flattenedVal[fqns[k]]);
      }
      if (ff === 0) {
        group.scopeTable.set(fqn, []);
        toSend[fqn] = {};
      }
      // Invalidate the value in the group's users' scopeTables
      for (i = 0, ll = users.length; i < ll; i++) {
        user = group.users[users[i]];
        user.scopeTable.deleteVar(fqn);
        user.socket.emit('rv', toSend);
      }
    }

    // If e is `everyone`, invalidate the values in the lesser groups
    if (group.isSuperGroup) {
      var groups = Object.keys(nowjs.groups);
      if (groups[0] === 'everyone') {
        for (i = 1, ll = groups.length; i < ll; i++) {
          // everyone is guaranteed to be the first group in keys.
          group = nowjs.groups[groups[i]];
          group.scopeTable.deleteVar(fqn);
        }
      } else {
        // stupid people, using numbers as group names...
        for (i = 0, ll = groups.length; i < ll; i++) {
          if (groups[i] !== 'everyone') {
            group = nowjs.groups[groups[i]];
            group.scopeTable.deleteVar(fqn);
          }
        }
      }
    }
  }

  function deleteVar(group, fqn) {
    var keys = Object.keys(group.users);
    var user;
    for (var i = 0, ll = keys.length; i < ll; i++) {
      user = group.users[keys[i]];
      // Only send to users who haven't overwritten the value at the
      // provided fqn.
      if (user.scopeTable[fqn] === undefined) {
        user.socket.emit('del', fqn);
      }
    }
    group.scopeTable.deleteVar(fqn);
  }


  nowjs.on('multicall', function (e, args) {
    multicall(e, e.fqn, args);
  });

  nowjs.on('grouprv', function (e) {
    replaceVar(e, e.fqn, e.val);
  });

  nowjs.on('groupdel', function (e) {
    deleteVar(e, e.fqn);
  });
};