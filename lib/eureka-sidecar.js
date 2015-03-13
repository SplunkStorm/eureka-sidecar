process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var Client = require('node-rest-client').Client;

module.exports = {
	client: new Client(),
	attempt: 1,
	registered: false,
	validate_options: function(options) {
		var required_options = ['eureka_url', 'app', 'ip-address', 'app-port', 'hostname'];
		var missing_options = [];
		var defaults = {
			'timer': 5,
			'retries': 5,
			'retry_timeout': 5,
			'eureka_version': 'v2',
			'proto': 'http'
		};
		for (var key in defaults) {
			options[key] = options[key] || defaults[key];
		}

		for (var key in required_options) {
			if (options[required_options[key]] == undefined) {
				missing_options.push(required_options[key]);
			}
		}
		if (missing_options.length) {
			throw new Error("Missing options " + missing_options.join(', '));
		}

		return options;
	},

	initialize: function(override_options) {
		console.log("Initializing");
		this.options = this.validate_options(override_options);
		console.log("Options: " );
		console.log(this.options);
		this.register();
		this.setup_timer();	
	},

	register: function() {
		console.log("Initial registration started");
		this.check_health(function(healthy) {
			if (healthy) {
				this.make_register_rest_call();
			} else {
				console.log("Microservice not ready yet.  Waiting " + this.options.retry_timeout +
					" seconds and trying again.  Attempt " + this.attempt + " of " +
					this.options.retries);
				setTimeout(function() {
					if (this.attempt >= this.options.retries) {
						throw new Error('Microservice failed to come up after ' + this.options.retries + ' attempts.');
					} else {
						this.attempt++;
						this.register();
					}
				}.bind(this), this.options.retry_timeout * 1000);
			}
		}.bind(this));

	},

	make_register_rest_call: function() {
		console.log("Registering with eureka");
		var register_args = {
			data: {
				'instance': {
					'hostName': this.options['hostname'],
					'app': this.options['app'],
					'ipAddr': this.options['ip-address'],
					'status': 'UP',
					'port': this.options['app-port'],
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

		var req = this.client.post(this.options['eureka_url'] + '/' + this.options['eureka_version'] + '/apps/' + this.options['app'],
			register_args, function (data, response) {
				if (response.statusCode >= 300) {
					throw new Error(data);
				} else {
					console.log("Service is up.  Registered.");
					this.registered = true;
				}
			}.bind(this));
	},

	check_health: function(callback) {
		console.log("Checking health");
		var self = this;

		var health_check_args = {
			headers: {
				Accept: 'application/json'
			}
		};

		var url = this.options['proto'] + '://localhost:' + this.options['app-port'] + '/health';
		var req = this.client.get(url, health_check_args, function(data, response) {
			if (response.statusCode >= 300) {
				console.error("Error");
				console.error(data);
				callback(false);
			} else {
				callback(self.parse_health_response(data));
			}
		});
		req.on('error', function(err) {
			console.log("Something went wrong connecting to local microservice: " + err.code);
			console.log(err);
			callback(false);
		});
	},

	parse_health_response: function (data) {
		console.log("Parsing health response");
		var parsed;

		try {
			if (typeof(data) === 'string') {
				parsed = JSON.parse(data);
			} else if (typeof(data) === 'object') {
				parsed = data;
			} else {
				throw new Error('unknown data type: ' + typeof(data));
			}
			console.log(parsed);
			return parsed.status === "ok";
		} catch (e) {
			console.error(e.message);
			console.error(data);
			return false;
		}
	},

	setup_timer: function() {
		console.log("Starting heartbeat timer");
		this.interval = setInterval(this.heartbeat_interval.bind(this), this.options['timer'] * 1000);
	},

    heartbeat_interval: function() {
        if (this.registered) {
            this.check_health(function (healthy) {
                var url = [
                    this.options['eureka_url'],
                    this.options['eureka_version'], 'apps', this.options['app'],
                    this.options['hostname']
                ].join('/');
                if (healthy) {
                    var req = this.client.put(url, function (data, response) {
                        if (response.statusCode >= 300) {
                            console.log(response);
                            throw new Error(data);
                        }
                    });
                } else {
                    console.log("Microservice is no longer healthy, deregistering from Eureka.");
                    var req = this.client.delete(url, function (data, response) {
                        if (response.statusCode >= 300) {
                            console.log(response);
                            throw new Error(data);
                        }
                        throw new Error("Sidecar suiciding due to microservice death");
                    });
                }
            }.bind(this))
        } else {
            console.log("Not registered with eureka yet, skipping heartbeat");
        }
    }
};
