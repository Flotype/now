/**
 * wrap.js
 *
 * Wrap provides the proxy object that is exposed to the server.
 * Changes/additions to the object's properties and nested objects
 * trigger the store function to be called.
 *
 */

var Proxy = require('node-proxy');

exports.wrap = function (entity) {
  function wrapRoot(path, proto) {
    return Proxy.create({
      get : function (receiver, name) {
        if (entity.scopeTable.arrays[path] !== undefined && name === 'length') {
          return entity.scopeTable.arrays[path];
        }
        var fqn = path+'.'+name;
        var returnObj = entity.get(fqn);
        if (returnObj && typeof returnObj === 'object') {
          if (entity.proxies[fqn]) {
            return entity.proxies[fqn];
          }
          return (entity.proxies[fqn] = wrapRoot(fqn, !returnObj.filter || returnObj.filter(isNaN).length ? Object.prototype : Array.prototype));
        }
        if (returnObj === undefined && proto[name]) {
          return proto[name];
        }
        return returnObj;
      },
      set : function (receiver, name, value) {
        var fqn = path + '.' + name;
        var len = entity.scopeTable.arrays[path];
        if (len) {
          if (name === 'length') {
            entity.scopeTable.arrays[path] = value;
            return value;
          }
          while (len < name) {
            receiver[len++] = undefined;
          }
          entity.scopeTable.arrays[path] = name + 1;
        }
        entity.set(fqn, value);
        if (!value || typeof value !== 'object') {
          return value;
        }
        if (Array.isArray(value)) {
          entity.scopeTable.flagAsArray(fqn, value.length);
        }
        return (entity.proxies[fqn] = wrapRoot(fqn, value.constructor.prototype));
      },
      enumerate : function () {
        return entity.scopeTable.get(path);
      },
      hasOwn : function (name) {
        return entity.scopeTable.get(path+'.'+name) !== undefined;
      },
      delete : function (name) {
        var fqn = path + '.' + name;
        entity.deleteVar(fqn);
        delete entity.proxies[fqn];
      },
      fix : function () {
        return undefined;
      }
    }, proto);
  }
  return wrapRoot('now', Object.prototype);
};
