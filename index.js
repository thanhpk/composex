var yaml = require('node-yaml');

var destfile = process.argv[2];

console.log(destfile);
yaml.read(destfile, 'utf8', yaml.schema.defaultSafe, function(err, data) {
	if (err) throw err;
	console.log(data);
}
