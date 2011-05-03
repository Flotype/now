var fs = require('fs');

var fileCache = {};
var nowFileCache;

var defaultListeners;
var server;
var options;

exports.generateClientLibs = generateClientLibs;

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
        var host = request.headers.host.split(":");
        var hostServer = options['host'] || host[0];
        var hostPort =  options['port'] || host[1] || '80';
        generateClientLibs(hostServer, hostPort, function(nowText, utilText){
          nowFileCache = {now: nowText, nowUtil: utilText};
          response.writeHead(200, {'content-type': 'text/javascript'});
          response.write(nowFileCache.nowUtil);
          response.write(nowFileCache.now);
          response.end();
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
}

function generateClientLibs(hostServer, hostPort, callback){
    fs.readFile(__dirname + "/now.js", function(err, data){  
      var nowText = data.toString();
      nowText = nowText.replace(/\*\*SERVER\*\*/g, hostServer);
      nowText = nowText.replace(/\*\*PORT\*\*/g, hostPort);
      fs.readFile(__dirname + "/nowUtil.js", function(err, data){ 
      var utilText = data.toString();
      callback(nowText, utilText);
    });
  });
}