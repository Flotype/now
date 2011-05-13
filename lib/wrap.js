/**
 * wrap.js
 * 
 * Wrap provides the proxy object that is exposed to the server.  
 * Changes/additions to the object's properties and nested objects trigger the store function to be called
 *
 * This file contains source code from node-sesame by James Halliday
 * Copyright 2010 James Halliday (mail@substack.net)
 */

var Proxy = require('node-proxy');

exports.wrap = function (store, scope, user) {
    
    // Utility objects to keep track of changes so updates can be aggregated 
    var taint = {};
    var taintedFqns = {};
    
    var set = store ? (store.set || store.save).bind(store) : null;
    
    var theProxy = Proxy.create({
      get : function (recv, name) {
        if (name === 'toJSON' && !Object.hasOwnProperty.call(scope, name)) {
          return function () { return scope; };
        }
        else {
          var returnObj = wrapRoot(name, scope[name], '["'+name+'"]', theProxy);
          
          // For all functions, ensure the `this` namespace contains the proxy and user objects
          if(typeof returnObj === 'function' && Object.hasOwnProperty.call(scope, name)){
            if(user){
              returnObj = returnObj.bind({now: theProxy, user:user});        
            } else {
              returnObj = returnObj.bind({now: theProxy});
            }
          }
          return returnObj;
        }
      },
      set : function (recv, name, value) {
        scope[name] = value;
        update(name, '["'+name+'"]');
        
        // Convert nested object to proxy
        return wrapRoot(name, value, '["'+name+'"]', theProxy);
      },
      enumerate : function () {
        return Object.keys(scope);
      },        
      hasOwn : function(name) {
        return Object.hasOwnProperty.call(scope, name);
      },
      delete : function (name) {
        update(name, '["'+name+'"]');
        delete scope[name];
      },
      fix : function () {
        return undefined;
      }
    }, Object.getPrototypeOf(scope));
    
    function update (key, fqn) {
      
      if (!taint[key] && store) {
        taintedFqns[key] = {};
        
        // The actual store callback is called on next tick so we can aggregate changes
        process.nextTick(function () {
          if (Object.hasOwnProperty.call(scope, key)) {
            set(key, scope[key], function (err) {
              if (err) console.error(err);
            },  taintedFqns[key]);
          } else {
            store.remove(key);
          }
          taint[key] = undefined;
          taintedFqns[key] = undefined;
        });
      }
      
      // Add changes 
      taint[key] = true;
      var val = getVarAtFqn(fqn, scope[key]);
      fqn = "now."+convertToDotNotation(fqn);
      taintedFqns[key][fqn] = (val !== null && val !== undefined && Object.hasOwnProperty.call(val, 'toFqn'))? val.toFqn() : val;
    }
    
    function wrapRoot (rootKey, obj, path, nowObject) {
      if (typeof obj !== 'object' || obj === null) return obj;
      var setTaint = update.bind({}, rootKey);
      var wrap = wrapRoot.bind({}, rootKey);
              
      return Proxy.create({
        get : function (recv, name) {
          if (name === 'toJSON' && !Object.hasOwnProperty.call(obj, name)) {
            return function () { return obj; };
          } else if(name === 'toFqn' && !Object.hasOwnProperty.call(obj, name)) {
            return function () { return {$ref: '$'+path}; };
          } else {
            var returnObj = obj[name];
            if(typeof returnObj === 'function'){
              if(user){
                returnObj = returnObj.bind({now: nowObject, user: user});        
              } else {
                returnObj = returnObj.bind({now: nowObject});
              }
            }
            return wrap(returnObj, path+'["'+name+'"]');
          }
        },
        set : function (recv, name, value) {
          obj[name] = value;
          setTaint(path+'["'+name+'"]');
          return wrap(obj[name], path+'["'+name+'"]');
        },
        enumerate : function () {
          return Object.keys(obj);
        },
        hasOwn : function(name) {
          return Object.hasOwnProperty.call(obj, name);
        },
        delete : function (name) {
          if (obj.propertyIsEnumerable(name)) {
            setTaint(path);
          }
          delete obj[name];
        },
        fix : function () {
          return undefined;
        }
      }, Object.getPrototypeOf(obj));
    }

    return theProxy;
};

// Convert nowUtil.decycle style fqn to now style fqn
function convertToDotNotation(lameFqn){
  var fqn = lameFqn.replace(/\"/g, "");
  fqn = fqn.substring(1, fqn.length - 1);
  fqn = fqn.replace(/\]\[/g, ".");
  return fqn;
}

function getVarAtFqn(fqn, scope){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = scope;
  while(path.length > 0){
    var prop = path.shift();
    currVar = currVar[prop];
  }
  
  return currVar;
}
