import * as libnet from "net";
import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";

export type Header = {
	key: string,
	value: string
};

export type Message = {
	line: string,
	headers: Array<Header>,
	body: Buffer
};

export function parseMessage(buffer: Buffer): Message {
	let string = buffer.toString("binary");
	let lines = string.split("\r\n");
	let i = 0;
	let line = lines[i++];
	let headers = new Array<Header>();
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
};

export function serializeMessage(message: Partial<Message>): Buffer {
	let body = message.body ?? Buffer.alloc(0);
	let headers = [
		{ key: "Content-Length", value: `${body.length}` },
		...(message.headers ?? [])
	];
	let head = Buffer.from([
		message.line,
		...headers.map((header) => `${header.key}: ${header.value}`),
		``,
		``
	].join("\r\n"));
	return Buffer.concat([head, body]);
};

export type Request = {
	method: string,
	path: string,
	version: string,
	headers: Array<Header>,
	body: Buffer
};

export function parseRequest(buffer: Buffer): Request {
	let message = parseMessage(buffer);
	let line = message.line;
	let parts = line.split(" ");
	if (parts.length !== 3) {
		throw `Expected three parts in request line!`;
	}
	return {
		method: parts[0],
		path: parts[1],
		version: parts[2],
		headers: message.headers,
		body: message.body
	};
};

export function serializeRequest(request: Partial<Request>): Buffer {
	return serializeMessage({
		line: `${request.method ?? "GET"} ${request.path ?? "/"} ${request.version ?? "HTTP/1.1"}`,
		headers: request.headers,
		body: request.body
	});
};

export type Response = {
	version: string,
	status: number,
	reason: string,
	headers: Array<Header>,
	body: Buffer
};

export function parseResponse(buffer: Buffer): Response {
	let message = parseMessage(buffer);
	let line = message.line;
	let parts = line.split(" ");
	if (parts.length < 3) {
		throw `Expected at least three parts in response line!`;
	}
	if (!/^[1-9][0-9][0-9]$/.test(parts[1])) {
		throw `Expected a three-digit status!`;
	}
	return {
		version: parts[0],
		status: Number.parseInt(parts[1]),
		reason: parts.slice(2).join(" "),
		headers: message.headers,
		body: message.body
	};
};

export function serializeResponse(response: Partial<Response>): Buffer {
	return serializeMessage({
		line: `${response.version ?? "HTTP/1.1"} ${response.status ?? 200} ${response.reason ?? "OK"}`,
		headers: response.headers,
		body: response.body
	});
};

export type OutboundSocketEventMap = {
	"close": {}
};

export class OutboundSocket extends stdlib.routing.MessageRouter<OutboundSocketEventMap> {
	private socket: libnet.Socket;

	constructor(options: libnet.NetConnectOpts) {
		super();
		let socket = libnet.createConnection(options);
		socket.on("connect", () => {
		});
		socket.on("close", () => {
			this.route("close", {});
		});
		socket.on("error", () => {
			socket.destroy();
		});
		this.socket = socket;
	}

	close(): void {
		this.socket.destroy();
	}

	async request(request: Partial<Request>): Promise<Response> {
		return new Promise((resolve, reject) => {
			this.socket.write(serializeRequest(request));
			let ondata = async (buffer: Buffer) => {
				this.socket.off("data", ondata);
				let response = parseResponse(buffer);
				resolve(response);
			};
			this.socket.on("data", ondata);
		});
	}
};

export type InboundSocketEventMap = {
	"close": {}
};

export class InboundSocket extends stdlib.routing.MessageRouter<InboundSocketEventMap> {
	private socket: libnet.Socket;

	constructor(options: libnet.NetConnectOpts, upgrade: Partial<Request>, handle: (request: Request) => Promise<Partial<Response>>) {
		super();
		let socket = libnet.createConnection(options);
		let ondata = (buffer: Buffer) => {
			let response = parseResponse(buffer);
			if (response.status !== 101) {
				return socket.emit("error", `Expected status 101!`);
			}
			let connection = response.headers.find((header) => header.key.toLowerCase() === "connection");
			if (is.absent(connection) || connection.value !== "Upgrade") {
				return socket.emit("error", `Expected a valid connection header!`);
			}
			let upgrade = response.headers.find((header) => header.key.toLowerCase() === "upgrade");
			if (is.absent(upgrade) || upgrade.value !== "PTTH/1.0") {
				return socket.emit("error", `Expected a valid upgrade header!`);
			}
			socket.off("data", ondata);
			socket.on("data", async (buffer) => {
				try {
					let request = parseRequest(buffer);
					let response = await handle(request);
					socket.write(serializeResponse(response));
				} catch (error) {
					socket.emit("error", error);
				}
			});
		};
		socket.on("data", ondata);
		socket.on("connect", () => {
			socket.write(serializeRequest({
				...upgrade,
				headers: [
					{ key: "Connection", value: "Upgrade" },
					{ key: "Upgrade", value : "PTTH/1.0" },
					...(upgrade.headers ?? [])
				]
			}));
		});
		socket.on("close", () => {
			this.route("close", {});
		});
		socket.on("error", () => {
			socket.destroy();
		});
		this.socket = socket;
	}

	close(): void {
		this.socket.destroy();
	}
};
