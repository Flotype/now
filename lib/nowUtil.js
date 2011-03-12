if('window' in this) {
  window.nowUtil = {};
} else {
  nowUtil = exports;
}


/* ===== BEGIN NOW UTILS ===== */

nowUtil.serializeFunction = function(fqn, func) {
  return {type: "function", fqn: fqn};
}

nowUtil.addChildrenToBlacklist = function(blacklist, parentObj, parentFqn){
  for(var prop in parentObj){
    blacklist[(parentFqn+"."+prop)] = true;
    if(typeof parentObj[prop] == 'object'){
      nowUtil.addChildrenToBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
    }
  }
}

nowUtil.removeChildrenFromBlacklist = function(blacklist, parentObj, parentFqn){
  for(var prop in parentObj){
    delete blacklist[(parentFqn+"."+prop)];
    if(typeof parentObj[prop] == 'object'){
      nowUtil.removeChildrenFromBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
    }
  }
}

nowUtil.getAllChildFqns = function(parentObj, parentFqn){
  var fqns = [];
  
  function getAllChildFqnsHelper(parentObj, parentFqn){
    for(var prop in parentObj){
      fqns.push(parentFqn+"."+prop);
      if(typeof parentObj[prop] == 'object'){
        getAllChildFqnsHelper(parentObj[prop], parentFqn+"."+prop);
      }
    }
  }
  getAllChildFqnsHelper(parentObj, parentFqn);
  return fqns; 
}

