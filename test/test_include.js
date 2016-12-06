var assert = require('assert');
var composex = require('../index.js');
var yaml = require('yamljs');
var path = require('path');

describe('Include', function() {
	describe('include', function() {
		it('should include all service', function(done) {
			composex.parse(path.resolve(__dirname, './allservice/deploy.yml'), function(obj) {
				assert.notEqual(obj.services['A.nginx'], undefined);
				assert.notEqual(obj.services['newfpm'], undefined);
				assert.notEqual(obj.services['A.fpm'], undefined);
				done();
			});
		});
	});
});
