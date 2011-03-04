var proxy = require('./wrap.js');
var nproxy = require('node-proxy');
var cycle = require('./cycle.js');
//var diff_match_patch = require('./diff_match_patch.js').diff_match_patch;

var store = {
  set: function(key, val, callback){
    console.log("set " + key);
    callback();  
  },
  remove: function(key){
    console.log("remove " + key);
  }
}

var now = {};
now = proxy.wrap(store, now);

setTimeout(function(){
    now.a = {c: [{}]};
    delete now.a.c;
}, 2000);


