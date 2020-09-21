import { setInterval } from "timers";
import * as libtls from "tls";
import * as cast_message from "./cast_message";
import * as mdns from "./mdns";
import * as xcast from "./xcast";

/*
default media receiver: CC1AD845
*/

function sendCastMessage(socket: libtls.TLSSocket, message: cast_message.CastMessage, verbose: boolean = true): void {
	if (verbose) {
		console.log("outgoing");
		console.log(message);
	}
	let buffer = cast_message.serializeCastMessage(message);
	let header = Buffer.alloc(4);
	header.writeUInt32BE(buffer.length, 0);
	socket.write(header);
	socket.write(buffer);
}

function sendConnection(socket: libtls.TLSSocket, json: xcast.connection.Autoguard[keyof xcast.connection.Autoguard]) {
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

function sendHeartbeat(socket: libtls.TLSSocket, json: xcast.heartbeat.Autoguard[keyof xcast.heartbeat.Autoguard]) {
	let castMessage: cast_message.CastMessage = {
		protocol_version: cast_message.ProtocolVersion.CASTV2_1_0,
		source_id: "sender-0",
		destination_id: "receiver-0",
		namespace: "urn:x-cast:com.google.cast.tp.heartbeat",
		payload_type: cast_message.PayloadType.STRING,
		payload_utf8: JSON.stringify(json)
	};
	sendCastMessage(socket, castMessage, false);
}

function sendReceiver(socket: libtls.TLSSocket, json: xcast.receiver.Autoguard[keyof xcast.receiver.Autoguard]) {
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

const chromecasts = new Map<string, libtls.TLSSocket>();
const timers = new Map<string, any>();

function onpacket(host: string, socket: libtls.TLSSocket, packet: Buffer): void {
	let castMessage = cast_message.parseCastMessage(packet);
	let message = JSON.parse(castMessage.payload_utf8 || "{}");
	if (castMessage.namespace === "urn:x-cast:com.google.cast.tp.connection") {
		console.log("incoming");
		console.log(castMessage);
	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.tp.heartbeat") {
		if (xcast.heartbeat.Ping.is(message)) {
			sendHeartbeat(socket, {
				"type": "PONG"
			});
		} else if (xcast.heartbeat.Pong.is(message)) {

		}
	} else if (castMessage.namespace === "urn:x-cast:com.google.cast.receiver") {
		console.log("incoming");
		console.log(castMessage);
		if (xcast.receiver.ReceiverStatus.is(message)) {

		}
	}
}

function onclose(host: string, socket: libtls.TLSSocket): void {
	console.log(`No longer connected to ${host}...`);
	// NOTIFY
	chromecasts.delete(host);
	clearInterval(timers.get(host));
	timers.delete(host);
}

function packetize(host: string, socket: libtls.TLSSocket): void {
	let buffered = Buffer.alloc(0);
	let waiting_header = true;
	let bytes_required = 4;
	socket.on("data", (chunk: Buffer) => {
		console.log(`Got ${chunk.length} bytes from ${host}`);
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
	console.log(`Connected to ${host}.`);
	// NOTIFY
	packetize(host, socket);
	sendConnection(socket, {
		type: "CONNECT"
	});
	timers.set(host, setInterval(() => {
		sendHeartbeat(socket, {
			type: "PING"
		});
	}, 5000));
}

function connect(host: string): void {
	let socket = libtls.connect({
		host: host,
		port: 8009,
		rejectUnauthorized: false
	});
	chromecasts.set(host, socket);
	socket.on("secureConnect", () => {
		onsecureconnect(host, socket);
	});
	socket.on("close", () => {
		onclose(host, socket);
	});
}

export function observe() {
	mdns.observe("_googlecast._tcp.local", (host) => {
		console.log(`Got chromecast service discovery response from ${host}.`);
		if (!chromecasts.has(host)) {
			connect(host);
		}
	});
};
