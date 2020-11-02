import * as libfs from "fs";

function readBuffer(fd: number, offset: number, buffer: Buffer): number {
	let bytes = libfs.readSync(fd, buffer, 0, buffer.length, offset);
	if (bytes !== buffer.length) {
		throw `Expected to read ${buffer.length} bytes but read ${bytes}!`;
	}
	return offset + bytes;
}

enum Markers {
	START_OF_IMAGE = 0xFFD8,
	END_OF_IMAGE = 0xFFD9,
	APPLICATION_0 = 0xFFE0,
	START_OF_SCAN = 0xFFDA,
	START_OF_FRAME_0 = 0xFFC0,
	DEFINE_QUANTIZATION_TABLE = 0xFFDB,
	DEFINE_HUFFMAN_TABLE = 0xFFC4,
}

const marker = Buffer.alloc(2);
const length = Buffer.alloc(2);

function parseStartOfImage(fd: number, offset: number): number {
	offset = readBuffer(fd, offset, marker);
	if (marker.readUInt16BE(0) !== Markers.START_OF_IMAGE) {
		throw ``;
	}
	return offset;
}

function parseApplicationJfif(fd: number, offset: number): number {
	offset = readBuffer(fd, offset, marker);
	if (marker.readUInt16BE(0) !== Markers.APPLICATION_0) {
		throw ``;
	}
	offset = readBuffer(fd, offset, length);
	let data = Buffer.alloc(length.readUInt16BE(0) - 2);
	offset = readBuffer(fd, offset, data);
	let identifier = data.slice(0, 5).toString();
	if (identifier !== "JFIF\0") {
		throw ``;
	}
	let major = data.readUInt8(5);
	if (major !== 1) {
		throw ``;
	}
	let minor = data.readUInt8(6);
	if (minor !== 2) {
		throw ``;
	}
	let units = data.readUInt8(7);
	if (units !== 0 && units !== 1 && units !== 2) {
		throw ``;
	}
	let x = data.readUInt16BE(8);
	if (x === 0) {
		throw ``;
	}
	let y = data.readUInt16BE(10);
	if (y === 0) {
		throw ``;
	}
	let w = data.readUInt8(12);
	let h = data.readUInt8(13);
	if (w * h * 3 !== data.length - 14) {
		throw ``;
	}
	return offset;
}

type ProbeResult = {
	width: number,
	height: number
};

export function probe(fd: number): ProbeResult {
	let offset = 0;
	offset = parseStartOfImage(fd, offset);
	offset = parseApplicationJfif(fd, offset);
	while (true) {
		offset = readBuffer(fd, offset, marker);
		if (marker.readUInt16BE(0) === Markers.START_OF_FRAME_0) {
			offset = readBuffer(fd, offset, length);
			let data = Buffer.alloc(length.readUInt16BE(0) - 2);
			offset = readBuffer(fd, offset, data);
			let precision = data.readUInt8(0);
			let height = data.readUInt16BE(1);
			let width = data.readUInt16BE(3);
			let component_count = data.readUInt8(5);
			for (let i = 0; i < component_count; i++) {
				let component_id = data.readUInt8(6 + i * 3 + 0);
				let component_sampling_factors = data.readUInt8(6 + i * 3 + 1);
				let component_quantization_table = data.readUInt8(6 + i * 3 + 2);
			}
			return {
				width,
				height
			};
		} else {
			offset = readBuffer(fd, offset, length);
			offset += length.readUInt16BE(0) - 2;
		}
	}
};
