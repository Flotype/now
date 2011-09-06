var fs = require('fs');
var server = require('http').createServer(function(req, response){
  fs.readFile(__dirname+'/helloworld.html', function(err, data){
    response.writeHead(200, {'Content-Type':'text/html'});
    response.write(data);
    response.end();
  });
});
server.listen(8080);
var nowjs = require("now");
var everyone = nowjs.initialize(server);



nowjs.on("connect", function(){
  console.log("Joined: " + this.now.name);
});

nowjs.on("disconnect", function(){
  console.log("Left: " + this.now.name);
});


everyone.now.distributeMessage = function(message){
  everyone.now.receiveMessage(this.now.name, message);
};