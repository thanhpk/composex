var yaml = require('yamljs');
var _ = require('lodash');
var async = require('async');
var request = require('request');

exports.parse = function(ymlcontent, auth, callback) {
	var dep = yaml.parse(ymlcontent);

	if (!dep.services) {
		callback({});
		return;
	}
	var services = {};
	var serviceRef = {};
	async.each(Object.key(dep.services), function(servicename, cb) {
		var service = dep.services[servicename];
		request(service.from, function(err, response) {
			if (err != undefined) {
				cb(err);
				return;
			}

			if (response.statusCode !== 200) {
				cb(response.body);
				return;
			}

			var serviceYml = yaml.parse(response.body);
			serviceRef[servicename] = serviceYml;
			
			serviceExports[servicename] = serviceYml.exports;
			var exporterr = checkExports(serviceYml);
			if (exporterr) {
				cb(exporterr);
				return;
			}
			
			if (serviceYml.containers != undefined)	_.map(Object.keys(serviceYml.containers), function(containername) {
				var container = serviceYml.containers[containername];
				services[servicename + '.' + containername] = container;
				checkHostEnv(serviceYml, servicename, containername, function(err) {
					if (err) {
						cb(err);
						return;
					}
					cb();
				});
			});
		});
	}, function(err) {
		if (err) {
			callback(err);
			return;
		}

		_.map(Object.keys(dep.services), function(servicename) {
			var binds = dep.services[servicename].binds;

			if (binds == undefined) return;
			var errs = [];
			_.map(Object.keys(binds), function(bindto) {
				var bindfrom = binds[bindto];

				err = checkBindTo(serviceExports, bindto);
				if (err) {
					errs.push(err);
					return;
				}

				var bindtoSplit = bindto.split('.');
				var bindtoservicename = bindtoSplit[0];
				var bindtoexport = bindtoSplit[1];
				
				if (serviceRef[bindtoservicename] == undefined) {
					callback(`bind err: service reference not found at ${servicename}: ${bindtoservicename}`);
					return;
				}
				if (serviceRef[bindtoservicename].exports == undefined) {
					callback(`bind err: service not export any containers (${servicename}: ${bindtoservicename})`);
					return;
				}

				var exp = serviceRef[bindtoservicename].exports[bindtoexport];
				if (exp == undefined) {
					callback(`bind err: reference to export not found (${servicename}: ${bindtoservicename})`);
					return; 
				}

				var expSplit = exp.split(':');
				var expContainer = expSplit[0];
				var expPort = expSplit[1];
				
				_.map(Object.keys(serviceRef[servicename].containers), function(containername) {
					_.map(Object.keys(serviceRef[servicename].containers[containername].host_env), function(env) {
						if (services[servicename + '.' + containername].host_env[env].trim() == bindfrom + ".host") {
							services[servicename + '.' + containername].host_env[env] = bindtoservicename + "." + expContainer;
						}
						if (services[servicename + '.' + containername].host_env[env].trim() == bindfrom + ".port") {
							services[servicename + '.' + containername].host_env[env] = bindtoservicename + "." + expPort;
						}
					});
				});				
			});
		});
	});
});



function checkHostEnv(service, servicename, containername, cb) {
	_.map(Object.keys(service[containername].host_env), function(env) {
		var envvalue = service[containername].host_env[env];
		if (envvalue == undefined || envvalue == '') {
			cb("wrong host_env format at service " + servicename + '.' + containername + "/" + env);
			return;
		}
		
		var envSplit = envvalue.split('.');
		if (envSplit.length != 2) {
			cb("wrong host_env format at service " + servicename + '.' + containername + "/" + env + "must be ENV=name.port or ENV=name.host");
			return;
		}
		var importname = envSplit[0];
		if (service.imports == undefined) {
			cb("wrong host_env format at service " + servicename + '.' + containername + "/" + env+ " service has no imports");
			return;
		}

		if (service.imports.indexOf(importname) == -1) {
			cb("import not found at " + servicename + '.' + containername + "/" + env);
			return;
		}

		cb();
	});
}
