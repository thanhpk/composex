var yaml = require('yamljs');
var _ = require('lodash');
var async = require('async');
var request = require('request');

exports.parse = function(ymlcontent, auth, callback) {
	if (ymlcontent == undefined) {
		callback("content must not be null");
		return;
	}
	
	var dep = yaml.parse(ymlcontent);

	if (!dep.services) {
		callback(null, {});
		return;
	}
	var services = {};
	var serviceRef = {};
	var serviceExports = {};
	async.each(Object.keys(dep.services), function(servicename, cb) {
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
		mapHostEnv(dep, serviceRef, serviceExports, services, function(err) {
			if (err) {
				callback(err);
				return;
			}

			callback(null, {services: services});
		});
	});
}
// dep, map to deployment file (refer to serviceRef)
// serviceRef, a map to fetched service Key = service name, value = service yml
// serviceExports, a map to exported endpoint. key = servicename, value = endpoint name string
// services, a map to all output containers. Key = full container name, value = name
function mapHostEnv(dep, serviceRef, serviceExports, services, callback) {
	var errs = [];
	_.map(Object.keys(dep.services), function(servicename) {
		var binds = dep.services[servicename].binds;
		if (binds == undefined) return;
		_.map(Object.keys(binds), function(bindto) {
			var bindfrom = binds[bindto];
			var err = checkBindTo(serviceExports, bindto);
			if (err) {
				errs.push(err);
				return;
			}

			var bindtoSplit = bindto.split('.');
			var bindtoservicename = bindtoSplit[0];
			var bindtoexport = bindtoSplit[1];
			
			if (serviceRef[bindtoservicename] == undefined) {
				errs.push(`bind err: service reference not found at ${servicename}: ${bindtoservicename}`);
				return;
			}
			if (serviceRef[bindtoservicename].exports == undefined) {
				errs.push(`bind err: service not export any containers (${servicename}: ${bindtoservicename})`);
				return;
			}

			var exp = serviceRef[bindtoservicename].exports[bindtoexport];
			if (exp == undefined) {
				errs.push(`bind err: reference to export not found (${servicename}: ${bindtoservicename})`);
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
	
	if (errs.length != 0) {
		callback(errs.join('\n'));
		return;
	}
	callback();
}

function checkExports() {
	return;
}

function checkBindTo() {
	return;
}

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
