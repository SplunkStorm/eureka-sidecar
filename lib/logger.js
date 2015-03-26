var winston = require('winston');

var color = false;
var level = 'info';

if (true || process.env.DEBUG) {
	color = true;
	level = 'debug'
}

module.exports = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({
			colorize: color,
			level: level,
			timestamp: true
		})
	]
});
