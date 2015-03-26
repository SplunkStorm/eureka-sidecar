/**
 * Created by mharris on 2/25/15.
 */

var sidecar = require('../lib/eureka-sidecar.js');
var should = require('should');
var sinon = require('sinon');
var EventEmitter = require('events').EventEmitter;

describe('eureka-sidecar basic unit tests', function() {
    it ('contains the proper functions', function() {
        sidecar.validate_options.should.be.a.Function;
        sidecar.initialize.should.be.a.Function;
        sidecar.register.should.be.a.Function;
        sidecar.make_register_rest_call.should.be.a.Function;
        sidecar.check_health.should.be.a.Function;
        sidecar.parse_health_response.should.be.a.Function;
        sidecar.setup_timer.should.be.a.Function;
        sidecar.client.should.be.an.Object;
        sidecar.attempt.should.equal(1);
        sidecar.registered.should.be.false;
    });
});

describe('validate_options', function() {
    var options = {
        eureka_url: 'http://eureka',
        app: 'testing',
        'ip-address': '127.0.0.1',
        'app-port': '8000',
        hostname: 'hostname'
    };

    it ('throws an error on missing options', function() {
        (function() {
            sidecar.validate_options({});
        }).should.throw();
    });

    it ('properly populates options when passed the proper options', function() {
        (sidecar.options == undefined).should.be.true;
        var validatedOptions;
        (function() {
            validatedOptions = sidecar.validate_options(options);
        }).should.not.throw();
        validatedOptions.should.be.an.Object;
        validatedOptions.should.have.properties([
            'eureka_url',
            'app',
            'ip-address',
            'app-port',
            'hostname',
            'timer'
        ]);
    });
});

describe('initialize', function() {
    var registerStub, setup_timerStub, validate_optionsStub;
    beforeEach(function() {
        registerStub = sinon.stub(sidecar, 'register');
        setup_timerStub = sinon.stub(sidecar, 'setup_timer');
        validate_optionsStub = sinon.stub(sidecar, 'validate_options');
    });

    afterEach(function() {
        registerStub.restore();
        setup_timerStub.restore();
        validate_optionsStub.restore();
    });

    it ('calls register, setup_timer, and validate_options', function() {
        var options = {};
        validate_optionsStub.returns(options);
        sidecar.initialize(options);
        sidecar.options.should.eql(options);
        validate_optionsStub.called.should.be.true;
        setup_timerStub.called.should.be.true;
        validate_optionsStub.called.should.be.true;
    });
});

describe('register', function() {
    var check_healthStub, make_register_rest_callStub, clock;
    var options = {
        'retries': 5,
        retry_timeout: .001
    };

    beforeEach(function() {
        check_healthStub = sinon.stub(sidecar, 'check_health');
        make_register_rest_callStub = sinon.stub(sidecar, 'make_register_rest_call');
        sidecar.options = options;
        clock = sinon.useFakeTimers();
    });

    afterEach(function() {
        check_healthStub.restore();
        make_register_rest_callStub.restore();
        clock.restore();
    });

    it('on initial success immediately calls make_register_rest_call', function() {
        check_healthStub.callsArgWith(0, true);
        sidecar.eureka_register();
        check_healthStub.called.should.be.true;
        make_register_rest_callStub.called.should.be.true;
    });
    it('on initial failure, waits retry_timeout seconds and tries again', function() {
        check_healthStub.onCall(0).callsArgWith(0, false);
        check_healthStub.onCall(1).callsArgWith(0, true);
        sidecar.eureka_register();
        clock.tick(options.retry_timeout * 1000);
        check_healthStub.calledTwice.should.be.true;
    });
    it('throws an error if microservice is not ready after n attempts', function() {
        sidecar.attempt = 1;
        check_healthStub.callsArgWith(0, false);
        (function() {
            sidecar.eureka_register();
            for (var i = 0; i < options.retries; i++) {
                clock.tick(options.retry_timeout * 1000);
            }
        }).should.throw();
    });
});

describe('make_register_rest_call', function() {
    var client_postStub;
    var successResponse = {statusCode: 200};
    var failResponse = {statusCode: 403};

    beforeEach(function() {
        client_postStub = sinon.stub(sidecar.client, 'post');
    });

    afterEach(function() {
        client_postStub.restore();
    });

    it ('sets registered to true on successful post', function() {
        client_postStub.callsArgWith(2, null, successResponse);
        sidecar.registered.should.be.false;
        sidecar.make_register_rest_call();
        client_postStub.called.should.be.true;
        sidecar.registered.should.be.true;
    });

    it ('throws an error on unsuccessful post', function() {
        client_postStub.callsArgWith(2, 'error', failResponse);
        (function() {
            sidecar.make_register_rest_call();
        }).should.throw('error');
        client_postStub.called.should.be.true;
    });
});

