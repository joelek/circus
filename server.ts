#!/usr/bin/env node

import * as libfs from "fs";
import * as libhttp from "http";
import * as libhttps from "https";
import * as libpath from "path";
import * as liburl from "url";
import * as api from "./api";
import * as auth from "./auth";
import * as libdb from "./database";
import * as data from "./data";

let media = data.media;

let files_index: libdb.Index<libdb.FileEntry> = {};

for (let i = 0; i < media.files.length; i++) {
	let file = media.files[i];
	files_index[file.file_id] = file;
}

let get_path_segments = (path: string): Array<string> => {
	let raw_path_segments = path.split('/');
	let path_segments = [];
	for (let raw_path_segment of raw_path_segments) {
		if (raw_path_segment === '') {
			continue;
		}
		if (raw_path_segment === '.') {
			continue;
		}
		if (raw_path_segment !== '..') {
			path_segments.push(decodeURIComponent(raw_path_segment));
			continue;
		}
		if (path_segments.length === 0) {
			throw new Error(`bad req`);
		}
		path_segments.pop();
	}
	return path_segments;
};

let filter_headers = (headers: libhttp.IncomingHttpHeaders, keys: Array<string>): Partial<libhttp.IncomingHttpHeaders> => {
	let out: Partial<libhttp.IncomingHttpHeaders> = {};
	for (let key in headers) {
		if (keys.indexOf(key) >= 0) {
			out[key] = headers[key];
		}
	}
	return out;
};

let send_data = (file: libdb.FileEntry, request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void => {
	if (request.url === undefined) {
		throw new Error();
	}
	try {
		var url = liburl.parse(request.url, true);
		auth.getUsername(url.query.token as string);
	} catch (error) {
		response.writeHead(401, {});
		return response.end();
	}
	let filename = file.path.join(libpath.sep);
	let fd = libfs.openSync(filename, 'r');
	let size = libfs.fstatSync(fd).size;
	libfs.closeSync(fd);
	let parts2;
	let range = request.headers.range;
	if (range !== undefined && (parts2 = /^bytes\=((?:[0-9])|(?:[1-9][0-9]+))\-((?:[0-9])|(?:[1-9][0-9]+))?$/.exec(range)) != null) {
		let offset = parseInt(parts2[1]);
		let offset2 = parts2[2] ? parseInt(parts2[2]) : null;
		if (offset2 === null) {
			offset2 = Math.min(offset + 1048576, size) - 1;
		}
		if (offset >= size || offset2 >= size || offset2 < offset) {
			response.writeHead(416);
			response.end();
			return;
		}
		let length = offset2 - offset + 1;
		response.writeHead(206, {
			'Access-Control-Allow-Origin': '*',
			'Accept-Ranges': `bytes`,
			'Content-Range': `bytes ${offset}-${offset2}/${size}`,
			'Content-Type': file.mime,
			'Content-Length': `${length}`
		});
		var s = libfs.createReadStream(filename, {
			start: offset,
			end: offset2
		});
		s.on('open', function () {
			s.pipe(response);
		});
		s.on('error', function (error) {
			response.end();
		});
	} else {
		var s = libfs.createReadStream(filename);
		s.on('open', function () {
			response.writeHead(200, {
				'Access-Control-Allow-Origin': '*',
				'Accept-Ranges': `bytes`,
				'Content-Type': file.mime,
				'Content-Length': `${size}`
			});
			s.pipe(response);
		});
		s.on('error', function (error) {
			response.writeHead(404, {
				'Access-Control-Allow-Origin': '*',
				'Content-Type': 'text/plain'
			});
			response.end();
		});
	}
};

let httpServer = libhttp.createServer()
	.on('request', (request, response) => {
		response.writeHead(307, {
			'Location': `https://${request.headers['host']}${request.url}`
		});
		response.end();
	})
	.listen(80);

let httpsServer = libhttps.createServer({
		cert: libfs.readFileSync("./private/certs/live/ap.joelek.se/fullchain.pem"),
		dhparam: libfs.readFileSync("./private/certs/dhparam.pem"),
		key: libfs.readFileSync("./private/certs/live/ap.joelek.se/privkey.pem")
	}).on('request', (request, response) => {
		console.log(`${new Date().toUTCString()}:${request.method}:${request.url}`, JSON.stringify(filter_headers(request.headers, ['host', 'range']), null, "\t"));
		if (!/ap[.]joelek[.]se(:[0-9]+)?$/.test(request.headers.host)) {
			console.log('dropped', JSON.stringify(request.headers, null, "\t"));
			response.writeHead(400);
			response.end();
			return;
		}
		let parts: RegExpExecArray | null;
		if (request.method === 'GET' && request.url === '/favicon.ico') {
			response.writeHead(404);
			response.end();
			return;
		}
		if (request.method === 'GET' && (parts = /^[/]files[/]([0-9a-f]{32})[/]/.exec(request.url)) !== null) {
			let file_id = parts[1];
			let file = media.files.find(file => file.file_id === file_id);
			if (file !== undefined) {
				return send_data(file, request, response);
			}
		}
		if (/^[/]api[/]/.test(request.url)) {
			return api.handleRequest(request, response);
		}
		if (request.method === 'GET') {
			response.writeHead(200);
			response.end(`<!doctype html><html><head><base href="/"/><meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0" name="viewport"/></head><body><script>${libfs.readFileSync('./build/client.js')}</script></body></html>`);
			return;
		}
		console.log('unhandled', JSON.stringify(request.headers, null, "\t"));
		response.writeHead(400);
		response.end();
		return;
	})
	.listen(443);
