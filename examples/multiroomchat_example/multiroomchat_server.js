﻿var fs = require('fs');
var server = require('http').createServer(function(req, response){
  fs.readFile(__dirname+'/multiroomchat.html', function(err, data){
    response.writeHead(200, {'Content-Type':'text/html'}); 
    response.write(data);  
    response.end();
  });
});
server.listen(8080);


var nowjs = require("now");
var everyone = nowjs.initialize(server);


everyone.on('connect', function(){
  var defaultRoom = "room 1",
      group = nowjs.getGroup(defaultRoom);

  this.now.room = defaultRoom;

  if (group.now.receiveMessage) {
    group.now.receiveMessage("SERVER", this.now.name + " has joined the channel");
  }
  group.addUser(this.user.clientId);

  console.log("Joined: " + this.now.name);
});


everyone.on('disconnect', function(){
  console.log("Left: " + this.now.name);
});

everyone.now.changeRoom = function(newRoom){
  var group = nowjs.getGroup(this.now.room);
  
  group.removeUser(this.user.clientId);
  group.now.receiveMessage("SERVER", this.now.name + " has left the room");

  this.now.room = newRoom;
  this.now.receiveMessage("SERVER", "You're now in " + this.now.room);

  group = nowjs.getGroup(newRoom);
  if (group.now.receiveMessage) {
    group.now.receiveMessage("SERVER", this.now.name + " has joined the room");
  }  
  group.addUser(this.user.clientId);
}

everyone.now.distributeMessage = function(message){
  nowjs.getGroup(this.now.room).now.filterMessage(this.user.clientId, this.now.name, message);
};

everyone.now.filterMessage = function(clientId, name, message){
    if (clientId === this.user.clientId) {
        return;
    }
    this.now.receiveMessage(name, message);
}
