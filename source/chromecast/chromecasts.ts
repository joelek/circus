import * as libnet from "net";
import * as libtls from "tls";
import * as cast_message from "./cast_message";
import * as mdns from "./mdns";
import * as schema from "./schema";
import * as is from "../is";
import * as libdb from "../database";
import * as data from "../data";
import * as languages from "../languages";
import * as observers from "../simpleobs";
import * as libcontext from "../context/client";
import * as sockets from "@joelek/ts-sockets";

let requestId = 0;

function sendCastMessage(socket: libnet.Socket, message: cast_message.CastMessage): void {
	if (false) {
		console.log("outgoing");
		console.log(JSON.stringify(JSON.parse(message.payload_utf8 || "{}"), null, "\t"));
	}
	let buffer = cast_message.serializeCastMessage(message);
	let header = Buffer.alloc(4);
	header.writeUInt32BE(buffer.length, 0);
	socket.write(header);
	socket.write(buffer);
}

function sendConnection(socket: libnet.Socket, json: schema.connection.Autoguard[keyof schema.connection.Autoguard]) {
	let castMessage: cast_message.CastMessage = {
		protocol_version: cast_message.ProtocolVersion.CASTV2_1_0,
		source_id: "sender-0",
		destination_id: "receiver-0",
		namespace: "urn:x-cast:com.google.cast.tp.connection",
		payload_type: cast_message.PayloadType.STRING,
		payload_utf8: JSON.stringify(json)
	};
	sendCastMessage(socket, castMessage);
}

function sendHeartbeat(socket: libnet.Socket, json: schema.heartbeat.Autoguard[keyof schema.heartbeat.Autoguard]) {
	let castMessage: cast_message.CastMessage = {
		protocol_version: cast_message.ProtocolVersion.CASTV2_1_0,
		source_id: "sender-0",
		destination_id: "receiver-0",
		namespace: "urn:x-cast:com.google.cast.tp.heartbeat",
		payload_type: cast_message.PayloadType.STRING,
		payload_utf8: JSON.stringify(json)
	};
	sendCastMessage(socket, castMessage);
}

function sendReceiver(socket: libnet.Socket, json: schema.receiver.Autoguard[keyof schema.receiver.Autoguard]) {
	let castMessage: cast_message.CastMessage = {
		protocol_version: cast_message.ProtocolVersion.CASTV2_1_0,
		source_id: "sender-0",
		destination_id: "receiver-0",
		namespace: "urn:x-cast:com.google.cast.receiver",
		payload_type: cast_message.PayloadType.STRING,
		payload_utf8: JSON.stringify(json)
	};
	sendCastMessage(socket, castMessage);
}

function sendMedia(socket: libnet.Socket, source: string, target: string, json: schema.media.Autoguard[keyof schema.media.Autoguard]) {
	let castMessage: cast_message.CastMessage = {
		protocol_version: cast_message.ProtocolVersion.CASTV2_1_0,
		source_id: source,
		destination_id: target,
		namespace: "urn:x-cast:com.google.cast.media",
		payload_type: cast_message.PayloadType.STRING,
		payload_utf8: JSON.stringify(json)
	};
	sendCastMessage(socket, castMessage);
}

interface Observer {
	onconnect(id: string): void,
	ondisconnect(id: string): void
}

const chromecasts = new Map<string, libtls.TLSSocket>();
const timers = new Map<string, any>();
const ccobservers = new Set<Observer>();

export function addObserver(observer: Observer): void {
	ccobservers.add(observer);
	for (let key in chromecasts) {
		observer.onconnect(key);
	}
}

function onpacket(host: string, socket: libtls.TLSSocket, packet: Buffer): void {
	let castMessage = cast_message.parseCastMessage(packet);
	let message = JSON.parse(castMessage.payload_utf8 || "{}");
	if (false) {
		console.log("incoming");
		console.log(JSON.stringify(message, null, "\t"));
	}
	if (castMessage.namespace === "urn:x-cast:com.google.cast.tp.connection") {
	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.tp.heartbeat") {
		if (schema.heartbeat.Ping.is(message)) {
			sendHeartbeat(socket, {
				"type": "PONG"
			});
		} else if (schema.heartbeat.Pong.is(message)) {
			clearTimeout(timers.get(host));
			setuptimers(host, socket);
		}
	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.receiver") {
		if (schema.receiver.ReceiverStatus.is(message)) {
		}
	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.media") {

	}
}

