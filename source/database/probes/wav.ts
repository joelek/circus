import * as libfs from "fs";
import * as schema from "./schema";

type Section = {
	offset: number;
	length: number;
};

class RIFFChunk {
	readonly fd: number;
	readonly type: string;
	readonly body: Section;

	constructor(fd: number, type: string, body: Section) {
		this.fd = fd;
		this.type = type;
		this.body = body;
	}

	static parse(fd: number, section: Section): RIFFChunk {
		let offset = section.offset;
		let buffer = Buffer.alloc(8);
		if (libfs.readSync(fd, buffer, 0, buffer.length, offset) !== buffer.length) {
			throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
		}
		offset += buffer.length;
		let type = buffer.subarray(0, 4).toString("ascii");
		let length = buffer.readUInt32LE(4);
		if (length > section.length) {
			throw new Error(`Expected a length of at most ${section.length} bytes, got ${length}!`);
		}
		return new RIFFChunk(fd, type, {
			offset,
			length
		});
	}
};

export function probe(fd: number): schema.Probe {
	let result: schema.Probe = {
		resources: []
	};
	let root_chunk = RIFFChunk.parse(fd, {
		offset: 0,
		length: libfs.fstatSync(fd).size
	});
	if (root_chunk.type !== "RIFF") {
		throw new Error(`Expected a "RIFF" chunk, got "${root_chunk.type}"!`);
	}
	let body_type = Buffer.alloc(4);
	if (libfs.readSync(fd, body_type, 0, body_type.length, root_chunk.body.offset) !== body_type.length) {
		throw new Error(`Expected to read exactly ${body_type.length} bytes!`);
	}
	if (body_type.subarray(0, 4).toString("ascii") !== "WAVE") {
		throw new Error(`Expected a "WAVE" chunk list!`);
	}
	let format_chunk = RIFFChunk.parse(fd, {
		offset: root_chunk.body.offset + 4,
		length: root_chunk.body.length - 4
	});
	if (format_chunk.type !== "fmt ") {
		throw new Error(`Expected a "fmt " chunk, got "${format_chunk.type}"!`);
	}
	let data_chunk = RIFFChunk.parse(fd, {
		offset: format_chunk.body.offset + format_chunk.body.length,
		length: root_chunk.body.length - (format_chunk.body.offset + format_chunk.body.length)
	});
	if (data_chunk.type !== "data") {
		throw new Error(`Expected a "data" chunk, got "${data_chunk.type}"!`);
	}
	let format = Buffer.alloc(16);
	if (libfs.readSync(fd, format, 0, format.length, format_chunk.body.offset) !== format.length) {
		throw new Error(`Expected to read exactly ${format.length} bytes!`);
	}
	let audio_format = format.readUint16LE(0);
	if (audio_format !== 1) {
		throw new Error(`Expected linear PCM audio format!`);
	}
	let number_of_channels = format.readUint16LE(2);
	let sample_rate = format.readUint32LE(4);
	let byte_rate = format.readUint32LE(8);
	let block_align = format.readUint16LE(12);
	let bits_per_sample = format.readUint16LE(14);
	let duration_ms = Math.ceil(data_chunk.body.length * 1000 / byte_rate);
	result.resources.push({
		type: "audio",
		duration_ms
	});
	return result;
};
