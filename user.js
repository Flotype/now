exports.Client = function(socket) {
	this.socket = socket;

	//groups that the user is in.
	this.groups = [];

	//the user's ScopeTable
	this.scopeTable = new ScopeTable();

	//reference for this.user
	this.user = { clientId: socket.sessionid; }

	this.now = this._generateProxy();
}

Client.prototype._generateProxy = function() {
	//return the proxy object for the Client
}
