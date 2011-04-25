var nowUtil = {

  serializeFunction: function(fqn, func) {
    return {type: "function", fqn: fqn};
  },

  addChildrenToBlacklist: function(blacklist, parentObj, parentFqn){
    for(var prop in parentObj){
      if(parentObj.hasOwnProperty(prop)){
        blacklist[(parentFqn+"."+prop)] = true;
        if(parentObj[prop] && typeof parentObj[prop] === 'object'){
          nowUtil.addChildrenToBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
        }
      }
    }
  },

  removeChildrenFromBlacklist: function(blacklist, parentObj, parentFqn){
    for(var prop in parentObj){
      if(parentObj.hasOwnProperty(prop)){
        delete blacklist[(parentFqn+"."+prop)];
        if(parentObj[prop] && typeof parentObj[prop] === 'object'){
          nowUtil.removeChildrenFromBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
        }
      }
    }
  },

  getAllChildFqns: function(parentObj, parentFqn){
    var fqns = [];
    
    function getAllChildFqnsHelper(parentObj, parentFqn){
      for(var prop in parentObj){
        if(parentObj.hasOwnProperty(prop)) {
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

  initializeScope: function(obj, socket) {
    var data = nowUtil.decycle(obj, 'now', [nowUtil.serializeFunction]);
    var scope = data[0];
    nowUtil.debug("initializeScope", JSON.stringify(data));
    nowUtil.print(scope);
    socket.send({type: 'createScope', data: {scope: scope}});
  },

  isArray: Array.isArray || function (obj) {
    return  Object.prototype.toString.call(obj) === '[object Array]'; 
  },

  getVarFromFqn: function(fqn, scope){
    var path = fqn.split(".");
    path.shift();
    var currVar = scope;
    while(path.length > 0){
      var prop = path.shift();
      if(currVar.hasOwnProperty(prop)) {
        currVar = currVar[prop];
      } else {
        return false;
      }
    }
    return currVar;
  },

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

  forceGetParentVarAtFqn: function(fqn, scope){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = scope;
    while(path.length > 1){
      var prop = path.shift();
      if(!currVar.hasOwnProperty(prop)){
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

  isLegacyIE: function(){
    try {
      Object.defineProperty({}, '', {});
      return false;
    } catch (err) {
      return true;
    }
    return true;
  },

  multiForceGetParentVarAtFqn: function(fqn, scopes){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = scopes.slice(0);
    
    while(path.length > 1){
      var prop = path.shift();
      for(var i in scopes) {
        if(!currVar[i].hasOwnProperty(prop)){
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

  createVarAtFqn: function(fqn, scope, value){
    var path = fqn.split(".");  

    var currVar = nowUtil.forceGetParentVarAtFqn(fqn, scope);
    currVar[path.pop()] = value;
  },

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


  createAndBlacklistVarAtFqn: function(fqn, scope, value, blacklist, blacklistFqn){
    var path = fqn.split(".");
    path.shift();
    
    var currVar = scope;
    while(path.length > 1){
      var prop = path.shift();
      blacklistFqn += "."+prop;
      if(!currVar.hasOwnProperty(prop)){
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

  mergeScopes: function(current, incoming) {
    for(var prop in incoming){
      if(incoming.hasOwnProperty(prop)) {
        if(incoming[prop] && typeof incoming[prop] === "object"){
          if(!current.hasOwnProperty(prop)){
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

  multiMergeScopes: function(current, key, incoming) {
    var i;
    for(var prop in incoming){
      if(incoming.hasOwnProperty(prop)){
        if(incoming[prop] && typeof incoming[prop] === "object"){
          
          var newCurrent = [];
          
          for(i in current) {
            if(current.hasOwnProperty(i)) {
              var curItem = current[i][key];        
              if(!curItem.hasOwnProperty(prop)){
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
            if(current.hasOwnProperty(i)) {
              current[i][key][prop] = incoming[prop];
            }
          }
        }
      }
    }
  },

  shallowCopy: function(incoming) {
    if(nowUtil.isArray(incoming)) {
      return incoming.slice();
    } else if(incoming && typeof incoming === "object") {
      var target = {};
      for(var key in incoming) {
        if(incoming.hasOwnProperty(key)) {
          target[key] = incoming[key];
        }
      }
      return target;
    } else {
      return incoming;
    }
  },
  
  multiDeepCopy: function(targets, incoming) {
    var i;
    if(incoming && typeof incoming === "object") {
      for(var prop in incoming){
        if(incoming.hasOwnProperty(prop)) {
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

  mergeChanges: function(scopes, changes) {
    for(var fqn in changes) {
      nowUtil.multiCreateVarAtFqn(fqn, scopes, changes[fqn]);
    }
  },

  debug: function(func, msg){
    //console.log(func + ": " + msg);
  },

  error: function(err){
    console.log(err);
    if(err.hasOwnProperty('stack')){
      console.log(err.stack);
    }
  },

  print: function(msg) {
    //console.log(msg);
  },

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
                return null;
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
                      nu[j][i] = values[j];
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
                        nu[j][name] = values[j];
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


  retrocycle: function retrocycle($, funcHandler) {
    "use strict";
    var px = /^\$(?:\[(?:\d?|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;
    (function rez(value) {
        var i, item, name, path;
        if (value && typeof value === 'object') {
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                for (i = 0; i < value.length; i += 1) {
                    item = value[i];
                    if(item.hasOwnProperty("type") && item.type === 'function') {
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
                            if(item.hasOwnProperty("type") && item.type === 'function') {
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

  mapAndMergeFunctionsInScopes: function(target, incoming, mapFn){
    nowUtil.mapAndMergeFunctionsInScopeHelper(target, incoming, mapFn, 'now');
  },

  mapAndMergeFunctionsInScopesHelper: function(target, incoming, mapFn, fqn){
    for(var key in incoming){
      fqn += '.' + key;
      if(target && !target.hasOwnProperty(key)){
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
        if(target && !target.hasOwnProperty(key)){
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

  generateRandomString: function(){
    return Math.random().toString().substr(2); 
  }

};

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
