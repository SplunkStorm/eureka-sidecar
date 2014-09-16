#!/usr/bin/env node

var sidecar = require('../lib/eureka-sidecar');

sidecar.initialize({
	'eureka_url': process.env.EUREKA_URL || 'http://ec2-54-165-101-15.compute-1.amazonaws.com/eureka',
	'app': process.env.APP || 'sidecar',
	'ip-address': process.env.IP_ADDRESS || '10.13.6.48',
	'app-port': process.env.PORT || '5000',
	'hostname': process.env.HOSTNAME || 'frankenstein',
	'metadata': {
		'version': process.env.VERSION || '0.0.1'
	}
});