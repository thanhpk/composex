var compose = require('./index.js');
var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');


exports.parse = function(pathtoyml, scope, callback, currentPath) {

		if (validUrl.isUri(pathtoyml)) {
		request(pathtoyml, function(err, response, body) {
			parseYml(body, scope, callback);
		});
	}
	else {
		var absolutePath = !currentPath ? path.resolve(pathtoyml) : path.resolve(currentPath, pathtoyml);
		
		fs.readFile(absolutePath, 'utf8', function(err, data) {
			if (err) throw err;
			currentPath = path.dirname(absolutePath);
			parseYml(data, scope, callback);
		});
	}
}


function parseYml(content, scope, callback) {
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
		script += createscript + "\n";

		script += ` --network ${scope}_overlay_ds`; 
	});
	callback(script);
}

function parseEnv(envyml) {
	if (!envyml) return "";

	var env = "";
	_.map(envyml, function(e) {
		env += ` -e '${e}'`;
	});
	return env;
}

