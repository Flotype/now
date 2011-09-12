var nowUtil = require('./nowUtil').nowUtil;
var ScopeTable = function (data) {
  this.data = data || {};
  this.arrays = {};
};

ScopeTable.prototype.get = function (fqn) {
  // does not reconstruct objects. :P
  return this.data[fqn];
};

ScopeTable.prototype.set = function (fqn, val) {
  if (this.data[fqn] !== undefined) {
    this.deleteChildren(fqn);
  } else {
    var lastIndex = fqn.lastIndexOf('.');
    var parent = fqn.substring(0, lastIndex);
    this.addParent(parent, fqn.substring(lastIndex + 1));
  }
  delete this.arrays[fqn];
  return (this.data[fqn] = val);
};

ScopeTable.prototype.addParent = function (parent, key) {
  if (parent) {
    if (!Array.isArray(this.data[parent])) {
      this.set(parent, []); // Handle changing a non-object to an object.
    }
    this.data[parent].push(key);
  }
};

ScopeTable.prototype.deleteChildren = function (fqn) {
  var keys = this.data[fqn];
  if (Array.isArray(this.data[fqn])) {
    // Deleting a child will remove it via splice.
    for (var i = 0; keys.length;) {
      // Recursive delete all children.
      this.deleteVar(fqn + '.' + keys[i]);
    }
  }
};

ScopeTable.prototype.deleteVar = function (fqn) {
  var lastIndex = fqn.lastIndexOf('.');
  var parent = fqn.substring(0, lastIndex);

  if (nowUtil.hasProperty(this.data, parent)) {
    // Remove from its parent.
    var index = this.data[parent].indexOf(fqn.substring(lastIndex + 1));
    if (index > -1) {
      this.data[parent].splice(index, 1);
    }
    this.deleteChildren(fqn);
    delete this.data[fqn];
    delete this.arrays[fqn];
  }
};

ScopeTable.prototype.flagAsArray = function (fqn, len) {
  return (this.arrays[fqn] = len);
};

exports.ScopeTable = ScopeTable;
