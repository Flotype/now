var fs = require('fs');

var fileCache = {};
var nowFileCache = {};

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

// Called upon http server request
function handleResponse(request, response){
    // Handle only GET requests for /nowjs/* files. Pass all other requests through
    var i;
    if(request.method === "GET"){
    
      // Detect if request involves the now.js file
      if(request.url.split('?')[0] === "/nowjs/now.js") {
          serveFile(__dirname + '/now.js', request, response, options);
      } else {
        // Make sure default listeners are still handled
        for(i in defaultListeners){
          defaultListeners[i].call(server, request, response);
        }
      }
    } else {
      for(i in defaultListeners){
        // Make sure default listeners are still handled
        defaultListeners[i].call(server, request, response);
      }
    }
};

// Actually serve the file
function serveFile(filename, request, response, options){
  var options = options || {};

  // Write file from cache if possible
  if(fileCache.hasOwnProperty(filename)) {
    response.writeHead(200);
    response.write(fileCache[filename]);
    response.end();
  } else {  
    if(filename.indexOf("/now.js") !== -1) {
      
	  // Write file from cache if possible
      if(nowFileCache.hasOwnProperty(request.headers.host)) {
      
        // Write file from cache
        response.writeHead(200, {'content-type': 'text/javascript'});
        response.write(nowFileCache[request.headers.host].nowUtil);
        response.write(nowFileCache[request.headers.host].now);
        response.end();
      } else {
        // Determine hostname / port if not given in options
        var host = request.headers.host.split(":");
        var hostServer = options['host'] || host[0];
        var hostPort =  options['port'] || host[1] || '80';
        
        // Call generate client libs, which takes the desired host/port and executes callback with two parts of now.js as parameters
        generateClientLibs(hostServer, hostPort, function(nowText, utilText){          
        
          // Write to client
          response.writeHead(200, {'content-type': 'text/javascript'});
          response.write(utilText);
          response.write(nowText);
          response.end();

          // Add to cache
          nowFileCache[request.headers.host] = {now: nowText, nowUtil: utilText};
        });
      }
    } else {
      // For any other filename, read file and server (not cached)
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

// Takes host and port and call callback with now.js and nowUtil.js as parameters
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
