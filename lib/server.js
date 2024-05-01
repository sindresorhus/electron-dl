import http from 'node:http';
import nodeStatic from 'node-static';

const server = () => {
	const fileServer = new nodeStatic.Server('./mock', {cache: false});

	http.createServer((request, response) => {
		request.addListener('end', () => {
			fileServer.serve(request, response);
		}).resume();
	}).listen(8080);
};

export default server;
