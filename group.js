var EventEmitter = require('events').EventEmitter;

exports.initialize = function(nowScope) {
	return function ClientGroup (groupName) {
		//all users in the group
		this.users = {};
		
		this.groupName = groupName;

		this.count = 0;
		//group proxy obj;
		this.now = this._generateProxy();
		//group scope table
		this.scopeTable = new ScopeTable();
	}
}

ClientGroup.prototype.__proto__ = EventEmitter.prototype;

//adds a user to the group
ClientGroup.prototype.addUser = function(clientId) {
	if(this.hasClient(clientId)) {
		return;
	}
	this.users.push(clientId);
	this.count++;

	var self = this;

	nowScope.getClient(clientId, function() {
		this.groups.push(groupName);
	});
	this.emit.apply({}, ['connect', clientId])
}
//removes a user from the group
ClientGroup.prototype.removeUser = function(clientId) {
	if(! this.hasClient(clientId)) {
		return;
	}
	this.count--;
	var self = this;
	nowScope.getClient(clientId, function() {
		delete this.groups[groupName];
	});
	this.emit.apply({}, ['disconnect', clientId]);
}

//alias for on('connect')
ClientGroup.prototype.connected = function(func) {
	this.on('connect', func);
}

ClientGroup.prototype.disconnected = function(func) {
	this.on('disconnect', func);
}

//returns boolean whether or not user is in a group
ClientGroup.prototype.hasClient = function(clientId) {
	for(var i = 0; i < this.users.length; i++) {
		if(this.users[i] == clientId) return true;
	}
	return false;
}

ClientGroup.prototype._generateProxy = function() {
//return the proxy object for the client group
}
