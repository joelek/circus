import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libhttp from "http";
import * as libhttps from "https";
import * as libos from "os";
import * as libpath from "path";
import * as liburl from "url";
import * as api from "../api/api";
import * as auth from "./auth";
import * as indexer from "../database/indexer";
import * as subsearch from "./subsearch";
import * as context from "../player/";
import * as playlists from "../playlists/";
import * as chromecasts from "../chromecast/chromecasts";
import * as airplay from "../airplay/";
import * as is from "../is";
import { default as config } from "../config";

let send_data = (file_id: string, request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void => {
	if (request.url === undefined) {
		throw new Error();
	}
	let user_id = "";
	try {
		var url = liburl.parse(request.url, true);
		user_id = auth.getUserId(url.query.token as string);
	} catch (error) {
		response.writeHead(401, {});
		return response.end();
	}
	let file = indexer.files.lookup(file_id);
	let path = indexer.getPath(file);
	let mime = "application/octet-stream";
	try {
		mime = indexer.audio_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = indexer.image_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = indexer.metadata_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = indexer.subtitle_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = indexer.video_files.lookup(file.file_id).mime;
	} catch (error) {}
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
			"Cache-Control": "private, max-age=86400",
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
				let timestamp_ms = Date.now();
				indexer.streams.insert({
					stream_id: libcrypto.randomBytes(8).toString("hex"),
					user_id,
					file_id,
					timestamp_ms
				});
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
				"Cache-Control": "private, max-age=86400",
				'Content-Type': mime,
				'Content-Length': `${size}`
			});
			s.pipe(response);
		});
		s.on('error', function (error) {
			response.writeHead(404);
			response.end();
		});
	}
};

const contextServer = new context.server.ContextServer();
const playlistsServer = new playlists.server.PlaylistsServer();

let indexTimer: NodeJS.Timeout | undefined;

function setupIndexTimer(): void {
	if (is.present(indexTimer)) {
		clearTimeout(indexTimer);
	}
	indexTimer = setTimeout(() => {
		indexTimer = undefined;
		indexer.runIndexer();
	}, 60 * 60 * 1000);
}

function requestHandler(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
	let host = request.headers["host"] || "";
	let method = request.method || "";
	let path = request.url || "";
	if (/^[/]sockets[/]context[/]/.test(path)) {
		return contextServer.getRequestHandler()(request, response);
	}
	if (/^[/]sockets[/]playlists[/]/.test(path)) {
		return playlistsServer.getRequestHandler()(request, response);
	}
	let startMs = Date.now();
	response.on("finish", () => {
		let duration_ms = Date.now() - startMs;
		process.stderr.write(`${response.statusCode} ${method}:${path} (${duration_ms} ms)\n`);
		setupIndexTimer();
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
	if (method === "POST" && path === "/discover") {
		airplay.discover();
		chromecasts.discover();
		response.writeHead(200);
		return response.end("{}");
	}
	if (method === 'GET' && (parts = /^[/]files[/]([0-9a-f]{16})[/]/.exec(path)) !== null) {
		let file_id = parts[1];
		return send_data(file_id, request, response);
	}
	if (/^[/]media[/]/.test(path)) {
		if ((parts = /^[/]media[/]stills[/]([0-9a-f]{16})[/]/.exec(path)) != null) {
			let file_id = parts[1];
			let file = indexer.files.lookup(file_id);
			let filename = [".", "private", "stills", file.file_id];
			if (libfs.existsSync(filename.join("/"))) {
				let stream = libfs.createReadStream(filename.join("/"));
				stream.on("open", () => {
					response.writeHead(200, {
						"Access-Control-Allow-Origin": "*",
						"Cache-Control": "public, max-age=86400",
						"Content-Type": "image/jpeg"
					});
					stream.pipe(response);
				});
			} else {
				response.writeHead(404);
				return response.end();
			}
			return;
		}
		if ((parts = /^[/]media[/]gifs[/]([0-9a-f]{16})[/]/.exec(path)) != null) {
			let cue_id = parts[1];
			let cue = indexer.cues.lookup(cue_id);
			let filename = [".", "private", "gifs", cue.cue_id];
			if (libfs.existsSync(filename.join("/"))) {
				let stream = libfs.createReadStream(filename.join("/"));
				stream.on("open", () => {
					response.writeHead(200, {
						"Access-Control-Allow-Origin": "*",
						"Cache-Control": "public, max-age=86400",
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
							"Cache-Control": "public, max-age=86400",
							"Content-Type": "image/gif"
						});
						stream.pipe(response);
					});
				});
			}
			return;
		}
	}
	if (/^[/]api[/]/.test(path)) {
		return api.handleRequest(request, response);
	}
	if (path === "/manifest.json") {
		response.writeHead(200, {
			"Content-Type": "application/json"
		});
		return response.end(JSON.stringify({
			"name": "Circus",
			"start_url": "/",
			"display": "standalone",
			"theme_color": "#df4f7f",
			"background_color":"#1f1f1f",
			"icons": []
		}));
	}
	if (path === "/logo.png") {
		response.writeHead(200, {
			"Content-Type": "image/png"
		});
		libfs.createReadStream("./public/logo.png").pipe(response);
		return;
	}
	if (method === 'GET') {
		response.writeHead(200);
		response.end(`<!doctype html><html><head><base href="/"/><meta charset="utf-8"/><meta content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0" name="viewport"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><link rel="apple-touch-icon" href="logo.png" /><link rel="manifest" href="/manifest.json"/><link href="https://fonts.googleapis.com/css2?family=Nunito&family=Pacifico&display=swap" rel="stylesheet"/><title>Circus</title></head><body><script>${libfs.readFileSync('./dist/client.min.js')}</script></body></html>`);
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

function getLocalIp(family: string = "ipv4"): string {
	let networkInterfaces = libos.networkInterfaces();
	for (let interfaceInfos of Object.values(networkInterfaces)) {
		if (is.present(interfaceInfos)) {
			for (let interfaceInfo of interfaceInfos) {
				if (interfaceInfo.internal === true) {
					continue;
				}
				if (interfaceInfo.family.toLowerCase() === family.toLowerCase()) {
					return interfaceInfo.address;
				}
			}
		}
	}
	throw `Expected a local interface!`;
}

let full_chain = read(config.certificate_path.join("/"));
let dhparam = read("./private/certs/dhparam.pem");
let certificate_key = read(config.certificate_key_path.join("/"));

// TODO: Use hostname from certificate.
let hostname = getLocalIp();
let media_server_host = `http://${hostname}`;
let http_server = libhttp.createServer({}, requestHandler);
http_server.listen(config.http_port, () => {
	console.log(`http://${hostname}:${config.http_port}`);
});
http_server.keepAliveTimeout = 60 * 1000;
if (full_chain && certificate_key) {
	let https_server = libhttps.createServer({
		cert: full_chain,
		dhparam: dhparam,
		key: certificate_key
	}, requestHandler);
	https_server.listen(config.https_port, () => {
		console.log(`https://${hostname}:${config.https_port}`);
	});
	https_server.keepAliveTimeout = 60 * 1000;
	airplay.observe(true, media_server_host);
	chromecasts.observe(true, media_server_host);
} else {
	airplay.observe(false, media_server_host);
	chromecasts.observe(false, media_server_host);
}

for (let key of indexer.getKeysFromUser.lookup(undefined)) {
	console.log(`Registration key available: ${key.key_id}`);
}
