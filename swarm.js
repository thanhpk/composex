var compose = require('./index.js');
var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');

exports.parse = function(pathtoyml, scope, dfspath, callback, currentPath) {

		if (validUrl.isUri(pathtoyml)) {
		request(pathtoyml, function(err, response, body) {
			parseYml(body, scope, dfspath, callback);
		});
	}
	else {
		var absolutePath = !currentPath ? path.resolve(pathtoyml) : path.resolve(currentPath, pathtoyml);
		
		fs.readFile(absolutePath, 'utf8', function(err, data) {
			if (err) throw err;
			currentPath = path.dirname(absolutePath);
			parseYml(data, scope, dfspath, callback);
		});
	}
}


function parseYml(content, scope, dfspath, callback) {
	var net = yaml.parse(content);

	if (!net.services) {
		callback("");
		return;
	}

	var script = "";
	_.map(Object.keys(net.services), function(servicename) {
		var service = net.services[servicename];
		var createscript = "docker service create ";
		createscript += ` --name ${scope}.${servicename}`;
		
		if (net.services[servicename] != undefined)	createscript += parseEnv(net.services[servicename].environment);
		if (net.services[servicename] != undefined)	createscript += parseExpose(net.services[servicename].expose);
		if (net.services[servicename] != undefined)	createscript += parseVolume(net.services[servicename].volumes, scope, dfspath, servicename);
		script += ` --network ${scope}_overlay_ds`; 
		script += createscript + "\n";
	});
	callback(script);
}

function parseVolume(volumeyml, scope, dfspath, servicename) {
	if (!volumeyml) return "";

	var volume = "";
	_.map(volumeyml, function(v) {
		var splitV = v.split(':');
		
		v = splitV[1] || splitV[0];
		
		volume += ` --mount type=bind,source=${dfspath}/${scope}/${servicename}${v},destination=${v}`;
	});

	return volume;
}

function parseEnv(envyml) {
	if (!envyml) return "";

	var env = "";
	_.map(envyml, function(e) {
		env += ` -e '${e}'`;
	});
	return env;
}

function parseExpose(exposeyml) {
	if (!exposeyml) return "";

	var expose = "";
	_.map(exposeyml, function(port) {
		expose += ` -p ${port}`;
	});

	return expose;
}
