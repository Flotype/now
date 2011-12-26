/*
 *	This is an example of creating an object that autoloads
 *	files and directories from a specified folder into an object
 *	in order to emulate a namespace loader.
 *
 *	The preferred naming convention is property names
 *	of Objects begin lower case, while directory and file names
 *	should begin upper case in order to avoid naming conflicts
 *
 */

var sys = require("sys"),
	assert = require("assert"),
	namespace = require(__dirname + "/autoload-namespace").namespace,
	org = namespace(__dirname + "/org");

sys.puts("test 1");
assert.equal(typeof(org), "object", "org is not an object");
sys.puts("test 2");
assert.equal(typeof(org.w3c), "object", "org.w3c is not an object");
sys.puts("test 3");
assert.equal(typeof(org.w3c.DOM), "object", "org.w3c.DOM is not an object");
sys.puts("test 4");
assert.equal(typeof(org.w3c.DOM.Document), "object", "org.w3c.DOM.Document is not an object");
sys.puts("test 5");
assert.equal(typeof(org.w3c.DOM.Document.string), "string", "org.w3c.DOM.Document.string is not a string");
sys.puts("test 6");
assert.equal(org.w3c.DOM.Document.string.toString(), "String", "org.w3c.DOM.Document.string is not equal to 'String'");
sys.puts("test 7");
assert.equal(typeof(org.w3c.DOM.Document.String.Test), "object", "org.w3c.DOM.Document.String.Test is not an object");
sys.puts("test 8");
assert.equal(typeof(org.w3c.DOM.Document.String.Test.success), "string", "org.w3c.DOM.Document.String.Test.success is not an string");
sys.puts("test 9");
assert.equal(org.w3c.DOM.Document.String.Test.success, "success", "org.w3c.DOM.Document.String.Test.success is not equal to 'success'");
sys.puts(typeof(org.w3c.DOM.Document.create));
sys.puts(typeof(function(){}));
sys.puts(Object.prototype.toString.call(org.w3c.DOM.Document.create));
sys.puts(org.w3c.DOM.Document.create instanceof Function);
org.w3c.DOM.Document.create(sys);