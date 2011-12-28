/*
 * Module dependencies.
 */
var fs = require('fs')
  , package = JSON.parse(fs.readFileSync(__dirname + '/../package.json'))
  , jsp = require("uglify-js").parser
  , pro = require("uglify-js").uglify;



var template = '/*! now.%ext% build:' + package.version + ', %type%. Copyright(c) 2011 Flotype <team@flotype.com> MIT Licensed */\n'
  , development = template.replace('%type%', 'development').replace('%ext%', 'js')
  , production = template.replace('%type%', 'production').replace('%ext%', 'min.js');



  //array base containing all the files to be read.
  base = ['now.js'];
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
      var code = production + pro.gen_code(ast, {ascii_only: true});
       
      code += ';';
      fs.write(
          fs.openSync(__dirname + '/../lib/dist/now.js', 'w')
        , code
        , 0
        , 'utf8'  
      );
      
    });
  }); 

