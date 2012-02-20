var fs = require('fs');
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


nowjs.on('connect', function(){
  this.now.room = "room 1";
  nowjs.getGroup(this.now.room).addUser(this.user.clientId);
  console.log("Joined: " + this.now.name);
});


nowjs.on('disconnect', function(){
  console.log("Left: " + this.now.name);
});

everyone.now.changeRoom = function(newRoom){
  this.now.distributeMessage("[leaving " + this.now.room + "]");
  nowjs.getGroup(this.now.room).removeUser(this.user.clientId);
  nowjs.getGroup(newRoom).addUser(this.user.clientId);
  this.now.room = newRoom;
  this.now.distributeMessage("[entering " + this.now.room + "]");
  var that = this;
  nowjs.getGroup(this.now.room).count(function(count){
    var prettyCount = (count === 1) ? "Room is empty." : (count - 1) + " other(s) in room.";
    that.now.receiveMessage("SERVER", "You're now in " + that.now.room + ". " + prettyCount);
  });
}

everyone.now.distributeMessage = function(message){
  nowjs.getGroup(this.now.room).now.receiveMessage(this.now.name, message);
};
