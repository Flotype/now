var io = require("socket.io");
var http = require("http");
var nowLib = require("./nowLib.js");
var nowUtil = require("./nowUtil.js");
var fs = require('fs');


var everyone = {now: {}};
exports.everyone = everyone;

var everyoneWatcherBlacklist = {};

var everyoneWatcher = new nowLib.NowWatcher("now", exports.everyone.now, function(prop, fqn, oldVal, newVal){
  if(!(fqn in everyoneWatcherBlacklist)) {
    nowUtil.debug("everyoneWatcherVariableChanged", fqn + " => " + newVal);
    
    if(typeof oldVal == "object") {
      var oldFqns = nowUtil.getAllChildFqns(oldVal, fqn);
      
      for(var i in oldFqns) {
        console.log("deleting " + oldFqns[i]);
        delete everyoneWatcher.data.watchedKeys[oldFqns[i]];
      }
      

    }
    
    if(nowUtil.isArray(newVal)) {
      newVal = [];
    } else if(typeof newVal == "object" ) {
      newVal = {};
    }
    
    for(var sessionId in nowLib.nowCore.scopes) {
      var scope = nowLib.nowCore.scopes[sessionId];
      nowUtil.createVarAtFqn(fqn, scope, newVal);
    }
    
    nowUtil.createVarAtFqn(fqn, nowLib.serverScope, newVal); 
    
    if(typeof newVal == "function") {
      console.log(fqn);
      nowUtil.debug("everyoneWatcherVariableChanged", fqn + " generating multicaller");
      var func = generateMultiCaller(fqn);
      everyoneWatcherBlacklist[fqn] = true;
      nowUtil.createVarAtFqn(fqn, everyone.now, func);
    }
  } else {
    nowUtil.debug("everyoneWatcherVariableChanged", fqn + " change ignored");
    delete everyoneWatcherBlacklist[fqn];
  }
  

  // In case the object is an array, we delete from hashedArrays to prevent multiple watcher firing
  delete everyoneWatcher.data.hashedArrays[fqn];

});

function generateMultiCaller(fqn){
  nowUtil.debug("generateMultiCaller", fqn);
  return function(){
    var outputs = {};
    for(var clientId in nowLib.nowCore.scopes){
      nowUtil.debug("Multicaller", "Calling "+fqn+" on client " + clientId);
      var clientScope = nowLib.nowCore.scopes[clientId];
      var theFunction = nowUtil.getVarFromFqn(fqn, clientScope);
      if(theFunction !== false) {
        outputs[clientId] = theFunction.apply({now: clientScope}, arguments);
      }
    }
    return outputs;
  } 
}

nowLib.nowCore.optionalWatcherFunctions.push(function(scope, fqn, newVal, type){
  if(type == 'variableChanged') {
    if(typeof newVal == "function") {
      var func = generateMultiCaller(fqn);
      nowUtil.createAndBlacklistVarAtFqn(fqn, everyone.now, func, everyoneWatcherBlacklist, "now");
    }
  }
})

setInterval(function(){
  for(var key in nowLib.nowCore.watchers){
    nowLib.nowCore.watchers[key].processScope();
  }
  everyoneWatcher.processScope();
}, 1000);

exports.initialize = function(server){

  // Override the default HTTP server listeners
  var defaultListeners = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', function(request, response){
    // Handle only GET requests for /nowjs/* files. Pass all other requests through
    if(request.method == "GET"){
      switch(request.url){
        case "/nowjs/nowUtil.js":
          serveFile('./nowUtil.js', request, response);
          break;
          
        case "/nowjs/nowClient.js":
          serveFile('./nowClient.js', request, response);
          break;
          
        case "/nowjs/nowLib.js":
          serveFile('./nowLib.js', request, response);
          break;
        
        default:
          for(var i in defaultListeners){
            defaultListeners[i](request, response);
          }
          break;
      }
    } else {
      for(var i in defaultListeners){
        defaultListeners[i](request, response);
      }
    }
  });
  
  socket = io.listen(server);
  socket.on('connection', function(client){
    nowUtil.initializeScope(nowLib.serverScope, client);
    nowLib.handleNewConnection(client);
  });
  
  return everyone;
}

function serveFile(filename, request, response){
  fs.readFile(filename, function(err, file){  
    if(err) {  
        response.writeHead(500, {"Content-Type": "text/plain"});  
        response.write(err + "\n");  
        response.end();  
        return;  
    }
    
    var host = request.headers.host.split(":");
    var hostServer = host[0]
    var hostPort = '80';
    if(host.length > 1){
      hostPort = host[1];
    }
    
    var parsedFile = file.toString().replace("**SERVER**", hostServer);
    parsedFile = parsedFile.replace("**PORT**", hostPort);    
    response.writeHead(200);  
    response.write(parsedFile);  
    response.end();
  });
}