var yaml = require('yamljs');
var _ = require('lodash');
var async = require('async');
var request = require('request');

exports.parse = function(ymlcontent, callback) {
	var auth = "Basic " + new Buffer("thanhpk" + ":" + "123456").toString("base64");
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
		request({
			method: 'GET',
			url: service.from,
			headers: {Authorization: auth}
		}, function(err, response) {
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
			var errs = [];
			if (serviceYml.containers != undefined)
				_.map(Object.keys(serviceYml.containers), function(containername) {
					var container = serviceYml.containers[containername];
					services[servicename + '.' + containername] = container;
					var err = checkHostEnv(serviceYml, servicename, containername);
					if (err) {
						errs.push(err);
						return;
					}
				});

			if (errs.length > 0) {
				cb(errs.join('\n'));
				return;
			}
			cb();
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

			var bindfromSplit = bindfrom.split('.');
			var bindfromservicename = bindfromSplit[0];
			var bindfromexport = bindfromSplit[1];

			
			if (serviceRef[bindfromservicename] == undefined) {
				errs.push(`bind err: service reference not found at ${servicename}: ${bindfromservicename}`);
				return;
			}
			if (serviceRef[bindfromservicename].exports == undefined) {
				errs.push(`bind err: service not export any containers (${servicename}: ${bindfromservicename})`);
				return;
			}

			var exp = serviceRef[bindfromservicename].exports[bindfromexport];
			if (exp == undefined) {
				errs.push(`bind err: reference to export not found (${servicename}: ${bindfromservicename})`);
				return; 
			}

			var expSplit = exp.split(':');
			var expContainer = expSplit[0];
			var expPort = expSplit[1];			
			_.map(Object.keys(serviceRef[servicename].containers), function(containername) {
				_.map(Object.keys(serviceRef[servicename].containers[containername].host_env), function(env) {
					if (services[servicename + '.' + containername].host_env[env].trim() == bindto + ".host") {
						services[servicename + '.' + containername].host_env[env] = bindfromservicename + "." + expContainer;
					}
					if (services[servicename + '.' + containername].host_env[env].trim() == bindto + ".port") {
						services[servicename + '.' + containername].host_env[env] = bindfromservicename + "." + expPort;
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
	return undefined;
}

function checkBindTo() {
	return undefined;
}

function checkHostEnv(service, servicename, containername) {
	var errs = [];
	if (service.containers[containername].host_env == undefined) {
		return;
	}
	
	_.map(Object.keys(service.containers[containername].host_env), function(env) {
		var envvalue = service.containers[containername].host_env[env];
		if (envvalue == undefined || envvalue == '') {
			errs.push("wrong host_env format at service " + servicename + '.' + containername + "/" + env);
			return;
		}
		
		var envSplit = envvalue.split('.');
		if (envSplit.length != 2) {
			errs.push("wrong host_env format at service " + servicename + '.' + containername + "/" + env + "must be ENV=name.port or ENV=name.host");
			return;
		}
		var importname = envSplit[0];
		if (service.imports == undefined) {
			errs.push("wrong host_env format at service " + servicename + '.' + containername + "/" + env+ " service has no imports");
			return;
		}

		if (service.imports.indexOf(importname) == -1) {
			errs.push("import not found at " + servicename + '.' + containername + "/" + env);
			return;
		}
	});

	if (errs.length > 0) return errs.join('\n');
	return;
}
