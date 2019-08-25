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
		palette.writeUInt8(0, (i * 4) + 3);
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

function trim_transparent_region(bitmap: bmp.Bitmap): bmp.Bitmap {
	let y0 = 0;
	outer: for (; y0 < bitmap.h; y0++) {
		inner: for (let x = 0; x < bitmap.w; x++) {
			let k = bitmap.buffer.readUInt8((y0 * bitmap.w) + x);
			if (bitmap.palette.readUInt8((k * 4) + 3) > 0) {
				break outer;
			}
		}
	}
	let y1 = bitmap.h - 1;
	outer: for (; y1 > y0; y1--) {
		inner: for (let x = 0; x < bitmap.w; x++) {
			let k = bitmap.buffer.readUInt8((y1 * bitmap.w) + x);
			if (bitmap.palette.readUInt8((k * 4) + 3) > 0) {
				break outer;
			}
		}
	}
	let x0 = 0;
	outer: for (; x0 < bitmap.w; x0++) {
		inner: for (let y = 0; y < bitmap.h; y++) {
			let k = bitmap.buffer.readUInt8((y * bitmap.w) + x0);
			if (bitmap.palette.readUInt8((k * 4) + 3) > 0) {
				break outer;
			}
		}
	}
	let x1 = bitmap.w - 1;
	outer: for (; x1 > x0; x1--) {
		inner: for (let y = 0; y < bitmap.h; y++) {
			let k = bitmap.buffer.readUInt8((y * bitmap.w) + x1);
			if (bitmap.palette.readUInt8((k * 4) + 3) > 0) {
				break outer;
			}
		}
	}
	let w = x1 - x0;
	let h = y1 - y0;
	let buffer = Buffer.alloc(w * h);
	for (let y = 0; y < h; y++) {
		bitmap.buffer.copy(buffer, (y * w), ((y0 + y) * bitmap.w) + x0, ((y0 + y) * bitmap.w) + x1);
	}
	return {
		...bitmap,
		w,
		h,
		buffer
	};
}

function convert_to_brightness(bitmap: bmp.Bitmap): bmp.Bitmap {
	let palette = Buffer.alloc(256 * 4);
	for (let i = 0; i < 256; i++) {
		let y = bitmap.palette.readUInt8((i * 4) + 0);
		let o = bitmap.palette.readUInt8((i * 4) + 3);
		let b = ((Math.max(16, Math.min(y, 235)) - 16) / (235 - 16) * 255) | 0;
		palette.writeUInt8(b, (i * 4) + 0);
		palette.writeUInt8(b, (i * 4) + 1);
		palette.writeUInt8(b, (i * 4) + 2);
		palette.writeUInt8(o, (i * 4) + 3);
	}
	return {
		...bitmap,
		palette
	};
}

function blend_onto_black_background(bitmap: bmp.Bitmap): bmp.Bitmap {
	let palette = Buffer.alloc(256 * 4);
	for (let i = 0; i < 256; i++) {
		let r = bitmap.palette.readUInt8((i * 4) + 0);
		let g = bitmap.palette.readUInt8((i * 4) + 1);
		let b = bitmap.palette.readUInt8((i * 4) + 2);
		let o = bitmap.palette.readUInt8((i * 4) + 3);
		r = (r * (o / 255)) | 0;
		g = (g * (o / 255)) | 0;
		b = (b * (o / 255)) | 0;
		o = 255;
		palette.writeUInt8(r, (i * 4) + 0);
		palette.writeUInt8(g, (i * 4) + 1);
		palette.writeUInt8(b, (i * 4) + 2);
		palette.writeUInt8(o, (i * 4) + 3);
	}
	return {
		...bitmap,
		palette
	};
}

function invert_colors(bitmap: bmp.Bitmap): bmp.Bitmap {
	let palette = Buffer.alloc(256 * 4);
	for (let i = 0; i < 256; i++) {
		let r = bitmap.palette.readUInt8((i * 4) + 0);
		let g = bitmap.palette.readUInt8((i * 4) + 1);
		let b = bitmap.palette.readUInt8((i * 4) + 2);
		let o = bitmap.palette.readUInt8((i * 4) + 3);
		r = 255 - r;
		g = 255 - g;
		b = 255 - b;
		palette.writeUInt8(r, (i * 4) + 0);
		palette.writeUInt8(g, (i * 4) + 1);
		palette.writeUInt8(b, (i * 4) + 2);
		palette.writeUInt8(o, (i * 4) + 3);
	}
	return {
		...bitmap,
		palette
	};
}

let bitmap = parse_pgssub({ buffer: libfs.readFileSync(process.argv[2]), offset: 0 });
bitmap = trim_transparent_region(bitmap);
bitmap = convert_to_brightness(bitmap);
bitmap = blend_onto_black_background(bitmap);
bitmap = invert_colors(bitmap);
let writable = libfs.createWriteStream('../temp/test.bmp');
bmp.write_to(bitmap, writable);
