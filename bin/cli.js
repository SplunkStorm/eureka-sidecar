#!/usr/bin/env node

var os = require('os');
var fs = require('fs');
var sidecar = require('../lib/eureka-sidecar');
require('longjohn');

var buildNumber = -1;

fs.readFile('/etc/buildnumber', function(err, data) {
	if (!err) {
		buildNumber = data.toString().trim();
	}

	sidecar.initialize({
		'cloud_stack': process.env.CLOUD_STACK,
		'app': process.env.APP || 'sidecar',
		'ip-address': process.env.IP_ADDRESS || os.networkInterfaces().eth0[0].address,
		'app-port': process.env.PORT || '5000',
		'proto': process.env.PROTO || 'http',
		'hostname': process.env.HOSTNAME || os.hostname(),
		'metadata': {
			'version': process.env.VERSION || '0.0.1',
			'build': buildNumber
		}
	});
});

