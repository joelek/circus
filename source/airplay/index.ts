import * as libcrypto from "crypto";
import * as libhttp from "http";
import * as libnet from "net";
import * as mdns from "../mdns";
import * as is from "../is";
import * as plist from "./plist";

function makeUUID(): string {
	return [
		libcrypto.randomBytes(4).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(6).toString("hex")
	].join("-");
}

let session_id = makeUUID();

let agent = new libhttp.Agent({
	maxSockets: 1,
	keepAlive: true
})

function readBody(response: libhttp.IncomingMessage): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		let chunks = new Array<Buffer>();
		response.on("data", (chunk) => {
			chunks.push(chunk);
		});
		response.on("end", () => {
			let buffer = Buffer.concat(chunks);
			resolve(buffer);
		});
		response.on("error", reject);
	});
}

namespace api {
	export type ServerInfo = {
		device_id: string
	};

	export function play(info: ServerInfo, host: string, url: string, progressFactor: number): Promise<void> {
		return new Promise((resolve, reject) => {
			let payload = Buffer.from([
				`Content-Location: ${url}`,
				`Start-Position: ${progressFactor}`,
				``
			].join("\n"));
			let request = libhttp.request({
				headers: {
					"Content-Type": "text/parameters",
					"Content-Length": payload.length,
					"X-Apple-Session-ID": session_id,
				},
				method: "POST",
				hostname: host,
				port: 7000,
				path: "/play",
				agent
			}, async (response) => {
				let status = response.statusCode ?? 0;
				if (status >= 200 && status < 300) {
					return resolve();
				}
				return reject();
			});
			request.end(payload);
		});
	}

	export function getServerInfo(host: string): Promise<ServerInfo> {
		return new Promise((resolve, reject) => {
			let request = libhttp.request({
				headers: {
					"Content-Length": 0,
					"X-Apple-Session-ID": session_id,
				},
				method: "GET",
				hostname: host,
				port: 7000,
				path: "/server-info",
				agent
			}, async (response) => {
				let buffer = await readBody(response);
				let string = buffer.toString();
				let parts = /<key>deviceid<[/]key>\s*<string>([^<]*)<[/]string>/s.exec(string);
				if (is.present(parts)) {
					let device_id = parts[1];
					return resolve({
						device_id
					});
				}
				return reject();
			});
			request.end();
		});
	}
}

type HTTPHeader = {
	key: string,
	value: string
};

type HTTPMessage = {
	line: string,
	headers: Array<HTTPHeader>,
	body: Buffer
};

function parseHTTPMessage(buffer: Buffer): HTTPMessage {
	let string = buffer.toString("binary");
	let lines = string.split("\r\n");
	let i = 0;
	let line = lines[i++];
	let headers = new Array<HTTPHeader>();
	while (i < lines.length) {
		let line = lines[i++];
		if (line === "") {
			break;
		}
		let parts = line.split(": ");
		let key = parts[0];
		let value = parts.slice(1).join(": ");
		headers.push({
			key: Buffer.from(key, "binary").toString(),
			value: Buffer.from(value, "binary").toString()
		});
	}
	let body = Buffer.from(lines.slice(i).join("\r\n"), "binary");
	return {
		line: Buffer.from(line, "binary").toString(),
		headers,
		body
	};
}

type HTTPRequest = HTTPMessage & {
	method: string,
	path: string,
	version: string
};

function parseHTTPRequest(buffer: Buffer): HTTPRequest {
	let message = parseHTTPMessage(buffer);
	let line = message.line;
	let parts = line.split(" ");
	if (parts.length !== 3) {
		throw `Expected three parts in request line!`;
	}
	return {
		...message,
		method: parts[0],
		path: parts[1],
		version: parts[2]
	};
}

type HTTPResponse = HTTPMessage & {
	version: string,
	status: number,
	reason: string
};

function parseHTTPResponse(buffer: Buffer): HTTPResponse {
	let message = parseHTTPMessage(buffer);
	let line = message.line;
	let parts = line.split(" ");
	if (parts.length < 3) {
		throw `Expected at least three parts in response line!`;
	}
	if (!/^[1-9][0-9][0-9]$/.test(parts[1])) {
		throw `Expected a three-digit status!`;
	}
	return {
		...message,
		version: parts[0],
		status: Number.parseInt(parts[1]),
		reason: parts.slice(2).join(" ")
	};
}

function getEventConnection(info: api.ServerInfo, host: string, onevent: (request: HTTPRequest) => void): Promise<libnet.Socket> {
	return new Promise((resolve, reject) => {
		let socket = libnet.createConnection({
			host: host,
			port: 7000
		});
		let is_resolved = false;
		socket.on("data", (buffer) => {
			if (!is_resolved) {
				let response = parseHTTPResponse(buffer);
				if (response.status !== 101) {
					return reject(`Expected a protocol switch!`);
				}
				let connection = response.headers.find((header) => header.key.toLowerCase() === "connection");
				if (is.absent(connection) || connection.value !== "Upgrade") {
					return reject(`Expected a valid connection header!`);
				}
				let upgrade = response.headers.find((header) => header.key.toLowerCase() === "upgrade");
				if (is.absent(upgrade) || upgrade.value !== "PTTH/1.0") {
					return reject(`Expected a valid upgrade header!`);
				}
				is_resolved = true;
				return resolve(socket);
			} else {
				let request = parseHTTPRequest(buffer);
				onevent(request);
				socket.write([
					`HTTP/1.1 200 OK`,
					`Content-Length: 0`,
					``
				].join("\r\n") + "\r\n");
			}
		});
		socket.on("connect", () => {
			console.log(`Connected to AirPlay device at ${host}.`);
		});
		socket.on("close", () => {
			console.log(`Disconnected from AirPlay device at ${host}.`);
		});
		socket.on("error", (error) => {
			socket.destroy();
		});
		socket.write([
			`POST /reverse HTTP/1.1`,
			`Connection: Upgrade`,
			`Upgrade: PTTH/1.0`,
			`X-Apple-Purpose: event`,
			`X-Apple-Session-ID: ${session_id}`,
			``
		].join("\r\n") + "\r\n");
	});
}

async function makeSocket(host: string): Promise<libnet.Socket> {
	let info = await api.getServerInfo(host);
	let socket = await getEventConnection(info, host, (request) => {
		try {
			let document = plist.parse(request.body.toString());
		} catch (error) {}
	});
	//await api.play(info, host, "https://file-examples-com.github.io/uploads/2017/04/file_example_MP4_1920_18MG.mp4", 0);
	return socket;
}

class Device {
	constructor(host: string) {

	}
}

const devices = new Map<string, Device>();

export function observe(): void {
	mdns.observe("_airplay._tcp.local", async (host) => {
		try {
			let device = devices.get(host);
			if (is.absent(device)) {
				devices.set(host, new Device(host));
				let socket = await makeSocket(host);
				socket.on("close", () => {
					devices.delete(host);
				});
			}
		} catch (error) {}
	});
};
