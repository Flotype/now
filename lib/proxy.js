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
  function wrapRoot(path) {
    return Proxy.create({
      get : function (receiver, name) {
        var fqn = path+'.'+name;
        var returnObj = entity.get(fqn);
        if (returnObj && typeof returnObj === 'object') {
          return wrapRoot(fqn);
        } else {
          return returnObj;
        }
      },
      set : function (receiver, name, value) {
        var fqn = path+'.'+name;
        var val = entity.set(fqn, value);
        return wrapRoot(fqn);
      },
      enumerate : function () {
        return entity.get(path);
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
    });
  }
  return wrapRoot('now');
};