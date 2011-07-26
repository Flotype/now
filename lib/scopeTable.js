var nowUtil = require('./nowUtil').nowUtil;
var ScopeTable = function (data) {
  this.data = data || {};
};

ScopeTable.prototype.get = function (fqn) {
  // does not reconstruct objects. :P
  return this.data[fqn];
};

ScopeTable.prototype.set = function (fqn, val) {
  if (this.data[fqn] !== undefined) {
    this.deleteVar(fqn, val);
  }
  var lastIndex = fqn.lastIndexOf('.');
  var parent = fqn.substring(0, lastIndex);
  this.addParent(parent, fqn.substring(lastIndex + 1));
  return this.data[fqn] = val;
};

ScopeTable.prototype.addParent = function(parent, key) {
  if (parent && !Array.isArray(this.data[parent])) {
    this.set(parent, []); // Handle changing a non-object to an object.
  }
  if (parent) {
    this.data[parent].push(key);
  }
}

ScopeTable.prototype.deleteVar = function (fqn) {
  var lastIndex = fqn.lastIndexOf('.');
  var parent = fqn.substring(0, lastIndex);
    
  if (nowUtil.hasProperty(this.data, parent)) {
    
    // Remove from its parent.
    var index = this.data[parent].indexOf(fqn.substring(lastIndex + 1));
    if (index > -1) {
      this.data[parent].splice(index, 1);
    }
  }
  if (Array.isArray(this.data[fqn])) {
    for (var i = 0; i < this.data[fqn].length; i++) {
      // Recursive delete all children.
      this.deleteVar(fqn + '.' + this.data[fqn][i]);
    }
  }
  delete this.data[fqn];
};

exports.ScopeTable = ScopeTable;