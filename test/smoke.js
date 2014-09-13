var sidecar = require ('../lib/eureka-sidecar.js');
var should = require('should');
var sinon = require('sinon');

describe('eureka sidecar', function() {
	var default_options = {
			'eureka_url': 'http://eureka',
			'app': 'testing',
			'ip-address': '127.0.0.1',
			'app-port': '8000',
			'hostname': 'hostname'
		};

	it('contains the proper functions', function() {
		sidecar.initialize.should.be.a.Function;
		sidecar.register.should.be.a.Function;
		sidecar.validate_options.should.be.a.Function;
		sidecar.setup_timer.should.be.a.Function;
	});

	it('throws an error on empty options', function() {
		(function(){
			sidecar.validate_options({});	
		}).should.throw(/Missing options/);
	});

	it('accepts the default options', function() {
		var validated_options = sidecar.validate_options(default_options);

		validated_options.should.have.properties([
			'eureka_url',
			'app',
			'ip-address',
			'app-port',
			'hostname',
			'timer'
		]);

		validated_options.timer.should.equal(5);
	});

	describe('end to end tests', function() {
		var post_stub;
		before(function(done) {
			post_stub = sinon.stub(sidecar.client, 'post');
			done();
		});

		after(function(done) {
			post_stub.restore();
			done();
		});

		it('calls post on register', function() {
			post_stub.callsArgWith(2, 'Ok', {statusCode: 200});
			sidecar.initialize(default_options);
			post_stub.called.should.be.true;
		});

		it('throws an error if registration fails', function() {
			post_stub.callsArgWith(2, 'Fail', {statusCode: 503});
			(function() {
				sidecar.initialize(default_options);
			}).should.throw('Fail')
		});

		describe('clock tests', function() {
			var put_stub;
			var clock;

			before(function(done) {
				put_stub = sinon.stub(sidecar.client, 'put');
				clock = sinon.useFakeTimers();
				done();
			});

			after(function(done) {
				put_stub.restore();
				clock.restore();
				done();
			});

			it('calls put on a timer', function() {
				post_stub.callsArgWith(2, 'Ok', {statusCode: 200});
				put_stub.callsArgWith(1, 'Ok', {statusCode: 200});
				sidecar.initialize(default_options);
				clock.tick(5000);

				put_stub.called.should.be.true;
			});

			it ('responds to an error on put', function() {
				post_stub.callsArgWith(2, 'Ok', {statusCode: 200});
				put_stub.callsArgWith(1, 'Fail', {statusCode: 503});
				(function() {
					sidecar.initialize(default_options);
					clock.tick(5000);
				}).should.throw('Fail');
			});
		});
	});
});