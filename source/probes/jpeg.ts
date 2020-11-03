import * as libfs from "fs";

namespace readers {
	export class Binary {
		private fd: number;
		private offset: number;

		private read(buffer: Buffer): Buffer {
			let bytes = libfs.readSync(this.fd, buffer, 0, buffer.length, this.offset);
			if (bytes !== buffer.length) {
				throw `Expected to read ${buffer.length} bytes but read ${bytes}!`;
			}
			this.offset += bytes;
			return buffer;
		}

		private skip(length: number): void {
			this.offset += length;
		}

		constructor(path: Array<string>) {
			this.fd = libfs.openSync(path.join("/"), "r");
			this.offset = 0;
		}

		newContext<A>(context: (read: (buffer: Buffer) => Buffer, skip: (length: number) => void) => A): A {
			let offset = this.offset;
			try {
				return context((buffer) => this.read(buffer), (length) => this.skip(length));
			} catch (error) {
				this.offset = offset;
				throw error;
			}
		}
	};
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

type StartOfImage = {

};

function parseStartOfImage(data: Buffer): StartOfImage {
	return {};
}

type Application0 = {
	major: number,
	minor: number,
	units: number,
	x: number,
	y: number,
	w: number,
	h: number,
	preview: Buffer
};

function parseApplication0(data: Buffer): Application0 {
	let offset = 0;
	let identifier = data.slice(offset, 5); offset += 5;
	if (identifier.toString() !== "JFIF\0") {
		throw `Expected a JFIF tag!`;
	}
	let major = data.readUInt8(offset); offset += 1;
	let minor = data.readUInt8(offset); offset += 1;
	let units = data.readUInt8(offset); offset += 1;
	if ((units !== 0) && (units !== 1) && (units !== 2)) {
		throw `Expected a valid density unit!`;
	}
	let x = data.readUInt16BE(offset); offset += 2;
	if (x === 0) {
		throw `Expected a non-zero horisontal resolution!`;
	}
	let y = data.readUInt16BE(offset); offset += 2;
	if (y === 0) {
		throw `Expected a non-zero vertical resolution!`;
	}
	let w = data.readUInt8(offset); offset += 1;
	let h = data.readUInt8(offset); offset += 1;
	let preview = data.slice(offset, offset + w * h * 3); offset += w * h * 3;
	if (preview.length !== w * h * 3) {
		throw `Expected a valid thumbnail!`;
	}
	return {
		major,
		minor,
		units,
		x,
		y,
		w,
		h,
		preview
	};
}

type StartOfFrame0 = {
	precision: number,
	height: number,
	width: number,
	component_count: number,
	components: {
		id: number,
		sampling_factors: number,
		quantization_table: number
	}[]
};

function parseStartOfFrame0(data: Buffer): StartOfFrame0 {
	let offset = 0;
	let precision = data.readUInt8(offset); offset += 1;
	let height = data.readUInt16BE(offset); offset += 2;
	let width = data.readUInt16BE(offset); offset += 2;
	let component_count = data.readUInt8(offset); offset += 1;
	let components = [...Array(component_count).keys()].map(() => {
		let id = data.readUInt8(offset); offset += 1;
		let sampling_factors = data.readUInt8(offset); offset += 1;
		let quantization_table = data.readUInt8(offset); offset += 1;
		return {
			id,
			sampling_factors,
			quantization_table
		};
	});
	return {
		precision,
		height,
		width,
		component_count,
		components
	};
}

type ProbeResult = {
	width: number,
	height: number
};

export function probe(reader: readers.Binary): ProbeResult {
	return reader.newContext((read, skip) => {
		let marker = Buffer.alloc(2);
		let length = Buffer.alloc(2);
		read(marker);
		if (marker.readUInt16BE() !== Markers.START_OF_IMAGE) {
			throw `Expected SOI marker!`;
		}
		parseStartOfImage(Buffer.alloc(0));
		read(marker);
		if (marker.readUInt16BE() !== Markers.APPLICATION_0) {
			throw `Expected APP0 marker!`;
		}
		read(length);
		parseApplication0(read(Buffer.alloc(length.readUInt16BE() - 2)));
		while (true) {
			read(marker);
			read(length);
			if (marker.readUInt16BE() === Markers.START_OF_FRAME_0) {
				let sof = parseStartOfFrame0(read(Buffer.alloc(length.readUInt16BE() - 2)));
				return {
					width: sof.width,
					height: sof.height
				};
			} else {
				skip(length.readUInt16BE() - 2);
			}
		}
	});
};
