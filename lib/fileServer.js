var fs = require('fs');

var fileCache = {};
var nowFileCache;

var defaultListeners;
var server;
var options;

exports.wrapServer = function(httpServer, serverOptions){
  server = httpServer;
  options = serverOptions;
  defaultListeners = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', handleResponse);
}

function handleResponse(request, response){
    // Handle only GET requests for /nowjs/* files. Pass all other requests through
    var i;
    if(request.method === "GET"){
      if(request.url.split('?')[0] === "/nowjs/now.js") {
          serveFile(__dirname + '/now.js', request, response, options);
      } else {
        for(i in defaultListeners){
          defaultListeners[i].call(server, request, response);
        }
      }
    } else {
      for(i in defaultListeners){
        defaultListeners[i].call(server, request, response);
      }
    }
};


function serveFile(filename, request, response, options){
  var options = options || {};

  if(fileCache.hasOwnProperty(filename)) {
    response.writeHead(200);
    response.write(fileCache[filename]);
    response.end();
  } else { 
    if(filename.indexOf("/now.js") !== -1) {
      if(nowFileCache === undefined) {
        fs.readFile(filename, function(err, data){  
          var host = request.headers.host.split(":");
          var hostServer = options['host'] || host[0];
          var hostPort = '80';
          if(host.length > 1){
            hostPort = host[1];
          }
          hostPort = options['port'] || hostPort;

          var text = data.toString();
          text = text.replace(/\*\*SERVER\*\*/g, hostServer);
          text = text.replace(/\*\*PORT\*\*/g, hostPort);
          
          fs.readFile(__dirname + "/nowUtil.js", function(err, data){ 
            var textUtil = data.toString();
            nowFileCache = {nowUtil: textUtil, now: text};
            response.writeHead(200, {'content-type': 'text/javascript'});
            response.write(nowFileCache.nowUtil);
            response.write(nowFileCache.now);
            response.end();
          });
        });
      } else {
        response.writeHead(200, {'content-type': 'text/javascript'});
        response.write(nowFileCache.nowUtil);
        response.write(nowFileCache.now);
        response.end();
      }
    } else {
      fs.readFile(filename, function(err, data){
        var text = data.toString();
        response.writeHead(200);
        response.write(text);
        response.end();
        fileCache[filename] = text;
      });
    }
  }
};