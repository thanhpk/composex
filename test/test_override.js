var assert = require('assert');
var composex = require('../index.js');
var yaml = require('yamljs');
var path = require('path');

describe('Override', function() {
	// namespace
	describe('links', function() {
		it('should be overrided', function(done) {
			composex.parse( path.resolve(__dirname, './overridelink/deploy.yml'), function(obj) {
				assert.equal(obj.services['A.nginx'].links[0].trim(), 'newfpm:fpm');
				done();
			});
		});
	});

});
