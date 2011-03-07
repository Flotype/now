var Proxy = require('node-proxy');

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

exports.wrap = function (store, sessions) {
    var taint = {};
    var taintedFqns = {};
    var set = store ? (store.set || store.save).bind(store) : null;
    
    function update (key, fqn) {
        
        if (!taint[key] && store) {
            taintedFqns[key] = {};
            process.nextTick(function () {
                if (sessions.hasOwnProperty(key)) {
                    set(key, sessions[key], function (err) {
                        if (err) console.error(err)
                    },  taintedFqns[key]);
                }
                else {
                    store.remove(key);
                }
                taint[key] = undefined;
                taintedFqns[key] = undefined;
            });
        }
        taint[key] = true;
        var val = getVarAtFqn(fqn, sessions[key]);
        fqn = "now."+convertToDotNotation(fqn);
        taintedFqns[key][fqn] = (val.hasOwnProperty('toFqn'))? val.toFqn() : val;
    }
    
    function wrapRoot (rootKey, obj, path) {
        if (typeof obj !== 'object' || obj === null) return obj;
        var setTaint = update.bind({}, rootKey);
        var wrap = wrapRoot.bind({}, rootKey);
                
        return Proxy.create({
            get : function (recv, name) {
                if (name === 'toJSON' && !obj.hasOwnProperty(name)) {
                    return function () { return obj };
                } else if(name === 'toFqn' && !obj.hasOwnProperty(name)) {
                    return function () { return {$ref: '$'+path} };
                } else return wrap(obj[name], path+"[\""+ name+"\"]");
            },
            set : function (recv, name, value) {
                obj[name] = value;
                setTaint(path+"[\""+ name+"\"]");
                return wrap(obj[name], path+"[\""+ name+"\"]");
            },
            enumerate : function () {
                return Object.keys(obj)
            },
            hasOwn : function(name) {
                return obj.hasOwnProperty(name);
            },
            delete : function (name) {
                if (obj.propertyIsEnumerable(name)) {
                    setTaint(path);
                }
                delete obj[name];
            },
            fix : function () {
                return undefined;
            },
        }, Object.getPrototypeOf(obj))
    }
    
    return Proxy.create({
        get : function (recv, name) {
            if (name === 'toJSON' && !sessions.hasOwnProperty(name)) {
                return function () { return sessions }
            }
            else return wrapRoot(name, sessions[name], "[\""+name+"\"]")
        },
        set : function (recv, name, value) {
            sessions[name] = value;
            update(name, "[\""+name+"\"]");
            return wrapRoot(name, value, name);
        },
        enumerate : function () {
            return Object.keys(sessions)
        },        
        hasOwn : function(name) {
            return sessions.hasOwnProperty(name);
        },
        delete : function (name) {
            update(name, "[\""+name+"\"]");
            delete session[name];
        },
        fix : function () {
            return undefined;
        },
    }, Object.getPrototypeOf(sessions));
};