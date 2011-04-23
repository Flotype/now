var fs = require('fs');
var server = require('http').createServer(function(req, response){
  fs.readFile(__dirname+'/helloworld.html', function(err, data){
    response.writeHead(200, {'Content-Type':'text/html'}); 
    response.write(data);  
    response.end();
  });
});
server.listen(8080);
var everyone = require("./../../lib/nowServerLib.js").initialize(server);

var clients = {};

everyone.connected(function(){
  console.log("Joined: " + this.now.name + "/" + everyone.count);
  clients[this.clientId] = {now: this.now, connectedClient: true};
});


everyone.disconnected(function(){
  console.log("Left: " + this.now.name + "/" + everyone.count);
  clients[this.clientId].connectedClient = false;
});

everyone.now.distributeMessage = function(message){everyone.now.receiveMessage(this.now.name, message);};

everyone.now.try = function(){
  clients[this.clientId].now.getContext();

}

everyone.now.getContext = function(id, cb){ 
   console.log(this);
};