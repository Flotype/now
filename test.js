var server = require('http').createServer(function(req, res){});
server.listen(80);

var everyone = require("./nowServerLib.js").initialize(server);

everyone.now.distributeMessage = [function(name, message){everyone.now.receiveMessage(name, message);}];
everyone.now.j = function(){
  everyone.now.a[everyone.now.a.length-1]();
};

everyone.now.z = [1,2,3];

setTimeout(function(){everyone.now.j = 3;}, 3000);