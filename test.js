var proxy = require('./wrap.js');
var nproxy = require('node-proxy');
var cycle = require('./cycle.js');
//var diff_match_patch = require('./diff_match_patch.js').diff_match_patch;

var store = {
  set: function(key, val, callback){
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
    now.b = now.a.c[0];
    
    var stringified_now = JSON.stringify(now);
    console.log(stringified_now);
    var restored_now = cycle.retrocycle(JSON.parse(stringified_now));
    console.log(JSON.stringify(restored_now));
    console.log(restored_now.b == restored_now.a.c[0]);
}, 2000);


