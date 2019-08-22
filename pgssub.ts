import * as libcp from 'child_process';
import * as libcrypto from 'crypto';
import * as libfs from 'fs';
import * as libpath from 'path';

function log(message: any): void {
	console.log(message);
}

function parse_palette_block(chunk: { buffer: Buffer, offset: number }): void {
	let index = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let y = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let cr = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let cb = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let alpha = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	log({ index, y, cr, cb, alpha });
}

function parse_palette(chunk: { buffer: Buffer, offset: number }): void {
	chunk.offset += 2;
	let count = (chunk.buffer.length - 2) / 5;
	for (let i = 0; i < count; i++) {
		parse_palette_block(chunk);
	}
}

function parse_bitmap(chunk: { buffer: Buffer, offset: number }): void {
	chunk.offset += 7;
	let w = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let h = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	log({ w, h });
	let bmp = Buffer.alloc(w * h);
	let x = 0;
	let y = 0;
	while ((x < w) && (y < h)) {
		let index = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
		let count = 1;
		if (index === 0) {
			let b1 = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
			let fa = ((b1 & 0x80) >> 7);
			let fb = ((b1 & 0x40) >> 6);
			if (fb === 0) {
				count = ((b1 & 0x3F) >> 0);
				if (count === 0) {
					count = w - x;
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
			bmp.writeUInt8(index, (y * w) + x); x += 1;
			if (x >= w) {
				x = 0;
				y += 1;
			}
		}
	}
	libfs.writeFileSync('../temp/test.raw', bmp);
}

function parse_times_block(chunk: { buffer: Buffer, offset: number }): void {
	chunk.offset += 3;
	let forced = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let x = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let y = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	log({ forced, x, y });
}

function parse_times(chunk: { buffer: Buffer, offset: number }): void {
	let w = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let h = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let frame_rate = chunk.buffer.readInt8(chunk.offset); chunk.offset += 1;
	let index = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	chunk.offset += 3;
	let count = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	log({ w, h, frame_rate, index, count });
	for (let i = 0; i < count; i++) {
		parse_times_block(chunk);
	}
}

function parse_size_block(chunk: { buffer: Buffer, offset: number }): void {
	let id = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
	let x = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let y = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let w = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	let h = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
	log({ id, x, y, w, h });
}

function parse_size(chunk: { buffer: Buffer, offset: number }): void {
	let count = chunk.buffer.readInt8(chunk.offset); chunk.offset += 1;
	log({ count });
	for (let i = 0; i < count; i++) {
		parse_size_block(chunk);
	}
}

function parse_end(chunk: { buffer: Buffer, offset: number }): void {

}

function parse_pgssub(chunk: { buffer: Buffer, offset: number }): void {
	while (true) {
		let type = chunk.buffer.readUInt8(chunk.offset); chunk.offset += 1;
		let size = chunk.buffer.readUInt16BE(chunk.offset); chunk.offset += 2;
		let data = chunk.buffer.slice(chunk.offset, chunk.offset + size); chunk.offset += size;
		log({ type, size });
		if (false) {
		} else if (type === 0x14) {
			parse_palette({ buffer: data, offset: 0 });
		} else if (type === 0x15) {
			parse_bitmap({ buffer: data, offset: 0 });
		} else if (type === 0x16) {
			parse_times({ buffer: data, offset: 0 });
		} else if (type === 0x17) {
			parse_size({ buffer: data, offset: 0 });
		} else if (type === 0x80) {
			parse_end({ buffer: data, offset: 0 });
			break;
		} else {
			throw new Error(``);
		}
	}
}

parse_pgssub({ buffer: libfs.readFileSync(process.argv[2]), offset: 0 });
