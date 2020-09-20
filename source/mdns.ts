import * as libdgram from 'dgram';

interface Observer {
	(host: string): void;
}

let rcache: Record<string, string> = {};
let observers: Record<string, Array<Observer>> = {};

let notify_observers = (key: string, value: string): void => {
	let obs = observers[key];
	if (obs !== undefined) {
		for (let observer of obs) {
			observer(value);
		}
	}
	let newkey = rcache[key];
	if (newkey !== undefined) {
		notify_observers(newkey, value);
	}
};

let add_cache_entry = (key: string, value: string, type: string): void => {
	rcache[value] = key;
	if (type === 'A') {
		notify_observers(key, value);
	}
};

let parse_name = async (buffer: Buffer, offset: number): Promise<{ value: string, offset: number }> => {
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
			labels.push(label.toString('binary'));
			continue;
		}
		if (length < 192) {
			throw new Error();
		}
		let name = await parse_name(buffer, buffer.readUInt16BE(offset) & 0x3FFF);
		labels.push(name.value);
		offset += 2;
		break;
	}
	return {
		value: labels.join('.'),
		offset: offset
	};
};

let parse_question = async (buffer: Buffer, offset: number): Promise<{ value: string, offset: number }> => {
	let name = await parse_name(buffer, offset);
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

let parse_record = async (buffer: Buffer, offset: number): Promise<{ name: string, data: string, offset: number }> => {
	let name = await parse_name(buffer, offset);
	offset = name.offset;
	let type = buffer.readUInt16BE(offset);
	offset += 2;
	let cls = buffer.readUInt16BE(offset);
	offset += 2;
	let ttl = buffer.readUInt32BE(offset);
	offset += 4;
	let length = buffer.readUInt16BE(offset);
	offset += 2;
	let data = '';
	if (type === 1) {
		data = `${buffer[offset+0]}.${buffer[offset+1]}.${buffer[offset+2]}.${buffer[offset+3]}`;
		offset += 4;
		add_cache_entry(name.value, data, 'A');
	}
	if (type === 12) {
		let dname = await parse_name(buffer, offset);
		offset = dname.offset;
		data = dname.value;
		add_cache_entry(name.value, data, 'PTR');
	}
	if (type === 16) {
		let raw = buffer.slice(offset, offset + length);
		offset += length;
		data = raw.toString('binary');
	}
	if (type === 33) {
		let priority = buffer.readUInt16BE(offset);
		offset += 2;
		let weight = buffer.readUInt16BE(offset);
		offset += 2;
		let port = buffer.readUInt16BE(offset);
		offset += 2;
		let dname = await parse_name(buffer, offset);
		offset = dname.offset;
		data = dname.value;
		add_cache_entry(name.value, data, 'SRV');
	}
	return {
		name: name.value,
		data: data,
		offset: offset
	};
};

let parse_mdns = async (buffer: Buffer): Promise<void> => {
	let offset = 0;
	let header = buffer.slice(offset, offset + 12);
	offset += 12;
	let id = header.readUInt16BE(0);
	let flags = header.readUInt16BE(2);
	let qdcount = header.readUInt16BE(4);
	let ancount = header.readUInt16BE(6);
	let nscount = header.readUInt16BE(8);
	let arcount = header.readUInt16BE(10);
	let questions = new Array<{ value: string, offset: number }>();
	for (let i = 0; i < qdcount; i++) {
		let result = await parse_question(buffer, offset);
		questions.push(result);
		offset = result.offset;
	}
	let answers = new Array<{ name: string, data: string, offset: number } >();
	for (let i = 0; i < ancount; i++) {
		let result = await parse_record(buffer, offset);
		answers.push(result);
		offset = result.offset;
	}
	let authorities = new Array<{ name: string, data: string, offset: number } >();
	for (let i = 0; i < nscount; i++) {
		let result = await parse_record(buffer, offset);
		authorities.push(result);
		offset = result.offset;
	}
	let additionals = new Array<{ name: string, data: string, offset: number } >();
	for (let i = 0; i < arcount; i++) {
		let result = await parse_record(buffer, offset);
		additionals.push(result);
		offset = result.offset;
	}
	//console.log(JSON.stringify(rcache, null, "\t"));
};

const MDNS_ADDRESS = '224.0.0.251';
const MDNS_PORT = 5353;

let socket = libdgram.createSocket({ type: 'udp4', reuseAddr: true });

socket.on('listening', () => {
	socket.setMulticastLoopback(false);
	socket.addMembership(MDNS_ADDRESS, '0.0.0.0');
});

socket.on('message', async (buffer, rinfo) => {
	//console.log(`Received ${buffer.length} bytes from ${rinfo.address}:${rinfo.port}.`);
	try {
		await parse_mdns(buffer);
	} catch (error) {
		console.log(error);
	}
});

socket.bind(MDNS_PORT);

export let discover = (host: string): void => {
	let header = Buffer.alloc(12);
	header.writeUInt16BE(1, 4);
	let body = Buffer.alloc(1000);
	let offset = 0;
	let labels = host.split('.').forEach(a => {
		if (a.length >= 64) {
			throw new Error();
		}
		body.writeUInt8(a.length, offset); offset += 1;
		body.write(a, offset); offset += a.length;
	});
	body.writeUInt8(0, offset); offset += 1;
	body.writeUInt16BE(12, offset); offset += 2;
	body.writeUInt16BE(1, offset); offset += 2;
	body = body.slice(0, 0 + offset);
	console.log("Sending discover packet!");
	socket.send(Buffer.concat([header, body]), MDNS_PORT, MDNS_ADDRESS);
};

interface Cancellable {
	cancel(): void;
}

// TODO: Only notify with responses to specific host.
export let observe = (host: string, observer: Observer): Cancellable => {
	let obs = observers[host];
	if (obs === undefined) {
		obs = new Array<Observer>();
		observers[host] = obs;
	}
	obs.push(observer);
	discover(host);
	return {
		cancel(): void {
			let index = obs.lastIndexOf(observer);
			obs = obs.slice(index, 1);
		}
	};
};
