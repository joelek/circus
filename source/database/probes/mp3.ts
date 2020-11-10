/*
let decode_id3v24_syncsafe_integer = (b: Buffer): number => {
	return ((b[0] & 0x7F) << 21) | ((b[1] & 0x7F) << 14) | ((b[2] & 0x7F) << 7) | ((b[3] & 0x7F) << 0);
};

type ID3Tag = {
	track_title: string | null;
	album_name: string | null;
	year: number | null;
	track: number | null;
	tracks: number | null;
	disc: number | null;
	discs: number | null;
	track_artists: string[] | null;
	album_artists: string[] | null;
	duration: number;
};

let read_id3v24_tag = (file: string): ID3Tag => {
	let fd = libfs.openSync(file, 'r');
	try {
		let headerid3 = Buffer.alloc(10);
		libfs.readSync(fd, headerid3, 0, headerid3.length, null);
		if (headerid3.slice(0, 5).toString() !== 'ID3\x04\x00') {
			throw new Error();
		}
		let length = decode_id3v24_syncsafe_integer(headerid3.slice(6, 6 + 4));
		let body = Buffer.alloc(length);
		libfs.readSync(fd, body, 0, body.length, null);
		let tag = {
			track_title: null,
			album_name: null,
			year: null,
			track: null,
			tracks: null,
			disc: null,
			discs: null,
			track_artists: null,
			album_artists: null,
			duration: 0
		} as ID3Tag;
		let offset = 0;
		while (offset < body.length) {
			let frame_id = body.slice(offset, offset + 4).toString();
			let length = decode_id3v24_syncsafe_integer(body.slice(offset + 4, offset + 4 + 4));
			let flags = body.slice(offset + 8, offset + 8 + 2);
			let data = body.slice(offset + 10, offset + 10 + length);
			offset += 10 + length;
			if (frame_id === '\0\0\0\0') {
				break;
			} else if (frame_id === 'TIT2') {
				tag.track_title = data.slice(1, -1).toString();
			} else if (frame_id === 'TALB') {
				tag.album_name = data.slice(1, -1).toString();
			} else if (frame_id === 'TDRC') {
				let string = data.slice(1, -1).toString();
				let parts = /^([0-9]{4})$/.exec(string);
				if (parts !== null) {
					tag.year = parseInt(parts[1]);
				}
			} else if (frame_id === 'TRCK') {
				let string = data.slice(1, -1).toString();
				let parts = /^([0-9]{2})\/([0-9]{2})$/.exec(string);
				if (parts !== null) {
					tag.track = parseInt(parts[1]);
					tag.tracks = parseInt(parts[2]);
				}
			} else if (frame_id === 'TPOS') {
				let string = data.slice(1, -1).toString();
				let parts = /^([0-9]{2})\/([0-9]{2})$/.exec(string);
				if (parts !== null) {
					tag.disc = parseInt(parts[1]);
					tag.discs = parseInt(parts[2]);
				}
			} else if (frame_id === 'TPE1') {
				tag.track_artists = data.slice(1, -1).toString().split(";").map(a => a.trim());
			} else if (frame_id === 'TPE2') {
				tag.album_artists = data.slice(1, -1).toString().split(";").map(a => a.trim());
			} else if (frame_id === 'TXXX') {
				let string = data.slice(1, -1).toString();
				let parts = /^ALBUM ARTIST\0(.+)$/.exec(string);
				if (parts !== null) {
					tag.album_artists = parts[1].split(";").map(a => a.trim());
				}
			}
		}
		let header = Buffer.alloc(4);
		libfs.readSync(fd, header, 0, header.length, null);
		let sync = ((header[0] & 0xFF) << 3) | ((header[1] & 0xE0) >> 5);
		let version = ((header[1] & 0x18) >> 3);
		let layer = ((header[1] & 0x06) >> 1);
		let skip_crc = ((header[1] & 0x01) >> 0);
		let bitrate = ((header[2] & 0xF0) >> 4);
		let sample_rate = ((header[2] & 0x0C) >> 2);
		let padded = ((header[2] & 0x02) >> 1);
		let priv = ((header[2] & 0x01) >> 0);
		let channels = ((header[3] & 0xC0) >> 6);
		let modext = ((header[3] & 0x30) >> 4);
		let copyrighted = ((header[3] & 0x08) >> 3);
		let original = ((header[3] & 0x04) >> 2);
		let emphasis = ((header[3] & 0x03) >> 0);
		if (sync === 0x07FF && version === 3 && layer === 1) {
			let samples_per_frame = 1152;
			if (bitrate === 9 && sample_rate === 0) {
				let slots = (samples_per_frame * 128000 / 8 / 44100) | 0;
				if (padded) slots++;
				let bytes = slots * 1;
				let body = Buffer.alloc(bytes - 4);
				libfs.readSync(fd, body, 0, body.length, null);
				let zeroes = body.slice(0, 0 + 32);
				let xing = body.slice(32, 32 + 4);
				if (xing.toString('binary') === 'Xing') {
					let flags = body.slice(36, 36 + 4);
					let has_quality = ((flags[3] & 0x08) >> 3);
					let has_toc = ((flags[3] & 0x04) >> 2);
					let has_bytes = ((flags[3] & 0x02) >> 1);
					let has_frames = ((flags[3] & 0x01) >> 0);
					offset = 40;
					if (has_frames) {
						let num_frames = body.readUInt32BE(offset); offset += 4;
						tag.duration = ((num_frames * 1152 / 44100) * 1000) | 0;
					}
					if (has_bytes) {
						let num_bytes = body.readUInt32BE(offset); offset += 4;
					}
					if (has_toc) {
						offset += 100;
					}
					if (has_quality) {
						let quality = body.readUInt32BE(offset); offset += 4;
					}
				}
			}
		}
		libfs.closeSync(fd);
		return tag;
	} catch (error) {
		libfs.closeSync(fd);
		throw error;
	}
};

let parse_png = (node: string): void => {
	let fds = {
		fd: libfs.openSync(node, 'r'),
		offset: 0
	};
	try {
		let buffer = Buffer.alloc(8);
		fds.offset += libfs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
		if (buffer.toString('binary') !== '\u0089PNG\u000D\u000A\u001A\u000A') {
			throw new Error();
		}
		let nodes = node.split(libpath.sep);
		let file_id = makeFileId(...nodes);
		add_file({
			file_id: file_id,
			path: nodes,
			mime: 'image/png'
		});
		libfs.closeSync(fds.fd);
	} catch (error) {
		libfs.closeSync(fds.fd);
		throw error;
	}
};
*/