function setuptimers(host: string, socket: libtls.TLSSocket): void {
	timers.set(host, setTimeout(() => {
		sendHeartbeat(socket, {
			type: "PING"
		});
		timers.set(host, setTimeout(() => {
			socket.destroy();
		}, 5000));
	}, 5000));
}

function onclose(host: string, socket: libtls.TLSSocket): void {
	for (let observer of ccobservers) {
		try {
			observer.ondisconnect(host);
		} catch (error) {}
	}
	chromecasts.delete(host);
	clearTimeout(timers.get(host));
	timers.delete(host);
}

function packetize(host: string, socket: libtls.TLSSocket): void {
	let buffered = Buffer.alloc(0);
	let waiting_header = true;
	let bytes_required = 4;
	socket.on("data", (chunk: Buffer) => {
		buffered = Buffer.concat([buffered, chunk]);
		while (buffered.length >= bytes_required) {
			let buffer = buffered.slice(0, bytes_required);
			buffered = buffered.slice(bytes_required);
			if (waiting_header) {
				let header = buffer;
				waiting_header = false;
				bytes_required = header.readUInt32BE(0);
			} else {
				let payload = buffer;
				waiting_header = true;
				bytes_required = 4;
				onpacket(host, socket, payload);
			}
		}
	});
}

function onsecureconnect(host: string, socket: libtls.TLSSocket): void {
	for (let observer of ccobservers) {
		try {
			observer.onconnect(host);
		} catch (error) {}
	}
	packetize(host, socket);
	sendConnection(socket, {
		type: "CONNECT"
	});
	sendReceiver(socket, {
		type: "GET_STATUS",
		requestId: ++requestId
	});
	setuptimers(host, socket);
}

function connect(host: string): void {
	let socket = libtls.connect({
		host: host,
		port: 8009,
		rejectUnauthorized: false
	});
	chromecasts.set(host, socket);
	socket.on("secureConnect", () => {
		console.log(`Connected to chromecast at ${host}.`);
		onsecureconnect(host, socket);
	});
	socket.on("close", () => {
		console.log(`Disconnected from chromecast at ${host}.`);
		onclose(host, socket);
	});
	socket.on("error", () => {
		socket.end();
	});
}

let players = new Map<string, ChromecastPlayer>();

let url: string | undefined;

mdns.observe("_googlecast._tcp.local", (host) => {
	if (!chromecasts.has(host)) {
		connect(host);
	}
});

export function observe(secure: boolean) {
	if (is.present(url)) {
		return;
	}
	url = `${secure ? "wss:" : "ws:"}//127.0.0.1/sockets/context/?type=chromecast&name=Chromecast`;
	addObserver({
		onconnect(hostname) {
			let player = new ChromecastPlayer(hostname, url as string);
			players.set(hostname, player);
		},
		ondisconnect(hostname) {
			let player = players.get(hostname);
			if (is.present(player)) {
				players.delete(hostname);
				player.close();
			}
		}
	});
};

export class ChromecastPlayer {
	private context: libcontext.ContextClient;
	private isConnected = new observers.ObservableClass(false);
	private isLaunched = new observers.ObservableClass(false);
	private isLoading = new observers.ObservableClass(false);

	constructor(hostname: string, url: string) {
		// send launch CC1AD845
		this.context = new libcontext.ContextClient(url, (url) => new sockets.WebSocketClient(url));
		{
			let computer = () => {
				let currentLocalEntry = this.context.currentLocalEntry.getState();
				let token = this.context.token.getState();
				if (is.absent(currentLocalEntry) || is.absent(token)) {
					//lastVideo.src = ``;
				} else {
					//let url = `/files/${currentLocalEntry.file_id}/?token=${token}`;
				}
			};
			this.context.currentLocalEntry.addObserver(computer);
			this.context.token.addObserver(computer);
		}
	}

	close(): void {
		this.context.close();
	}
}
