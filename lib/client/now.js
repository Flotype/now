(function() {

  var nowReady = false;

  var watcher;
  var client;
  var closures = {};
  var blacklist = {};

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
    shallowCopy: function (obj) {
      var out = {};
      for (var i in obj) {
        if (util.hasProperty(obj, i)) {
          out[i] = obj[i];
        }
      }
      return out;
    },
    getAllChildFqns: function (parentObj, parentFqn) {
      var fqns = [];
      var ignore = {
        'now.core': true,
        'now.ready': true
      };
      function getAllChildFqnsHelper(parentObj, parentFqn) {
        for (var prop in parentObj) {
          if (util.hasProperty(parentObj, prop) && !util.hasProperty(ignore, parentFqn + '.'+prop)) {
            fqns.push(parentFqn+'.'+prop);
            if (parentObj[prop] && typeof parentObj[prop] === 'object') {
              getAllChildFqnsHelper(parentObj[prop], parentFqn+'.'+prop);
            }
          }
        }
      }
      getAllChildFqnsHelper(parentObj, parentFqn);
      return fqns;
    },
    addChildrenToBlacklist: function (blacklist, parentObj, parentFqn) {
      for (var prop in parentObj) {
        if (util.hasProperty(parentObj, prop)) {
          blacklist[(parentFqn+'.'+prop)] = true;
          if (parentObj[prop] && typeof parentObj[prop] === 'object') {
            util.addChildrenToBlacklist(blacklist, parentObj[prop], parentFqn+'.'+prop);
          }
        }
      }
    },
    createVarAtFqn: function (fqn, scope, value) {
      var path = fqn.split('.');
      var currVar = util.forceGetParentVarAtFqn(fqn, scope);
      currVar[path.pop()] = value;
    },
    forceGetParentVarAtFqn: function (fqn, scope) {
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
    getVarFromFqn: function (fqn, scope) {
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
    flatten: function (val, fqn) {
      var vals = {};
      var fqns = util.getAllChildFqns(val, "");
      for (var i = 0, ii = fqns.length; i < ii; i++) {
        vals[fqn+fqns[i]] = util.getVarFromFqn(fqns[i], val);
      }
      return vals;
    },
    generateRandomString: function() {
      return Math.random().toString().substr(2);
    },
    watch: function (obj, prop, fqn, handler) {
      var val = obj[prop];
      var getter = function () {
        return val;
      };
      var setter = function (newVal) {
        var oldval = val;
        val = newVal;
        handler.call(obj, prop, fqn, oldval, newVal);
        return newVal;
      };
      if (Object.defineProperty) {// ECMAScript 5
        Object.defineProperty(obj, prop, {
          get: getter,
          set: setter
        });
      } else if (Object.prototype.__defineGetter__ && Object.prototype.__defineSetter__) { // legacy
        Object.prototype.__defineGetter__.call(obj, prop, getter);
        Object.prototype.__defineSetter__.call(obj, prop, setter);
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

  var isIE = (function() {
    try {
      Object.defineProperty({}, '', {});
      return false;
    } catch (err) {
      return true;
    }
    return true;
  })();

  var lib = {
    createScope: function() {

      // Create the watcher object
      watcher = new lib.NowWatcher('now', now, {}, function (prop, fqn, oldVal, newVal) {

        // Handle variable value changes in this callback
        // If not on blacklist do changes
        if (!util.hasProperty(blacklist, fqn)) {
          if (oldVal && typeof oldVal === 'object') {
            var oldFqns = util.getAllChildFqns(oldVal, fqn);

            for (var i in oldFqns) {
              delete watcher.data.watchedKeys[oldFqns[i]];
            }
          }

          util.addChildrenToBlacklist(blacklist, newVal, fqn);

          var vals = {};
          if (newVal && typeof newVal == 'object') {
            vals = util.flatten(newVal, fqn);
            for (var i in vals) {
              if (typeof (vals[i]) === 'function' && !vals[i].remote) {
                vals[i] = {fqn: i};
              }
            }
          } else if (typeof newVal === 'function' && !newVal.remote) {
            vals[fqn] = {fqn: fqn};
          }
          else {
            vals[fqn] = newVal;
          }
          client.emit('rv', vals);
        } else {
          // If on blacklist, remove from blacklist
          delete blacklist[fqn];
        }
        // In case the object is an array, we delete from hashedArrays to prevent multiple watcher firing
        delete watcher.data.hashedArrays[fqn];

      });

      var fqns = util.getAllChildFqns(now, 'now');
      /*
        var scope = {};
        for (var i = 0, ii = fqns.length; i < ii; i++) {
          scope[fqns[i]] = util.getVarFromFqn(fqns[i], now);
          if (typeof scope[fqns[i]] === 'function') {
            scope[fqns[i]] = {fqn:fqns[i]};
          }
        }

        client.emit('rv', scope);
      */
      setTimeout(function () {
        watcher.processScope();
      }, 1000);

      util.emit('ready');
    },

    replaceVar: function (data) {
      if (!nowReady) {
        lib.createScope();
        nowReady = true;
      }
      for (var key in data) {
        blacklist[key] = true;
        if (util.hasProperty(data[key], 'fqn')) {
          data[key] = lib.constructRemoteFunction(key);
        }
        util.createVarAtFqn(key, now, data[key]);
      }
    },

    remoteCall: function (data) {
      var func;
      // Retrieve the function, either from closures hash or from the now scope
      if (data.fqn.split('_')[0] === 'closure') {
        func = closures[data.fqn];
      } else {
        func = util.getVarFromFqn(data.fqn, now);
      }

      var args = data.args;

      if (typeof args === 'object' && !util.isArray(args)) {
        var newargs = [];
        // Enumeration order is not defined so this might be useless, but there will be cases when it works
        for (var i in args) {
          newargs.push(args[i]);
        }
        args = newargs;
      }

      // Search (only at top level) of args for functions parameters, and replace with wrapper remote call function
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
          if (typeof args[i] === 'function' && util.hasProperty(args, i)) {
            var closureId = 'closure_' + args[i].name + '_' + util.generateRandomString(10);
            closures[closureId] = args[i];
            args[i] = {fqn: closureId};
          }
        }
        client.emit('rfc', {fqn: fqn, args: args});
      };
      remoteFn.remote = true;
      return remoteFn;
    },

    NowWatcher: function (fqnRoot, scopeObj, scopeClone, variableChanged) {
      this.data = {watchedKeys: {}, hashedArrays: {}};

      var badNames = {'now.ready': true, 'now.core': true };

      this.traverseObject = function (path, obj, arrayBlacklist, objClone) {
        // Prevent new array items from being double counted
        for (var key in obj) {
          if (util.hasProperty(obj, key)) {
            var fqn = path+'.'+key;
            // Ignore ready function
            if (util.hasProperty(badNames, fqn)) {
              continue;
            }
            if (isIE && !util.isArray(obj) && typeof obj[key] !== 'object' && util.hasProperty(objClone, key) && obj[key] !== objClone[key]) {
              this.variableChanged(key, fqn, objClone[key], obj[key]);
              objClone[key] = util.shallowCopy(obj[key]);
            }
            if (!util.hasProperty(this.data.watchedKeys, fqn)) {
              if (!isIE) {
                util.watch(obj, key, fqn, this.variableChanged);
              } else {
                objClone[key] = util.shallowCopy(obj[key]);
              }
              if (!util.hasProperty(arrayBlacklist, fqn)) {
                this.variableChanged(key, fqn, '', obj[key]);
              }
              this.data.watchedKeys[fqn] = true;
            }

            if (obj[key] && typeof obj[key] === 'object') {
              if (util.isArray(obj[key])) {
                if (util.hasProperty(this.data.hashedArrays, fqn)) {
                  var diff = this.compareArray(this.data.hashedArrays[fqn], obj[key]);
                  if (diff === false) {
                    // Replace the whole array
                    this.variableChanged(key, fqn, this.data.hashedArrays[fqn], obj[key]);
                  } else if (diff !== true) {
                    for (var i in diff) {
                      if (util.hasProperty(diff, i)) {
                        arrayBlacklist[fqn+'.'+i] = true;
                        this.variableChanged(i, fqn+'.'+i, this.data.hashedArrays[fqn][i], diff[i]);
                      }
                    }
                  }
                }
                this.data.hashedArrays[fqn] = obj[key].slice(0);
              }
              if (isIE && (!util.hasProperty(objClone, key) || !(typeof objClone[key] === 'object'))) {
                if (util.isArray(obj[key])) {
                  objClone[key] = [];
                } else {
                  objClone[key] = {};
                }
              }
              if (isIE) {
                this.traverseObject(fqn, obj[key], arrayBlacklist, objClone[key]);
              } else {
                this.traverseObject(fqn, obj[key], arrayBlacklist);
              }
            }
          }
        }
      };

      this.processScope = function () {
        if (isIE) {
          this.traverseObject(fqnRoot, scopeObj, {}, scopeClone);
        } else {
          this.traverseObject(fqnRoot, scopeObj, {});
        }
        setTimeout(function () {
          watcher.processScope();
        }, 1000);
      };

      this.variableChanged = variableChanged;

       /**
       * Returns true if two the two arrays are identical.
       * Returns an object of differences if keys have been added or the value at a key has changed
       * Returns false if keys have been deleted
       */
      this.compareArray = function (oldArr, newArr) {
        var result = {};
        var modified = false;
        if (newArr.length >= oldArr.length) {
          for (var i in newArr) {
            if (!util.hasProperty(oldArr, i) || newArr[i] !== oldArr[i]) {
              result[i] = newArr[i];
              modified = true;
            }
          }
          return (modified) ? result : true;
        } else {
          return false;
        }
      };
    },

    handleNewConnection: function () {
      if (client.handled) return;
      client.handled = true;
      client.on('rfc', lib.remoteCall);
      client.on('rv', lib.replaceVar);

      client.on('disconnect', function () {
        util.emit('disconnect');
      });
      // Forward planning for socket io 0.7
      client.on('error', function () {
        util.emit('error');
      });
      client.on('retry', function () {
        util.emit('retry');
      });
      client.on('reconnect', function () {
        util.emit('reconnect');
      });
      client.on('reconnect_failed', function () {
        // Error to user.
      });
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

    var socket = io.connect('http://**SERVER**:**PORT**/');
    now.core.socketio = socket;
    socket.on('connect', function () {
      client = socket;
      now.core.clientId = socket.socket.sessionid;
      lib.handleNewConnection();
      util.emit('connect');
    });
    socket.on('disconnect', function () {
      // y-combinator trick
      (function (y) {
        y(now, y, [now]);
      })(function (obj, fn, seen) {
        for (var i in obj) {
          if (obj[i] && typeof obj[i] === 'object' &&
              obj[i] != document && seen.indexOf(obj[i]) === -1) {
            seen[seen.length] = obj[i];
            fn(obj[i], fn, seen);
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