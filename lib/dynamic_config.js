var winston = require('winston');
var AWS = require('aws-sdk');

AWS.config.region = 'us-east-1';

function DynamicConfig(cloud_stack) {
	this.cloud_stack = cloud_stack;
	this.table_name = null;
}

module.exports = DynamicConfig;

DynamicConfig.prototype.initialize = function(callback) {
	metadata = {
		"action": "initialize_config",
		"status": "start",
		"cloud_stack": this.cloud_stack
	};
	winston.info("Initializing dynamic config", metadata);
	if ( this.cloud_stack ) {
		regex = this.cloud_stack + '-[a-z]+-ConfigTable-[a-zA-Z0-9]+';
		var db = new AWS.DynamoDB();
		config = this;
		db.listTables(function(err, data) {
			if ( data ) {
				metadata = {
					"action": "initialize_config",
					"status": "list_tables",
					"cloud_stack": config.cloud_stack,
					"tables": data.TableNames,
					"regex": regex
				};
				winston.info("Found tables", metadata);
				for (var i in data.TableNames) {
					table = data.TableNames[i];
					var result = table.match(regex);
					metadata = {
						"action": "initialize_config",
						"status": "check_table",
						"cloud_stack": config.cloud_stack,
						"tables": data.TableNames,
						"table": table,
						"regex": regex,
						"result": result
					};
					winston.debug("Checking table", metadata);
					if ( result ) {
						config.table_name = table;
						callback(null, table);
						break;
					}
				}
			}
			else {
				callback(err, null);
			}
		});
	}
	else {
		callback("cloud_stack not provided", null);
	}
}

DynamicConfig.prototype.get_eureka_url = function(callback) {
	callback(null, process.env.EUREKA_URL)
}