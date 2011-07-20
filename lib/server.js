var nowUtil = require('./nowUtil').nowUtil;
var Now = require('./now').Now;

process.on('uncaughtException', function (err) {
  console.log(err.message);
  console.log(err.stack);
});

module.exports = new Now();