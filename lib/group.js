var EventEmitter = require('events').EventEmitter;

exports.initialize = function(now) {
	function Group (groupName, isSuperGroup) {
		//all users in the group
		this.users = {};
		
		this.groupName = groupName;

		this.count = 0;
		//group proxy obj;
		this.now = new Proxy(this);
		//group scope table
		this.scopeTable = new ScopeTable();

	}

	Group.prototype.__proto__ = EventEmitter.prototype;

	//adds a user to the group
	Group.prototype.addUser = function(clientId) {
		var self = this;
		if(this.hasClient(clientId)) {
			return;
		}
		now.getClient(clientId, function() {
			self.users[this.user.clientId] = this;
			this.groups[self.groupName] = self;
			self.emit.apply(this, ['connect', this.user.clientId])
		}
		this.count++;
	}
	//removes a user from the group
	Group.prototype.removeUser = function(clientId) {
		if(! this.hasClient(clientId)) {
			return;
		}
		this.count--;
		var self = this;
		now.getClient(clientId, function() {
			delete self.users[this.user.clientId];
			delete this.groups[groupName];
			self.emit.apply(this, ['disconnect', this.user.clientId])
		});
	}

	//alias for on('connect')
	Group.prototype.connected = function(func) {
		this.on('connect', func);
	}

	Group.prototype.disconnected = function(func) {
		this.on('disconnect', func);
	}

	//returns boolean whether or not user is in a group
	Group.prototype.hasClient = function(clientId) {
		for(var i = 0; i < this.users.length; i++) {
			if(this.users[i] == clientId) return true;
		}
		return false;
	}

	Group.prototype.get = function(fqn) {
		var value = this.scopeTable.get(fqn);
		if(value === undefined && !this.isSuperGroup) {
			value = now.getGroup('everyone').scopeTable.get(fqn);	
		}
		if(typeof value === 'function') {
			value = multicaller.bind({group: this, fqn: fqn});
		}
		return value;
	}

	Group.prototype.set = function(fqn, val) {
			var keys = Object.keys(this.users);
			for(var i = 0, ll = keys.length; i < ll; i++){
				var user = this.users[keys[i]];
				delete user.scopeTable[fqn];
				user.socket.emit('rv', nowUtil.getValOrFqn(val));
				
			}
			if(this.isSuperGroup) {
				keys = Object.keys(now.groups);
				for(var i = 0, ll = keys.length; i < ll; i++) {
					var group = now.groups[keys[i]];
					if(!group.isSuperGroup) {
						delete group.scopeTable[fqn];
					}
				}
			}
			this.scopeTable.set(fqn, val);
	}

	return Group;
}
