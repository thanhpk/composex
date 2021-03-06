var assert = require('assert');
var composex = require('../index.js');
var yaml = require('yamljs');
var path = require('path');
var _ = require('lodash');

describe('Override', function() {
	// namespace
	describe('links', function() {
		it('should be full when not being override', function(done) {
			composex.parse(path.resolve(__dirname, './overridelink/not_override_deploy.yml'), function(obj) {
				assert.equal(obj.services['A.nginx'].links[0].trim(), 'A.fpm:fpm');
				done();
			});
		});

		it('should be full when not being override (multilevel)', function(done) {
			composex.parse(path.resolve(__dirname, './overridelink/not_override_deploy_derived.yml'), function(obj) {
				assert.equal(obj.services['B.A.nginx'].links[0].trim(), 'B.A.fpm:fpm');
				done();
			});
		});


		it('shoud be correct level', function(done) {
			composex.parse(path.resolve(__dirname, './overridelink/not_override_deploy_derived.yml'), function(obj) {
				assert.equal(obj.services['B.A.nginx'].links[1].trim(), 'B.mongo:mongo');
				done();
			});
		});
		
		it('should be overrided', function(done) {
			composex.parse( path.resolve(__dirname, './overridelink/deploy.yml'), function(obj) {
				assert.equal(obj.services['A.nginx'].links[0].trim(), 'newfpm:fpm');
				done();
			});
		});
	});

	describe('ports', function() {
		it('should be overried', function(done) {
			composex.parse(path.resolve(__dirname, './overrideport/deploy.yml'), function(obj) {
				var expectport = ["7000:7000", "30:30", "80:40"].sort();
				assert.equal(true, _.isEqual(obj.services['A.nginx'].ports.sort(), expectport));
				done();
			});
		});
	});

	describe('builds', function() {
		it('should be absolute path (v1)', function(done) {
			composex.parse(path.resolve(__dirname, './overridebuild/extendbuildv1.yml'), function(obj) {
				assert.equal(path.resolve(__dirname, './overridebuild/common'), obj.services['A.nginx'].build);
				done();
			});
		});


		it('should be absolute path (v2)', function(done) {
			composex.parse(path.resolve(__dirname, './overridebuild/extendbuildv2.yml'), function(obj) {
				assert.equal(path.resolve(__dirname, './overridebuild/common'), obj.services['A.nginx'].build.context);
				done();
			});
		});
	});

	
});
