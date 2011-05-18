var proxy = require('./wrap.js');
var io = require("socket.io");
var http = require("http");
var fs = require('fs');
var nowUtil = require("./nowUtil.js").nowUtil;

// The socket created by socket.io
var socket;

// Everyone group
var everyone;
var fileServer = require('./fileServer.js');
var ClientGroup = require('./clientGroup.js').ClientGroup;


var nowCore = {

  // Scopes (now objects) of connected users
  // clientId => now objects
  scopes: {},
  
  // Proxies, now objects are actually exposed as these. Modifications to proxy objects trigger the `store` callback which allows us to sync changes 
  // clientId => now proxies
  proxies: {},
  
  // Contains references to closures passed in as pararmeters to remote calls
  // (Generated closure id) => reference to closure function
  closures: {},
  
  // Maps clientId to an object containing a map of groupNames to group object references
  // clientId => {groupName => (group object references)}
  clientGroups : {},
  
  // Contains all groups that exist
  // groupName => (group object references)
  groups: {},
  
  // Keeps track of all this.user objects, so they can be available anywhere this.now is available
  userObjects : {},
  
  
  // The defalt options. This is extended and overwritten by users options upon initialize
  options: {
    clientWrite: true,
    autoHost: true,
    socketio: {}
  },
  
  
  // All of the different client messages we'll handle
  messageHandlers: {
    
    // A remote function call from client
    remoteCall: function(client, data){
      nowUtil.debug("handleRemoteCall", data.callId);
      var clientScope = nowCore.proxies[client.sessionId];
      var theFunction;
      
      // Retrieve the function, either from closures hash or from the now scope
      if(data.fqn.split('_')[0] === 'closure'){
        theFunction = nowCore.closures[data.fqn];
      } else {
        theFunction = nowUtil.getVarFromFqn(data.fqn, clientScope);
      }
      
      var theArgs = data.args;
      
      // Search (only at top level) of args for functions parameters, and replace with wrapper remote call function
      for(var i in theArgs){
        if(Object.hasOwnProperty.call(theArgs[i], 'type') && theArgs[i].type === 'function'){
          theArgs[i] = nowCore.constructRemoteFunction(client, theArgs[i].fqn);
        }
      }
      
      // Call the function with this.now and this.user
      theFunction.apply({now: clientScope, user: client.user }, theArgs);
      
      nowUtil.debug("handleRemoteCall" , "completed " + data.callId);
    },

    
    // Called by initializeScope from the client side
    createScope: function(client, data){
     
      // This is the now object as populated by the client
      // constructHandleFunctionForClientScope returns a function that will generate multicallers and remote call functions for this client
      var scope = nowUtil.retrocycle(data.scope, nowCore.constructHandleFunctionForClientScope(client));
       
      nowUtil.debug("handleCreateScope", "");
      nowUtil.print(scope);

	    client.user = client.user ? client.user : {clientId: client.sessionId};

      var tmp;
      //Check if Socket.IO client object has a request, headers and cookie associated with it. Some transports (i.e. Flash socket) do not.
      if((tmp = client.request) && (tmp = tmp.headers) && (tmp = tmp.cookie)){
        client.user.cookie = tmp;
      }

      nowCore.userObjects[client.sessionId] = client.user;
      
      // Create proxy object
      nowCore.proxies[client.sessionId] = proxy.wrap(nowCore.constructClientScopeStore(client), scope, client.user);
      
      // The now object, wrapped by the proxy
      nowCore.scopes[client.sessionId] = scope;
      
      // Initialize empty hash of groups this user belongs to
      nowCore.clientGroups[client.sessionId] = {};

      // Add to the everyone group!
      everyone.addUser(client.sessionId);

    },

    // Handler for variable values changes
    replaceVar: function(client, data){
    
      // If clientWrite is false (not the default) then ignore writes
      if(nowCore.options.clientWrite) {
      
        // constructHandleFunctionForClientScope returns a function that will generate multicallers and remote call functions for this client
        var newVal = nowUtil.retrocycle({key: data.value}, nowCore.constructHandleFunctionForClientScope(client));
     
        nowUtil.debug("handleReplaceVar", data.key + " => " + data.value);
        nowUtil.print(data.value);
        
        var scope = nowCore.scopes[client.sessionId];  

        // If a new function was added, make sure those functions have multicallers in the scope of all groups that the client is a part of
        var obj = {};
        obj[data.key] = newVal.key;
	      nowUtil.multiMergeFunctionsToMulticallers(nowCore.clientGroups[client.sessionId], obj);

        // Change the variable to the new value in the now scope of the client
        scope[data.key] = newVal.key;
      } else {
        nowUtil.debug("handleReplaceVar", "preventing client write");
      }
    }
  },

  
  
  handleDisconnection: function(client) {
    //Remove scope and other functions
    if(!client.connected) {
    
      everyone.removeUser(client.sessionId);
  
      var groups = nowCore.clientGroups[client.sessionId];
      for(var i in groups){
        groups[i].removeUser(client.sessionId);
      }

      delete nowCore.scopes[client.sessionId];
      delete nowCore.proxies[client.sessionId];
      delete nowCore.closures[client.sessionId];
      delete nowCore.clientGroups[client.sessionId];
    }
  },

  
  // Returns a function for use in retrocycle when it encounters a functin. generates a multicaller and returns a remote function to replace the original
  constructHandleFunctionForClientScope: function(client) {
    return function(funcObj) {
      // Generate multicaller
      var multiCaller = everyone.generateMultiCaller(funcObj.fqn);
      // Insert the multicaller
      nowUtil.createVarAtFqn(funcObj.fqn, everyone.nowScope, multiCaller);
      // Return a remote function for replacing the serialized function in the scope
      return nowCore.constructRemoteFunction(client, funcObj.fqn);
    };
  },

  
  // Constructs a remote function, given a fqn to the function on the originating side
  constructRemoteFunction: function(client, fqn) {  
    nowUtil.debug("constructRemoteFunction", fqn);  
    
    // Create the function
    var remoteFn = function() {
    
      // Generate a random call id
      var callId = fqn+ "_"+ nowUtil.generateRandomString();
        
      nowUtil.debug("executeRemoteFunction", fqn + ", " + callId);
      
      // Create a copy of the arguments
      var theArgs = Array.prototype.slice.call(arguments);
      
      // Find functions in the arguments, and store functions in closure table and serialize functions
      for(var i in theArgs){
        if(typeof theArgs[i] === 'function'){
          var closureId = "closure" + "_" + theArgs[i].name + "_" + nowUtil.generateRandomString();
          nowCore.closures[closureId] = theArgs[i];
          theArgs[i] = {type: 'function', fqn: closureId};
        }
      }
      
      // On the next tick, send the remoteCall request
      process.nextTick(function(){
        client.send({type: 'remoteCall', data: {callId: callId, fqn: fqn, args: theArgs}});
      });

    };
    return remoteFn;
  },

  
  // THe store function to be used in the now object proxy for clients
  constructClientScopeStore: function(client) {
    return {
      set: function(key, val, callback, changes){
        nowUtil.debug("clientScopeStore", key + " => " + val);
        
        // Decycle the object with one version that has serialized objects, the other with multicallers
        var data =  nowUtil.decycle(val, "now."+key, [nowUtil.serializeFunction, everyone.generateMultiCaller]);
        // data[0] = For client
        // data[1] = For Everyone
        
        // Send serialized function version of data to client
      	client.send({type: 'replaceVar', data: {key: key, value: data[0]}});

        // Send multicaller function version of data to grop
        everyone.nowScope[key] = data[1];

        // If a new function was added, make sure those functions have multicallers in the scope of all groups that the client is a part of
        var obj = {};
        obj[key] = val;
	      nowUtil.multiMergeFunctionsToMulticallers(nowCore.clientGroups[client.sessionId], obj);

	      callback();  
	   },  
      remove: function(key){
		      // console.log("remove " + key);
      }
    }; 
  }
};


