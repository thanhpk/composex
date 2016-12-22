var assert = require('assert');

var swarm = require('../swarm.js');
var yrml = require('yamljs');
var path = require('path');

describe('Swarm', function() {
	describe('servicename', function() {
		it('should contains scope', function(done) {
			swarm.parse(path.resolve(__dirname, './servicename/docker-compose.yml'), 'thanhpk', function(output) {
				assert.Equal(output.indexOf('--name thanhpk.service1'), -1);
				assert.Equal(output.indexOf('--name thanhpk.B.service2'), -1);
				done();
			});
		});
	});

	describe('enviroments', function() {			
		it('should add --env or -e based on environment', function(done) {
			swarm.parse(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', function(output) {
				assert.Equal(output.indexOf('--env \'thanh=1234\'') != -1 || output.indexOf('-e \'thanh=1234\'') != -1, true);
				assert.Equal(output.indexOf('--env \'van=Hi llo\'') != 1 || output.indexOf('-e \'van=Hi llo\'') != -1, true);
			});
			done();
		});
	});
});

