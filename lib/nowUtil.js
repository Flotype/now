
var nowUtil = {

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
  }
  
};