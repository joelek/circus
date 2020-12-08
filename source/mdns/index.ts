import * as libdgram from "dgram";
import * as is from "../is";

const MDNS_ADDRESS = "224.0.0.251";
const MDNS_PORT = 5353;

interface Observer {
	(host: string): void;
}

let map = new Map<string, Set<Observer>>();

function parseName(buffer: Buffer, offset: number): { value: string, offset: number } {
	let labels = new Array<string>();
	while (true) {
		let length = buffer.readUInt8(offset);
		if (length === 0) {
			offset += 1;
			break;
		}
		if (length < 64) {
			offset += 1;
			let label = buffer.slice(offset, offset + length);
			offset += length;
			labels.push(label.toString("binary"));
			continue;
		}
		if (length < 192) {
			throw new Error();
		}
		let name = parseName(buffer, buffer.readUInt16BE(offset) & 0x3FFF);
		labels.push(name.value);
		offset += 2;
		break;
	}
	return {
		value: labels.join("."),
		offset: offset
	};
};

enum Type {
	A = 1,
	PTR = 12,
	SRV = 33
};

type Question = {
	value: string,
	type: number,
	kind: number
};

async function parseQuestion(packet: Buffer, offset: number): Promise<Question & { offset: number }> {
	let name = await parseName(packet, offset);
	offset = name.offset;
	let type = packet.readUInt16BE(offset);
	offset += 2;
	let kind = packet.readUInt16BE(offset);
	offset += 2;
	return {
		value: name.value,
		type,
		kind,
		offset
	};
};

type Answer = {
	name: string,
	type: number,
	kind: number,
	ttl: number,
	data_offset: number
};

function parseA(packet: Packet, data_offset: number): { ipv4: string } {
	let buffer = packet.buffer;
	let a = buffer.readUInt8(data_offset);
	data_offset += 1;
	let b = buffer.readUInt8(data_offset);
	data_offset += 1;
	let c = buffer.readUInt8(data_offset);
	data_offset += 1;
	let d = buffer.readUInt8(data_offset);
	data_offset += 1;
	let ipv4 = `${a}.${b}.${c}.${d}`;
	return {
		ipv4
	};
}

function parsePTR(packet: Packet, data_offset: number): { to: string } {
	let buffer = packet.buffer;
	let to = parseName(buffer, data_offset);
	data_offset = to.offset;
	return {
		to: to.value
	};
}

function parseSRV(packet: Packet, data_offset: number): { priority: number, weight: number, port: number, to: string } {
	let buffer = packet.buffer;
	let priority = buffer.readUInt16BE(data_offset);
	data_offset += 2;
	let weight = buffer.readUInt16BE(data_offset);
	data_offset += 2;
	let port = buffer.readUInt16BE(data_offset);
	data_offset += 2;
	let to = parseName(buffer, data_offset);
	data_offset = to.offset;
	return {
		priority,
		weight,
		port,
		to: to.value
	};
}

function parseAnswer(buffer: Buffer, offset: number): Answer & { offset: number } {
	let name = parseName(buffer, offset);
	offset = name.offset;
	let type = buffer.readUInt16BE(offset);
	offset += 2;
	let kind = buffer.readUInt16BE(offset);
	offset += 2;
	let ttl = buffer.readUInt32BE(offset);
	offset += 4;
	let length = buffer.readUInt16BE(offset);
	offset += 2;
	let data_offset = offset;
	if (offset + length > buffer.length) {
		throw `Invalid buffer length!`;
	}
	offset += length;
	return {
		name: name.value,
		type,
		kind,
		ttl,
		data_offset,
		offset
	};
};

type Packet = {
	buffer: Buffer,
	questions: Array<Question>,
	answers: Array<Answer>,
	authorities: Array<Answer>,
	additionals: Array<Answer>
};

