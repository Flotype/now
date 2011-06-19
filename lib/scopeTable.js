var ScopeTable = function (data) {
  this.data = data || {};
};

ScopeTable.prototype.get = function (fqn) {
  // does not reconstruct objects. :P
  return this.data[fqn];
};

ScopeTable.prototype.set = function (fqn, val) {
  var lastIndex = fqn.lastIndexOf('.');
  var parent = fqn.substring(0, lastIndex);
  if (parent && !Object.prototype.hasOwnProperty.call(this.data, parent)) {
    this.set(parent, []);
  }
  if (parent && this.data[fqn] === undefined)
    this.data[parent].push(fqn.substring(lastIndex + 1));
  return this.data[fqn] = val;
};

ScopeTable.prototype.delete = function (fqn) {
  var lastIndex = fqn.lastIndexOf('.');
  var parent = fqn.substring(0, lastIndex);
  // Remove from its parent.
  this.data[parent].splice(
    this.data[parent].indexOf(fqn.substring(lastIndex + 1)),
    1);
  if (Array.isArray(this.data[fqn])) {
    for (var i = 0; i < this.data[fqn].length; i++) {
      this.delete(fqn + '.' + this.data[fqn][i]);
    }
  }
  delete this.data[fqn];
};

exports.ScopeTable = ScopeTable;