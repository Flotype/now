
var fs = require('fs');
var server = require('http').createServer(function(req, response){
  fs.readFile('lolol.html', function(err, data){
    response.writeHead(200);  
    response.write(data);  
    response.end();
  });
});
server.listen(8080);


var everyone = require("./nowServerLib.js").initialize(server);

everyone.now.setVar = function(){
  this.now.harro = "foobar";
}

everyone.now.distributeMessage = [function(name, message){everyone.now.receiveMessage(name, message);}];
everyone.now.j = function(){
  everyone.now.a[everyone.now.a.length-1]();
};


everyone.now.z = [1,2,3];
