(function () {

  var socket;
  var closures = {};
  var nowReady = false;
  var madeFirstContact = 0;
  var fqnMap = {
    data: {},

    get: function (fqn) {
      return fqnMap.data[fqn];
    },

    set: function (fqn, val) {
      var lastIndex = fqn.lastIndexOf('.');
      var parent = fqn.substring(0, lastIndex);
      if (parent && !util.isArray(fqnMap.data[parent])) {
        fqnMap.set(parent, []);
      }
      if (parent && fqnMap.data[fqn] === undefined)
        fqnMap.data[parent].push(fqn.substring(lastIndex + 1));
      return fqnMap.data[fqn] = val;
    },

    delete: function (fqn) {
      var lastIndex = fqn.lastIndexOf('.');
      var parent = fqn.substring(0, lastIndex);

      if (util.hasProperty(fqnMap.data, parent)) {
        // Remove from its parent.
        fqnMap.data[parent].splice(
          fqnMap.data[parent].indexOf(fqn.substring(lastIndex + 1)),
          1);
      }

      if (util.isArray(fqnMap.data[fqn])) {
        for (var i = 0; i < fqnMap.data[fqn].length; i++) {
          fqnMap.delete(fqn + '.' + fqnMap.data[fqn][i]);
        }
      }
      delete fqnMap.data[fqn];
    }
  };

  var util = {
    _events: {},
    // Event code from socket.io
    on: function (name, fn) {
      if (!(util.hasProperty(util._events, name))) {
        util._events[name] = [];
      }
      util._events[name].push(fn);
      return util;
    },

    emit: function (name, args) {
      if (util.hasProperty(util._events, name)) {
        var events = util._events[name].slice(0);
        for (var i = 0, ii = events.length; i < ii; i++) {
          events[i].apply(util, args === undefined ? [] : args);
        }
      }
      return util;
    },
    removeEvent: function (name, fn) {
      if (util.hasProperty(util._events, name)) {
        for (var a = 0, l = util._events[name].length; a < l; a++) {
          if (util._events[name][a] == fn) {
            util._events[name].splice(a, 1);
          }
        }
      }
      return util;
    },

    hasProperty: function (obj, prop) {
      return Object.prototype.hasOwnProperty.call(Object(obj), prop);
    },
    isArray: Array.isArray || function (obj) {
      return  Object.prototype.toString.call(obj) === '[object Array]';
    },

    createVarAtFqn: function (scope, fqn, value) {
      var path = fqn.split('.');
      var currVar = util.forceGetParentVarAtFqn(scope, fqn);
      currVar[path.pop()] = value;
    },

    forceGetParentVarAtFqn: function (scope, fqn) {
      var path = fqn.split('.');
      path.shift();

      var currVar = scope;
      while (path.length > 1) {
        var prop = path.shift();
        if (!util.hasProperty(currVar, prop)) {
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
        if (util.hasProperty(currVar, prop)) {
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

    watch: function (obj, label, fqn) {
    alert(0);
      var val = obj[label];
      function getter () {
        return val;
      };
      function setter (newVal) {
      alert(1);
        if (val !== newVal) {
          // trigger some sort of change.
          if (val && typeof val === 'object') {
            fqnMap.delete(fqn);
            util.processScope(obj, fqn.substring(0, fqn.lastIndexOf('.')));
            return;
          }
          
          console.log(obj);
          alert(2);
          obj[label] = newVal;
          if (newVal && typeof newVal === 'object') {
            fqnMap.delete(fqn);
            util.processScope(newVal, fqn);
            return;
          }
          fqnMap.set(fqn, newVal);
          if (typeof newVal === 'function') {
            newVal = {fqn: fqn};
          }
          var obj = {};
          obj[fqn] = newVal;
          socket.emit('rv', obj);
        }
        return newVal;
      };
      if (Object.defineProperty) {
        Object.defineProperty(obj, label, {get: getter, set: setter});
      } else {
        if (util.getter) {
          obj.__defineGetter__(label, util.getter);
        }
        if (setter) {
          obj.__defineSetter__(label, setter);
        }
      }
    }
  };

  var now = {
    ready: function (func) {
      if (arguments.length === 0) {
        util.emit('ready');
      } else {
        if (nowReady) {
          func();
          return;
        }
        util.on('ready', func);
      }
    },
    core: {
      on: util.on,
      removeEvent: util.removeEvent,
      clientId: undefined
    }
  };
  window.now = now;

  var isIE = (function () {
    try {
      Object.defineProperty({}, '', {});
      return false;
    } catch (err) {
      return true;
    }
    return true;
  })();

  var lib = {

    replaceVar: function (data) {
      for (var fqn in data) {
        if (util.hasProperty(data[fqn], 'fqn')) {
          data[fqn] = lib.constructRemoteFunction(fqn);
        }
        util.createVarAtFqn(now, fqn, data[fqn]);
      }

      if (!nowReady) {
        nowReady = true;
        util.emit('ready');
      }

    },

    remoteCall: function (data) {
      var func;
      // Retrieve the function, either from closures hash or from the now scope
      if (data.fqn.split('_')[0] === 'closure') {
        func = closures[data.fqn];
      } else {
        func = util.getVarFromFqn(now, data.fqn);
      }
      var args = data.args;

      if (typeof args === 'object' && !util.isArray(args)) {
        var newargs = [];
        // Enumeration order is not defined so this might be useless,
        // but there will be cases when it works
        for (var i in args) {
          newargs.push(args[i]);
        }
        args = newargs;
      }

      // Search (only at top level) of args for functions parameters,
      // and replace with wrapper remote call function
      for (var i = 0, ii = args.length; i < ii; i++) {
        if (util.hasProperty(args[i], 'fqn')) {
          args[i] = lib.constructRemoteFunction(args[i].fqn);
        }
      }
      func.apply({now: now}, args);
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
      if (socket.handled) return;
      socket.handled = true;

      socket.on('rfc', function (data) {
        lib.remoteCall(data);
        util.emit('rfc', data);
      });
      socket.on('rv', function (data) {
        lib.replaceVar(data);
        util.emit('rv', data);
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
    },
    processNowScope: function () {
      lib.processScope(now, 'now');
      setTimeout(lib.processNowScope, 1000);
    },
    processScope: function (obj, path) {
      var data = {};
      lib.traverseScope(obj, path, data);
      // Send only for non-empty object
      if (!madeFirstContact) {
        socket.emit('rv', data);
        madeFirstContact = 1;
        return;
      }
      for (var i in data) {
        socket.emit('rv', data);
        break;
      }
    },
    traverseScope: function (obj, path, data) {
      if (obj && typeof obj === 'object') {
        var objIsArray = util.isArray(obj);
        for (var key in obj) {
          var fqn = path + '.' + key;
          if (fqn === 'now.core' || fqn === 'now.ready') {
            continue;
          }
          var type = typeof obj[key];
          if (util.hasProperty(obj, key)) {
            if ((isIE || objIsArray) &&
                !(obj[key] && type === 'object') &&
                fqnMap.get(fqn) !== obj[key]) {
              fqnMap.set(fqn, obj[key]);
              data[fqn] = obj[key];
            } else {
              util.watch(obj, key, fqn);
              if (type !== 'object' || !obj[key]) {
                if (fqnMap.get(fqn) === undefined) {
                  fqnMap.set(fqn, obj[key]);
                  if (type === 'function') {
                    if (obj[key].remote) {
                      continue;
                    }
                    data[fqn] = {fqn: fqn};
                  } else {
                    data[fqn] = obj[key];
                  }
                }
              }
            }
          }
          lib.traverseScope(obj[key], fqn, data);
        }
      }
    }
  };

  var dependencies = [
    { key: 'io', path: '/socket.io/socket.io.js'}
  ];
  var dependenciesLoaded = 0;

  var scriptLoaded = function () {
    dependenciesLoaded++;
    if (dependenciesLoaded !== dependencies.length) {
      return;
    }

    socket = io.connect('http://**SERVER**:**PORT**/');
    now.core.socketio = socket;
    socket.on('connect', function () {
      now.core.clientId = socket.socket.sessionid;
      lib.handleNewConnection(socket);

      // Begin intermittent scope traversal
      lib.processNowScope();

      util.emit('connect');
    });
    socket.on('disconnect', function () {
      // y-combinator trick
      (function (y) {
        y(y, now);
      })(function (fn, obj) {
        for (var i in obj) {
          if (obj[i] && typeof obj[i] === 'object' &&
              obj[i] != document && obj[i] !== now.core) {
            fn(fn, obj[i]);
          }
          else if (typeof obj[i] === 'function' && obj[i].remote) {
            delete obj[i];
          }
        }
      });
    });
  };

  for (var i=0, ii=dependencies.length; i < ii; i++) {
    if (window[dependencies[i]['key']]) {
      scriptLoaded();
      return;
    }
    var fileref=document.createElement('script');
    fileref.setAttribute('type','text/javascript');
    fileref.setAttribute('src', 'http://**SERVER**:**PORT**'+dependencies[i]['path']);
    fileref.onload = scriptLoaded;
    if (isIE) {
      fileref.onreadystatechange = function () {
        if (fileref.readyState === 'loaded') {
          scriptLoaded();
        }
      };
    }
    document.getElementsByTagName('head')[0].appendChild(fileref);
  }
})();