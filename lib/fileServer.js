var fs = require('fs');
var nowUtil = require('./nowUtil').nowUtil;

var fileCache = {};
var nowFileCache = {};

var defaultListeners;
var server;
var options;

var handleResponse, serveFile, generateClientLibs;

exports.wrapServer = function (httpServer, serverOptions) {
  server = httpServer;
  options = serverOptions || {client: {}};
  options.client = JSON.stringify(options.client);

  defaultListeners = server.listeners('request');
  if (serverOptions.autoHost) {
    server.removeAllListeners('request');
    server.on('request', handleResponse);
  }
};

// Called upon http server request
handleResponse = function (request, response) {
  // Handle only GET requests for /nowjs/* files. Pass all other requests through
  var i;
  if (request.method === 'GET') {

    // Detect if request involves the now.js file
    if (request.url.split('?')[0] === '/nowjs/now.js') {
      serveFile(__dirname + '/client/now.js', request, response, options);
    } else {
      // Make sure default listeners are still handled
      for (i in defaultListeners) {
        defaultListeners[i].call(server, request, response);
      }
    }
  } else {
    for (i in defaultListeners) {
      // Make sure default listeners are still handled
      defaultListeners[i].call(server, request, response);
    }
  }
};

// Actually serve the file
serveFile = function (filename, request, response, options) {
  // Write file from cache if possible
  if (nowUtil.hasProperty(fileCache, filename)) {
    response.writeHead(200);
    response.write(fileCache[filename]);
    response.end();
  } else {
    if (filename.indexOf('/now.js') !== -1) {

      // Write file from cache if possible
      if (nowUtil.hasProperty(nowFileCache, request.headers.host)) {

        // Write file from cache
        response.writeHead(200, {'Content-Type': 'text/javascript'});
        response.write(nowFileCache[request.headers.host].nowUtil);
        response.write(nowFileCache[request.headers.host].now);
        response.end();
      } else {
        // Determine hostname / port if not given in options
        var host = request.headers.host.split(':');
        var hostServer = options['host'] || host[0];
        var hostPort =  options['port'] || host[1] || '80';

        // Call generate client libs, which takes the desired host/port and executes callback with two parts of now.js as parameters
        generateClientLibs(hostServer, hostPort, function (nowText, utilText) {

          // Write to client
          response.writeHead(200, {'Content-Type': 'text/javascript'});
          response.write(utilText);
          response.write(nowText);
          response.end();

          // Add to cache
          nowFileCache[request.headers.host] = {now: nowText, nowUtil: utilText};
        });
      }
    } else {
      // For any other filename, read file and server (not cached)
      fs.readFile(filename, function (err, data) {
        var text = data.toString();
        response.writeHead(200);
        response.write(text);
        response.end();
        fileCache[filename] = text;
      });
    }
  }
};

// Takes host and port and call callback with now.js and nowUtil.js as parameters
generateClientLibs = function (hostServer, hostPort, callback) {
  fs.readFile(__dirname + '/client/now.js', function (err, data) {
    var nowText = data.toString();
    nowText = nowText.replace('**SERVER**', hostServer);
    nowText = nowText.replace('**PORT**', hostPort);
    nowText = nowText.replace('**OPTIONS**', options.client);
    nowText = nowText.replace('**SCOPE**', options.scope);
    var utilText = '';
    callback(nowText, utilText);
  });
};

exports.generateClientLibs = generateClientLibs;
