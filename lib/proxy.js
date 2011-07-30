/**
 * wrap.js
 *
 * Wrap provides the proxy object that is exposed to the server.
 * Changes/additions to the object's properties and nested objects
 * trigger the store function to be called.
 *
 */

// TWO ISSUES: ScopeTables don't preserve Arrays, and Proxies can't
// return Arrays.

var Proxy = require('node-proxy');

exports.wrap = function (entity) {
  function wrapRoot(path, proto) {
    proto = proto || Object.prototype;
    return Proxy.create({
      get : function (receiver, name) {
        if (entity.scopeTable.arrays[path] !== undefined && name === 'length') {
          return entity.scopeTable.arrays[path];
        }
        var fqn = path+'.'+name;
        var returnObj = entity.get(fqn);
        if (returnObj && typeof returnObj === 'object') {
          return wrapRoot(fqn, Array.isArray(returnObj) ? Array.prototype : Object.prototype);
        }
        if (returnObj === undefined && proto[name]) {
          return proto[name];
        }
        return returnObj;
      },
      set : function (receiver, name, value) {
        var fqn = path + '.' + name;
        if (entity.scopeTable.arrays[path] !== undefined) {
          if (name === 'length') {
            entity.scopeTable.arrays[path] = value;
            return value;
          }
          if (name >= entity.scopeTable.arrays[path]) {
            for (var i = entity.scopeTable.arrays[path]; i < name; i++) {
              receiver[i] = undefined;
            }
            entity.scopeTable.arrays[path] = name + 1;
          }
        }
        var val = entity.set(fqn, value);
        if (Array.isArray(value)) {
          entity.scopeTable.flagAsArray(fqn, value.length);
          return wrapRoot(fqn, Array.prototype);
        }
        return wrapRoot(fqn);
      },
      enumerate : function () {
        return entity.scopeTable.get(path);
      },
      hasOwn : function (name) {
        return entity.scopeTable.get(path+'.'+name) !== undefined;
      },
      delete : function (name) {
        entity.deleteVar(path+'.'+name);
      },
      fix : function () {
        return undefined;
      }
    }, proto);
  }
  return wrapRoot('now');
};
