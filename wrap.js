var Proxy = require('node-proxy');
exports.wrap = function (store, sessions) {
    var taint = {};
    var set = store ? (store.set || store.save).bind(store) : null;
    
    function update (key) {
        if (!taint[key] && store) {
            process.nextTick(function () {
                if (sessions.hasOwnProperty(key)) {
                    set(key, sessions[key], function (err) {
                        if (err) console.error(err)
                    });
                }
                else {
                    store.remove(key);
                }
                taint[key] = undefined;
            });
        }
        taint[key] = true;
    }
    
    function wrapRoot (rootKey, obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        var setTaint = update.bind({}, rootKey);
        var wrap = wrapRoot.bind({}, rootKey);
        
        return Proxy.create({
            get : function (recv, name) {
                if (name === 'toJSON' && !obj.hasOwnProperty(name)) {
                    return function () { return obj };
                }
                else return wrap(obj[name]);
            },
            set : function (recv, name, value) {
                setTaint();
                obj[name] = value;
                return wrap(obj[name]);
            },
            enumerate : function () {
                return Object.keys(obj)
            },
            delete : function (name) {
                if (obj.propertyIsEnumerable(name)) {
                    setTaint();
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
            else return wrapRoot(name, sessions[name])
        },
        set : function (recv, name, value) {
            sessions[name] = value;
            update(name);
            return wrapRoot(name, value);
        },
        enumerate : function () {
            return Object.keys(sessions)
        },
        delete : function (name) {
            update(name);
            delete session[name];
        },
        fix : function () {
            return undefined;
        },
    }, Object.getPrototypeOf(sessions));
};