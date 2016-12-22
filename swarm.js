var compose = require('./index.js');
var yaml = require('yamljs');
var request = require('request');
var fs = require('fs');
var validUrl = require('valid-url');
var async = require('async');
var _ = require('lodash');
var path = require('path');

function toSwarmScript(scope, composeContent, callback) {
	

}


function parseYml(content, scope, callback) {
	var net = yaml.parse(content);

	if (!net.services) {
		callback("");
		return;
	}

	_.map(Object.keys(net.services), function(servicename) {
		var service = net.services[servicename];
		var createservice = "docker service create ";
		createservice += ` --name ${scope}.${servicename}`;

	});

	
}
