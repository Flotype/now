var proxy = require('./wrap.js');
var nowUtil = require('./nowUtil.js').nowUtil;

exports.ClientGroup = function ClientGroup(userScopes, serverScope, socket){
  var groupScopes = {};
  var nowScope = {};
  
  var connectedFuncs = [];
  var disconnectedFuncs = [];

  
  function connected(func) {
    if(arguments.length === 0) {
      for(var i in connectedFuncs) {
        connectedFuncs[i].apply(this);
      }
    } else {
      connectedFuncs.push(func); 
    }
  };
  
  function disconnected(func) {
    if(arguments.length === 0) {
      for(var i in disconnectedFuncs) {
        disconnectedFuncs[i].apply(this);
      }
    } else {
      disconnectedFuncs.push(func); 
    }
  };
  
  var store = {
    set: function(key, val, callback, changes){

		 nowUtil.debug("everyoneStore", key + " => " + val);
      var currScopes = [];
      
      // Put all relevant userScopes in array so we traverse only once
      for(var i in groupScopes) {
        currScopes.push(groupScopes[i]);
      }
      currScopes.push(serverScope);
      nowUtil.mergeChanges(currScopes, changes);
      
      var data = nowUtil.decycle(val, "now."+key, [function(fqn, func){
        var multiCaller = generateMultiCaller(fqn);
        nowUtil.createVarAtFqn(fqn, nowScope, multiCaller);
        return nowUtil.serializeFunction(fqn, func); 
      }]);
      
      socket.broadcast({type: 'replaceVar', data: {key: key, value: data[0]}});
      
      callback();  
    },
    remove: function(key){
      // console.log("remove " + key);
    }
  }
  
  function addUser(clientId){
    if(userScopes.hasOwnProperty(clientId)){
      groupScopes[clientId] = userScopes[clientId];
    } else {
      throw new Error("Invalid client id");
    }
  };
  
  function removeUser(clientId){
    if(groupScopes.hasOwnProperty(clientId)){
      delete groupScopes[clientId];
    }
  };
  
  function generateMultiCaller(fqn){
    nowUtil.debug("generateMultiCaller", fqn);
    
    return function multicall(){
      for(var clientId in groupScopes){
        nowUtil.debug("Multicaller", "Calling "+fqn+" on client " + clientId);
        var clientScope = groupScopes[clientId];
        var theFunction = nowUtil.getVarFromFqn(fqn, clientScope);
        if(theFunction !== false) {
          theFunction.apply({now: clientScope}, arguments);
        } else {
          nowUtil.debug("Multicaller", "No function found for client " + clientId);
        }
      }
    };
    
  };
  
  this.now = proxy.wrap(store, nowScope);
  this.connected = connected;
  this.disconnected = disconnected;
  this.addUser = addUser;
  this.nowScope = nowScope;

  this.generateMultiCaller = generateMultiCaller;
}
