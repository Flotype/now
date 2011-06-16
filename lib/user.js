var nowUtil = require('./nowUtil.js');
var fn = require('./function');

exports.initialize = function(now) {
  var User = function (socket) {
    var self = this;

    // Set socket and the approprate handlers
    this.socket = socket;
    socket.on('rc', function(data) {
      var theFunction = self.get(data.fqn);
      var args = data.args;
      for(var i = 0, ll = args.length; i < ll; i++){
        if(nowUtil.hasProperty(args[i], 'fqn')){
          args[i] = fn.remotecall.bind({user: self, fqn: args[i].fqn});
        }
      }
      theFunction.apply(null, args);
    });
    socket.on('rv', function(data) {
      var keys = Object.keys(data);
          for(var i = 0, ll = keys.length; i < ll ; i++){
            var fqn = keys[i];
            var value = data[fqn];
            if (nowUtil.hasProperty(value, 'fqn')){
              value = fn.remotecall.bind({user: self, fqn: fqn});
            }
	    self.scopeTable.set(fqn, value);
          }
    });
    socket.on('cs', function(data) {
      self.scopeTable = new ScopeTable(data);
    });

    //groups that the user is in.
    this.groups = [];

    //the user's ScopeTable
    this.scopeTable = new ScopeTable();

    //reference for this.user
    this.user = { clientId: socket.sessionid };

    this.now = new Proxy(this);
  };

  User.prototype.get = function(fqn) {
    // First look in this user's scopeTable
    var value = this.scopeTable.get(fqn);

    if(value !== undefined) {
      return value;
    } else {
      // Look through all the groups for the value
      var i = 0;
      var keys = Object.keys(this.groups);
      var ll = keys.length;
      while(value === undefined && i < ll) {
        // Look in the scopeTable directly, rather than using User.get method. This resolves functions to the real functions rather than a multicaller
	value = this.groups[keys[i]].scopeTable.get(fqn);
	i++;
      }

      // If this is a function, bind to the current user
      if(typeof value === 'function') {
	var userClone = nowUtil.clone(this);
	userClone.fqn = fqn;
	value = value.bind(userClone);
      }

      // Cache it in this user's scopeTable for quicker access
      this.scopeTable[fqn] = value;

      return value;
    }
  };

  User.prototype.set = function(fqn, val) {
    var everyone = now.getGroup('everyone');

    if(typeof val === 'function' && everyone.scopeTable.get(fqn) === undefined) {
      everyone.scopeTable.set(fqn, val);
    } else if(typeof val === 'object') {
      var flattenedVal = nowUtil.flatten(val, fqn);
      for(var i = 0, key = Object.keys(flattenedVal), ll = key.length; i < ll; i++) {
	fqn = key[i];
	val = flattenedVal[fqn];
	this.scopeTable.set(fqn, val);

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
