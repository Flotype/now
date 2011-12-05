/**
 * wrap.js
 *
 * Wrap provides the proxy object that is exposed to the server.
 * Changes/additions to the object's properties and nested objects
 * trigger the store function to be called.
 *
 */

var Proxy = require('../bin/proxy.node');

exports.wrap = function (entity) {
  function wrapRoot(path, proto) {
    return Proxy.create({
      get : function (receiver, name) {
        if (Array.isArray(proto) && name === 'length') {
          var arr = entity.scopeTable.get(path);
          return entity.scopeTable.flagAsArray(path, arr.length && (1 + 1 * arr[arr.length - 1]));
        }
        var fqn = path + '.' + name;
        var returnObj = entity.get(fqn);
        if (returnObj && typeof returnObj === 'object') {
          var p = (entity.scopeTable.arrays[fqn] === undefined) ? Object.prototype : Array.prototype;
          if (p === Array.prototype) {
            entity.scopeTable.flagAsArray(fqn, returnObj[returnObj.length - 1] || 0);
          }
          return wrapRoot(fqn, p);
        }
        if (returnObj === undefined && proto[name]) {
          return proto[name];
        }
        return returnObj;
      },
      set : function (receiver, name, value) {
        var fqn = path + '.' + name;
        if (proto === Array.prototype) {
          var len = 1 * entity.scopeTable.arrays[path] || 0;
          if (name === 'length') {
            return entity.scopeTable.flagAsArray(path, value);
          }
          if (name > len) {
            entity.scopeTable.flagAsArray(path, 1 + name);
            while (len <= name) {
              receiver[len++] = undefined;
            }
          }
        }
        entity.set(fqn, value);
        if (!value || typeof value !== 'object') {
          return value;
        }
        if (Array.isArray(value)) {
          entity.scopeTable.flagAsArray(fqn, value.length);
        }
        return wrapRoot(fqn, value.constructor.prototype);
      },
      enumerate : function () {
        return entity.scopeTable.get(path);
      },
      hasOwn : function (name) {
        return entity.scopeTable.get(path + '.' + name) !== undefined;
      },
      delete : function (name) {
        var fqn = path + '.' + name;
        entity.deleteVar(fqn);
      },
      fix : function () {
        return undefined;
      }
    }, proto);
  }
  return wrapRoot('now', Object.prototype);
};
