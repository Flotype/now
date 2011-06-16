var ScopeTable = function () {
};

ScopeTable.prototype.data = {};

ScopeTable.prototype.get = function (fqn) {
  return data[fqn];
};

ScopeTable.prototype.set = function (fqn, val) {
  return data[fqn] = val;
};