// Returns existing group or creates a new group
exports.getGroup = function(groupName){
    if(!Object.hasOwnProperty.call(nowCore.groups, groupName)){
      nowCore.groups[groupName] = new ClientGroup(nowCore, socket, groupName);
    }
    return nowCore.groups[groupName];
}


// Return a specific client
exports.getClient = function(clientId, callback) {
  if(Object.hasOwnProperty.call(nowCore.proxies, clientId)) {
    callback.apply({now: nowCore.proxies[clientId], user: nowCore.userObjects[clientId] });      
  } else {
    // throw "No such clientId" + clientId;
    callback(new Error("No such clientId" + clientId));
    return false;
  }
}


// Handle new socket.io connection
function handleNewConnection(client){
  client.on('message', function(message){
    var messageObj = message;
    
    // Route to message handlers
    if(Object.hasOwnProperty.call(messageObj, 'type') && Object.hasOwnProperty.call(nowCore.messageHandlers, messageObj.type)) {
      nowCore.messageHandlers[messageObj.type](client, messageObj.data);
    }
  });
  client.on('disconnect', function(){
    nowCore.handleDisconnection(client);
  });
};

exports.initialize = function(server, options){
	options = options || readConfigFile();
  // Merge user and default options
  nowUtil.mergeScopes(nowCore.options, options);
  
  // Override the default HTTP server listeners
  fileServer.wrapServer(server, nowCore.options);

  socket = io.listen(server, nowCore.options.socketio || {});
    
  // Expose the underlying socket.io object
  exports.socketio = socket;
  
  // Initialize the everyone group
  everyone = exports.getGroup("everyone");
  everyone.setAsSuperGroup();

  
  socket.on('connection', function(client){
    nowUtil.initializeScope(everyone.defaultScope, client);
    handleNewConnection(client);
  });
  
  return everyone;
};

function readConfigFile(){
	var path = process.cwd()+"/nowjs.json";
	try{
		var conf = fs.readFileSync(path);
		var parsedConf = JSON.parse(conf);
		return parsedConf;
	} catch(e) {
		return undefined;
	}	
}

// Provide function for clients to control client lib generation
exports.generateClientLibs = function(hostServer, hostPort, path){
  fileServer.generateClientLibs(hostServer, hostPort, function(nowText, utilText){
    if(path){
      var stream = fs.createWriteStream(path);
      stream.on('open', function(fd){
        stream.write(utilText);
        stream.end(nowText);
      })
    } else {
      process.stdout.write(utilText);
      process.stdout.write(nowText);
    }
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', function (err) {
  nowUtil.error(err);
});
