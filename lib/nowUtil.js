exports.nowUtil = {

  hasProperty: function(obj, prop) {
    return Object.prototype.hasOwnProperty.call(Object(obj), prop);
  },

  clone: function(obj) {
    var output = {};
    output.__proto__ = obj;
    return output;
  },

  generateRandomString: function(){
    return Math.random().toString().substr(2);
  },

  getAllChildFqns: function(parentObj, parentFqn){
    var fqns = [];

    function getAllChildFqnsHelper(parentObj, parentFqn){
      for(var prop in parentObj){
        if(util.hasProperty(parentObj, prop)) {
          fqns.push(parentFqn+'.'+prop);
          if(parentObj[prop] && typeof parentObj[prop] === 'object'){
            getAllChildFqnsHelper(parentObj[prop], parentFqn+'.'+prop);
          }
        }
      }
    }
    getAllChildFqnsHelper(parentObj, parentFqn);
    return fqns;
  },

  getVarFromFqn: function(fqn, scope){
    var path = fqn.split('.');
    path.shift();
    var currVar = scope;
    while(path.length > 0){
      var prop = path.shift();
      if(util.hasProperty(currVar, prop)) {
        currVar = currVar[prop];
      } else {
        return false;
      }
    }
    return currVar;
  },

  flatten: function(val, fqn) {
    var vals = {};
    var fqns = util.getAllChildFqns(val, "");
    for(var i = 0, ii = fqns.length; i < ii; i++) {
      vals[fqn+fqns[i]] = getValOrFqn(getVarFromFqn(fqns[i], val));
    }
    return vals;
  },
  
};
