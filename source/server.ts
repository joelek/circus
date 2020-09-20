#!/usr/bin/env node

import * as libfs from "fs";
import * as libhttp from "http";
import * as libhttps from "https";
import * as libpath from "path";
import * as liburl from "url";
import * as api from "./api";
import * as auth from "./auth";
import * as channels from "./channels";
import * as data from "./data";
import * as subsearch from "./subsearch";
import { FileEntry, CueEntry } from "./database";
import { TypeSocketServer } from "./typesockets";
import { Autoguard as messages } from "./messages";
import * as chromecast from "./chromecast";
import { Deferred } from "./shared";
import * as cast_message from "./cast_message";
import * as libtls from "tls";
import * as xcast from "./xcast";

let tss = new TypeSocketServer(messages);
let connections = new Set<string>();

tss.addEventListener("sys", "connect", (message) => {
	connections.add(message.connection_id);
});
tss.addEventListener("sys", "disconnect", (message) => {
	connections.delete(message.connection_id);
});

let ghost: Deferred<string>;

tss.addEventListener("app", "GetDeviceAvailable", (message) => {
	tss.send("DeviceAvailable", message.connection_id, {
		ip: ghost
	});
});

function sendHeartbeat(socket: libtls.TLSSocket, destination_id: string, json: xcast.heartbeat.Autoguard[keyof xcast.heartbeat.Autoguard]) {
	let castMessage: cast_message.CastMessage = {
		protocol_version: 0,
		source_id: "server-0",
		destination_id,
		namespace: "urn:x-cast:com.google.cast.tp.heartbeat",
		payload_type: cast_message.PayloadType.STRING,
		payload_utf8: JSON.stringify(json)
	};
	socket.write(cast_message.serializeCastMessage(castMessage));
}

function handleCastMessage(socket: libtls.TLSSocket, castMessage: cast_message.CastMessage): void {
	let message = JSON.parse(castMessage.payload_utf8 || "{}");
	console.log(message);
	if (castMessage.namespace === "urn:x-cast:com.google.cast.tp.connection") {

	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.tp.heartbeat") {
		if (xcast.heartbeat.Ping.is(message)) {
			sendHeartbeat(socket, castMessage.source_id, {
				"type": "PONG"
			});
		} else if (xcast.heartbeat.Pong.is(message)) {
			// RESET TIMER
		}
	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.receiver") {

	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.tp.deviceauth") {

	}
}

chromecast.observe('_googlecast._tcp.local', (host) => {
	console.log(host);
	if (ghost !== host) {
		ghost = host;
		for (let connection of connections) {
			tss.send("DeviceAvailable", connection, {
				ip: host
			});
		}
		chromecast.connectToChromecast(host, (socket, packet) => {
			let message = cast_message.parseCastMessage(packet);
			handleCastMessage(socket, message);
		});
	}
});

/*
default media receiver: CC1AD845
*/

let filter_headers = (headers: libhttp.IncomingHttpHeaders, keys: Array<string>): Partial<libhttp.IncomingHttpHeaders> => {
	let out: Partial<libhttp.IncomingHttpHeaders> = {};
	for (let key in headers) {
		if (keys.indexOf(key) >= 0) {
			out[key] = headers[key];
		}
	}
	return out;
};

