var assert = require('assert');
var composex = require('../index.js');

var yml = require('yamljs');
var path = require('path');

describe('Import & Export', function() {
	describe('import export', function() {
		it('should replace the host_env with name in import list', function(done) {
			composex.parse(__dirname + '/importexport/importer.yml', function(obj) {
				assert.notEqual(obj.services.webserver.environment.join('\n').indexOf('DATABASE_HOST=E.mysql'), -1);
				assert.netEqual(obj.services.webserver.environment.join('\n').indexOf('DATABASE_PORT=3309'), -1);
				done();
			});
		});

		it('should have correct name when being linked', function(done) {
			composex.parse(__dirname + '/importexport/indirectimport.yml', function(obj) {
				assert.notEqual(obj.services.webserver.environment.join('\n').indexOf('DATABASE_HOST=I.E.mysql'), -1);
				assert.notEqual(obj.services.webserver.environment.join('\n').indexOf('DATABASE_PORT=3309'), -1);
				done();
			});
		});
	});

	describe('join', function() {
		it('should replace the env', function (done) {
			composex.parse(__dirname + '/join/join.yml', function(obj) {
				assert.notEqual(obj.services.A.webserver.environment.join('\n').indexOf('DBHOST=B.mysql'), -1);
				assert.notEqual(obj.services.A.webserver.environment.join('\n').indexOf('DBPORT=3306'), -1);				
				done();
			});
		});
	});
});

