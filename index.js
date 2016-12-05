var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var destfile = process.argv[2];
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');
function parse(content, cb) {
	var ymlobj = yaml.parse(content);
	var namespaceMap = ymlobj.includes;

	if (ymlobj.includes == undefined) {
		cb(ymlobj.services);
		return;
	}

	
	async.filter(Object.keys(ymlobj.includes), function(namespace, callback) {
		async.waterfall([function(callback) {
			if (validUrl.isUri(ymlobj.includes[namespace])) {
				request(ymlobj.includes[namespace], function(err, response, body) {
					parse(body, callback);
				});
			} else {


				fs.readFile(ymlobj.includes[namespace], 'utf8', function(err, data) {
					if (err) throw err;
					parse(data, callback);
				});
			}
		}], function(childServices) {			
			if (childServices == undefined) {
				callback(undefined);
				return;
			}
			var services = {};
			_.map(Object.keys(ymlobj.services), function(servicename) {
				services[servicename] = ymlobj.services[servicename];
			});
			
			_.map(Object.keys(childServices), function(servicename) {
				services[`${namespace}.${servicename}`] = childServices[servicename];
			});
			callback(services);
		});
	}, function(servicesArr) {
		cb(servicesArr);
	});
}

if (validUrl.isUri(destfile)) {
	request(destfile, function(err, response, body) {
		parse(body, function(){});
	});
} else {
	fs.readFile(destfile, 'utf8', function(err, data) {
		if (err) throw err;
		parse(data, function(data){console.log(data);});
	});
}
				process.chdir(path.dirname(destfile));