nowUtil.watch =  function (obj, prop, fqn, handler) {
  var val = obj[prop];
  var getter = function () {
    return val;
  }
  var setter = function (newVal) {
    var oldval = val;
    val = newVal;
    handler.call(obj, prop, fqn, oldval, newVal);
    return newVal;
  }
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

nowUtil.initializeScope = function(obj, socket) {
  var data = nowUtil.decycle(obj, 'now', [nowUtil.serializeFunction]);
  var scope = data[0];
  nowUtil.debug("initializeScope", JSON.stringify(data));
  //nowUtil.print(scope);
  socket.send({type: 'createScope', data: {scope: scope}});
}

nowUtil.isArray = function (obj) {
  return Array.isArray(obj);
}

nowUtil.getVarFromFqn = function(fqn, scope){
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
}

nowUtil.getVarParentFromFqn = function(fqn, scope){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = scope;
  while(path.length > 1){
    var prop = path.shift();
    currVar = currVar[prop];
  }
  return currVar;
}

nowUtil.forceGetParentVarAtFqn = function(fqn, scope){
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
}

nowUtil.multiForceGetParentVarAtFqn = function(fqn, scopes){
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
}

nowUtil.createVarAtFqn = function(fqn, scope, value){
  var path = fqn.split(".");  

  var currVar = nowUtil.forceGetParentVarAtFqn(fqn, scope);
  currVar[path.pop()] = value;
}

nowUtil.multiCreateVarAtFqn = function(fqn, scopes, value){
  var path = fqn.split(".");
  var key = path.pop();
  var currVar = nowUtil.multiForceGetParentVarAtFqn(fqn, scopes);
  
  
  if (typeof value == "object"){
    if(nowUtil.isArray(value)) {
      for(var i in scopes) {
        currVar[i][key] = [];
      }
    } else {
      for(var i in scopes) {
        currVar[i][key] = {};
      }
    }
    nowUtil.multiMergeScopes(currVar, key, value);
  } else {
    for(var i in scopes) {
      currVar[i][key] = value;
    }    
  }
  
  
  
  
}


nowUtil.createAndBlacklistVarAtFqn = function(fqn, scope, value, blacklist, blacklistFqn){
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
}

nowUtil.deepCreateVarAtFqn= function(fqn, scope, value){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = nowUtil.getVarParentFromFqn(fqn, scope);
  if (typeof value == "object"){
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
}

nowUtil.mergeScopes = function(current, incoming) {
  for(var prop in incoming){
    if(typeof incoming[prop] == "object"){
      if(!current.hasOwnProperty(prop)){
        if(nowUtil.isArray(incoming[prop])) {
          current[prop] = [];
        } else {
          current[prop] = {};
        }
      }
      nowUtil.mergeScopes(current[prop], incoming[prop]);
    } else {
      if(!current.hasOwnProperty(prop)){
        current[prop] = incoming[prop];
      }
    }
  }
}

nowUtil.multiMergeScopes = function(current, key, incoming) {
  for(var prop in incoming){
    if(typeof incoming[prop] == "object"){
      
      var newCurrent = [];
      
      for(var i in current) {
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
      
      nowUtil.multiMergeScopes(newCurrent, prop, incoming[prop]);
    } else {
      for(var i in current) {
        current[i][key][prop] = incoming[prop];
      }
    }
  }
}


nowUtil.multiDeepCopy = function(targets, incoming) {
  if(typeof incoming == "object") {
    for(var prop in incoming){
      if(typeof incoming[prop] == "object") {
        var next = [];
        for(var i in targets){
          if(nowUtil.isArray(incoming[prop])) {
            targets[i][prop] = [];
          } else {
            targets[i][prop] = {};  
          }
          next[i] = targets[i][prop];
        }
        nowUtil.multiDeepCopy(next, incoming[prop]);
      } else {
        for(var i in targets){
          targets[i][prop] = incoming[prop];
        }
      }
    }
  } else {
    for(var i in targets){
      targets[i] = incoming;
    }
  }
  return targets;
}

nowUtil.mergeChanges = function(scopes, changes) {
  for(var fqn in changes) {
    nowUtil.multiCreateVarAtFqn(fqn, scopes, changes[fqn]);
  }
}

nowUtil.debug = function(func, msg){
  //console.log(func + ": " + msg);
}

nowUtil.print = function(msg) {
  //console.log(msg);
}

nowUtil.decycle = function decycle(object, key, funcHandlers) {
  "use strict";
  var objects = [],
      paths = [];
  return (function derez(value, path, name, fqn) {
      var i, name, nu;
      
      switch (typeof value) {
      case 'object':
          if (!value) {
              return null;
          }
          for (i = 0; i < objects.length; i += 1) {
              if (objects[i] === value) {                
                for(var i in funcHandlers) {
                  nu.push({$ref: paths[i]});
                }
                return nu;
              }
          }
          objects.push(value);
          paths.push(path);
          if (Object.prototype.toString.apply(value) === '[object Array]') {
              nu = [];
              for(var i in funcHandlers) {
                nu.push([]);
              }
              for (i = 0; i < value.length; i += 1) {
                  var values = derez(value[i], path + '[' + i + ']', i, fqn+"."+i);
                  for(var j in values) {
                    nu[j][i] = values[j];
                  }
              }
          } else {
              nu = [];
              for(var i in funcHandlers) {
                nu.push({});
              }
              for (name in value) {
                  if (Object.prototype.hasOwnProperty.call(value, name)) {
                      var values = derez(value[name], path + '[' + JSON.stringify(name) + ']', name, fqn+"."+name);
                  }
                  for(var j in values) {
                    nu[j][name] = values[j];
                  }
              }
          }
          return nu;
      case 'function':
          var output = [];
          for(var i in funcHandlers) {
            output[i] = funcHandlers[i](fqn, value);
          }
          return output;
      case 'number':
      case 'string':
      case 'boolean':
          var output = [];
          for(var i in funcHandlers) {
            output[i] = value;
          }
          return output;
      }
  }(object, '$', '', key));
};


nowUtil.retrocycle = function retrocycle($, funcHandler) {
  "use strict";
  var px = /^\$(?:\[(?:\d?|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;
  (function rez(value, fqn) {
      var i, item, name, path;
      if (value && typeof value === 'object') {
          if (Object.prototype.toString.apply(value) === '[object Array]') {
              for (i = 0; i < value.length; i += 1) {
                  item = value[i];
                  if(item.hasOwnProperty("type") && item.type == 'function') {
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
                  if (typeof value[name] === 'object') {
                      item = value[name];
                      if (item) {
                          if(item.hasOwnProperty("type") && item.type == 'function') {
                            value[name] = funcHandler(value[name]);
                            item = value[name];
                          }
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
  })($);
  return $;
};