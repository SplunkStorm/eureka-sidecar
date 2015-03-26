var winston = require('winston');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var Client = require('node-rest-client').Client;
var DynamicConfig = require('./dynamic_config');

module.exports = {
	client: new Client(),
	attempt: 1,
	registered: false,
	validate_options: function(options) {
		var required_options = ['app', 'ip-address', 'app-port', 'hostname'];
		var missing_options = [];
		var defaults = {
			'timer': 5,
			'retries': 5,
			'retry_timeout': 5,
			'eureka_version': 'v2',
			'proto': 'http',
			'cloud_stack': null
		};
		for (key in defaults) {
			options[key] = options[key] || defaults[key];
		}

		for (key in required_options) {
			if (options[required_options[key]] == undefined) {
				missing_options.push(required_options[key]);
			}
		}
		if (missing_options.length) {
			throw new Error("Missing options " + missing_options.join(', '));
		}

		winston.info('Validated options', options);
		return options;
	},

	initialize: function(override_options) {
		metadata = {
			"action": "initialize",
			"status": "start"
		};
		winston.info("Initializing eureka-sidecar", metadata);
		this.options = this.validate_options(override_options);
		this.retrieve_eureka_url();
		this.eureka_register();
		this.setup_timer();
	},

	retrieve_eureka_url: function() {
		metadata = {
			"action": "retrieve_eureka_url",
			"status": "start"
		};
		winston.info("Starting initialization", metadata);
		this.config = new DynamicConfig(this.options.cloud_stack);
		this.config.initialize(function (err, table) {
			if ( err ) {
				winston.error(err);
			}
			else {
				metadata = {
					"action": "retrieve_eureka_url",
					"status": "in_progress",
					"table": table
				};
				winston.info("Initizalization complete", metadata);
				config.get_eureka_url(function (err, eureka_url) {
					if ( err ) {
						winston.error(err);
					}
					else {
						this.options.eureka_url = eureka_url;
						metadata = {
							"action": "retrieve_eureka_url",
							"status": "success",
							"table": table,
							"eureka_url": eureka_url
						};
						winston.info("Retrieved Eureka URL", metadata);
					}
				}.bind(this));
			}
		}.bind(this));
	},

	eureka_register: function() {
		metadata = {
			"action": "eureka_register",
			"status": "start",
			"retry_timeout": this.options.retry_timeout,
			"attempt": this.attempt,
			"retries": this.options.retries,
			"eureka_url": this.options.eureka_url
		};
		winston.info("Registering with Eureka", metadata);
		this.check_health(function(healthy) {
			if (healthy && this.options.eureka_url) {
				this.make_register_rest_call();
			}
			else {
				metadata["status"] = "retry";
				winston.warn("Microservice not ready yet", metadata);

				setTimeout(function() {
					if (this.attempt >= this.options.retries) {
						metadata["status"] = "failed";
						winston.error("Microservice registration failed",
							metadata);
						throw new Error("Microservice registration failed");
					}
					else {
						this.attempt++;
						this.eureka_register();
					}
				}.bind(this), this.options.retry_timeout * 1000);
			}
		}.bind(this));
	},

	make_register_rest_call: function() {
		metadata = {
			"action": "make_register_rest_call",
			"status": "success",
			"registered": this.registered
		};
		winston.info("Registering with eureka", metadata);
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

		var req = this.client.post(this.options['eureka_url'] + '/' +
				this.options['eureka_version'] + '/apps/' + this.options['app'],
			register_args, function (data, response) {
				if (response.statusCode >= 300) {
					throw new Error(data);
				} else {
					this.registered = true;
					metadata = {
						"action": "make_register_rest_call",
						"status": "success",
						"registered": this.registered
					};
					winston.info("Service is up", metadata);
				}
			}.bind(this));
	},

	check_health: function(callback) {
		var self = this;
		var health_check_args = {
			headers: {
				Accept: 'application/json'
			}
		};

		var url = this.options['proto'] + '://localhost:' +
				this.options['app-port'] + '/health';
		metadata = {
			"action": "check_health",
			"url": url
		};
		winston.info("Checking health", metadata);
		var req = this.client.get(url, health_check_args, function(data, response) {
			if (response.statusCode >= 300) {
				metadata["status"] = "failed";
				metadata["message"] = err.message;
				metadata["code"] = err.code;
				winston.error("Health check failed", metadata);
				callback(false);
			} else {
				callback(self.parse_health_response(data));
			}
		});
		req.on('error', function(err) {
			metadata["status"] = "failed";
			metadata["message"] = err.message;
			metadata["code"] = err.code;
			winston.error("Health check failed", metadata);
			callback(false);
		});
	},

	parse_health_response: function (data) {
		var parsed;

		try {
			if (typeof(data) === 'string') {
				parsed = JSON.parse(data);
			} else if (typeof(data) === 'object') {
				parsed = data;
			} else {
				throw new Error('unknown data type: ' + typeof(data));
			}
			winston.info("health_response", parsed);
			return parsed.status === "ok";
		}
		catch (err) {
			metadata = {
				"action": "parse_health_response",
				"status": "failed",
				"message": err.message,
				"code": err.code,
				"response": data
			};
			winston.error("Unable to parse health response", metadata);
			return false;
		}
	},

	setup_timer: function() {
		interval = this.options['timer'] * 1000;
		metadata = {
			"interval": interval
		};
		winston.info("Starting heartbeat timer", metadata);
		this.interval = setInterval(this.heartbeat_interval.bind(this),
			interval);
	},

    heartbeat_interval: function() {
        if (this.registered) {
            this.check_health(function (healthy) {
                var url = [
                    this.options['eureka_url'],
                    this.options['eureka_version'], 'apps',
					this.options['app'],
                    this.options['hostname']
                ].join('/');
                if (healthy) {
                    this.client.put(url, function (data, response) {
                        if (response.statusCode >= 300) {
                            winston.error(response);
                            throw new Error(data);
                        }
                    });
                } else {
					metadata = {
						"action": "heartbeat_interval",
						"status": "failed",
						"healthy": healthy,
						"registered": registered
					};
					winston.error("Microservice is no longer healthy",
						metadata);
                    this.client.delete(url, function (data, response) {
                        if (response.statusCode >= 300) {
                            winston.error(response);
                            throw new Error(data);
                        }
                        throw new Error("Sidecar suiciding due to microservice death");
                    });
                }
            }.bind(this))
        }
		else {
			metadata = {
				"action": "heartbeat_interval",
				"status": "retry"
			};
            winston.warn("Skipping heartbeat", metadata);
        }
    }
};
