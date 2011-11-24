var fs = require('fs');
var express = require('express');
var server = express.createServer();
console.log('blargh');
server.use(express.cookieParser());
var store = {store: null};
server.use(express.session({ secret: "keyboard cat" }));
server.get('/', function (req, res) {
  res.contentType(__dirname + '/helloworld.html');
  res.send(fs.readFileSync(__dirname + '/helloworld.html'));
  store.store = req.sessionStore;
  console.log('This got read.');
  console.log(store.store);
});
server.listen(8080);
var nowjs = require("now");
var everyone = nowjs.initialize(server, {connect: store});

nowjs.on("connect", function(){
  console.log("Joined: " + this.now.name);
});

nowjs.on("disconnect", function(){
  console.log("Left: " + this.now.name);
});

everyone.now.distributeMessage = function(message){
  console.log(store);
  console.log(this.user.cookie);
  console.log(this.user.session);
  everyone.now.receiveMessage(this.now.name, message);
};
