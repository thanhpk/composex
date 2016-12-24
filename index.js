var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var swarm = require('./swarm.js');

exports.parse = parse;
exports.merge = function(pathtoyml, cb) {
	parse(pathtoyml, function() {
	});
};

exports.toSwarm = swarm.parse;

function toFullname(ymlobj, prop, namespace) {
	if (ymlobj[prop] == undefined) {
		return;
	}
	var newprop = [];
	for (var i in ymlobj[prop]) {
		var propitem = ymlobj[prop][i];
		if (propitem == undefined) continue;

		var newpropitem = '';
		var propitems = propitem.split(':');
		if (propitems.length === 2) {
			newpropitem = `${namespace}.${propitems[0]}:${propitems[1]}`;
		} else {
			newpropitem = `${namespace}.${propitems[0]}:${propitems[0]}`;
		}

		newprop.push(newpropitem);
	}
	ymlobj[prop] = newprop;	
}

function toFullnameImport(ymlobj, namespace) {
	if (ymlobj.imports == undefined) {
		return;
	}
	var new_imports = [];
	_.map(ymlobj.imports, function(imp) {
		var importSplit = imp.split('=');
		if (importSplit.length != 2) throw "import must be A=B";
		new_imports.push(`${namespace}.${importSplit[0]}=${namespace}.${importSplit[1]}`);
	});
	ymlobj.imports = new_imports;
}

function toFullnameExport(ymlobj, namespace) {
	if (ymlobj.exports == undefined) {
		return;
	}
	var new_exports = [];
	_.map(ymlobj.exports, function(imp) {
		var exportSplit = imp.split('=');
		if (exportSplit.length != 2) throw "export must be A=B";
		new_exports.push(`${namespace}.${exportSplit[0]}=${namespace}.${exportSplit[1]}`);
	});
	ymlobj.exports = new_exports;
}

function toFullnameJoin(ymlobj, namespace) {
	if (ymlobj.joins == undefined) {
		return;
	}
	var new_joins = [];
	_.map(ymlobj.joins, function(join) {
		var joinSplit = join.split('=');
		if (joinSplit.length != 2) throw "join must be A=B";
		new_joins.push(`${namespace}.${joinSplit[0]}=${namespace}.${joinSplit[1]}`);
	});
	ymlobj.exports = new_joins;
}

function toFullnameEnv(ymlobj, namespace) {
	if (ymlobj.host_env == undefined) {
		return;
	}
	var newenvs = [];
	_.map(ymlobj.host_env, function(env) {
		var hostenvsplit = env.split('=');
		newenvs.push(`${hostenvsplit[0]}=${namespace}.${hostenvsplit[1]}`);
	});
	ymlobj.host_env = newenvs;
}

function mergeImportExport(parent, namespace, child) {
	parent.imports = parent.imports || [];
	var childImportMap = {};
	// build map and add namespace
	_.map(child.imports, function (imp) {
		var importSplit = imp.split('=');
		if (importSplit.length != 2) throw "import must be A=B";
		childImportMap[`${namespace}.${importSplit[0]}`]=`${namespace}.${importSplit[1]}`;
	});

	//rebuild array
	_.map(Object.keys(childImportMap), function(key) {
		parent.imports.push(`${key}=${childImportMap[key]}`);
	});

	var childExportMap = {};
	// build map and add namespace
	_.map(child.exports, function (imp) {
		var exportSplit = imp.split('=');
		if (exportSplit.length != 2) throw "export must be A=B";
		childExportMap[`${namespace}.${exportSplit[0].trim()}`]=`${namespace}.${exportSplit[1].trim()}`;
	});

	//rebuild array
	_.map(Object.keys(childExportMap), function(key) {
		parent.exports.push(`${key}=${childExportMap[key]}`);
	});
}

