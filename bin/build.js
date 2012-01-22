/*
 * Module dependencies.
 */
var fs = require('fs')
  , package = JSON.parse(fs.readFileSync(__dirname + '/../package.json'))
  , jsp = require("uglify-js").parser
  , pro = require("uglify-js").uglify;



var template = '/*! now.js build:' + package.version + '. Copyright(c) 2011 Flotype <team@flotype.com> MIT Licensed */\n'
  
var base = ['now.js'];
var files = [];
base.forEach(function (file) {
  files.push(__dirname + '/../lib/client/' + file);
});

var results = {};
files.forEach(function (file) {
  fs.readFile(file, function (err, content) {
      
    if (err) throw err;
    var code = content.toString();
    var ast = jsp.parse(code);
    ast = pro.ast_squeeze(ast, {make_seqs: false, dead_code: false});
    var code = template + pro.gen_code(ast, {ascii_only: true});
     
    code += ';';
    fs.write(
        fs.openSync(__dirname + '/../dist/now.js', 'w')
      , code
      , 0
      , 'utf8'  
    );
    
  });
}); 

