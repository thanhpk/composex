var assert = require('assert');
var composex = require('../index.js');
var yml = require('yamljs');
var path = require('path');

describe('Swarm', function() {
	describe('servicename', function() {
		it('should contains scope', function(done) {
			composex.toSwarm(path.resolve(__dirname, './servicename/docker-compose.yml'), 'thanhpk', '', function(output) {
				assert.notEqual(output.indexOf('--name thanhpk.service1'), -1);
				assert.notEqual(output.indexOf('--name thanhpk.B.service2'), -1);
				done();
			});
		});

		it('should have image name', function(done) {
			composex.toSwarm(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', '', function(output) {
				assert.notEqual(output.indexOf(' thanhpk234 '), -1);
				done();
			});
		});

		it('should have command', function(done) {
			composex.toSwarm(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', '', function(output) {
				assert.notEqual(output.indexOf(' ping google.com -g'), -1);
				done();
			});
		});		
	});

	describe('enviroments', function() {			
		it('should add --env or -e based on environment', function(done) {
			composex.toSwarm(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', '', function(output) {
				assert.equal(output.indexOf('--env \'thanh=1234\'') != -1 || output.indexOf('-e \'thanh=1234\'') != -1, true);
				assert.equal(output.indexOf('--env \'van=Hi llo\'') != 1 || output.indexOf('-e \'van=Hi llo\'') != -1, true);
				done();
			});
		});
	});

	describe('expose', function() {
		it('should add --publish based on expose', function(done) {
			composex.toSwarm(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', '', function(output) {
				assert.equal(output.indexOf('--publish 8080') != -1 || output.indexOf('-p 8080') != -1, true);
				done();
			});
		});
	});

	describe('network', function() {
		it('should add --network based on scope', function(done) {
			composex.toSwarm(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', '', function(output) {
				assert.notEqual(output.indexOf('--network thanhpk_overlay_ds'), -1);
				done();
			});
		});
	});
	
	describe('volume', function() {
		it('should add volume', function(done) {
			composex.toSwarm(path.resolve(__dirname, './swarm/docker-compose.yml'), 'thanhpk', '/gluster', function(output) {
				assert.notEqual(output.indexOf("--mount type=bind,source=/gluster/thanhpk/mongo/data/db,destination=/data/db"), -1);
				assert.notEqual(output.indexOf("--mount type=bind,source=/gluster/thanhpk/mongo/data/db2,destination=/data/db2"), -1);
				done();
			});
		});
	});
});

