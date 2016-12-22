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
				done();
			});
		});
	});

	describe('expose', function() {
		it('should add --publish based on expose', function(done) {
			swarm.parse(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', function(output) {
				assert.Equal(output.indexOf('--publish 8080') != -1 || output.indexOf('-p 8080') != -1, true);
				done();
			});
		});
	});

	describe('network', function() {
		it('should add --network based on scope', function(done) {
			swarm.parse(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', function(output) {
				assert.Equal(output.indexOf('--network thanhpk_overlay_ds'), -1);
				done();
			});
		});
	});

	descible('volume', function() {
		it('should add volume', function(done) {
			swarm.parse(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', function(output) {
				assert.Equal("--mount type=bind,source=/tmp/thanhpk/mongo/data/db,destination=/data/db", -1);
				assert.Equal("--mount type=bind,source=/tmp/thanhpk/mongo/data/db2,destination=/data/db2", -1);
				done();
			});
		});
	});
});

