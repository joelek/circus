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
import * as chromecasts from "./chromecasts";
import * as cc from "./cc";

let tss = new TypeSocketServer(messages);
// TODO: Keep map of connections and sessions.
let connections = new Map<string, string | undefined>();

tss.addEventListener("sys", "connect", (message) => {
	connections.set(message.connection_id, undefined);
});
tss.addEventListener("sys", "disconnect", (message) => {
	connections.delete(message.connection_id);
});
// TODO: Make authentication part of sys.
tss.addEventListener("app", "Authenticate", (message) => {
	connections.set(message.connection_id, message.data.token);
});

let devices = new Set<string>();

tss.addEventListener("app", "GetDevicesAvailable", (message) => {
	tss.send("AvailableDevices", {
		devices: Array.from(devices)
	}, message.connection_id);
});

chromecasts.addObserver({
	onconnect(id) {
		devices.add(id);
		for (let [connection_id, token] of connections) {
			tss.send("DeviceBecameAvailable", {
				id
			}, connection_id);
		}
	},
	ondisconnect(id) {
		devices.delete(id);
		for (let [connection_id, token] of connections) {
			tss.send("DeviceBecameUnavailable", {
				id
			}, connection_id);
		}
	}
});
chromecasts.observe();

tss.addEventListener("app", "TransferPlayback", async (message) => {
	let token = connections.get(message.connection_id);
	if (token != null) {
		try {
			await cc.launch(message.data.device, token, message.data.origin);
		} catch (error) {}
	} else {
		// TODO: Support switching back to playing on same device.
	}
});

cc.controller.isLaunched.addObserver((isLaunched) => {
	const session = cc.getSession();
	if (session != null) {
		let sessions = Array.from(connections.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("TransferPlayback", {
				device: isLaunched ? session.device : "",
				origin: session.origin
			}, connection_id);
		}
	}
});

cc.controller.context.addObserver((context) => {
	const session = cc.getSession();
	if (session != null) {
		let sessions = Array.from(connections.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContext", {
				context: context
			}, connection_id);
		}
	}
});

cc.controller.contextIndex.addObserver((contextIndex) => {
	const session = cc.getSession();
	if (session != null) {
		let sessions = Array.from(connections.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContextIndex", {
				index: contextIndex
			}, connection_id);
		}
	}
});

cc.controller.isPlaying.addObserver((isPlaying) => {
	const session = cc.getSession();
	if (session != null) {
		let sessions = Array.from(connections.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetPlaying", {
				playing: isPlaying
			}, connection_id);
		}
	}
});

tss.addEventListener("app", "GetPlayback", (message) => {
	let ccsession = cc.getSession();
	let token = connections.get(message.connection_id);
	if (ccsession != null && token != null && ccsession.token === token) {
		tss.send("TransferPlayback", {
			device: ccsession.device,
			origin: ccsession.origin
		}, message.connection_id);
		tss.send("SetContext", {
			context: cc.controller.context.getState()
		}, message.connection_id);
		tss.send("SetContextIndex", {
			index: cc.controller.contextIndex.getState()
		}, message.connection_id);
		tss.send("SetPlaying", {
			playing: cc.controller.shouldPlay.getState()
		}, message.connection_id);
	}
});

tss.addEventListener("app", "SetContext", async (message) => {
	let token = connections.get(message.connection_id);
	if (token == null) {
		return;
	}
	if (cc.isPlayingUsingToken(token)) {
		cc.controller.context.updateState(message.data.context);
	} else {
		let sessions = Array.from(connections.entries()).filter((entry) => entry[1] === token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContext", message.data, connection_id);
		}
	}
});

tss.addEventListener("app", "SetContextIndex", async (message) => {
	let token = connections.get(message.connection_id);
	if (token == null) {
		return;
	}
	if (cc.isPlayingUsingToken(token)) {
		cc.controller.contextIndex.updateState(message.data.index);
	} else {
		let sessions = Array.from(connections.entries()).filter((entry) => entry[1] === token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContextIndex", message.data, connection_id);
		}
	}
});

tss.addEventListener("app", "SetPlaying", async (message) => {
	let token = connections.get(message.connection_id);
	console.log(token);
	if (token == null) {
		return;
	}
	if (cc.isPlayingUsingToken(token)) {
		cc.controller.shouldPlay.updateState(message.data.playing);
	} else {
		let sessions = Array.from(connections.entries()).filter((entry) => entry[1] === token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetPlaying", message.data, connection_id);
		}
	}
});












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
		response.end(`<!doctype html><html><head><base href="/"/><meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0" name="viewport"/><link href="https://fonts.googleapis.com/css2?family=Nunito&family=Pacifico&family=Space+Mono&display=swap" rel="stylesheet"/><title>Zenplayer</title></head><body><script>${libfs.readFileSync('./build/client.bundle.js')}</script></body></html>`);
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
