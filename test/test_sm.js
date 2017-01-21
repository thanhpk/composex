var assert = require('assert');
var sm = require('../sm.js');
var fs = require('fs');

describe('SM Deploy', function() {
	describe('yaml bug', function() {
		it('imports must be array', function(done) {
			fs.readFile(__dirname + '/sm/deploy_importnotarray.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(err, ymlobj) {
					assert.notEqual(err, undefined);
					done();
				});
			});
		});

		it('imports must not contains "."', function(done) {
			fs.readFile(__dirname + '/sm/deploycontaindot.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(err, ymlobj) {
					assert.notEqual(err, undefined);
					done();
				});
			});
		});

		it('host_env services should be in imports', function(done) {
			fs.readFile(__dirname + '/sm/deploywrongimport.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(err, ymlobj) {
					assert.notEqual(err, undefined);
					done();
				});
			});
		});
	});

	describe('Services', function() {
		it('should list all containers with correct name', function(done) {
			fs.readFile(__dirname + '/sm/deploy.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(err, ymlobj) {
					if (err) assert.fail(err);
					assert.equal(ymlobj.services['dashboard.nginx'].image, 'nginx:1.2.5');
					done();
				});
			});
		});

		it('should mount the volume', function(done) {
			fs.readFile(__dirname + '/sm/deploy.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(err, ymlobj) {
					if (err) assert.fail(err);
					var volumes = ymlobj.services['apiaccount.mongo'].volumes;
					for (var i in volumes) {
						var volume = volumes[i];
						var voumeSplit = volume.split(':');
						var hostPath = volumeSplit[0];
						var containerPath = volumeSplit[1];
						if (containerPath == '/tmp') {
							assert.equal(hostPath, '/tmp/y');
						}

						if (containerPath == '/var/db') {
							assert.equal(hostPath, '/tmp/x/data2');
						}
						done();
					}
				}, '/tmp/x');
			});
		});
		
		it('should replace service env variable with correct service name', function(done) {
			fs.readFile(__dirname + '/sm/deploy.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(err, ymlobj) {
					if (err) assert.fail(err);
					assert.equal(ymlobj.services['dashboard.nginx'].host_env.APIACCOUNTHOST, 'apiaccount.mongo');
					done();
				});
			});
		});
	});
});
