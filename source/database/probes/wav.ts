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
		if (length > section.length - buffer.length) {
			throw new Error(`Expected a length of at most ${section.length - buffer.length} bytes, got ${length}!`);
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
	let file_size = libfs.fstatSync(fd).size;
	let root_chunk = RIFFChunk.parse(fd, {
		offset: 0,
		length: file_size
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
	let section: Section = {
		offset: root_chunk.body.offset + 4,
		length: root_chunk.body.length - 4
	};
	let chunks: Array<RIFFChunk> = [];
	while (true) {
		try {
			let chunk = RIFFChunk.parse(fd, section);
			chunks.push(chunk);
			section.offset += 8 + chunk.body.length;
			section.length -= 8 + chunk.body.length;
		} catch (error) {
			break;
		}
	}
	let format_chunk = chunks.find((chunk) => chunk.type === "fmt ");
	if (format_chunk == null) {
		throw new Error(`Expected a "fmt " chunk!`);
	}
	let data_chunk = chunks.find((chunk) => chunk.type === "data");
	if (data_chunk == null) {
		throw new Error(`Expected a "data" chunk!`);
	}
	let format = Buffer.alloc(16);
	if (libfs.readSync(fd, format, 0, format.length, format_chunk.body.offset) !== format.length) {
		throw new Error(`Expected to read exactly ${format.length} bytes!`);
	}
	let audio_format = format.readUint16LE(0);
	if (audio_format !== 1) {
		throw new Error(`Expected linear PCM audio format!`);
	}
	let channel_count = format.readUint16LE(2);
	let sample_rate_hz = format.readUint32LE(4);
	let byte_rate = format.readUint32LE(8);
	let block_align = format.readUint16LE(12);
	let bits_per_sample = format.readUint16LE(14);
	let duration_ms = Math.ceil(data_chunk.body.length * 1000 / byte_rate);
	result.resources.push({
		type: "audio",
		duration_ms,
		sample_rate_hz,
		channel_count,
		bits_per_sample
	});
	return result;
};
