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

everyone.on('connect', function() {
  this.now.setRoom("room 1");
  console.log("Joined: " + this.now.name);
});

everyone.on('disconnect', function() {
  if (this.now.room) {
    this.now.setRoom(false);
  }
  console.log("Left: " + this.now.name);
});

everyone.now.setRoom = function(newRoom) {
  var group;
 
  if (this.now.room) {
    group = nowjs.getGroup(this.now.room);
    group.removeUser(this.user.clientId);
    group.now.receiveMessage("SERVER", this.now.name + " has left the room");
  } 
 
  if (newRoom) { 
    this.now.room = newRoom;
  
    group = nowjs.getGroup(newRoom);
  
    if (group.count) {
        /* Best way to do this?
        present = [];
        group.now.each(function(member) {
              present.push(member.now.name);
        });
        suffix = ". Users here: " + present.join(', ');
        */
        suffix = ". Other users present: " + group.count;
    } else {
        suffix = ". You're the only one here";
    }
  
    this.now.receiveMessage("SERVER", "You're now in " + this.now.room + suffix) ;
  
    if (group.now.receiveMessage) {
      group.now.receiveMessage("SERVER", this.now.name + " has joined the room");
    }  
    group.addUser(this.user.clientId);
  }
}

everyone.now.distributeMessage = function(message){
  nowjs.getGroup(this.now.room).now.filterMessage(this.user.clientId, this.now.name, message);
};

everyone.now.filterMessage = function(clientId, name, message){
    if (clientId === this.user.clientId) {
        return;
    }
    this.now.receiveMessage(name, message);
};