function parse(pathtoyml, cb, currentPath) {
	if (validUrl.isUri(pathtoyml)) {
		request(pathtoyml, function(err, response, body) {
			parseYml(body, function(ymlobj) {
				convertHostEnvToEnv(ymlobj.services);
				cb(ymlobj);
			});
		});
	}
	else {
		var absolutePath = !currentPath ? path.resolve(pathtoyml) : path.resolve(currentPath, pathtoyml);
		
		fs.readFile(absolutePath, 'utf8', function(err, data) {
			if (err) throw err;
			currentPath = path.dirname(absolutePath);
			parseYml(data, function(ymlobj) {
				convertHostEnvToEnv(ymlobj.services);
				cb(ymlobj);
			});
		});
	}

	function parseYml(content, cb) {
		var ymlobj = yaml.parse(content);
		ymlobj.parsedExports = {};
		if (ymlobj.exports != undefined) _.map(ymlobj.exports, function(exp) {
			var exportSplit = exp.split('=');
			var serviceSplit = (exportSplit[1] || exportSplit[0]).split(":");
			
			var servicename = serviceSplit[0];
			var serviceport = serviceSplit[1];

			if (serviceport == null) throw "missing service port\n " + content;
			
			var name = exportSplit[1] == undefined ? servicename : exportSplit[0];
			ymlobj.parsedExports[name] = {host: servicename, port: serviceport};

		});
		
		if (ymlobj.services != undefined) _.map(Object.keys(ymlobj.services), function(servicename) {
			if (!ymlobj.services[servicename].build) return;
			if (typeof ymlobj.services[servicename].build === "string") {
				ymlobj.services[servicename].build = toAbsolutePath(currentPath, ymlobj.services[servicename].build);
			} else {
				ymlobj.services[servicename].build.context = toAbsolutePath(currentPath, ymlobj.services[servicename].build.context);
			}
		});

		if (ymlobj.includes == undefined) {
			cb(ymlobj);
			return;
		}

		var namespaceMap = ymlobj.includes;

		var allServices = [];
		async.eachOf(Object.keys(ymlobj.includes), function(namespace, value, callback) {
			parse(ymlobj.includes[namespace], function(childymlobj) {
				
				toFullnameImport(childymlobj, namespace);
				toFullnameExport(childymlobj, namespace);
				toFullnameJoin(childymlobj, namespace);

				var childServices = childymlobj.services;
				var services = {};
				if (ymlobj.services != undefined) _.map(Object.keys(ymlobj.services), function(servicename) {
					services[servicename] = ymlobj.services[servicename];
				});

				mergeImportExport(ymlobj, namespace, childymlobj);

				if (childServices == undefined) {
					allServices.push(services);
					callback();
					return;
				}

				_.map(Object.keys(childServices), function(servicename) {
					var cService = childServices[servicename];
					toFullname(cService, 'links', namespace);
					toFullnameEnv(cService, namespace);
					var service = services[`${namespace}.${servicename}`];
					if ( service != undefined) {
						merge(cService, service);
						mergePort(cService, service);
						override(cService, service);
						mergeEnvHost(cService, service);
					}
					services[`${namespace}.${servicename}`] = cService;
				});
				allServices.push(services);
				callback();
			}, currentPath);
		}, function(err) {
			if (ymlobj.services == null) ymlobj.services = {};
			
			delete ymlobj.includes;

			if (ymlobj.joins) _.map(ymlobj.joins, function(join) {
				
			});
			_.map(allServices, function(serviceMap) {
				_.map(Object.keys(serviceMap), function(servicename) {
			
					ymlobj.services[servicename] = serviceMap[servicename];
				});
			});
			
			cb(ymlobj);
		});
	}
}

// merge links and depends_on
function merge(dst, src) {
	_.map(['external_links', 'links', 'depends_on', 'volumes'], function(fieldname) {
		if (!src[fieldname]) return;
		var dstmap = {};
		_.map(dst[fieldname], function(item) {
			var	itemsplit = item.split(':');
			dstmap[itemsplit[1]] = itemsplit[0];
		});
		
		_.map(src[fieldname], function(item) {
			var itemsplit = item.split(':');
			var name = !itemsplit[1] ? itemsplit[0] : itemsplit[1];
			var ref = itemsplit[0];
			dstmap[name] = ref;
		});
		
		var newfield = [];
		_.map(Object.keys(dstmap), function(itemname) {
			newfield.push(`${dstmap[itemname]}:${itemname}`);
		});

		dst[fieldname] = newfield;
	});
}

