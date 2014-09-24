#!/usr/bin/env node
var os = require('os');
var fs = require('fs');
var sidecar = require('../lib/eureka-sidecar');
var buildNumber = -1

fs.readFile('/etc/buildnumber', function(err, data) {
	if (!err) {
		buildNumber = data.trim();
	}

	sidecar.initialize({
		'eureka_url': process.env.EUREKA_URL || 'http://eureka.services.splunkcloud.net/eureka',
		'app': process.env.APP || 'sidecar',
		'ip-address': process.env.IP_ADDRESS || os.networkInterfaces().eth0[0].address,
		'app-port': process.env.PORT || '5000',
		'hostname': process.env.HOSTNAME || os.hostname(),
		'metadata': {
			'version': process.env.VERSION || '0.0.1',
			'build': buildNumber
		}
	});
});

