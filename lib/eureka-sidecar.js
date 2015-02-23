var Client = require('node-rest-client').Client;
var https = require('https');

module.exports = {
	client: new Client(),

	validate_options: function(options) {
		var required_options = ['eureka_url', 'app', 'ip-address', 'app-port', 'hostname'];
		var missing_options = [];
		var defaults = {
			'timer': 5
		}
		for (var key in defaults) {
			options[key] = options[key] || defaults[key];
		}

		for (var key in required_options) {
			if (options[required_options[key]] == undefined) {
				missing_options.push(required_options[key]);
			}
		}
		// console.log(missing_options);
		if (missing_options.length) {
			throw new Error("Missing options " + missing_options.join(', '));
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

		this.client.post(this.options['eureka_url'] + '/v2/apps/' + this.options['app'], 
			register_args, function(data, response) {
				console.log(data);
				console.log(response);
				console.log(JSON.stringify(register_args));
				if (response.statusCode >= 300) {
					throw new Error(data);
				}
			});
	},

	check_health: function(callback) {
		var self = this;
		var options = {
			host: 'localhost',
			path: '/health',
			port: this.options['app-port'],
			method: 'GET',
			headers: {
				'Accept': 'application/json'
			}
		};

		var req = https.request(options, function(res) {
			var data = '';
			res.on('data', function(d) {
				data = data + d;
			});

			res.on('end', function() {
				callback(self.parse_health_response(data));
			});
		});
	},

	parse_health_response: function (data) {
		var parsed;

		try {
			parsed = JSON.parse(data);
			return parsed.status === "ok";
		} catch (e) {
			console.error(e.message);
			console.error(data);
			return false;
		}
	},

	setup_timer: function() {
		this.interval = setInterval((function() {
			this.check_health(function(healthy) {
				if (healthy) {
					var url = [
						this.options['eureka_url'],
						'v2', 'apps', this.options['app'],
						this.options['hostname']
					].join('/');

					console.log("Heartbeat to " + url);

					this.client.put(url, function(data, response) {
						console.log(data);
						if (response.statusCode >= 300) {
							console.log(response);
							throw new Error(data);
						}
					});
				} else {

				}
			})

		}).bind(this), this.options['timer'] * 1000);

	}

}