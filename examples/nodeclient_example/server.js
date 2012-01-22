var http = require('http');
var sys = require('util');
var nowjs = require('now');
var fs = require('fs');
var server = http.createServer(function (req,res){
    fs.readFile('./index.html', function(error, content) {
        if (error) {
            res.writeHead(500);
            res.end();
        }
        else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        }
    });
});
everyone = nowjs.initialize(server,{socketio: {"log level": 3}});
everyone.now.log = function(str){
  console.log(str);
}
everyone.now.distributeMessage = function(str){
  everyone.now.receiveMessage(str,this.now.name);
}
server.listen(8080);
console.log("Listening on 8080");
