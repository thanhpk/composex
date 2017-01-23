var compose = require('./index.js');
var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');

exports.parse = function(nodeid, pathtoyml, scope, callback, currentPath) {
	if (validUrl.isUri(pathtoyml)) {
		request(pathtoyml, function(err, response, body) {
			parseYml(nodeid, body, scope, callback);
		});
	}
	else {
		var absolutePath = !currentPath ? path.resolve(pathtoyml) : path.resolve(currentPath, pathtoyml);
		fs.readFile(absolutePath, 'utf8', function(err, data) {
			if (err) throw err;
			currentPath = path.dirname(absolutePath);
			parseYml(nodeid, data, scope, callback);
		});
	}
};

exports.parseYml = function parseYml(nodeid, content, scope, callback) {
	var net = typeof content == "string" ? yaml.parse(content) : content;
	if (!net.services) {
		callback("");
		return;
	}

	var script = "";
	_.map(Object.keys(net.services), function(servicename) {
		var service = net.services[servicename];
		var createscript = "docker service create ";
		createscript += ` --name ${scope}_${servicename}`;

		if (service.local) {
			createscript += ` --constraint 'node.id == ${nodeid}'`;
		}
		else {
			createscript += ` --constraint 'node.labels.remotedev == remotedev'`;
		}

		
		if (net.services[servicename] != undefined)	{
			createscript += parseEnv(service.environment);
			createscript += parseExpose(service.expose);
			createscript += parseVolume(service.volumes, scope, servicename);
		}
		
		createscript += ` --network ${scope}_overlay_ds`;
		
		var img = (net.services[servicename] || {image: 'alpine'})['image'];
		var cmd = (net.services[servicename] || {command: ''})['command'] || '';
		script += createscript + ' ' + img + ' ' + cmd + "\n";
	});
	callback(script);
};

function parseVolume(volumeyml, scope, servicename) {
	if (!volumeyml) return "";

	var volume = "";
	_.map(volumeyml, function(v) {
		var splitV = v.split(':');
		v = splitV[1] || splitV[0];		
		volume += ` --mount type=bind,source=${splitV[0]},destination=${v}`;
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
