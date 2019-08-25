type Bitmap = {
	w: number,
	h: number,
	buffer: Buffer,
	palette: Buffer
};

function write_to(bitmap: Bitmap): Buffer {
	let buffers = new Array<Buffer>();
	let stride = (((bitmap.w + 3) >> 2) << 2);
	let bmp_header = Buffer.alloc(14);
	bmp_header.set(Buffer.from('BM', 'binary'), 0);
	bmp_header.writeUInt32LE(14 + 40 + 256 * 4 + (stride * bitmap.h), 2);
	bmp_header.writeUInt16LE(0, 6);
	bmp_header.writeUInt16LE(0, 8);
	bmp_header.writeUInt32LE(14 + 40 + 256 * 4, 10);
	buffers.push(bmp_header);
	let dib_header = Buffer.alloc(40);
	dib_header.writeUInt32LE(40, 0);
	dib_header.writeUInt32LE(bitmap.w, 4);
	dib_header.writeUInt32LE(bitmap.h, 8);
	dib_header.writeUInt16LE(1, 12);
	dib_header.writeUInt16LE(8, 14);
	dib_header.writeUInt32LE(0, 16);
	dib_header.writeUInt32LE((stride * bitmap.h), 20);
	dib_header.writeUInt32LE(2835, 24);
	dib_header.writeUInt32LE(2835, 28);
	dib_header.writeUInt32LE(0, 32);
	dib_header.writeUInt32LE(0, 36);
	buffers.push(dib_header);
	buffers.push(bitmap.palette);
	for (let y = bitmap.h - 1; y >= 0; y--) {
		let row = Buffer.alloc(stride);
		bitmap.buffer.copy(row, 0, (y * bitmap.w), (y * bitmap.w) + bitmap.w);
		buffers.push(row);
	}
	return Buffer.concat(buffers);
}

export {
	Bitmap,
	write_to
};
