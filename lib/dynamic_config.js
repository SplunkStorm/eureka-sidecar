var winston = require('../lib/logger');
var AWS = require('aws-sdk');

AWS.config.region = 'us-east-1';
AWS.config.httpOptions.timeout = 30000;

function DynamicConfig(cloud_stack) {
	this.cloud_stack = cloud_stack;
	this.backend = new DynamicConfigBackend(cloud_stack);
}

function DynamicConfigBackend(cloud_stack) {
	this.cloud_stack = cloud_stack;
	this.dynamodb = new AWS.DynamoDB();
	this.table = null;
}

module.exports = DynamicConfig;

DynamicConfig.prototype.get_eureka_url = function(callback) {
	this.backend.get_value("global", "EurekaInternalURL", callback);
};

DynamicConfigBackend.prototype.extract_table = function(regex, tableNames) {
	var metadata = {
		"action": "extract_table",
		"regex": regex
	};
	for (var i in tableNames) {
		var table = tableNames[i];
		var result = table.match(regex);
		metadata["status"] = "check_table";
		metadata["table"] = table;
		metadata["result"] = result;
		winston.debug("Checking table", metadata);
		if ( result ) {
			this.table = table;
			return table;
		}
	}
	throw new Error("could not find suitable table in " + tableNames)
};

DynamicConfigBackend.prototype.find_table = function(callback) {
	var metadata = {
		"action": "find_table",
		"status": "start",
		"cloud_stack": this.cloud_stack
	};
	winston.info("Finding config table", metadata);
	if ( this.cloud_stack ) {
		var regex = this.cloud_stack + '-[a-z]+-ConfigTable-[a-zA-Z0-9]+';
		this.dynamodb.listTables(function(err, data) {
			if ( err ) {
				throw new Error("Unable to find config table: " + err);
			}
			else {
				metadata["status"] = "list_tables";
				metadata["regex"] = regex;
				metadata["tables"] = data.TableNames;
				winston.info("Found tables", metadata);
				callback(this.extract_table(regex, data.TableNames));
			}
		}.bind(this));
	}
	else {
		throw new Error("cloud_stack not provided");
	}
};

DynamicConfigBackend.prototype.get_value = function(service, key, callback) {
	if ( ! this.table ) {
		this.find_table(function(table) {
			this.get_value(service, key, callback);
		}.bind(this));
	}
	else {
		var params = {
			AttributesToGet: [ "Value" ],
			TableName : this.table,
			Key : {
				"Service" : { "S" : service },
				"Key" : { "S" : key }
			}
		};
		var metadata = {
			"action": "get_value",
			"status": "start",
			"params": params,
			"service": service,
			"key": key
		};
		winston.debug('Getting item', metadata);
		this.dynamodb.getItem(params, function(err, data) {
			if ( err )
				throw err;

			metadata["status"] = "success";
			metadata["value"] = data.Item.Value.S;
			winston.info('Retrieved value', metadata);
			callback(metadata["value"]);
		});
	}
};
