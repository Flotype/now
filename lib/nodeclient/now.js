var nowObjects = {};
module.exports = {
  nowInitialize: function noConflict(uri) {
    if (Object.prototype.hasOwnProperty.call(nowObjects, uri)) {
      return nowObjects[uri];
    }
    var io = require('socket.io-client');
    var Proxy = require('node-proxy');

    var socket = io.connect(uri);
    var closures = {};
    var nowReady = false;
    var lastTimeout;
    var core = {};
    var util, lib;
    var ready = function (func) {
      util.on('ready', func);
    };
    var wrap = function (entity) {
      function wrapRoot(path, proto) {
	return Proxy.create({
	  get : function (receiver, name) {
            if (entity.arrays[path] !== undefined && name === 'length') {
              return entity.arrays[path];
            }
            var fqn = path + '.' + name;
            if (fqn === "now.core") {
              return core;
            }
            if (fqn === "now.ready") {
              return ready;
            }
            var returnObj = entity.get(fqn);
            if (returnObj && typeof returnObj === 'object') {
              if (entity.proxies[fqn]) {
		return entity.proxies[fqn];
              }
              return (entity.proxies[fqn] = wrapRoot(
		fqn,
		(returnObj.filter && returnObj.filter(isNaN).length ?
		 Object : Array).prototype
	      ));
	    }
            if (returnObj === undefined && proto[name]) {
              return proto[name];
            }
            return returnObj;
	  },
	  set : function (receiver, name, val) {
            var fqn = path + '.' + name;
            var len = entity.arrays[path];
            if (len) {
              if (name === 'length') {
		entity.arrays[path] = val;
		return val;
              }
              while (len < name) {
		receiver[len++] = undefined;
              }
              entity.arrays[path] = name + 1;
            }
            entity.set(fqn, val);
            if (!val || typeof val !== 'object') {
              return val;
            }
            if (Array.isArray(val)) {
              entity.flagAsArray(fqn, val.length);
            }
            return (entity.proxies[fqn] = wrapRoot(fqn, val.constructor.prototype));
	  },
	  enumerate : function () {
            return entity.get(path);
	  },
	  hasOwn : function (name) {
            return entity.get(path + '.' + name) !== undefined;
	  },
	  delete : function (name) {
            entity.deleteVar(path + '.' + name);
	  },
	  fix : function () {
            return undefined;
	  }
	}, proto);
      }
      return wrapRoot('now', Object.prototype);
    };

    var fqnMap = {
      arrays: {},

      proxies: {},

      data: {},

      get: function (fqn) {
	return this.data[fqn];
      },

      set: function (fqn, val) {
	if (this.data[fqn] !== undefined) {
	  this.deleteVar(fqn, val);
	}
	var lastIndex = fqn.lastIndexOf('.');
	var parent = fqn.substring(0, lastIndex);
	this.addParent(parent, fqn.substring(lastIndex + 1));
	if ((typeof val !== 'object' || !val) && fqn !== 'now.ready') {
	  var obj = {};
	  obj[fqn] = util.getValOrFqn(val, fqn);
	  if (fqn !== undefined && val !== fqnMap.data[fqn]) {
            socket.emit('rv', obj);
	  }
	}
	return (this.data[fqn] = val);
      },

      addParent: function (parent, key) {
	if (parent && !Array.isArray(this.data[parent])) {
	  this.set(parent, []); // Handle changing a non-object to an object.
	}
	if (parent) {
	  this.data[parent].push(key);
	}
      },

      deleteVar: function (fqn) {
	var lastIndex = fqn.lastIndexOf('.');
	var parent = fqn.substring(0, lastIndex);

	if (util.hasProperty(this.data, parent)) {

	  // Remove from its parent.
	  var index = this.data[parent].indexOf(fqn.substring(lastIndex + 1));
	  if (index > -1) {
            this.data[parent].splice(index, 1);
	  }
	}
	if (Array.isArray(this.data[fqn])) {
	  // Deleting a child will remove it via splice.
	  for (var i = 0; this.data[fqn].length;) {
            // Recursive delete all children.
            this.deleteVar(fqn + '.' + this.data[fqn][i]);
	  }
	}
	delete this.data[fqn];
      }
    };

    util = {
      hasProperty: function (obj, prop) {
	return Object.prototype.hasOwnProperty.call(Object(obj), prop);
      },

      isArray: Array.isArray,

      createVarAtFqn: function (scope, fqn, value) {
	var path = fqn.split('.');
	var currVar = this.forceGetParentVarAtFqn(scope, fqn);
	var key;
	fqnMap.data[fqn] = value;
      },

      forceGetParentVarAtFqn: function (scope, fqn) {
	var path = fqn.split('.');
	path.shift();

	var currVar = scope;
	while (path.length > 1) {
	  var prop = path.shift();
	  // If either the property doesn't exist or it doesn't map to an object,
	  if (!this.hasProperty(currVar, prop) ||
	      !(currVar[prop] && typeof currVar[prop] === "object")) {
	    // determine whether we should make an array or an ordinary object.
            if (!isNaN(path[0])) {
              currVar[prop] = [];
            } else {
              currVar[prop] = {};
            }
	  }
	  currVar = currVar[prop];
	}
	return currVar;
      },

      getVarFromFqn: function (scope, fqn) {
	var path = fqn.split('.');
	path.shift();
	var currVar = scope;
	while (path.length > 0) {
	  var prop = path.shift();
	  if (this.hasProperty(currVar, prop)) {
            currVar = currVar[prop];
	  } else {
            return false;
	  }
	}
	return currVar;
      },

      generateRandomString: function () {
	return Math.random().toString().substr(2);
      },

      getValOrFqn: function (val, fqn) {
	if (typeof val === 'function') {
	  if (val.remote) {
            return undefined;
	  }
	  return {fqn: fqn};
	} else {
	  return val;
	}
      }
    };
    util.__proto__ = require('events').EventEmitter.prototype;

    var now = wrap(fqnMap);

    lib = {
      deleteVar: function (fqn) {
	var path, currVar, parent, key;
	path = fqn.split('.');
	currVar = now;
	for (var i = 1; i < path.length; i++) {
	  key = path[i];
	  if (currVar === undefined) {
            // delete from fqnMap, just to be safe.
            fqnMap.deleteVar(fqn);
            return;
	  }
	  if (i === path.length - 1) {
            delete currVar[path.pop()];
            fqnMap.deleteVar(fqn);
            return;
	  }
	  currVar = currVar[key];
	}
      },
      replaceVar: function (data) {
	for (var fqn in data) {
	  if (util.hasProperty(data[fqn], 'fqn')) {
            data[fqn] = lib.constructRemoteFunction(fqn);
	  }
	  util.createVarAtFqn(now, fqn, data[fqn]);
	}
      },

      remoteCall: function (data) {
	var func, i, ii;
	// Retrieve the function, either from closures hash or from the now scope
	if (data.fqn.split('_')[0] === 'closure') {
	  func = closures[data.fqn];
	} else {
	  func = fqnMap.get(data.fqn);
	}
	var args = data.args;

	if (typeof args === 'object' && !util.isArray(args)) {
	  var newargs = [];
	  // Enumeration order is not defined so this might be useless,
	  // but there will be cases when it works
	  for (i in args) {
            newargs.push(args[i]);
	  }
	  args = newargs;
	}

	// Search (only at top level) of args for functions parameters,
	// and replace with wrapper remote call function
	for (i = 0, ii = args.length; i < ii; i++) {
	  if (util.hasProperty(args[i], 'fqn')) {
            args[i] = lib.constructRemoteFunction(args[i].fqn);
	  }
	}
	func.apply({now: now}, args);
      },

      // Handle the ready message from the server
      serverReady: function () {
	nowReady = true;
	util.emit('ready');
      },

      constructRemoteFunction: function (fqn) {
	var remoteFn = function () {
	  var args = Array.prototype.slice.call(arguments);
	  for (var i = 0, ii = args.length; i < ii; i++) {
            if (typeof args[i] === 'function') {
              var closureId = 'closure_' + args[i].name + '_' + util.generateRandomString();
              closures[closureId] = args[i];
              args[i] = {fqn: closureId};
            }
	  }
	  socket.emit('rfc', {fqn: fqn, args: args});
	};
	remoteFn.remote = true;
	return remoteFn;
      },
      handleNewConnection: function (socket) {
	if (socket.handled) {
	  return;
	}
	socket.handled = true;

	socket.on('rfc', function (data) {
	  lib.remoteCall(data);
	  util.emit('rfc', data);
	});
	socket.on('rv', function (data) {
	  lib.replaceVar(data);
	  util.emit('rv', data);
	});
	socket.on('del', function (data) {
	  lib.deleteVar(data);
	  util.emit('del', data);
	});

	// Handle the ready message from the server
	socket.on('rd', function (data) {
	  lib.serverReady();
	});

	socket.on('disconnect', function () {
	  util.emit('disconnect');
	});
	// Forward planning for socket io 0.7
	socket.on('error', function () {
	  util.emit('error');
	});
	socket.on('retry', function () {
	  util.emit('retry');
	});
	socket.on('reconnect', function () {
	  util.emit('reconnect');
	});
	socket.on('reconnect_failed', function () {
	  util.emit('reconnect_failed');
	});
	socket.on('connect_failed', function () {
	  util.emit('connect_failed');
	});
      }
    };

    core.socketio = socket;
    socket.on('connect', function () {
      core.clientId = socket.id;
      socket.connected = true;
      lib.handleNewConnection(socket);

      socket.emit('rd');
      util.emit('connect');
    });

    socket.on('disconnect', function () {
      // y-combinator trick
      socket.connected = false;
      (function (y) {
	y(y, now);
      }(function (fn, obj) {
	for (var i in obj) {
	  if (obj[i] && typeof obj[i] === 'object' &&
              obj[i] !== now.core) {
            fn(fn, obj[i]);
	  }
	  else if (typeof obj[i] === 'function' && obj[i].remote) {
            delete obj[i];
	  }
	}
      }));
      // Clear all sorts of stuff in preparation for reconnecting.
      fqnMap.data = {};
    });

    return (nowObjects[uri] = now);
  }
};
