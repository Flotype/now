var express = require('express');

var app = express.createServer();

// Configuration

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');



// Routes

app.get('/', function(req, res){
  res.render('index', {locals: {
    title: 'NowJS + Express Example'
  }});
});

app.get('/chat', function(req, res){
  res.render('chat', {locals: {
    title: 'NowJS + Express Example'
  }});
});

app.listen(8080);
console.log("Express server listening on port %d", app.address().port);


// NowJS component
var nowjs = require('now');
var everyone = nowjs.initialize(app);

everyone.connected(function(){
      console.log("Joined: " + this.now.name);
});


everyone.disconnected(function(){
      console.log("Left: " + this.now.name);
});

everyone.now.distributeMessage = function(message){
  everyone.now.receiveMessage(this.now.name, message);
};

