var assert = require('assert');
var composex = require('../index.js');
var yaml = require('yamljs');
var path = require('path');

describe('Hostenv', function() {
	describe('hostenv', function() {
		it('should be resolve as env', function(done) {
			composex.parse(path.resolve(__dirname, './hostenv/deploy.yml'), function(obj) {
				assert.notEqual(obj.services['webserver'].environment.join('\n').indexOf('DB=database'), -1);
				done();
			});
		});
		
		it('should be overrided', function(done) {
			composex.parse(path.resolve(__dirname, './hostenv/deploy.yml'), function(obj) {
				assert.notEqual(obj.services['COMMON.dashboard2'].environment.join('\n').indexOf('DATABASEHOST=COMMON.BASE.database'), -1);
				assert.equal(obj.services['COMMON.dashboard2'].environment.join('\n').indexOf('DATABASEHOST=COMMON.database'), -1);
				done();
			});
		});

		it('should be resolve to correct name', function(done) {
			composex.parse(path.resolve(__dirname, './hostenv/deploy.yml'), function(obj) {
				assert.notEqual(obj.services['COMMON.database'].environment.join('\n').indexOf('BASE=COMMON.BASE.database'), -1);
				assert.notEqual(obj.services['COMMON.dashboard'].environment.join('\n').indexOf('DATABASEHOST=COMMON.database'), -1);
				done();
			});
		});
	});
});