describe('check_health', function() {
    var client_getStub, parse_health_responseStub, responseStub;
    var successResponse = {statusCode: 200};
    var failResponse = {statusCode: 403};
    var successData = '{"status": "ok"}';
    var failData = '{"status": "fucked"}';

    beforeEach(function() {
        client_getStub = sinon.stub(sidecar.client, 'get');
        parse_health_responseStub = sinon.stub(sidecar, 'parse_health_response');
        responseStub = new EventEmitter;
    });

    afterEach(function() {
        client_getStub.restore();
        parse_health_responseStub.restore();
    });

    it('calls back with true on healthy response', function(done) {
        client_getStub.callsArgWith(2, successData, successResponse).returns(responseStub);
        parse_health_responseStub.returns(true);
        sidecar.check_health(function(healthy) {
            healthy.should.be.true;
            done();
        });
    });

    it('calls back with false on an unhealthy response', function(done) {
        client_getStub.callsArgWith(2, failData, successResponse).returns(responseStub);
        parse_health_responseStub.returns(false);
        sidecar.check_health(function(healthy) {
            healthy.should.be.false;
            done();
        });
    });

    it('calls back with false on failure statusCode', function(done) {
        client_getStub.callsArgWith(2, '', failResponse).returns(responseStub);
        sidecar.check_health(function(healthy) {
            healthy.should.be.false;
            done();
        });
    });

    it('calls back with false on HTTP error', function(done) {
        client_getStub.returns(responseStub);
        sidecar.check_health(function(healthy) {
            healthy.should.be.false;
            done();
        });
        responseStub.emit('error', 'E_CONNREFUSED');
    });
});

describe('parse_health_response', function() {
    var successData = '{"status": "ok"}';
    var failData = '{"status": "fucked"}';
    var malformedData = 'this is not valid json';
    var successObjectData = {status: 'ok'};
    var weirdData = NaN;

    it('returns true on successData', function() {
        sidecar.parse_health_response(successData).should.be.true;
    });

    it('returns false on failData', function() {
        sidecar.parse_health_response(failData).should.be.false;
    });

    it('returns false on malformedData', function() {
        sidecar.parse_health_response(malformedData).should.be.false;
    });

    it('returns true on success object data', function() {
        sidecar.parse_health_response(successObjectData).should.be.true;
    });

    it('returns false on weird data', function() {
        sidecar.parse_health_response(weirdData).should.be.false;
    });
});

describe('setup_timer', function() {
    var options = {timer: 5};
    it('sets up the interval', function() {
        sidecar.options = options;
        sidecar.setup_timer();
        (function() {
            sidecar.interval.close();
        }).should.not.throw();
    });
});

describe('heartbeat_interval', function() {
    var check_healthStub, client_putStub, client_deleteStub;
    var successResponse = {statusCode: 200};
    var failResponse = {statusCode: 403};

    beforeEach(function() {
        check_healthStub = sinon.stub(sidecar, 'check_health');
        client_putStub = sinon.stub(sidecar.client, 'put');
        client_deleteStub = sinon.stub(sidecar.client, 'delete');
    });

    afterEach(function() {
        check_healthStub.restore();
        client_putStub.restore();
        client_deleteStub.restore();
    });

    it('noops if the microservice is not registered yet', function() {
        sidecar.registered = false;
        sidecar.heartbeat_interval();
        check_healthStub.called.should.be.false;
        client_deleteStub.called.should.be.false;
        client_putStub.called.should.be.false;
    });

    it('renews the eureka record on successful health check', function() {
        sidecar.registered = true;
        check_healthStub.callsArgWith(0, true);
        client_putStub.callsArgWith(1, null, successResponse);
        (function() {
            sidecar.heartbeat_interval();
            check_healthStub.called.should.be.true;
            client_putStub.called.should.be.true;
        }).should.not.throw();
    });

    it('deletes the eureka record on failed health check', function() {
        sidecar.registered = true;
        check_healthStub.callsArgWith(0, false);
        client_deleteStub.callsArgWith(1, null, successResponse);
        (function() {
            sidecar.heartbeat_interval();
            check_healthStub.called.should.be.true;
            client_deleteStub.called.should.be.true;
        }).should.throw("Sidecar suiciding due to microservice death");
    });

    it('throws an error if eureka renewal fails', function() {
        sidecar.registered = true;
        check_healthStub.callsArgWith(0, true);
        client_putStub.callsArgWith(1, 'data error', failResponse);
        (function() {
            sidecar.heartbeat_interval();
            check_healthStub.called.should.be.true;
            client_putStub.called.should.be.true;
        }).should.throw('data error');
    });

    it('throws an error if eureka removal fails', function() {
        sidecar.registered = true;
        check_healthStub.callsArgWith(0, false);
        client_deleteStub.callsArgWith(1, 'data error', failResponse);
        (function() {
            sidecar.heartbeat_interval();
            check_healthStub.called.should.be.true;
            client_deleteStub.called.should.be.true;
        }).should.throw('data error');
    });
});
