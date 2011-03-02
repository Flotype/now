var proxy = require('./wrap.js');

var store = {
  set: function(key, val, callback){
    console.log("set " + key +" : " +val);
    callback();  
  },
  remove: function(key){
    console.log("remove " + key);
  }
}

var now = {};

now = proxy.wrap(store, now);




now.a = {c:1, d:2};
now.b = now.a;
setTimeout(function(){

  now.b.c = 1;
}, 2000);