let send_data = (file_id: string, request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void => {
	if (request.url === undefined) {
		throw new Error();
	}
	let username = "";
	try {
		var url = liburl.parse(request.url, true);
		username = auth.getUsername(url.query.token as string);
	} catch (error) {
		response.writeHead(401, {});
		return response.end();
	}
	let file = data.files_index[file_id] as FileEntry;
	let path = file.path;
	let mime = file.mime;
	let filename = path.join(libpath.sep);
	let fd = libfs.openSync(filename, 'r');
	let size = libfs.fstatSync(fd).size;
	libfs.closeSync(fd);
	let parts2;
	let range = request.headers.range;
	if (range !== undefined && (parts2 = /^bytes\=((?:[0-9])|(?:[1-9][0-9]+))\-((?:[0-9])|(?:[1-9][0-9]+))?$/.exec(range)) != null) {
		let offset = parseInt(parts2[1]);
		let offset2 = parts2[2] ? parseInt(parts2[2]) : null;
		if (offset2 === null) {
			offset2 = size - 1;
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
			'Content-Type': mime,
			'Content-Length': `${length}`
		});
		var s = libfs.createReadStream(filename, {
			start: offset,
			end: offset2
		});
		s.addListener("close", () => {
			if (offset + s.bytesRead === size) {
				data.addStream(username, file_id);
			}
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
				'Content-Type': mime,
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

function requestHandler(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
	let host = request.headers["host"] || "";
	let method = request.method || "";
	let path = request.url || "";
	if (/^[/]typesockets[/]/.test(path)) {
		return tss.getRequestHandler()(request, response);
	}
	let startMs = Date.now();
	response.on("finish", () => {
		let endMs = Date.now();
		let ms = endMs - startMs;
		process.stderr.write(`${("    " + ms).slice(-4)}ms ${method}:${path}\n`);
	});
	if (false && /^[0-9]+[.][0-9]+[.][0-9]+[.][0-9]+(:[0-9]+)?$/.test(host)) {
		response.writeHead(400);
		response.end();
		return;
	}
	let parts: RegExpExecArray | null;
	if (method === 'GET' && path === '/favicon.ico') {
		response.writeHead(404);
		response.end();
		return;
	}
	if (method === 'GET' && (parts = /^[/]files[/]([0-9a-f]{32})[/]/.exec(path)) !== null) {
		let file_id = parts[1];
		return send_data(file_id, request, response);
	}
	if (/^[/]media[/]/.test(path)) {
		if ((parts = /^[/]media[/]gifs[/]([0-9a-f]{32})[/]/.exec(path)) != null) {
			let cue_id = parts[1];
			let cue = data.cues_index[cue_id] as CueEntry;
			let filename = [".", "private", "memes", cue.cue_id];
			if (libfs.existsSync(filename.join("/"))) {
				let stream = libfs.createReadStream(filename.join("/"));
				stream.on("open", () => {
					response.writeHead(200, {
						"Access-Control-Allow-Origin": "*",
						"Content-Type": "image/gif"
					});
					stream.pipe(response);
				});
			} else {
				subsearch.generateMeme(filename, cue, () => {
					if (!libfs.existsSync(filename.join("/"))) {
						response.writeHead(500);
						return response.end();
					}
					let stream = libfs.createReadStream(filename.join("/"));
					stream.on("open", () => {
						response.writeHead(200, {
							"Access-Control-Allow-Origin": "*",
							"Content-Type": "image/gif"
						});
						stream.pipe(response);
					});
				});
			}
			return;
		}
		if (/^[/]media[/]channels[/]/.test(path)) {
			let token = liburl.parse(request.url || "/", true).query.token as string;
			channels.handleRequest(token, request, response);
			return;
		}
	}
	if (/^[/]api[/]/.test(path)) {
		return api.handleRequest(request, response);
	}
	if (method === 'GET') {
		response.writeHead(200);
		response.end(`<!doctype html><html><head><base href="/"/><meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0" name="viewport"/><link href="https://fonts.googleapis.com/css2?family=Nunito&family=Pacifico&family=Space+Mono&display=swap" rel="stylesheet"/></head><body><script>${libfs.readFileSync('./build/client.bundle.js')}</script></body></html>`);
		return;
	}
	console.log('unhandled', JSON.stringify(request.headers, null, "\t"));
	response.writeHead(400);
	response.end();
	return;
}

if (!libfs.existsSync("./private/certs/")) {
	libfs.mkdirSync("./private/certs/", { recursive: true });
}

function read(path: string): Buffer | undefined {
	if (libfs.existsSync(path)) {
		return libfs.readFileSync(path);
	}
	return undefined;
}

let full_chain = read("./private/certs/full_chain.pem");
let dhparam = read("./private/certs/dhparam.pem");
let certificate_key = read("./private/certs/certificate_key.pem");

if (full_chain && certificate_key) {
	let server = libhttps.createServer({
		cert: full_chain,
		dhparam: dhparam,
		key: certificate_key
	}, requestHandler);
	server.listen(443, () => {
		console.log("https://localhost:443");
	});
	server.keepAliveTimeout = 60 * 1000;
	libhttp.createServer({}, (request, response) => {
		let host = request.headers["host"] || "";
		let path = request.url || "";
		let hostname = host.split(":").shift() as string;
		response.writeHead(307, {
			"Location": "https://" + hostname + ":" + 443 + path
		});
		response.end();
	}).listen(80, () => {
		console.log("http://localhost:80");
	});
} else {
	let server = libhttp.createServer({}, requestHandler);
	server.listen(80, () => {
		console.log("http://localhost:80");
	});
	server.keepAliveTimeout = 60 * 1000;
}
