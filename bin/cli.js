#!/usr/bin/env node

var os = require('os');
var fs = require('fs');
var sidecar = require('../lib/eureka-sidecar');
var SplunkCloud = require('splunk_cloud_common_node');
var SplunkCloudDynamicConfig = new SplunkCloud.DynamicConfig();
var winston = SplunkCloud.Logger;
if (process.env.DEBUG) {
	require('longjohn');
}

var buildNumber = -1;

fs.readFile('/etc/buildnumber', function(err, data) {
	if (!err) {
		buildNumber = data.toString().trim();
	}

	SplunkCloudDynamicConfig.get_user_data(function(err, userdata) {
		process.env.CLOUD_STACK = process.env.CLOUD_STACK || userdata.CLOUD_STACK;
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
});

