'use strict';
const http = require('http');
const nodeStatic = require('node-static');

module.exports = () => {
	const fileServer = new nodeStatic.Server('./mock', {cache: false});
	http.createServer((request, response) => {
		request.addListener('end', () => {
			fileServer.serve(request, response);
		}).resume();
	}).listen(8080);
};
