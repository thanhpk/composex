var assert = require('assert');
var sm = require('../sm.js');
var fs = require('fs');

describe('SM Deploy', function() {
	describe('Services', function() {
		it('should list all containers with correct name', function(done) {
			fs.readFile(__filename + '/test/sm/deploy.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(ymlobj) {
					assert.equal(ymlobj.services['dashboard.nginx'].image, 'nginx:1.2.5');
					done();
				});
			});			
		});
		
		it('should replace service env variable with correct service name', function(done) {
			fs.readFile(__filename + '/test/sm/deploy.yml', 'utf-8', function(err, data) {
				sm.parse(data, function(ymlobj) {
					assert.equal(ymlobj.services['dashboard.nginx'].host_env.APIACCOUNTHOST, 'apiaccount.mongo');
					done();
				});
			});
		});
	});
});
