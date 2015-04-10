
var merge_obj = function () {
    new_obj = {};

    for (var current = 0; current < arguments.length; current++) {

        for (item in arguments[current]) {
            new_obj[item] = arguments[current][item];
        }
    }

    return new_obj;
}


var merge_logger_data = function(service_log_data, function_log_data, log_data) {
    var priority = ['service_log_data', 'function_log_data', 'log_data']

    var required_fields = {
        service_log_data: ['service', 'version', 'path'],
        function_log_data: ['action', 'filename']
    }

    var lg = {
        service_log_data: service_log_data,
        function_log_data: function_log_data,
        log_data: log_data
    }

    required_fields_enum = 0
    for (var log in required_fields) {
        for (var required_field in required_fields[log]) {
            // check for missing fields
            if (!(required_fields[log][required_field] in lg[log])) {
                required_fields[log][required_field] = "MISSING_FIELD";
            } else if (required_fields[log][required_field].length == 0) {
                required_fields[log][required_field] = "EMPTY_FIELD";
            }
        }
        required_fields_enum++;
    }

    log_obj = merge_obj(service_log_data, function_log_data, log_data)

    return log_obj;
}


module.exports = {
    merge_obj: merge_obj,
    merge_logger_data: merge_logger_data
}
