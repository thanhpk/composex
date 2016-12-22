var assert = require('assert');

var swarm = require('../swarm.js');
var yrml = require('yamljs');
var path = require('path');

describe('Servicename', function() {
	describe('servicename', function() {
		it('should contains scope', function(done) {
			swarm.parse(path.resolve(__dirname, './servicename/docker-compose.yml'), 'thanhpk', function(output) {
				assert.Equal(output.indexOf('--name thanhpk.service1'), -1);
				assert.Equal(output.indexOf('--name thanhpk.B.service2'), -1);
				done();
			});
		});

		
	});
});
								 
