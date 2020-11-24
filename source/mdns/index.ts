import * as libdgram from "dgram";
import * as is from "../is";

const DEBUG = false;
const MDNS_ADDRESS = "224.0.0.251";
const MDNS_PORT = 5353;

interface Observer {
	(host: string): void;
}

type CacheEntry = {
	type: string,
	data: string
};

let cache = new Map<string, CacheEntry | undefined>();
let map = new Map<string, Set<Observer> | undefined>();

function addCacheEntry(key: string, entry: CacheEntry): void {
	if (DEBUG) {
		console.log(`Adding cache entry:`, key, entry);
	}
	cache.set(key, entry);
};

function lookupCacheEntry(host: string): string | undefined {
	let entry = cache.get(host);
	if (is.present(entry)) {
		if (entry.type === "A") {
			return entry.data;
		} else {
			return lookupCacheEntry(entry.data);
		}
	}
}

function notifyObservers(host: string): void {
	let observers = map.get(host);
	if (is.present(observers)) {
		let value = lookupCacheEntry(host);
		if (is.present(value)) {
			for (let observer of observers) {
				observer(value);
			}
		}
	}
};

async function parseName(buffer: Buffer, offset: number): Promise<{ value: string, offset: number }> {
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
		let name = await parseName(buffer, buffer.readUInt16BE(offset) & 0x3FFF);
		labels.push(name.value);
		offset += 2;
		break;
	}
	return {
		value: labels.join("."),
		offset: offset
	};
};

type Question = {
	value: string,
	offset: number
};

async function parseQuestion(buffer: Buffer, offset: number): Promise<Question> {
	let name = await parseName(buffer, offset);
	offset = name.offset;
	let type = buffer.readUInt16BE(offset);
	offset += 2;
	let cls = buffer.readUInt16BE(offset);
	offset += 2;
	return {
		value: name.value,
		offset: offset
	};
};

type Record = {
	name: string,
	data: string,
	offset: number
};

async function parseRecord(buffer: Buffer, offset: number): Promise<Record> {
	let name = await parseName(buffer, offset);
	offset = name.offset;
	let type = buffer.readUInt16BE(offset);
	offset += 2;
	let cls = buffer.readUInt16BE(offset);
	offset += 2;
	let ttl = buffer.readUInt32BE(offset);
	offset += 4;
	let length = buffer.readUInt16BE(offset);
	offset += 2;
	let data = "";
	if (type === 1) {
		data = `${buffer[offset+0]}.${buffer[offset+1]}.${buffer[offset+2]}.${buffer[offset+3]}`;
		offset += 4;
		addCacheEntry(name.value, { type: "A", data: data });
	} else if (type === 12) {
		let dname = await parseName(buffer, offset);
		offset = dname.offset;
		data = dname.value;
		addCacheEntry(name.value, { type: "PTR", data: data });
	} else if (type === 16) {
		let raw = buffer.slice(offset, offset + length);
		offset += length;
		data = raw.toString("binary");
	} else if (type === 33) {
		let priority = buffer.readUInt16BE(offset);
		offset += 2;
		let weight = buffer.readUInt16BE(offset);
		offset += 2;
		let port = buffer.readUInt16BE(offset);
		offset += 2;
		let dname = await parseName(buffer, offset);
		offset = dname.offset;
		data = dname.value;
		addCacheEntry(name.value, { type: "SRV", data: data });
	} else {
		if (DEBUG) {
			console.log(`Unknown DNS answer type ${type}! Skipping ${length} bytes...`, name);
		}
		offset += length;
	}
	return {
		name: name.value,
		data: data,
		offset: offset
	};
};

type Packet = {
	questions: Array<Question>,
	answers: Array<Record>,
	authorities: Array<Record>,
	additionals: Array<Record>
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
	let answers = new Array<Record>();
	for (let i = 0; i < ancount; i++) {
		let result = await parseRecord(buffer, offset);
		answers.push(result);
		offset = result.offset;
	}
	let authorities = new Array<Record>();
	for (let i = 0; i < nscount; i++) {
		let result = await parseRecord(buffer, offset);
		authorities.push(result);
		offset = result.offset;
	}
	let additionals = new Array<Record>();
	for (let i = 0; i < arcount; i++) {
		let result = await parseRecord(buffer, offset);
		additionals.push(result);
		offset = result.offset;
	}
	return {
		questions,
		answers,
		authorities,
		additionals
	};
};

const socket = libdgram.createSocket({ type: "udp4", reuseAddr: true });

socket.on("listening", () => {
	socket.setMulticastLoopback(false);
	socket.addMembership(MDNS_ADDRESS, "0.0.0.0");
});

socket.on("message", async (buffer, rinfo) => {
	try {
		let packet = await parsePacket(buffer);
		for (let answer of packet.answers) {
			notifyObservers(answer.name);
		}
	} catch (error) {
		if (DEBUG) {
			console.log(`Expected a valid DNS packet!`);
			console.log(error);
		}
	}
});

socket.bind(MDNS_PORT);

// TODO: Encode labels properly.
function sendDiscoveryPacket(host: string): void {
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
