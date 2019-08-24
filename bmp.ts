import * as libstream from "stream";

function write_to(image: { w: number, h: number, indices: Buffer, palette: Buffer }, writable: libstream.Writable): void {
	let stride = (((image.w + 3) >> 2) << 2);
	let bmp_header = Buffer.alloc(14);
	bmp_header.set(Buffer.from('BM', 'binary'), 0);
	bmp_header.writeUInt32LE(14 + 40 + 256 * 4 + (stride * image.h), 2);
	bmp_header.writeUInt16LE(0, 6);
	bmp_header.writeUInt16LE(0, 8);
	bmp_header.writeUInt32LE(14 + 40 + 256 * 4, 10);
	writable.write(bmp_header);
	let dib_header = Buffer.alloc(40);
	dib_header.writeUInt32LE(40, 0);
	dib_header.writeUInt32LE(image.w, 4);
	dib_header.writeUInt32LE(image.h, 8);
	dib_header.writeUInt16LE(1, 12);
	dib_header.writeUInt16LE(8, 14);
	dib_header.writeUInt32LE(0, 16);
	dib_header.writeUInt32LE((stride * image.h), 20);
	dib_header.writeUInt32LE(2835, 24);
	dib_header.writeUInt32LE(2835, 28);
	dib_header.writeUInt32LE(0, 32);
	dib_header.writeUInt32LE(0, 36);
	writable.write(dib_header);
	writable.write(image.palette);
	let row = Buffer.alloc(stride);
	for (let y = image.h - 1; y >= 0; y--) {
		let offset = (y * image.w);
		image.indices.copy(row, 0, offset, offset + image.w);
		writable.write(row);
	}
}

export = {
	write_to
};
