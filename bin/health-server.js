
/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express();

// Routes
app.get('/health', function(req, res) {
	res.json({
        'status': 'ok',
        'service_info': {
          'name': 'dummy',
          'version': 2
        }
    });
});

var server = app.listen(5000, function(){
  console.log("Express server listening on port %d", server.address().port);
});
