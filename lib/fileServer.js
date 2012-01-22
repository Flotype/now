var fs = require('fs');
var nowUtil = require('./nowUtil').nowUtil;
var fileCache = {};
var nowFileCache = {};
var defaultListeners;
var server;
var options;

// now.js client lib location
var nowClient = '/../dist/now.js';

var handleResponse, serveFile, generateClientLibs;

exports.wrapServer = function (httpServer, serverOptions) {
  server = httpServer;
  options = serverOptions || {client: {}};
  options.client = JSON.stringify(options.client);

  if(options.debug) {
    nowClient = '/client/now.js';
  }
  
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
      serveFile(__dirname + nowClient, request, response, options);
    } else {
      // Make sure default listeners are still handled
      for (i in defaultListeners) {
        if (nowUtil.hasProperty(defaultListeners, i)) {
          defaultListeners[i].call(server, request, response);
        }
      }
    }
  } else {
    for (i in defaultListeners) {
      // Make sure default listeners are still handled
      if (nowUtil.hasProperty(defaultListeners, i)) {
        defaultListeners[i].call(server, request, response);
      }
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
        response.write(nowFileCache[request.headers.host].now);
        response.end();
      } else {
        // Determine hostname / port if not given in options
        var host = request.headers.host.split(':');
        var hostServer = options['host'] || host[0];
        var hostPort =  options['port'] || host[1] || '80';

        // Call generate client libs, which takes the desired host/port and executes callback with two parts of now.js as parameters
        generateClientLibs(hostServer, hostPort, function (nowText) {

          // Write to client
          response.writeHead(200, {'Content-Type': 'text/javascript'});
          response.write(nowText);
          response.end();

          // Add to cache
          nowFileCache[request.headers.host] = {now: nowText};
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

// Takes host and port and call callback with now.js as parameter
generateClientLibs = function (hostServer, hostPort, callback) {
    fs.readFile(__dirname + nowClient, function (err, data) {
      var nowText = data.toString();
      var initString = options.scope + '.now = nowInitialize("' +
          (options.protocol !==  undefined ? options.protocol + ':' : '') +
          '//' + hostServer + ':' + hostPort + '", ' + options.client + ');\n';
      nowText += initString;

      callback(nowText);
  });
};

exports.generateClientLibs = generateClientLibs;
