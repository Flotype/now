var port     = 8080;
var express  = require('express');
var app      = express.createServer();
var server   = app.listen(port);
console.log("Express server listening on port " + port);

// App Configuration
app.configure(function(){
  app.use(express.methodOverride());
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
});

// Routes
app.get('/', function(req, res){
  res.render('index', {
    'title': 'NowJS + Express Example'
  });
});

app.get('/chat', function(req, res){
  res.render('chat', {
    title: 'NowJS + Express Example'
  });
});

// NowJS component
var nowjs    = require("now");
var everyone = nowjs.initialize(server);

nowjs.on('connect', function(){
  console.log("Joined: " + this.now.name);
});

nowjs.on('disconnect', function(){
  console.log("Left: " + this.now.name);
});

everyone.now.distributeMessage = function(message){
  everyone.now.receiveMessage(this.now.name, message);
};

