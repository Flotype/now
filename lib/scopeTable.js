var ScopeTable = function (data) {
  this.data = data || {};
};

ScopeTable.prototype.get = function (fqn) {
  return data[fqn];
};

ScopeTable.prototype.set = function (fqn, val) {
  return data[fqn] = val;
};

exports.ScopeTable = ScopeTable;