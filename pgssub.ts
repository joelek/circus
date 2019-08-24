import * as bmp from './bmp';
import * as libfs from 'fs';

function log(message: any): void {
	console.log(message);
}

type PaletteEntry = {
	index: number;
	y: number;
	u: number;
	v: number;
	o: number;
};

function parse_palette_block(chunk: { buffer: Buffer, offset: number }): PaletteEntry {
	let index = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let y = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let u = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let v = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let o = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	return {
		index,
		y,
		u,
		v,
		o
	};
}

type Palette = {
	entries: Array<PaletteEntry>;
};

function parse_palette(chunk: { buffer: Buffer, offset: number }): Palette {
	chunk.offset += 2;
	let count = (chunk.buffer.length - 2) / 5;
	let entries = new Array<PaletteEntry>(count);
	for (let i = 0; i < count; i++) {
		entries[i] = parse_palette_block(chunk);
	}
	return {
		entries
	};
}

type Bitmap = {
	w: number,
	h: number,
	buffer: Buffer
};

function parse_bitmap(chunk: { buffer: Buffer, offset: number }): Bitmap {
	chunk.offset += 7;
	let w = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let h = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let buffer = Buffer.alloc(w * h);
	let x = 0;
	let y = 0;
	while (y < h) {
		let index = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
		let count = 1;
		if (index === 0) {
			let b1 = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
			let fa = ((b1 & 0x80) >> 7);
			let fb = ((b1 & 0x40) >> 6);
			if (fb === 0) {
				count = ((b1 & 0x3F) >> 0);
				if (count === 0) {
					x = 0;
					y += 1;
				}
			} else {
				let b2 = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
				count = ((b1 & 0x3F) << 8) | b2;
			}
			if (fa === 0) {
				index = 0;
			} else {
				index = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
			}
		}
		for (let i = 0; i < count; i++) {
			buffer.writeUInt8(index, (y * w) + x); x += 1;
		}
	}
	return {
		w,
		h,
		buffer
	};
}

type TimesEntry = {
	x: number;
	y: number;
};

function parse_times_block(chunk: { buffer: Buffer, offset: number }): TimesEntry {
	chunk.offset += 4;
	let x = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let y = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	return {
		x,
		y
	};
}

type Times = {
	w: number;
	h: number;
	index: number;
	entries: Array<TimesEntry>;
};

function parse_times(chunk: { buffer: Buffer, offset: number }): Times {
	let w = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let h = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	chunk.offset += 1;
	let index = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	chunk.offset += 3;
	let count = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let entries = new Array<TimesEntry>(count);
	for (let i = 0; i < count; i++) {
		entries[i] = parse_times_block(chunk);
	}
	return {
		w,
		h,
		index,
		entries
	};
}

type SizeEntry = {
	id: number,
	x: number,
	y: number,
	w: number,
	h: number
};

function parse_size_block(chunk: { buffer: Buffer, offset: number }): SizeEntry {
	let id = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let x = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let y = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let w = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let h = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	return {
		id,
		x,
		y,
		w,
		h
	};
}

type Size = {
	entries: Array<SizeEntry>;
};

function parse_size(chunk: { buffer: Buffer, offset: number }): Size {
	let count = chunk.buffer.readInt8(chunk.offset); chunk.offset += 1;
	let entries = new Array<SizeEntry>(count);
	for (let i = 0; i < count; i++) {
		entries[i] = parse_size_block(chunk);
	}
	return {
		entries
	};
}

function parse_end(chunk: { buffer: Buffer, offset: number }): void {

}

function parse_pgssub(chunk: { buffer: Buffer, offset: number }): bmp.Bitmap {
	let palette = Buffer.alloc(256 * 4);
	for (let i = 0; i < 256; i++) {
		palette.writeUInt8(16, (i * 4) + 0);
		palette.writeUInt8(0, (i * 4) + 1);
		palette.writeUInt8(0, (i * 4) + 2);
		palette.writeUInt8(255, (i * 4) + 3);
	}
	let bitmaps = new Array<Bitmap>(0);
	let times = new Array<Times>(0);
	let sizes = new Array<Size>(0);
	while (true) {
		let type = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
		let size = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
		let data = chunk.buffer.slice(chunk.offset, chunk.offset + size); chunk.offset += size;
		if (false) {
		} else if (type === 0x14) {
			let custom_palette = parse_palette({ buffer: data, offset: 0 });
			for (let i = 0; i < custom_palette.entries.length; i++) {
				let entry = custom_palette.entries[i];
				palette.writeUInt8(entry.y, (entry.index * 4) + 0);
				palette.writeUInt8(entry.u, (entry.index * 4) + 1);
				palette.writeUInt8(entry.v, (entry.index * 4) + 2);
				palette.writeUInt8(entry.o, (entry.index * 4) + 3);
			}
		} else if (type === 0x15) {
			bitmaps.push(parse_bitmap({ buffer: data, offset: 0 }));
		} else if (type === 0x16) {
			times.push(parse_times({ buffer: data, offset: 0 }));
		} else if (type === 0x17) {
			sizes.push(parse_size({ buffer: data, offset: 0 }));
		} else if (type === 0x80) {
			parse_end({ buffer: data, offset: 0 });
			break;
		} else {
			throw new Error(``);
		}
	}
	let w = 1920;
	let h = 1080;
	let buffer = Buffer.alloc(w * h);
	buffer.fill(255);
	for (let i = 0; i < bitmaps.length; i++) {
		let bitmap = bitmaps[i];
		let size = sizes[0].entries[0];
		if (size) {
			for (let y = 0; y < bitmap.h; y++) {
				bitmap.buffer.copy(buffer, ((size.y + y) * w) + size.x, (y * size.w), (y * size.w) + size.w);
			}
		}
	}
	return {
		w,
		h,
		buffer,
		palette
	};
}

let image = parse_pgssub({ buffer: libfs.readFileSync(process.argv[2]), offset: 0 });
for (let i = 0; i < 256; i++) {
	let y = image.palette.readUInt8((i * 4) + 0);
	let u = image.palette.readUInt8((i * 4) + 1);
	let v = image.palette.readUInt8((i * 4) + 2);
	let o = image.palette.readUInt8((i * 4) + 3);
	let k = ((y - 16) / (235 - 16) * o) | 0;
	o = 255;
	image.palette.writeUInt8(k, (i * 4) + 0);
	image.palette.writeUInt8(k, (i * 4) + 1);
	image.palette.writeUInt8(k, (i * 4) + 2);
	image.palette.writeUInt8(o, (i * 4) + 3);
}
let writable = libfs.createWriteStream('../temp/test.bmp', { encoding: 'binary' });
bmp.write_to(image, writable);
