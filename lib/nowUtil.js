/**
 * NowUtil: an assorted collection of general-purpose functions used
 * in NowJS.
 */

Object.defineProperty(Array.prototype,
                      'toJSON',
                      { enumerable: false,
                        value: function () {
                          if (Array.isArray(this)) {
                            return this;
                          }
                          var toReturn = [];
                          for (var i = 0, ll = this.length; i < ll; i++) {
                            toReturn[i] = this[i];
                          }
                          return toReturn;
                        }
                      });

var util = {
  parseCookie: function (cookie) {
    if (typeof cookie !== 'string') {
      return {};
    }
    var regex = /(.+?)(;|$)\s*/g;
    var match = cookie.match(regex);
    if (!match) {
      return {};
    }
    var jsonCookie = {};
    var m, end, index;
    for (var i = 0; i < match.length; i++) {
      m = match[i];
      index = m.indexOf('=');
      end = m.lastIndexOf(';');
      if (index === -1) {
        jsonCookie[m.substr(index + 1,
                            end + 1 ?
                            end - index - 1:
                            undefined)] = true;
      } else {
        jsonCookie[m.substr(0, index)] = m.substr(index + 1,
                                                  (end + 1 ?
                                                   end - index - 1 :
                                                   undefined));
      }
    }
    return jsonCookie;
  },

  hasProperty: function (obj, prop) {
    return Object.prototype.hasOwnProperty.call(Object(obj), prop);
  },

  noop: function () {
  },

  clone: function (proto, obj) {
    // note regarding speed and C++ bindings: evidently it's slightly
    // faster to provide a wrapper function than adding an additional
    // level of lookup.
    if (!(obj && typeof obj === 'object')) {
      obj = {};
    }
    obj.__proto__ = proto;
    return obj;
  },

  generateRandomString: function () {
    return ("" + Math.random()).substring(2);
  },

  error: function (err) {
    console.log(err);
    if (util.hasProperty(err, 'stack')) {
      console.log(err.stack);
    }
  },

  getAllChildFqns: function (parentObj, parentFqn) {
    var fqns = [];
    var prop;
    function getAllChildFqnsHelper(parentObj, parentFqn) {
      for (var i = 0, keys = Object.keys(parentObj), ll = keys.length; i < ll; i++ ) {
        prop = keys[i];
        if (parentObj[prop] && typeof parentObj[prop] === 'object') {
          getAllChildFqnsHelper(parentObj[prop], parentFqn + '.' + prop);
        } else {
          fqns.push(parentFqn + '.' + prop);
        }
      }
      if (ll == 0) {
        fqns.push(parentFqn);
      }
    }
    getAllChildFqnsHelper(parentObj, parentFqn);
    return fqns;
  },

  extend: function (target, obj) {
    for (var i = 0, keys = Object.keys(obj), ii = keys.length; i < ii; i++) {
      var key = keys[i];
      if (obj[key] && typeof obj[key] === 'object') {
        if(Array.isArray(obj[key])) {
          target[key] = target[key] || [];
        } else {
          target[key] = target[key] || {};
        }
        util.extend(target[key], obj[key]);
      } else {
        target[key] = obj[key];
      }
    }
  },

  getVarFromFqn: function (fqn, scope) {
    var path = fqn.split('.');
    path.shift();
    var currVar = scope;
    var prop;
    while (path.length > 0) {
      prop = path.shift();
      if (util.hasProperty(currVar, prop)) {
        currVar = currVar[prop];
      } else {
        return false;
      }
    }
    return currVar;
  },

  stringify: JSON.stringify,

  parse: JSON.parse,

  flatten: function (val, fqn) {
    var vals = {};
    var fqns = util.getAllChildFqns(val, '');
    var m;
    for (var i = 0, ii = fqns.length; i < ii; i++) {
      m = util.getVarFromFqn(fqns[i], val);
      vals[fqn + fqns[i]] = m;
    }
    return vals;
  },

  getValOrFqn: function (val, fqn) {
    if (typeof val === 'function') {
      return {fqn: fqn};
    } else {
      return val;
    }
  },

  isEmptyObj: function (obj) {
    for (var i in obj) {
      return false;
    }
    return true;
  }
};

exports.nowUtil = util;