async function parsePacket(buffer: Buffer): Promise<Packet> {
	let offset = 0;
	let header = buffer.slice(offset, offset + 12);
	offset += 12;
	let id = header.readUInt16BE(0);
	let flags = header.readUInt16BE(2);
	let qdcount = header.readUInt16BE(4);
	let ancount = header.readUInt16BE(6);
	let nscount = header.readUInt16BE(8);
	let arcount = header.readUInt16BE(10);
	let questions = new Array<Question>();
	for (let i = 0; i < qdcount; i++) {
		let result = await parseQuestion(buffer, offset);
		questions.push(result);
		offset = result.offset;
	}
	let answers = new Array<Answer>();
	for (let i = 0; i < ancount; i++) {
		let result = await parseAnswer(buffer, offset);
		answers.push(result);
		offset = result.offset;
	}
	let authorities = new Array<Answer>();
	for (let i = 0; i < nscount; i++) {
		let result = await parseAnswer(buffer, offset);
		authorities.push(result);
		offset = result.offset;
	}
	let additionals = new Array<Answer>();
	for (let i = 0; i < arcount; i++) {
		let result = await parseAnswer(buffer, offset);
		additionals.push(result);
		offset = result.offset;
	}
	return {
		buffer,
		questions,
		answers,
		authorities,
		additionals
	};
};

function lookupHostname(hostname: string, packet: Packet): string | undefined {
	for (let answer of [...packet.answers, ...packet.authorities, ...packet.additionals]) {
		if (answer.name === hostname) {
			if (answer.type === Type.A) {
				let record = parseA(packet, answer.data_offset);
				return record.ipv4;
			} else if (answer.type === Type.PTR) {
				let record = parsePTR(packet, answer.data_offset);
				return lookupHostname(record.to, packet);
			} else if (answer.type === Type.SRV) {
				let record = parseSRV(packet, answer.data_offset);
				return lookupHostname(record.to, packet);
			}
		}
	}
}

function notifyObservers(packet: Packet): void {
	for (let answer of packet.answers) {
		let hostname = answer.name;
		let observers = map.get(hostname);
		if (is.present(observers)) {
			let value = lookupHostname(hostname, packet);
			if (is.present(value)) {
				for (let observer of observers) {
					observer(value);
				}
			}
		}
	}
};

const socket = libdgram.createSocket({ type: "udp4", reuseAddr: true });

socket.on("listening", () => {
	socket.setMulticastLoopback(false);
	socket.addMembership(MDNS_ADDRESS, "0.0.0.0");
});

socket.on("message", async (buffer) => {
	try {
		let packet = await parsePacket(buffer);
		notifyObservers(packet);
	} catch (error) {
		console.log(`Expected a valid DNS packet!`);
		console.log(error);
	}
});

socket.bind(MDNS_PORT);

// TODO: Encode labels properly.
export function sendDiscoveryPacket(host: string): void {
	console.log(`Sending discover packet for ${host}.`);
	let buffers = Array<Buffer>();
	let head = Buffer.alloc(12);
	head.writeUInt16BE(1, 4);
	buffers.push(head);
	for (let label of host.split(".")) {
		if (label.length >= 64) {
			throw `Expected a label with a length less than 64!`;
		}
		let buffer = Buffer.alloc(1 + label.length);
		buffer.writeUInt8(label.length, 0);
		buffer.write(label, 1);
		buffers.push(buffer);
	}
	let tail = Buffer.alloc(5);
	tail.writeUInt8(0, 0);
	tail.writeUInt16BE(12, 1);
	tail.writeUInt16BE(1, 3);
	buffers.push(tail);
	socket.send(Buffer.concat(buffers), MDNS_PORT, MDNS_ADDRESS);
};

interface Cancellable {
	cancel(): void;
};

export function observe(host: string, observer: Observer): Cancellable {
	let observers = map.get(host);
	if (is.absent(observers)) {
		observers = new Set<Observer>();
		map.set(host, observers);
	}
	observers.add(observer);
	sendDiscoveryPacket(host);
	return {
		cancel(): void {
			let observers = map.get(host);
			if (is.present(observers)) {
				observers.delete(observer);
				if (observers.size === 0) {
					map.delete(host);
				}
			}
		}
	};
};
