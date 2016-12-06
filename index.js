var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var destfile = process.argv[2];
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');

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
		var namespaceMap = ymlobj.includes;

		if (ymlobj.includes == undefined) {
			cb(ymlobj.services);
			return;
		}
		
		async.filter(Object.keys(ymlobj.includes), function(namespace, callback) {
			parse(ymlobj.includes[namespace], function(childServices) {
				
				var services = {};
				_.map(Object.keys(ymlobj.services), function(servicename) {
					services[servicename] = ymlobj.services[servicename];
					//			toFullname(services[servicename], 'links', namespace);
				});

				if (childServices == undefined) {
					callback(services);
					return;
				}
				
				_.map(Object.keys(childServices), function(servicename) {
					services[`${namespace}.${servicename}`] = childServices[servicename];
					toFullname(services[`${namespace}.${servicename}`], 'links', namespace);
				});
				callback(services);
			}, currentPath);
		}, function(servicesArr) {
			cb(servicesArr);
		});


	}
}

parse(destfile, function(data){
	console.log(data)
});
				process.chdir(path.dirname(destfile));


function merge(dst, src) {

	var dstlinkmap = {};
	_.map(dst.links, function(link) {
		var	linksplit = link.split(':');
		dstlinkmap[linksplit[1]] = dstlinkmap[linksplit[0]];
	});
	
	_.map(src.links, function(link) {
		var linksplit =  link.split(':')[1];
		var servicename = !linksplit[1] ? linksplit[0] : linksplit[1];
		var serviceref = linksplit[0];
		
		dstlinkmap[servicename] = serviceref;
	});
	var  newlinks = [];
	_.map(Object.keys(dstlinkmap), function(servicename) {
		newlinks.push(`${dstlinkmap}:${servicename}`);
	});

	dst.links = newlink;
}
