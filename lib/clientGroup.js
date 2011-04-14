var proxy = require('./wrap.js');
var nowUtil = require('./nowUtil.js').nowUtil;
var EventEmitter = require('events').EventEmitter;

exports.ClientGroup = function ClientGroup(allScopes, defaultScope, socket, groups, clientGroups){
  var groupScopes = {};
  var nowScope = {};

  var isSuperGroup = false;   

  
  function connected(func) {
    this.on('connect', func);
  };
  
  function disconnected(func) {
    this.on('disconnect', func); 
  };
  
  var store = {
    set: function(key, val, callback, changes){

      nowUtil.debug("everyoneStore", key + " => " + val);
      var currScopes = [];
      
      // Put all relevant allScopes in array so we traverse only once
      for(var i in groupScopes) {
        currScopes.push(groupScopes[i]);
      }
      currScopes.push(defaultScope);

      nowUtil.mergeChanges(currScopes, changes);

      if(isSuperGroup){
        var obj = {};
        obj[key] = val;
        nowUtil.multiMergeFunctionsToMulticallers(groups, obj);
      }

      
      var data = nowUtil.decycle(val, "now."+key, [function(fqn, func){
        var multiCaller = generateMultiCaller(fqn);
        nowUtil.createVarAtFqn(fqn, nowScope, multiCaller);
        return nowUtil.serializeFunction(fqn, func); 
      }]);
      
      var clients = socket.clients;
      for(var clientId in groupScopes){
        clients[clientId].send({type: 'replaceVar', data: {key: key, value: data[0]}});
      }

      callback();  
    },
    remove: function(key){
      // console.log("remove " + key);
    }
  }
  
  function setAsSuperGroup(){
    isSuperGroup = true;
  }

  function addUser(clientId){
    if(allScopes.hasOwnProperty(clientId)){
      
      if(!isSuperGroup){
        nowUtil.multiMergeFunctionsToMulticallers([this], allScopes[clientId]);
        clientGroups[clientId].push(this);
      }

      groupScopes[clientId] = allScopes[clientId];
      nowUtil.mergeScopes(allScopes[clientId], defaultScope);
      
      this.count++;
     
      this.emit.apply({_events: this._events, now: groupScopes[clientId], user:{clientId: clientId}}, ['connect', clientId]);
    } else {
      throw new Error("Invalid client id");
    }

  };
  
  function removeUser(clientId){
    if(groupScopes.hasOwnProperty(clientId)){
      
      this.count--;
      
      this.emit.apply({_events: this._events, now: groupScopes[clientId], user:{clientId: clientId}}, ['disconnect', clientId]);
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
          theFunction.apply({now: clientScope, user: {clientId: clientId}}, arguments);
        } else {
          nowUtil.debug("Multicaller", "No function found for client " + clientId);
        }
      }
    };
    
  };
  
  this.count = 0;
  this.now = proxy.wrap(store, nowScope);
  this.connected = connected;
  this.disconnected = disconnected;
  this.addUser = addUser;
  this.removeUser = removeUser;
  this.nowScope = nowScope;
  this.generateMultiCaller = generateMultiCaller;
  this.setAsSuperGroup = setAsSuperGroup;
}

exports.ClientGroup.prototype = new EventEmitter();

