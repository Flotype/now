/*
 *	This package exports one function: namespace
 *	in order to create a system of namespace loading 
 *	from a given directory. Directories and files are
 *	loaded into a proxy object in order to provide a
 *	system for loading additional files and directories
 *	the namespace.
 *
 *	This system does not proxy scalar values on an object
 *	because of the 
 *
 */
var Proxy = require("node-proxy"),
	fs = require("fs"),
	sys = require("sys"),
	path = require("path"),
	undef, extensions;

function isFunction(fn) {
	return !!fn && 
			Object.prototype.toString.call(fn) == 
				"[object Function]";
}

function isScalar(fn) {
	switch (typeof fn) {
		case "string": return true;
		case "number": return true;
	}
	return false;
}

function inPath(file) {
	var i = 0, l = extensions.length;

	for (;i<l;++i) {
		if (path.existsSync(file + "." + extensions[i])) {
			return true;
		}
	}
	return false;
}

exports.namespace = function namespace(filePath, properties) {
	properties = properties || {};
	
	var scalar = isScalar(properties),
		func = isFunction(filePath),
		handlers = {
			get: function(rec, name) {
				if (name === "valueOf" || name === "toString") {
					return function(){
						return properties[name]();
					};
				}
				if (!(name in properties)) {
					if (func) {
						handlers[name] = filePath(name, properties);
					} else {
						//sys.puts(name);
						var file = path.join(filePath, name),
							stat, obj;
						
						if (inPath(file)) {
							obj = require(file);
						}
						
						if (!obj) {
							try{
								// would work if it was a directory
								stat = fs.statSync(file);
							} catch(e) {}
						}
						if (stat || obj) {
							properties[name] = obj ? 
											namespace(file, obj) : 
											// this allows you to use an 
											// object as a namespace as well
											namespace(file);
						} else {
							return undef;
						}
					}
				} else if (!isScalar(properties[name]) && !Proxy.isProxy(properties[name])) {
					properties[name] = namespace(path.join(filePath, name), properties[name]);
				}
				//sys.puts("returning");
				return properties[name];
			
			},
			has: function(name) {
				return name === "valueOf" || 
						name === "toString" || 
						inPath(path.join(filePath, name));
			},
			set: function(rec, name, value) {
				properties[name] = value;
			},
			"delete": function(name) {
				return false;
			},
			enumerate: function() {
				return Object.keys(properties);
			},
			fix: function() {
				return undef;
			}
		};
	
	return isFunction(properties) ?
			Proxy.createFunction(handlers, function() {
				return properties.apply(this, arguments);
			}) :
			Proxy.create(handlers, properties.constructor.prototype);
};

extensions = exports.namespace.extensions = ["js", "node"];



