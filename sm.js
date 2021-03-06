var yaml = require('yamljs');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var validUrl = require('valid-url');
var path = require('path');
var fs = require('fs');

function getContent(pathtoyml, cb) {
	if (validUrl.isUri(pathtoyml)) {
		var auth = "Basic " + new Buffer("thanhpk" + ":" + "123456").toString("base64");
		request({
			method: 'GET',
			url: pathtoyml,
			headers: {Authorization: auth}
		}, function(err, response) {
			if (err) {
				cb(err);
				return;
			}
			
			if (response.statusCode !== 200) {
				cb(response.body);
				return;
			}

			cb(null, response.body);
			return;
		});
	}	else {
		var absolutePath =  path.resolve(pathtoyml);
		fs.readFile(absolutePath, 'utf8', function(err, data) {
			if (err) {
				cb(err);
				return;
			}
			cb(undefined, data);
		});
	}
}

function toPublishesMap(publishes) {
	if (publishes == undefined || publishes.length == 0) return [undefined, {}];
	var map = {};
	for (var i in publishes) {
		var publishSplit = publishes[i].split(":");
		if (publishSplit.length != 3) {
			return [`ERR: parse publish error (${publishes[i]}) must be P1:servicename:P2`];
		}
		var hostPort = publishSplit[0];
		var servicename = publishSplit[1];
		var containerPort = publishSplit[2];
		map[servicename] = map[servicename] || [];
		map[servicename].push({ hostPort: hostPort, containerPort: containerPort });
	}
	return [undefined, map];
}

function buildVolumeMap(mounts) {
	var volumeMap = {};
	if (mounts) {
		_.map(mounts, function(mount) {
			var mountSplit = mount.split(':');
			var volumename = mountSplit[0];
			var hostpath = mount.substr(volumename.length + 1, mount.length);
			volumeMap[volumename.trim()] = hostpath.trim();
		});
	}
	return volumeMap;
}

exports.parse = function(ymlcontent, callback, scope, dfspath) {
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
	var errP = toPublishesMap(dep.publishes);
	if (errP[0]) { callback(errP[0]); return; }
	
	var publishesMap = errP[1];
	
	async.each(Object.keys(dep.services), function(servicename, cb) {
		var service = dep.services[servicename];
		var volumeMap = buildVolumeMap(service.mounts);
		getContent(service.from, function(err, content) {
			if (err != undefined) {	cb(err); return;}

			var serviceYml = yaml.parse(content);
			serviceRef[servicename] = serviceYml;
			
			serviceExports[servicename] = serviceYml.exports;
			var exporterr = checkExports(serviceYml);
			if (exporterr) { cb(exporterr); return;}
			
			var errs = [];
			if (serviceYml.containers != undefined)
				_.map(Object.keys(serviceYml.containers), function(containername) {
					var container = serviceYml.containers[containername];
					container.local = service.local;

					var publishs = publishesMap[servicename + '.' + containername]; 
					if (publishs != undefined) {
						container.expose = container.expose || [];
						_.map(publishs, function(publish) {
							container.expose.push(`${publish.hostPort}:${publish.containerPort}`);
						});
					}
					
					services[servicename + '_' + containername] = container;
					var err = checkHostEnv(serviceYml, servicename, containername);
					if (err) {
						errs.push(err);
						return;
					}

					var mappedVolumes = [];
					if (container.volumes) {
						_.map(container.volumes, function(volume) {
							
							var volumeSplit = volume.split(':');
							var volumename = volumeSplit[0];
							var containerpath = volume.substr(volumename.length + 1, volume.length);
							if (volumeMap[volumename.trim()] == undefined) {
								mappedVolumes.push(`${dfspath}/${scope}/${servicename}/${containername}/${volumename}:${containerpath}`); 
							} else {
								mappedVolumes.push(`${volumeMap[volumename.trim()]}:${containerpath}`);
							}
						});
						container.volumes = mappedVolumes;
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
		mapHostEnv(scope, dep, serviceRef, serviceExports, services, function(err) {
			if (err) {
				callback(err);
				return;
			}
			callback(null, {services: services});
		});
	});
};

// dep, map to deployment file (refer to serviceRef)
// serviceRef, a map to fetched service Key = service name, value = service yml
// serviceExports, a map to exported endpoint. key = servicename, value = endpoint name string
// services, a map to all output containers. Key = full container name, value = name
function mapHostEnv(scope, dep, serviceRef, serviceExports, services, callback) {
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
				if (serviceRef[servicename].containers[containername].host_env == undefined) {
					return;
				}
				_.map(Object.keys(serviceRef[servicename].containers[containername].host_env), function(env) {
					if (services[servicename + '_' + containername].host_env[env].trim() == bindto + ".host") {
						services[servicename + '_' + containername].host_env[env] = scope + "_" + bindfromservicename + "_" + expContainer;
					}
					if (services[servicename + '_' + containername].host_env[env].trim() == bindto + ".port") {
						services[servicename + '_' + containername].host_env[env] = expPort;
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
	var imports = service.imports;
	if (imports != undefined && imports.constructor !== Array) {
		return `service ${servicename} err, import must be an array`;
	}
	
	if (service.containers[containername].host_env == undefined) {
		return undefined;
	}
	
	_.map(Object.keys(service.containers[containername].host_env), function(env) {
		var envvalue = service.containers[containername].host_env[env];
		if (envvalue == undefined || envvalue == '') {
			errs.push("wrong host_env format at service " + servicename + '.' + containername + "/" + env);
			return;
		}
		
		var envSplit = envvalue.split('.');
		if (envSplit.length != 2) {
			errs.push("wrong host_env format at service " + servicename + '.' + containername + " / " + env + " must be ENV=name.port or ENV=name.host");
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

	if (errs.length > 0)
		return errs.join('\n');
	else 
		return undefined;
} 
