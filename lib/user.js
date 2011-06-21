var nowUtil = require('./nowUtil.js').nowUtil;
var Proxy = require('./proxy');
var ScopeTable = require('./scopeTable').ScopeTable;

exports.initialize = function (now) {
  var fn = require('./function').init(now);
  var User = function (socket) {
    var self = this;
    // Set socket and the approprate handlers
    this.socket = socket;

    // Remote function call handler
    socket.on('rfc', function rfcHandler(data) {
      var theFunction = self.get(data.fqn);
      var args = data.args;
      // Convert any remote function stubs into remote functions
      for (var i = 0, ll = args.length; i < ll; i++) {
        if (nowUtil.hasProperty(args[i], 'fqn')) {
          var user = nowUtil.clone(self);
          user.fqn = args[i].fqn;
          args[i] = fn.remotecall.bind(user);
        }
      }
      theFunction.apply(self, args);
    });

    // Replace var handler
    socket.on('rv', function rvHandler(data) {
      var keys = Object.keys(data);
      var everyone = now.getGroup('everyone');
      var fqn, user, value;
      for (var i = 0, ll = keys.length; i < ll ; i++) {
        fqn = keys[i];
        value = data[fqn];
        user = nowUtil.clone(self);
        user.fqn = fqn;
        if (nowUtil.hasProperty(value, 'fqn')) {
          value = fn.remotecall.bind(user);
        }
        // Set directly in scope table to avoid extra processing and socket firing
	      self.scopeTable.set(fqn, value);
        if (typeof value === 'function' &&
            everyone.scopeTable.get(fqn) === undefined) {
          everyone.scopeTable.set(fqn, nowUtil.noop);
        }
      }
    });

    //groups that the user is in.
    this.groups = [];

    //the user's ScopeTable
    this.scopeTable = new ScopeTable();

    //reference for this.user
    this.user = { clientId: socket.id };

    this.now = Proxy.wrap(this);
  };

  User.prototype.get = function (fqn) {
    // First look in this user's scopeTable
    var value = this.scopeTable.get(fqn);
    if (value !== undefined) {
      return value;
    } else {
      // Look through all the groups for the value
      var i = 0;
      var keys = Object.keys(this.groups);
      var ll = keys.length;
      while (value === undefined && i < ll) {
        // Look in the scopeTable directly, rather than using Group.get
        // method. This resolves functions to the real functions
        // rather than a multicaller.
	      value = this.groups[keys[i++]].scopeTable.get(fqn);
      }
      // If this is a function, bind to the current user
      if (typeof value === 'function') {
	      var userClone = nowUtil.clone(this);
	      userClone.fqn = fqn;
	      value = value.bind(userClone);
      }

      // Cache it in this user's scopeTable for quicker access.
      this.scopeTable[fqn] = value;

      return value;
    }
  };

  User.prototype.set = function (fqn, val) {
    var everyone = now.getGroup('everyone');
    if (typeof val === 'function' && everyone.scopeTable.get(fqn) === undefined) {
      everyone.scopeTable.set(fqn, nowUtil.noop);
    } 
    if (typeof val === 'object') {
      this.scopeTable.set(fqn, Object.keys(fqn));
      var flattenedVal = nowUtil.flatten(val, fqn);
      for (var i = 0, key = Object.keys(flattenedVal), ll = key.length; i < ll; i++) {
	      fqn = key[i];
	      var m = flattenedVal[fqn];
	      this.scopeTable.set(fqn, m);
      }
      this.socket.emit('rv', flattenedVal);
    } else {
      this.scopeTable.set(fqn, val);
      var toSend = {};
      toSend[fqn] = nowUtil.getValOrFqn(val);
      this.socket.emit('rv', toSend);
    }
  };

  return User;
};