function convertHostEnvToEnv(services) {
	if (services == undefined) return;
	_.map(services, function(service) {
		if (service == undefined || service.host_env == undefined) return;

		service.environment = service.environment || [];
		service.environment = service.environment.concat(service.host_env);
	});
}

function mergeEnvHost(dst, src) {
	var dstmap = {};
	_.map(dst.host_env, function(item) {
		var	itemsplit = item.split('=');
		if (itemsplit[1] == null) throw "wrong host_env syntax";
		dstmap[itemsplit[0]] = itemsplit[1];
	});
		
	_.map(src.host_env, function(item) {
		var itemsplit =  item.split('=');
		dstmap[itemsplit[0]] = itemsplit[1] || itemsplit[0];
		if (itemsplit[1] == null) throw "wrong host_env syntax";
	});

	var new_hostenv = [];
	_.map(Object.keys(dstmap), function(itemname) {
		new_hostenv.push(`${itemname}=${dstmap[itemname]}`);
	});
	dst.host_env = new_hostenv;
}

function mergePort(dst, src) {
	_.map(['ports'], function(fieldname) {
		var dstmap = {};
		_.map(dst[fieldname], function(item) {
			var	itemsplit = item.split(':');
			dstmap[itemsplit[0]] = !itemsplit[1] ? itemsplit[0] : itemsplit[1];
		});
		
		_.map(src[fieldname], function(item) {
			var itemsplit =  item.split(':');
			var name = !itemsplit[1] ? itemsplit[0] : itemsplit[1];
			var ref = itemsplit[0];
			dstmap[ref] = name;
		});
		
		var newfield = [];
		_.map(Object.keys(dstmap), function(itemname) {
			newfield.push(`${itemname}:${dstmap[itemname]}`);
		});

		dst[fieldname] = newfield;
	});
}

function arrayUnique(array) {
  var a = array.concat();
  for(var i=0; i<a.length; ++i) {
    for(var j=i+1; j<a.length; ++j) {
      if(a[i] === a[j])
        a.splice(j--, 1);
    }
  }
  return a;
}

function mergeArray(dst, src) {
	_.map(['args', 'command', 'environment', 'expose', 'labels', 'networks', 'aliases', 'env_file'], function(fieldname) {
		if (dst[fieldname].constructor === Array) {
			if (src[fieldname] != undefined) {
				// convert src to array if itsn't
				var newsrc = [];
				if (src[fieldname].constructor !== Array) {
					_.map(Object.keys(src[fieldname]), function(key) {
						newsrc.push([key]);
					});
				}
				else {
					newsrc = src;
				}
				dst[fieldname] = arrayUnique(dst[fieldname].concat(newsrc));
			}
			return;
		}
		var dstmap = {};
		_.map(Object.keys(dst[fieldname]), function(key) {
			dstmap[key] = dst[fieldname][key];
		});
		
		_.map(src[fieldname], function(key) {
			dstmap[key] = src[fieldname][key];
		});
		
		dst[fieldname] = dstmap;
	});
}

function override(dst, src) {
	//container_name, entrypoint, image
	_.map(['build', 'context', 'dockerfile', 'container_name', 'entrypoint', 'image', 'cpu_shares', 'cpu_quota', 'cpuset', 'domainname', 'hostname', 'ipc', 'mac_address', 'mem_limit', 'memswap_limit', 'oom_score_adj', 'privileged', 'read_only', 'restart', 'shm_size', 'stdin_open', 'tty', 'user', 'working_dir'], function(fieldname) {
		if (src[fieldname] != undefined) dst[fieldname] = src[fieldname];
	});
}

function toAbsolutePath(filepath, value) {
	return validUrl.isUri(filepath) ? filepath : path.resolve(filepath, value);
}
