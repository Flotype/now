var nowUtil = require('./nowUtil').nowUtil;
var Now = require('./now').Now;

process.on('uncaughtException', function (err) {
  nowUtil.error(err);
});

module.exports = new Now();