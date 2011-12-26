

exports.string = "String";
exports.object = {};
exports.regexp = /regex/;
exports.create = function(sys) {
	sys.puts("A proxified function was called inside of Document.js")
};