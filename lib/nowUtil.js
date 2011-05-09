/**
 * nowUtil.js
 * 
 * Various utility functions used by both client and server side
 *
 */

var nowUtil = {


  // Creates the serialized form of functions to be sent over the wire
  serializeFunction: function(fqn, func) {
    return {type: "function", fqn: fqn};
  },

  
  // Find all fqns of properties in parentObj and add them to the given blacklist, prepened by parentFqn
  addChildrenToBlacklist: function(blacklist, parentObj, parentFqn){
    for(var prop in parentObj){
      if(Object.hasOwnProperty.call(parentObj, prop)){
        blacklist[(parentFqn+"."+prop)] = true;
        if(parentObj[prop] && typeof parentObj[prop] === 'object'){
          nowUtil.addChildrenToBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
        }
      }
    }
  },

  
  // Remove all fqns contained in parentObj from given blacklist
  removeChildrenFromBlacklist: function(blacklist, parentObj, parentFqn){
    for(var prop in parentObj){
      if(Object.hasOwnProperty.call(parentObj, prop)){
        delete blacklist[(parentFqn+"."+prop)];
        if(parentObj[prop] && typeof parentObj[prop] === 'object'){
          nowUtil.removeChildrenFromBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
        }
      }
    }
  },
  

  // Return array of all fqns of parentObj, prepended by parentFqn, recursively
  getAllChildFqns: function(parentObj, parentFqn){
    var fqns = [];
    
    function getAllChildFqnsHelper(parentObj, parentFqn){
      for(var prop in parentObj){
        if(Object.hasOwnProperty.call(parentObj, prop)) {
          fqns.push(parentFqn+"."+prop);
          if(parentObj[prop] && typeof parentObj[prop] === 'object'){
            getAllChildFqnsHelper(parentObj[prop], parentFqn+"."+prop);
          }
        }
      }
    }
    getAllChildFqnsHelper(parentObj, parentFqn);
    return fqns; 
  },

  
  // This is the client-side equivalent of the proxy object from wrap.js. 
  // Takes an object and the name of a property, calls the handler function when that property changes
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
  },

  
  // Used in initialization to serialize obj and send it over the given socket
  initializeScope: function(obj, socket) {
    var data = nowUtil.decycle(obj, 'now', [nowUtil.serializeFunction]);
    var scope = data[0];
    nowUtil.debug("initializeScope", JSON.stringify(data));
    nowUtil.print(scope);
    socket.send({type: 'createScope', data: {scope: scope}});
  },

  
  // Cross-browser isArray
  isArray: Array.isArray || function (obj) {
    return  Object.prototype.toString.call(obj) === '[object Array]'; 
  },


  // Attempt to traverse the scope and return the property the fqn represents. Returns false if not found
  getVarFromFqn: function(fqn, scope){
    var path = fqn.split(".");
    path.shift();
    var currVar = scope;
    while(path.length > 0){
      var prop = path.shift();
      if(Object.hasOwnProperty.call(currVar, prop)) {
        currVar = currVar[prop];
      } else {
        return false;
      }
    }
    return currVar;
  },

  
  // Traverse scope to get the parent object of the given fqn
  getVarParentFromFqn: function(fqn, scope){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = scope;
    while(path.length > 1){
      var prop = path.shift();
      currVar = currVar[prop];
    }
    return currVar;
  },
  
  
  // Traverse scope to get the parent object of the given fqn, or create and return it if it does't exist
  forceGetParentVarAtFqn: function(fqn, scope){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = scope;
    while(path.length > 1){
      var prop = path.shift();
      if(!Object.hasOwnProperty.call(currVar, prop)){
        if(!isNaN(path[0])) {
          currVar[prop] = [];
        } else {
          currVar[prop] = {};
        }
      }
      currVar = currVar[prop];
    }
    return currVar;
  },

  
  // Check if is <IE9 by defineProperty feature detection
  isLegacyIE: function(){
    try {
      Object.defineProperty({}, '', {});
      return false;
    } catch (err) {
      return true;
    }
    return true;
  },

  
  // Traverse scope to get parent object of given fqn for multiple scopes simultaneously, creating and returning the object if it doesn't exist
  multiForceGetParentVarAtFqn: function(fqn, scopes){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = scopes.slice(0);
    
    while(path.length > 1){
      var prop = path.shift();
      for(var i in scopes) {
        if(!Object.hasOwnProperty.call(currVar[i], prop)){
          if(!isNaN(path[0])) {
            currVar[i][prop] = [];
          } else {
            currVar[i][prop] = {};
          }
        }
        currVar[i] = currVar[i][prop];
      }
    }
    return currVar;
  },

  
  // Insert the value in the scope at the fqn, creating objects as necessary so the fqn exists
  createVarAtFqn: function(fqn, scope, value){
    var path = fqn.split(".");  

    var currVar = nowUtil.forceGetParentVarAtFqn(fqn, scope);
    currVar[path.pop()] = value;
  },

  
  // createVarAtFqn for multiple scopes
  multiCreateVarAtFqn: function(fqn, scopes, value){
    var path = fqn.split(".");
    var key = path.pop();
    var currVar = nowUtil.multiForceGetParentVarAtFqn(fqn, scopes);
    var i;
    
    if (value && typeof value === "object"){
      if(nowUtil.isArray(value)) {
        for(i in scopes) {
          currVar[i][key] = [];
        }
      } else {
        for(i in scopes) {
          currVar[i][key] = {};
        }
      }
      nowUtil.multiMergeScopes(currVar, key, value);
    } else {
      for(i in scopes) {
        currVar[i][key] = value;
      }    
    }

  },


  // Insert the value in the scope at the fqn, but add objects along the traversal to the blacklist, prepended with blacklistFqn
  createAndBlacklistVarAtFqn: function(fqn, scope, value, blacklist, blacklistFqn){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = scope;
    while(path.length > 1){
      var prop = path.shift();
      blacklistFqn += "."+prop;
      if(!Object.hasOwnProperty.call(currVar, prop)){
        if(!isNaN(path[0])) {
          blacklist[blacklistFqn] = true;
          currVar[prop] = [];
        } else {
          blacklist[blacklistFqn] = true;
          currVar[prop] = {};
        }
      }
      currVar = currVar[prop];
    }
    var finalProp = path.pop();
    blacklist[fqn] = true;
    currVar[finalProp] = value;
  },

  
  // Create var at fqn but instead of simply inserting the value, make a deep copy of the value
  deepCreateVarAtFqn: function(fqn, scope, value){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = nowUtil.getVarParentFromFqn(fqn, scope);
    if (value && typeof value === "object"){
      var prop = path.pop();
      if(nowUtil.isArray(value)) {
        currVar[prop] = [];
      } else {
        currVar[prop] = {};
      }
      nowUtil.mergeScopes(currVar[prop], value);
    } else {
      currVar[path.pop()] = value;
    }
  },

  
  // Deeply copy all children of incoming to current, with overwriting
  mergeScopes: function(current, incoming) {
    for(var prop in incoming){
      if(Object.hasOwnProperty.call(incoming, prop)) {
        if(incoming[prop] && typeof incoming[prop] === "object"){
          if(!Object.hasOwnProperty.call(current, prop)){
            if(nowUtil.isArray(incoming[prop])) {
              current[prop] = [];
            } else {
              current[prop] = {};
            }
          }
          nowUtil.mergeScopes(current[prop], incoming[prop]);
        } else {
          current[prop] = incoming[prop];
        }
      }
    }
  },

  
  // Deeply copy all children of incoming into each scope at current[i][key], with overwriting
  multiMergeScopes: function(current, key, incoming) {
    var i;
    for(var prop in incoming){
      if(Object.hasOwnProperty.call(incoming, prop)){
        if(incoming[prop] && typeof incoming[prop] === "object"){
          
          var newCurrent = [];
          
          for(i in current) {
            if(Object.hasOwnProperty.call(current, i)) {
              var curItem = current[i][key];        
              if(!Object.hasOwnProperty.call(curItem, prop)){
                if(nowUtil.isArray(incoming[prop])) {
                  curItem[prop] = [];
                } else {
                  curItem[prop] = {};
                }
              }
              newCurrent.push(current[i][key]);
            }
          }
          
          nowUtil.multiMergeScopes(newCurrent, prop, incoming[prop]);
        } else {
          for(i in current) {
            if(Object.hasOwnProperty.call(current, i)) {
              current[i][key][prop] = incoming[prop];
            }
          }
        }
      }
    }
  },

  
  // Create a shallow copy of incoming
  shallowCopy: function(incoming) {
    if(nowUtil.isArray(incoming)) {
      return incoming.slice();
    } else if(incoming && typeof incoming === "object") {
      var target = {};
      for(var key in incoming) {
        if(Object.hasOwnProperty.call(incoming, key)) {
          target[key] = incoming[key];
        }
      }
      return target;
    } else {
      return incoming;
    }
  },
  
  
  // Like multiMergeScopes but overwrite along the way with new nested objects
  multiDeepCopy: function(targets, incoming) {
    var i;
    if(incoming && typeof incoming === "object") {
      for(var prop in incoming){
        if(Object.hasOwnProperty.call(incoming, prop)) {
          if(incoming[prop] && typeof incoming[prop] === "object") {
            var next = [];
            for(i = 0; i < targets.length; i++){
              if(nowUtil.isArray(incoming[prop])) {
                targets[i][prop] = [];
              } else {
                targets[i][prop] = {};  
              }
              next[i] = targets[i][prop];
            }
            nowUtil.multiDeepCopy(next, incoming[prop]);
          } else {
            for(i = 0; i < targets.length; i++){
              targets[i][prop] = incoming[prop];
            }
          }
        }
      }
    } else {
      for(i = 0; i < targets.length; i++){
        targets[i] = incoming;
      }
    }
    return targets;
  },

  
  // Take the hash of changes and insert into each give scope
  // Changes is a map of fqn's to new values
  mergeChanges: function(scopes, changes) {
    for(var fqn in changes) {
      nowUtil.multiCreateVarAtFqn(fqn, scopes, changes[fqn]);
    }
  },

  
  // Log errors
  debug: function(func, msg){
    //console.log(func + ": " + msg);
  },

  
  // Log errors
  error: function(err){
    console.log(err);
    if(Object.hasOwnProperty.call(err, 'stack')){
      console.log(err.stack);
    }
  },

  
  // Log errors
  print: function(msg) {
    //console.log(msg);
  },

  
  
  // Pass in an object, a prefix for the fqn, and an array of funcHandlers that take a function and return a modified version
  // Returns an array of objects, each corresponding with one modified by one of the funcHandlers in the parameter array
  // Also change cyclical objects to a representation describing which object it is cyclically pointing to
  decycle: function decycle(object, key, funcHandlers) {
    "use strict";
    var objects = [],
        paths = [];
    return (function derez(value, path, fqn) {
        var i, j, nu = [];
        var output = [];
      
        switch (typeof value) {
        case 'object':
          if (!value) {
            for(i = 0; i < funcHandlers.length; i += 1) {
              nu.push(null);
            }
            return nu;
          }
          for (i = 0; i < objects.length; i += 1) {
            if (objects[i] === value) {                
              for(i = 0; i < funcHandlers.length; i += 1) {
                nu.push({$ref: paths[i]});
              }
              return nu;
            }
          }
          objects.push(value);
          paths.push(path);
          var values;
          if (Object.prototype.toString.apply(value) === '[object Array]') {
            nu = [];
            for(i = 0; i < funcHandlers.length; i += 1) {
              nu.push([]);
            }
            for (i = 0; i < value.length; i += 1) {
              values = derez(value[i], path + '[' + i + ']', fqn+"."+i);
              for(j in values) {
                if (Object.hasOwnProperty.call(values, j)) {
                  nu[j][i] = values[j];
                }
              }
            }
          } else {
            nu = [];
            for(i = 0; i < funcHandlers.length; i += 1) {
              nu.push({});
            }
            for (var name in value) {
              if (Object.prototype.hasOwnProperty.call(value, name)) {
                values = derez(value[name], path + '[' + JSON.stringify(name) + ']', fqn+"."+name);
                for(j in values) {
                  if (Object.hasOwnProperty.call(values, j)) {
                    nu[j][name] = values[j];
                  }
                }
              }
            }
          }
          return nu;
        case 'function':
          for(i = 0; i < funcHandlers.length; i += 1) {
            output[i] = funcHandlers[i](fqn, value);
          }
          return output;
        case 'undefined':
          for(i = 0; i < funcHandlers.length; i += 1) {
            nu.push(undefined);
          }
          return nu;
        case 'number':
        case 'string':
        case 'boolean':
            for(i = 0; i < funcHandlers.length; i += 1) {
              output[i] = value;
            }
            return output;
        }
    }(object, '$', key));
  },


  // Take $ and deserialize by replacing objects with object.type == function with the return value of funcHandlers
  // Restore cyclical structures as serialized by decycle
  retrocycle: function retrocycle($, funcHandler) {
    "use strict";
    var px = /^\$(?:\[(?:\d?|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;
    (function rez(value) {
        var i, item, name, path;
        if (value && typeof value === 'object') {
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                for (i = 0; i < value.length; i += 1) {
                    item = value[i];
                    if(Object.hasOwnProperty.call(item, "type") && item.type === 'function') {
                      value[i] = funcHandler(value[i]);
                      item = value[i];
                    }
                    if (item && typeof item === 'object') {
                        path = item.$ref;
                        if (typeof path === 'string' && px.test(path)) {
                            value[i] = eval(path);
                        } else {
                            rez(item);
                        }
                    }
                }
            } else {
                for (name in value) {
                    if (value[name] && typeof value[name] === 'object') {
                        item = value[name];
                        if (item) {
                            if(Object.hasOwnProperty.call(item, "type") && item.type === 'function') {
                              value[name] = funcHandler(value[name]);
                            } else {
                              path = item.$ref;
                              if (typeof path === 'string' && px.test(path)) {
                                  value[name] = eval(path);
                              } else {
                                  rez(item);
                              }
                            }
                        }
                    }
                }
            }
        }
    })($);
    return $;
  },

  
  // Merge incoming into target , without overwriting
  // When a function is encounter, replace with return value of mapFn applied with the function as a parameter
  mapAndMergeFunctionsInScopes: function(target, incoming, mapFn){
    nowUtil.mapAndMergeFunctionsInScopeHelper(target, incoming, mapFn, 'now');
  },

  mapAndMergeFunctionsInScopesHelper: function(target, incoming, mapFn, fqn){
    for(var key in incoming){
      fqn += '.' + key;
      if(target && !Object.hasOwnProperty.call(target, key)){
        if(nowUtil.isArray(incoming[key])){
          target[key] = [];
          nowUtil.mapAndMergeFunctionsInScopeHelper(target[key], incoming[key], mapFn, fqn);
        } else if (typeof incoming[key] == 'object'){
          target[key] = {};
          nowUtil.mapAndMergeFunctionsInScopeHelper(target[key], incoming[key], mapFn, fqn);
        } else if(typeof incoming[key] == 'function'){
          target[key] = mapFn(fqn, func);
        }
      }
    }
  },

  
  // Merge incomingScope into the targetGroups's now object, replacing functions with corresponding multicallers and without overwriting
  multiMergeFunctionsToMulticallers: function(targetGroups, incomingScope){
    
    var targetScopes = {};
    for(var i in targetGroups){
      targetScopes[i] = targetGroups[i].nowScope;
    }

    nowUtil.multiMergeFunctionsToMulticallersHelper(targetGroups, targetScopes, incomingScope, 'now');
  },

  multiMergeFunctionsToMulticallersHelper: function(targetGroups, targetScopes, incomingScope, fqn){
    for(var key in incomingScope){
      var newFqn = fqn + '.' + key;
      for(var i in targetScopes){
        var target = targetScopes[i];
        if(target && !Object.hasOwnProperty.call(target, key)){
          if(nowUtil.isArray(incomingScope[key])){
            target[key] = [];
            targetScopes[i] = target[key];
            nowUtil.multiMergeFunctionsToMulticallersHelper(targetGroups, targetScopes, incomingScope[key], newFqn);
          } else if (typeof incomingScope[key] == 'object'){
            target[key] = {};
            targetScopes[i] = target[key];
            nowUtil.multiMergeFunctionsToMulticallersHelper(targetGroups, targetScopes, incomingScope[key], newFqn);
          } else if(typeof incomingScope[key] == 'function'){
            target[key] = targetGroups[i].generateMultiCaller(newFqn);
          }
        }
      }

    }
  },

  
  // Generate unique ids
  generateRandomString: function(){
    return Math.random().toString().substr(2); 
  }

};




// JSON shim for older IE
if('window' in this) {
  window.nowUtil = nowUtil;
  if(!('JSON' in window)){
    JSON={};
    (function(){"use strict";function f(n){return n<10?'0'+n:n;}
    if(typeof Date.prototype.toJSON!=='function'){Date.prototype.toJSON=function(key){return isFinite(this.valueOf())?this.getUTCFullYear()+'-'+
    f(this.getUTCMonth()+1)+'-'+
    f(this.getUTCDate())+'T'+
    f(this.getUTCHours())+':'+
    f(this.getUTCMinutes())+':'+
    f(this.getUTCSeconds())+'Z':null;};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf();};}
    var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==='string'?c:'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);})+'"':'"'+string+'"';}
    function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);}
    if(typeof rep==='function'){value=rep.call(holder,key,value);}
    switch(typeof value){case'string':return quote(value);case'number':return isFinite(value)?String(value):'null';case'boolean':case'null':return String(value);case'object':if(!value){return'null';}
    gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==='[object Array]'){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||'null';}
    v=partial.length===0?'[]':gap?'[\n'+gap+partial.join(',\n'+gap)+'\n'+mind+']':'['+partial.join(',')+']';gap=mind;return v;}
    if(rep&&typeof rep==='object'){length=rep.length;for(i=0;i<length;i+=1){if(typeof rep[i]==='string'){k=rep[i];v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}else{for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}
    v=partial.length===0?'{}':gap?'{\n'+gap+partial.join(',\n'+gap)+'\n'+mind+'}':'{'+partial.join(',')+'}';gap=mind;return v;}}
    if(typeof JSON.stringify!=='function'){JSON.stringify=function(value,replacer,space){var i;gap='';indent='';if(typeof space==='number'){for(i=0;i<space;i+=1){indent+=' ';}}else if(typeof space==='string'){indent=space;}
    rep=replacer;if(replacer&&typeof replacer!=='function'&&(typeof replacer!=='object'||typeof replacer.length!=='number')){throw new Error('JSON.stringify');}
    return str('',{'':value});};}
    if(typeof JSON.parse!=='function'){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==='object'){for(k in value){if(Object.prototype.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v;}else{delete value[k];}}}}
    return reviver.call(holder,key,value);}
    text=String(text);cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return'\\u'+
    ('0000'+a.charCodeAt(0).toString(16)).slice(-4);});}
    if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,''))){j=eval('('+text+')');return typeof reviver==='function'?walk({'':j},''):j;}
    throw new SyntaxError('JSON.parse');};}}());
  }

} else {

  exports.nowUtil = nowUtil;
  
}
