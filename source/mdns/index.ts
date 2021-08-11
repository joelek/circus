import * as libdgram from "dgram";
import * as libos from "os";
import * as is from "../is";

const MDNS_ADDRESS = "224.0.0.251";
const MDNS_PORT = 5353;

type Device = {
	hostname: string,
	service_info?: Array<string>
};

interface Observer {
	(device: Device): void;
}

let map = new Map<string, Set<Observer>>();

function parseName(buffer: Buffer, offset: number): { labels: Array<string>, offset: number } {
	let labels = new Array<string>();
	while (true) {
		let length = buffer.readUInt8(offset);
		if (length === 0) {
			offset += 1;
			break;
		}
		if (length < 192) {
			offset += 1;
			let label = buffer.slice(offset, offset + length);
			offset += length;
			labels.push(label.toString());
			continue;
		}
		let name = parseName(buffer, buffer.readUInt16BE(offset) & 0x3FFF);
		labels.push(name.labels.join("."));
		offset += 2;
		break;
	}
	return {
		labels: labels,
		offset: offset
	};
};

enum Type {
	A = 1,
	PTR = 12,
	TXT = 16,
	SRV = 33
};

type Question = {
	value: string,
	type: number,
	kind: number
};

function parseQuestion(packet: Buffer, offset: number): Question & { offset: number } {
	let name = parseName(packet, offset);
	offset = name.offset;
	let type = packet.readUInt16BE(offset);
	offset += 2;
	let kind = packet.readUInt16BE(offset);
	offset += 2;
	return {
		value: name.labels.join("."),
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
	packet: Buffer,
	data_offset: number,
	data_length: number
};

function parseA(answer: Answer): { ipv4: string } {
	let buffer = answer.packet;
	let data_offset = answer.data_offset;
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

function parsePTR(answer: Answer): { to: string } {
	let buffer = answer.packet;
	let data_offset = answer.data_offset;
	let to = parseName(buffer, data_offset);
	data_offset = to.offset;
	return {
		to: to.labels.join(".")
	};
}

function parseTXT(answer: Answer): { content: Array<string> } {
	let buffer = answer.packet;
	let data_offset = answer.data_offset;
	let content = parseName(buffer, data_offset);
	return {
		content: content.labels
	};
}

function parseSRV(answer: Answer): { priority: number, weight: number, port: number, to: string } {
	let buffer = answer.packet;
	let data_offset = answer.data_offset;
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
		to: to.labels.join(".")
	};
}

function parseAnswer(packet: Buffer, offset: number): Answer {
	let name = parseName(packet, offset);
	offset = name.offset;
	let type = packet.readUInt16BE(offset);
	offset += 2;
	let kind = packet.readUInt16BE(offset);
	offset += 2;
	let ttl = packet.readUInt32BE(offset);
	offset += 4;
	let data_length = packet.readUInt16BE(offset);
	offset += 2;
	let data_offset = offset;
	if (data_offset + data_length > packet.length) {
		throw `Invalid buffer length!`;
	}
	offset += data_length;
	return {
		name: name.labels.join("."),
		type,
		kind,
		ttl,
		packet,
		data_offset,
		data_length
	};
};

type Packet = {
	buffer: Buffer,
	questions: Array<Question>,
	answers: Array<Answer>,
	authorities: Array<Answer>,
	additionals: Array<Answer>
};

function parsePacket(buffer: Buffer): Packet {
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
		let result = parseQuestion(buffer, offset);
		questions.push(result);
		offset = result.offset;
	}
	let answers = new Array<Answer>();
	for (let i = 0; i < ancount; i++) {
		let result = parseAnswer(buffer, offset);
		answers.push(result);
		offset = result.data_offset + result.data_length;
	}
	let authorities = new Array<Answer>();
	for (let i = 0; i < nscount; i++) {
		let result = parseAnswer(buffer, offset);
		authorities.push(result);
		offset = result.data_offset + result.data_length;
	}
	let additionals = new Array<Answer>();
	for (let i = 0; i < arcount; i++) {
		let result = parseAnswer(buffer, offset);
		additionals.push(result);
		offset = result.data_offset + result.data_length;
	}
	return {
		buffer,
		questions,
		answers,
		authorities,
		additionals
	};
};

function lookupDevice(device: Device, packet: Packet): Device | undefined {
	for (let answer of [...packet.answers, ...packet.authorities, ...packet.additionals]) {
		if (answer.name === device.hostname) {
			if (answer.type === Type.TXT) {
				try {
					let record = parseTXT(answer);
					device = {
						...device,
						service_info: record.content
					};
				} catch (error) {}
			}
		}
	}
	for (let answer of [...packet.answers, ...packet.authorities, ...packet.additionals]) {
		if (answer.name === device.hostname) {
			if (answer.type === Type.A) {
				let record = parseA(answer);
				device = {
					...device,
					hostname: record.ipv4
				};
				return device;
			} else if (answer.type === Type.PTR) {
				let record = parsePTR(answer);
				device = {
					...device,
					hostname: record.to
				};
				return lookupDevice(device, packet);
			} else if (answer.type === Type.SRV) {
				let record = parseSRV(answer);
				device = {
					...device,
					hostname: record.to
				};
				return lookupDevice(device, packet);
			}
		}
	}
}

function notifyObservers(packet: Packet): void {
	for (let answer of packet.answers) {
		let hostname = answer.name;
		let observers = map.get(hostname);
		if (is.present(observers)) {
			let device = lookupDevice({ hostname }, packet);
			if (is.present(device)) {
				for (let observer of observers) {
					observer(device);
				}
			}
		}
	}
};

function getNetworkInterfaces(): Array<libos.NetworkInterfaceInfo> {
	let networkInterfaces = libos.networkInterfaces();
	return Object.values(networkInterfaces)
		.filter(is.present)
		.flat()
		.filter((networkInterface) => {
			return !networkInterface.internal;
		});
}

const socket = libdgram.createSocket({ type: "udp4", reuseAddr: true });
const networkInterfaces = getNetworkInterfaces()
	.filter((networkInterface) => {
		return networkInterface.family === "IPv4";
	});

socket.on("listening", () => {
	socket.setMulticastLoopback(false);
	for (let networkInterface of networkInterfaces) {
		socket.addMembership(MDNS_ADDRESS, networkInterface.address);
	}
});

function isAddressLocal(string: string): boolean {
	let remotes = string.split(".")
		.map((part) => {
			return Number.parseInt(part, 10);
		});
	outer: for (let networkInterface of networkInterfaces) {
		let locals = networkInterface.address.split(".")
			.map((part) => {
				return Number.parseInt(part, 10);
			});
		let masks = networkInterface.netmask.split(".")
			.map((part) => {
				return Number.parseInt(part, 10);
			});
		inner: for (let [index, mask] of masks.entries()) {
			if ((remotes[index] & mask) !== (locals[index] & mask)) {
				continue outer;
			}
			return true;
		}
	}
	return false;
}

socket.on("message", (buffer, rinfo) => {
	let address = rinfo.address;
	if (!isAddressLocal(address)) {
		console.log(`Unexpected DNS packet from ${address}!`);
		return;
	}
	try {
		let packet = parsePacket(buffer);
		notifyObservers(packet);
	} catch (error) {
		console.log(`Expected a valid DNS packet!`);
	}
});

socket.bind(MDNS_PORT);

// TODO: Encode labels properly.
export function sendDiscoveryPacket(host: string): void {
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
