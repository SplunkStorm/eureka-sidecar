process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var Client = require('node-rest-client').Client;
var SplunkCloud = require('splunk_cloud_common_node');

var logger = SplunkCloud.Logger;
var merge_logger_data = SplunkCloud.MergeLoggerData.merge_logger_data;

var service_log_data = {
    service: 'eureka-sidecar',
    version: '1.0.0',
    path: ''
}


module.exports = {
    client: new Client(),
    attempt: 1,
    registered: false,
    validate_options: function (options) {
        var required_options = ['app', 'ip-address',
            'app-port', 'hostname'];
        var missing_options = [];
        var defaults = {
            'timer': 5,
            'retries': 5,
            'retry_timeout': 5,
            'eureka_version': 'v2',
            'proto': 'https',
            'cloud_stack': null
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

        logger.info('Validated options', options);
        return options;
    },

    initialize: function (override_options) {
        var metadata = {
            "action": "initialize",
            "status": "start"
        };
        var function_log_data = {
            action: 'initialize',
            status: 'start',
            filename: __filename
        };
        var merged_log_data = merge_logger_data(service_log_data, function_log_data);
        logger.info("Initializing eureka-sidecar", merged_log_data);
        this.options = this.validate_options(override_options);

        //If the cloud_stack option is set try and retrieve the Eureka URL from
        //dynamic config, otherwise just fallback to the default URL.
        //TODO: This behaviour should be removed and we should only use Dynamic
        //Config after the dynamic config system is deployed to prod.
        // DS 2015/3/31
        if ( this.options.cloud_stack ) {
            this.config = SplunkCloud.DynamicConfig(process.env.CLOUD_STACK);
            this.config.get_eureka_url(function (err, eureka_url) {
                if (err) {
                    throw new Error(err);
                }

                this.options.eureka_url = eureka_url + "/eureka";
                merged_log_data = merge_logger_data(service_log_data, function_log_data,
                    {status: 'success', eureka_url: this.options.eureka_url});
                logger.info('Retrieve eureka url completed', merged_log_data);

                this.register();
                this.setup_timer();
            }.bind(this));
        }
        else {
            //this.options.eureka_url = "http://eureka.services.splunkcloud.net/eureka";
            this.options.eureka_url = "http://54.152.252.16:8080/eureka";
            this.register();
            this.setup_timer();
        }
    },

    register: function () {
        var function_log_data = {
            action: "register",
            status: "start",
            retry_timeout: this.options.retry_timeout,
            attempt: this.attempt,
            retries: this.options.retries,
            eureka_url: this.options.eureka_url,
            filename: __filename
        };
        var merged_log_data = merge_logger_data(service_log_data, function_log_data);
        logger.info("Registering with Eureka", merged_log_data);
        this.check_health(function (healthy) {
            if (healthy) {
                this.make_register_rest_call();
            }
            else {
                merged_log_data = merge_logger_data(service_log_data, function_log_data,
                    {status: 'retry'});
                logger.warn("Microservice not ready yet", merged_log_data);

                setTimeout(function () {
                    if (this.attempt >= this.options.retries) {
                        merged_log_data = merge_logger_data(service_log_data, function_log_data,
                            {status: 'failed'});
                        logger.error("Microservice registration failed", merged_log_data);
                        throw new Error("Microservice registration failed");
                    }
                    else {
                        this.attempt++;
                        this.register();
                    }
                }.bind(this), this.options.retry_timeout * 1000);
            }
        }.bind(this));
    },

    make_register_rest_call: function () {
        var function_log_data = {
            action: "make_register_rest_call",
            status: "start",
            registered: this.registered,
            eureka_url: this.options.eureka_url,
            filename: __filename
        };
        var merged_log_data = merge_logger_data(service_log_data, function_log_data);
        logger.info("Registering with eureka", merged_log_data);
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
                    winston.error(data, metadata);
                } else {
                    this.registered = true;
                    merged_log_data = merge_logger_data(service_log_data, function_log_data,
                        {status: 'success', registered: this.registered})
                    logger.info("Service is up", merged_log_data);
                }
            }.bind(this));
        var errorHandler = function(req) {
            metadata.level = "CRITICAL";
            winston.error("socket error", metadata);
            req.abort();
        };
        req.on('requestTimeout', errorHandler);
        req.on('responseTimeout', errorHandler);
        req.on('error', function(err) {
            metadata.level = "CRITICAL";
            winston.error(err.message, metadata);
        });
    },

    check_health: function (callback) {
        var self = this;
        var health_check_args = {
            headers: {
                Accept: 'application/json'
            }
        };

        var url = this.options['proto'] + '://localhost:' +
            this.options['app-port'] + '/health';
        var function_log_data = {
            action: 'check_health',
            url: url,
            filename: __filename
        };
        var merged_log_data = merge_logger_data(service_log_data, function_log_data);
        logger.info("Checking health", merged_log_data);
        var req = this.client.get(url, health_check_args, function (data, response) {
            if (response.statusCode >= 300) {
                merged_log_data = merge_logger_data(service_log_data, function_log_data,
                    {status: 'failed', data: data, statusCode: response.statusCode})
                logger.error("Health check failed", merged_log_data);
                callback(false);
            } else {
                callback(self.parse_health_response(data));
            }
        });
        req.on('error', function (err) {
            merged_log_data = merge_logger_data(service_log_data, function_log_data,
                {status: 'failed', code: err.code})
            logger.error(err.message, merged_log_data);
            callback(false);
        });
    },

    parse_health_response: function (data) {
        var parsed;
        var function_log_data = {
            action: 'parse_health_response',
            filename: __filename
        };

        try {
            if (typeof(data) === 'string') {
                parsed = JSON.parse(data);
            } else if (typeof(data) === 'object') {
                parsed = data;
            } else {
                throw new Error('unknown data type: ' + typeof(data));
            }
            merged_log_data = merge_logger_data(service_log_data, function_log_data, parsed)
            logger.info("health_response", merged_log_data);
            return parsed.status === "ok";
        }
        catch (err) {
            merged_log_data = merge_logger_data(service_log_data, function_log_data,
                {status: 'failed', message: err.message, code: err.code, response: data})
            logger.error("Unable to parse health response", merged_log_data);
            return false;
        }
    },

    setup_timer: function () {
        var interval = this.options['timer'] * 1000;
        var function_log_data = {
            action: 'setup_timer',
            interval: interval,
            filename: __filename
        };
        var merged_log_data = merge_logger_data(service_log_data, function_log_data);
        logger.info("Starting heartbeat timer", merged_log_data);
        this.interval = setInterval(this.heartbeat_interval.bind(this),
            interval);
    },

    heartbeat_interval: function () {
        var function_log_data = {
            action: 'heartbeat_interval',
            filename: __filename
        }
        var merged_log_data = merge_logger_data(service_log_data, function_log_data);
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
                            logger.error(response, merged_log_data);
                            throw new Error(data);
                        }
                    });
                } else {
                    merged_log_data = merge_logger_data(service_log_data, function_log_data,
                        {status: 'failed', healthy: healthy, registered: this.registered})
                    logger.error("Microservice is no longer healthy", merged_log_data);
                    this.client.delete(url, function (data, response) {
                        if (response.statusCode >= 300) {
                            merged_log_data = merge_logger_data(service_log_data, function_log_data, response);
                            logger.error(merged_log_data);
                            throw new Error(data);
                        }
                        throw new Error("Sidecar suiciding due to microservice death");
                    });
                }
            }.bind(this))
        }
        else {
            merged_log_data = merge_logger_data(service_log_data, function_log_data,
                {status: 'retry'})
            logger.warn("Skipping heartbeat", merged_log_data);
        }
    }
};
