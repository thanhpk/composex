var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var destfile = process.argv[2];
var validUrl = require('valid-url');
var async = require('async');

function parse(content, cb) {
	var ymlobj = yaml.parse(content);
	var namespaceMap = ymlobj.includes;
	async.forEach(Object.keys(ymlobj.includes), function(namespace, callback) {
		if (validUrl.isUri(ymlobj.includes[namespace])) {
			request(ymlobj.includes[namespace], function(err, response, body) {
				parse(body, callback);
			});
		} else {
			callback();
		}
	}, function(err) {
		console.log('done');
	});
}

if (validUrl.isUri(destfile)) {
	request(destfile, function(err, response, body) {
		parse(body, function(){});
	});
} else {
	fs.readFile(destfile, 'utf8', function(err, data) {
		if (err) throw err;
		parse(data, function(){});
	});
}
