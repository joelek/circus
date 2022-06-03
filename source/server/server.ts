import * as libfs from "fs";
import * as libhttp from "http";
import * as libhttps from "https";
import * as libos from "os";
import * as libtls from "tls";
import * as api from "../api/api";
import * as indexer from "../database/indexer";
import * as subsearch from "./subsearch";
import * as context from "../player/";
import * as playlists from "../playlists/";
import * as chromecasts from "../chromecast/chromecasts";
import * as airplay from "../airplay/";
import * as is from "../is";
import { default as config } from "../config";
import { transactionManager } from "../database/atlas";
import { binid } from "../utils";
import * as atlas from "../database/atlas";

const contextServer = new context.server.ContextServer();
const playlistsServer = new playlists.server.PlaylistsServer();

async function requestHandler(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): Promise<void> {
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
		response.end("{}");
		return;
	}
	if (/^[/]media[/]/.test(path)) {
		if ((parts = /^[/]media[/]stills[/]([0-9a-f]{16})[/]/.exec(path)) != null) {
			let file_id = parts[1];
			let filename = [".", "private", "stills", file_id];
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
				response.end();
				return;
			}
			return;
		}
		if ((parts = /^[/]media[/]gifs[/]([0-9a-f]{16})[/]/.exec(path)) != null) {
			let cue_id = parts[1];
			let filename = [".", "private", "gifs", cue_id];
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
				transactionManager.enqueueReadableTransaction(async (queue) => {
					let cue = await atlas.stores.cues.lookup(queue, { cue_id: binid(cue_id) });
					let subtitle = await atlas.stores.subtitles.lookup(queue, cue);
					let file_subtitle = await atlas.stores.files.lookup(queue, subtitle);
					let video_subtitles = await atlas.links.subtitle_file_video_subtitles.filter(queue, subtitle);
					let file_video = await atlas.stores.files.lookup(queue, { file_id: video_subtitles[0].video_file_id });
					let video_path = await indexer.getPath(queue, file_video);
					let subtitle_path = await indexer.getPath(queue, file_subtitle);
					subsearch.generateMeme(filename, video_path, subtitle_path, cue, () => {
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
				});
			}
			return;
		}
	}
	if (/^[/]api[/]/.test(path)) {
		return api.server(request, response);
	}
	if (path === "/manifest.json") {
		response.writeHead(200, {
			"Content-Type": "application/json"
		});
		response.end(JSON.stringify({
			"name": "Circus",
			"start_url": "/",
			"display": "standalone",
			"theme_color": "#df4f7f",
			"background_color":"#1f1f1f",
			"icons": []
		}));
		return;
	}
	if (path === "/logo.png") {
		response.writeHead(200, {
			"Content-Type": "image/png"
		});
		libfs.createReadStream("./public/logo.png").pipe(response);
		return;
	}
	if (path === "/backdrop.png") {
		response.writeHead(200, {
			"Content-Type": "image/png"
		});
		libfs.createReadStream("./public/backdrop.png").pipe(response);
		return;
	}
	if (method === 'GET') {
		response.writeHead(200);
		response.end(`<!doctype html><html><head><base href="/"/><meta charset="utf-8"/><meta content="https://circus.joelek.se/backdrop.png" property="og:image"/><meta content="Transform your media library into your personal streaming service." name="description"/><meta content="width=device-width,initial-scale=1.0" name="viewport"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><link rel="apple-touch-icon" href="logo.png" /><link rel="manifest" href="/manifest.json"/><link href="https://fonts.googleapis.com/css2?family=Nunito&family=Pacifico&display=swap" rel="stylesheet"/><title>Circus</title></head><body><script>${libfs.readFileSync('./dist/client.min.js')}</script></body></html>`);
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

// TODO: Use hostname from certificate.
let hostname = getLocalIp();
let media_server_host = `http://${hostname}:${config.http_port}`;
let http_server = libhttp.createServer({}, requestHandler);
http_server.listen(config.http_port, () => {
	console.log(`http://${hostname}:${config.http_port}`);
});
http_server.keepAliveTimeout = 60 * 1000;
if (libfs.existsSync(config.certificate_path.join("/")) && libfs.existsSync(config.certificate_key_path.join("/"))) {
	let https_server = libhttps.createServer({
		SNICallback: (servername, callback) => {
			let secureContext = libtls.createSecureContext({
				key: libfs.readFileSync(config.certificate_key_path.join("/")),
				cert: libfs.readFileSync(config.certificate_path.join("/")),
				dhparam: libfs.existsSync("./private/certs/dhparam.pem") ? libfs.readFileSync("./private/certs/dhparam.pem") : undefined
			});
			callback(null, secureContext);
		},
		key: libfs.readFileSync(config.certificate_key_path.join("/")),
		cert: libfs.readFileSync(config.certificate_path.join("/")),
		dhparam: libfs.existsSync("./private/certs/dhparam.pem") ? libfs.readFileSync("./private/certs/dhparam.pem") : undefined
	}, requestHandler);
	https_server.listen(config.https_port, () => {
		console.log(`https://${hostname}:${config.https_port}`);
	});
	https_server.keepAliveTimeout = 60 * 1000;
	let websocket_host = `wss://${hostname}:${config.https_port}`;
	airplay.observe(websocket_host, media_server_host);
	chromecasts.observe(websocket_host, media_server_host);
} else {
	let websocket_host = `ws://${hostname}:${config.http_port}`;
	airplay.observe(websocket_host, media_server_host);
	chromecasts.observe(websocket_host, media_server_host);
}
