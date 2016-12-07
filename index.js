var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');

exports.parse = parse;
exports.merge = function(pathtoyml, cb) {
	parse(pathtoyml, function() {
		
	});
}

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

function parse(pathtoyml, cb, currentPath) {
	if (validUrl.isUri(pathtoyml)) {
		request(pathtoyml, function(err, response, body) {
			parseYml(body);
		});
	}
	else {
		var absolutePath = !currentPath ? path.resolve(pathtoyml) : path.resolve(currentPath, pathtoyml);
		
		fs.readFile(absolutePath, 'utf8', function(err, data) {
			if (err) throw err;
			currentPath = path.dirname(absolutePath);
			parseYml(data);
		});
	}

	function parseYml(content) {
		var ymlobj = yaml.parse(content);

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
		
		async.filter(Object.keys(ymlobj.includes), function(namespace, callback) {
			parse(ymlobj.includes[namespace], function(childymlobj) {
				var childServices = childymlobj.services;
				var services = {};



				if (ymlobj.services != undefined) _.map(Object.keys(ymlobj.services), function(servicename) {
					services[servicename] = ymlobj.services[servicename];
				});

				if (childServices == undefined) {
					callback(services);
					return;
				}
				_.map(Object.keys(childServices), function(servicename) {
					if (services[`${namespace}.${servicename}`] != undefined) {
						merge(childServices[servicename], services[`${namespace}.${servicename}`]);
						mergePort(childServices[servicename], services[`${namespace}.${servicename}`]);
						override(childServices[servicename], services[`${namespace}.${servicename}`]);
					}

					toFullname(childServices[servicename], 'links', namespace);
					services[`${namespace}.${servicename}`] = childServices[servicename];
				});
				callback(services);
			}, currentPath);
		}, function(servicesArr) {
			delete ymlobj.includes;
			ymlobj.services = servicesArr;
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
			var itemsplit =  item.split(':');
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
