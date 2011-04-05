function ClientGroup(scopes, userList){
  
  var multiStore = {
    set: function(key, val, callback, changes){

      nowUtil.debug("everyoneStore", key + " => " + val);
      var scopes = [];
      
      // Put all relevant scopes in array so we traverse only once
      for(var i in nowCore.scopes) {
        scopes.push(nowCore.scopes[i]);
      }
      scopes.push(serverScope);
      
      nowUtil.mergeChanges(scopes, changes);
      
      var data = nowUtil.decycle(val, "now."+key, [function(fqn, func){
        var multiCaller = nowCore.generateMultiCaller(fqn);
        nowUtil.createVarAtFqn(fqn, everyone.nowScope, multiCaller);
        return nowUtil.serializeFunction(fqn, func); 
      }]);
      
      socket.broadcast({type: 'replaceVar', data: {key: key, value: data[0]}});
      
      callback();  
    },
    remove: function(key){
      // console.log("remove " + key);
    }
  }
  
  function generateMultiCaller(fqn){
    nowUtil.debug("generateMultiCaller", fqn);
    return function multicall (){
      var outputs = {};
      for(var clientId in nowCore.scopes){
        nowUtil.debug("Multicaller", "Calling "+fqn+" on client " + clientId);
        var clientScope = nowCore.scopes[clientId];
        var theFunction = nowUtil.getVarFromFqn(fqn, clientScope);
        if(theFunction !== false) {
          outputs[clientId] = theFunction.apply({now: clientScope}, arguments);
        } else {
          nowUtil.debug("Multicaler", "No function found for client " + clientId);
        }
      }
      return outputs;
    };
  }
  
};