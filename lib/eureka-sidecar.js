var Client = require('node-rest-client').Client;

var client = new Client();

module.exports = {
	validate_options: function(options) {
		var required_options = ['eureka_url', 'app', 'ip-address', 'app-port', 'hostname'];
		var missing_options = [];
		var defaults = {
			'timer': 5
		}
		for (var key in defaults) {
			options[key] = defaults[key];
		}

		for (var key in required_options) {
			if (options[required_options[key]] == undefined) {
				missing_options.push(required_options[key]);
			}
		}

		if (missing_options.length) {
			throw "Missing options " + missing_options.join(', ');
		}

		return options;
	},

	initialize: function(override_options) {
		this.options = this.validate_options(override_options);
		this.register();
		this.setup_timer();	
	},

	register: function() {
		var register_args = {
			data: {
				'instance': {
					'hostName': this.options['hostname'],
					'app': this.options['app'],
					'ipAddr': this.options['ip-address'],
					// 'vipAddress': this.options['ip-address'],
					// 'secureVipAddress': this.options['ip-address'],
					'status': 'UP',
					'port': this.options['app-port'],
					// 'securePort': this.options['app-port'],
					'dataCenterInfo': {
						'name': 'MyOwn'
					},
					'metadata': this.options['metadata']
				}
			},
			headers: {
				'Content-Type': 'application/json'
			}
		};

		client.post(this.options['eureka_url'] + '/v2/apps/' + this.options['app'], 
			register_args, function(data, response) {
				console.log(data);
				console.log(response);
				console.log(JSON.stringify(register_args));
				if (response.statusCode >= 300) {
					throw data;
				}
			});
	},

	setup_timer: function() {
		this.interval = setInterval((function() {
			var url = [
				this.options['eureka_url'], 
				'v2', 'apps', this.options['app'], 
				this.options['hostname']
			].join('/');

			console.log("Heartbeat to " + url);

			client.put(url, function(data, response) {
				console.log(data);
				if (response.statusCode >= 300) {
					console.log(response);
					throw data;
				}
			});
		}).bind(this), this.options['timer'] * 1000);

	}

}