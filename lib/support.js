var net = require('net');
var nowUtil = require('./nowUtil').nowUtil;

exports.initialize = function(nowjs){
  var fn = require('./function').init(nowjs);

  function Support(host, port){
    this.socket = net.createConnection(port, host);
    this._attachListeners();
    this.socket.setNoDelay();
    this.availableFunctions = {};
  }

  Support.prototype._startHandshake = function(){
    this.socket.write(JSON.stringify({type:'new'}));
  };

  Support.prototype._attachListeners = function(){
    var self = this;
    this.socket.on('connect', function(){self._startHandshake();});
    this.socket.on('data', function(message){self._handleMessage(message);});
  };

  Support.prototype.getRemoteFunction = function(fn) {
    var self = this;
    if(this.availableFunctions[fn] == undefined){throw new Error("No such function: " + fn);};
    return function(){
      var args = [];
      for (var i = 0, ii = arguments.length; i < ii; i++) {
        args[i] = arguments[i];
      }
      for (i = 0, ii = args.length; i < ii; i++) {
        if (typeof args[i] === 'function') {
          closureId = 'closure_' + args[i].name + '_' + nowUtil.generateRandomString();
          nowjs.closures[closureId] = args[i];
          args[i] = {fqn: closureId};
          setTimeout(function () {
            nowjs.closures[closureId] = nowUtil.noop;
          }, nowjs.options.closureTimeout);
        }
      }

      self.socket.write(JSON.stringify({type: 'rfc',fqn:fn, args:args}));
    };
  };

  Support.prototype._handleMessage = function(message){
    message = JSON.parse(message.toString());
    switch(message.type){
    case "usercall":
      var user = nowjs.users[message.id];
      if (user && message.serverId !== nowjs.serverId) {
        args = message.args;
        // Convert any remote function stubs into remote functions
        for (i = 0, ll = args.length; i < ll; i++) {
          if (nowUtil.hasProperty(args[i], 'fqn')) {
            obj = {host: message.host, port:message.port, fqn: args[i].fqn};
            args[i] = fn.closurecall.bind(obj);
          }
        }
        theFunction = user.get(message.fqn);
        theFunction.apply({}, args);
      } 
      break;
    case "multicall":
      group = nowjs.getGroup(message.groupName);
      //group = nowUtil.clone(group, {excludes: message.excludes});
      if (group) {
        args = message.args;
        // Convert any remote function stubs into remote functions
        for (i = 0, ll = args.length; i < ll; i++) {
          if (nowUtil.hasProperty(args[i], 'fqn')) {
            obj = {socket: this.socket, host: message.host, port:message.port, fqn: args[i].fqn};
            args[i] = fn.closurecall.bind(obj);
          }
        }
        group = nowUtil.clone(group, {fqn: message.fqn});
        nowjs.emit('multicall', group, args);
      }
      break;
    case 'closurecall':
      var args = message.args;
      // Convert any remote function stubs into remote functions
      for (i = 0, ll = args.length; i < ll; i++) {
        if (nowUtil.hasProperty(args[i], 'fqn')) {
          obj = {socket: this.socket, host: message.host, port:message.port, fqn: args[i].fqn};
          args[i] = fn.closurecall.bind(obj);
        }
      }
      theFunction = nowjs.closures[message.fqn];
      theFunction.apply({}, args);
      break;
    case 'functionList':
      var funcs = message.functions;
      for(var i = 0, ll = funcs.length; i < ll; i++){
        this.availableFunctions[funcs[i]] = true;
      }
    }
  };


  return Support;
}