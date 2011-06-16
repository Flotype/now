var ScopeTable = function (data) {
  this.data = data || {};
};

ScopeTable.prototype.get = function (fqn) {
  return this.data[fqn];
};

ScopeTable.prototype.set = function (fqn, val) {
  return this.data[fqn] = val;
};

exports.ScopeTable = ScopeTable;