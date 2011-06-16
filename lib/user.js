var nowUtil = require('./nowUtil.js');

exports.initialize = function(now) {
	function User(socket) {
		var self = this;
		this.socket = socket;
		socket.on('rc', function(data) {
			var theFunction = self.get(data.fqn]);
			theFunction.apply(null, data.args);
		});
		socket.on('rv', function(data) {
			self.scopeTable.set(data.fqn, data.value);
		});
		socket.on('cs', function(data) {
			self.scopeTable = new ScopeTable(data);
		});

		//groups that the user is in.
		this.groups = [];

		//the user's ScopeTable
		this.scopeTable = new ScopeTable();

		//reference for this.user
		this.user = { clientId: socket.sessionid; }

		this.now = new Proxy(this);
	}

	User.prototype.get = function(fqn) {
		var value = this.scopeTable.get(fqn);
		if(value !== undefined) {
			return value;
		} else {
			var i = 0;
			var keys = Object.keys(this.groups);
			var ll = keys.length;
			while(value === undefined && i < ll) {
				value = this.groups[keys[i]].scopeTable[fqn];
				i++;
			}
			if(typeof value === 'function') {
				var userClone = nowUtil.clone(this);
				userClone.fqn = fqn;
				value = value.bind(userClone);

			}
			
			this.scopeTable[fqn] = value;
			return value;
	}
	}

	User.prototype.set = function(fqn, val) {
		var everyone = now.getGroup('everyone');
		if(typeof val === 'function' && everyone.scopeTable.get(fqn) === undefined) {
			everyone.scopeTable.set(fqn, val);
		}
		this.scopeTable.set(fqn, val);

		this.socket.emit('rv', nowUtil.getValOrFqn(val));
	}
	return User;
}


