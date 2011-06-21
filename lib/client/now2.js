(function() {

  var socket;
  var closures = {};
  var fqnMap; = {
    data: {},

    get: function (fqn) {
      // does not reconstruct objects. :P
      return this.data[fqn];
    },

    set: function (fqn, val) {
      var lastIndex = fqn.lastIndexOf('.');
      var parent = fqn.substring(0, lastIndex);
      if (parent && !util.hasProperty(this.data, parent)) {
        this.set(parent, []);
      }
      if (parent && this.data[fqn] === undefined)
        this.data[parent].push(fqn.substring(lastIndex + 1));
      return this.data[fqn] = val;
    },

    delete: function (fqn) {
      var lastIndex = fqn.lastIndexOf('.');
      var parent = fqn.substring(0, lastIndex);

      if(util.hasProperty(this.data, parent)){
        // Remove from its parent.
        this.data[parent].splice(
          this.data[parent].indexOf(fqn.substring(lastIndex + 1)),
          1);
      }

      if (util.isArray(this.data[fqn])) {
        for (var i = 0; i < this.data[fqn].length; i++) {
          this.delete(fqn + '.' + this.data[fqn][i]);
        }
      }
      delete this.data[fqn];
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
    createVarAtFqn: function (scope, fqn, value) {
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
    
    watch: function(obj, label, getter, setter) {
      if (Object.defineProperty) {
        Object.defineProperty(
            obj,
            label,
            {
              get: getter,
              set: setter
            }
        );
      }
      else {
        if (getter) {
          obj.__defineGetter__(label, getter);
        }
        if (setter) {
          obj.__defineSetter__(label, setter);
        }
      }
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
          if (typeof args[i] === 'function') {
            var closureId = 'closure_' + args[i].name + '_' + util.generateRandomString();
            closures[closureId] = args[i];
            args[i] = {fqn: closureId};
          }
        }
        client.emit('rfc', {fqn: fqn, args: args});
      };
      remoteFn.remote = true;
      return remoteFn;
    },
    handleNewConnection: function () {
      if (client.handled) return;
      client.handled = true;

      client.on('rfc', function (data) {
        lib.remoteCall(data);
        util.emit('rfc', data);
      });
      client.on('rv', function (data) {
        lib.replaceVar(data);
        util.emit('rv', data);
      });

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
        util.emit('reconnect_failed');
      });
      client.on('connect_failed', function () {
        util.emit('connect_failed');
      });
    },
    processScope: function() {
      var data = {};
      traverseScope(now, 'now', data);
     
      // Send only for non-empty object
      for(var i in data) {
        socket.emit('rv', data);
        break;
      }
    }
    traverseScope: function(obj, path, data){
      if(obj && typeof obj === 'object') {
        var objIsArray = util.isArray(obj);
        for(var key in obj) {
          var fqn = path + '.' + key;
          if(util.hasProperty(obj, key)) {
            if((isIE || objIsArray) && !(obj[key] && typeof obj[key] === 'object') && fqnMap.get(fqn) !== obj[key]) {
              fqnMap.set(fqn, obj[key]);
              data[fqn] = obj[key];
            } else {
              
            }
          }
          
          this.traverseScope(obj[key], fqn, data);
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
      lib.handleNewConnection();
      
      // Begin intermitten scope traversal
      lib.traverseScope(now);
      
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