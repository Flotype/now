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
  group.addUser(this.user.clientId);
  console.log("Joined: " + this.now.name);
});

nowjs.on("disconnect", function(){
  console.log("Left: " + this.now.name);
});

everyone.on('join', function(){
  console.log("joined " + this.now.name);
});


everyone.on('leave', function(){
  console.log("left " + this.now.name);
});




var group = nowjs.getGroup('x');


everyone.now.add = function(){

  group.now.x = {};
  group.now.x.a = 1;
  group.now.x.b = function(){console.log('hello'); everyone.now.receiveMessage('hi', 'hi')}
}

everyone.now.test = function(){group.now.x.b();};

everyone.now.exclude = function(){
  group = group.exclude(this.user.clientId);
}


everyone.now.distributeMessage = function(message){
  everyone.now.receiveMessage(this.now.name, message);
};