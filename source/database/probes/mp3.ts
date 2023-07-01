import * as is from "../../is";
import * as readers from "./readers";
import * as schema from "./schema";
import * as libfs from "fs";

type Tags = {
	title?: string,
	album?: string,
	year?: number,
	track_number?: number,
	disc_number?: number,
	artist?: string,
	album_artist?: string,
	copyright?: string
};

















function parseID3v11Tags(reader: readers.Binary): Tags {
	return reader.newContext((read, skip, tell) => {
		let tags = {} as Tags;
		let { cursor, size } = tell();
		skip(size - 128 - cursor);
		let buffer = read(Buffer.alloc(128));
		let offset = 0;
		let id = buffer.slice(offset, offset + 3).toString(); offset += 3;
		let title = buffer.slice(offset, offset + 30).toString("latin1"); offset += 30;
		let artist = buffer.slice(offset, offset + 30).toString("latin1"); offset += 30;
		let album = buffer.slice(offset, offset + 30).toString("latin1"); offset += 30;
		let year = buffer.slice(offset, offset + 4).toString(); offset += 4;
		let comment = buffer.slice(offset, offset + 28).toString("latin1"); offset += 28;
		let track_number = buffer.slice(offset, offset + 2); offset += 2;
		let genre = buffer.slice(offset, offset + 1); offset += 1;
		if (id !== "TAG") {
			throw new Error(`Expected an ID3v1.0 tag!`);
		}
		tags.title = title.trim() || undefined;
		tags.artist = artist.trim() || undefined;
		tags.album = album.trim() || undefined;
		let year_parts = /^([0-9]+)$/.exec(year);
		if (is.present(year_parts)) {
			tags.year = parseInt(year_parts[1]);
		}
		if (track_number[0] === 0x00 && track_number[1] !== 0x00) {
			tags.track_number = track_number[1];
		}
		return tags;
	});
};

function parseID3v1Tags(reader: readers.Binary): Tags {
	try {
		return parseID3v11Tags(reader);
	} catch (error) {}
	throw new Error(`Expected a valid ID3v1 tag!`);
};



















function decodeSyncSafeInteger(buffer: Buffer): number {
	let a = buffer.readUInt8(0);
	let b = buffer.readUInt8(1);
	let c = buffer.readUInt8(2);
	let d = buffer.readUInt8(3);
	return ((a & 0x7F) << 21) | ((b & 0x7F) << 14) | ((c & 0x7F) << 7) | ((d & 0x7F) << 0);
};

function resynchronizeID3v2Data(buffer: Buffer): Buffer {
	let bytes = [] as Array<number>;
	for (let i = 0; i < buffer.length; i++) {
		let a = buffer[i+0];
		let b = buffer[i+1];
		bytes.push(a);
		if (a === 0xFF && b === 0x00) {
			i += 1;
		}
	}
	return Buffer.from(bytes);
};

function truncateID3v2String(string: string): string {
	let index = string.indexOf("\0");
	if (index < 0) {
		return string;
	}
	return string.slice(0, index);
};

type ID3v22Header = {
	version: number;
	revision: number;
	flags: {
		is_unsynchronized: boolean;
		is_compressed: boolean;
	};
	payload_size: number;
};

function parseID3v22Header(reader: readers.Binary): ID3v22Header {
	return reader.newContext((read, skip) => {
		let buffer = read(Buffer.alloc(10));
		let offset = 0;
		let id = buffer.slice(offset, offset + 3); offset += 3;
		let version = buffer.readUint8(offset); offset += 1;
		let revision = buffer.readUint8(offset); offset += 1;
		let flags = buffer.readUint8(offset); offset += 1;
		let is_unsynchronized = ((flags >> 7) & 0x01) === 1;
		let is_compressed = ((flags >> 6) & 0x01) === 1;
		let payload_size = decodeSyncSafeInteger(buffer.slice(offset, offset + 4)); offset += 4;
		if (id.toString() !== "ID3" || version !== 2) {
			throw new Error(`Expected an ID3v2.2 tag!`);
		}
		return {
			version,
			revision,
			flags: {
				is_unsynchronized,
				is_compressed
			},
			payload_size
		};
	});
};

type ID3v22FrameHeader = {
	id: string;
	payload_size: number;
};

function parseID3v22FrameHeader(buffer: Buffer, cursor: { offset: number }): ID3v22FrameHeader {
	let id = buffer.slice(cursor.offset, cursor.offset + 3).toString(); cursor.offset += 3;
	let payload_size = buffer.readUintBE(cursor.offset, 3); cursor.offset += 3;
	return {
		id,
		payload_size
	};
};

type ID3v22Frame = {
	header: ID3v22FrameHeader;
	body: Buffer;
};

function parseID3v22Frame(buffer: Buffer, cursor: { offset: number }): ID3v22Frame {
	let header = parseID3v22FrameHeader(buffer, cursor);
	let body = buffer.slice(cursor.offset, cursor.offset + header.payload_size); cursor.offset += header.payload_size;
	return {
		header,
		body
	};
};

enum ID3v22StringEncoding {
	LATIN_1,
	UTF16_BE_OR_LE
};

function parseID3v22String(buffer: Buffer): string {
	let type = buffer.readUint8(0) as ID3v22StringEncoding;
	if (type === ID3v22StringEncoding.LATIN_1) {
		let bytes = buffer.slice(1);
		return truncateID3v2String(bytes.toString("latin1"));
	}
	if (type === ID3v22StringEncoding.UTF16_BE_OR_LE) {
		let bom = buffer.readUint16BE(1);
		let bytes = buffer.slice(3);
		let is_big_endian = (bom === 0xFEFF);
		if (is_big_endian) {
			buffer.swap16();
		}
		return truncateID3v2String(bytes.toString("utf16le"));
	}
	throw new Error(`Expected a valid ID3v2.2 string encoding!`);
};

function parseID3v22Tags(reader: readers.Binary): Tags {
	return reader.newContext((read, skip) => {
		let header = parseID3v22Header(reader);
		if (header.flags.is_compressed) {
			throw new Error(`Expected an uncompressed ID3v2.2 tag!`);
		}
		let buffer_size = header.payload_size;
		let buffer = read(Buffer.alloc(buffer_size));
		let tags: Tags = {};
		let cursor = { offset: 0 };
		while (cursor.offset < buffer.length) {
			let frame = parseID3v22Frame(buffer, cursor);
			if (!/^[A-Z0-9]{3}$/.test(frame.header.id)) {
				break;
			}
			try {
				if (header.flags.is_unsynchronized) {
					frame.body = resynchronizeID3v2Data(frame.body);
				}
				if (frame.header.id === "TCR") {
					tags.copyright = parseID3v22String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TT2") {
					tags.title = parseID3v22String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TAL") {
					tags.album = parseID3v22String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TYE") {
					let string = parseID3v22String(frame.body);
					let parts = /^([0-9]+)$/.exec(string);
					if (is.present(parts)) {
						tags.year = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TRK") {
					let string = parseID3v22String(frame.body);
					let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
					if (is.present(parts)) {
						tags.track_number = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TPA") {
					let string = parseID3v22String(frame.body);
					let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
					if (is.present(parts)) {
						tags.disc_number = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TP1") {
					tags.artist = parseID3v22String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TP2") {
					tags.album_artist = parseID3v22String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TXX") {
					let string = parseID3v22String(frame.body);
					let parts = /^ALBUM ARTIST\0(.+)$/.exec(string);
					if (is.present(parts)) {
						tags.album_artist = parts[1].trim() || undefined;
					}
					continue;
				}
			} catch (error) {
				console.warn(`Error while parsing frame with type ${frame.header.id}!`);
			}
		}
		return tags;
	});
};


































type ID3v23Header = {
	version: number;
	revision: number;
	flags: {
		is_unsynchronized: boolean;
		has_extended_header: boolean;
		is_experimental: boolean;
	};
	payload_size: number;
};

function parseID3v23Header(reader: readers.Binary): ID3v23Header {
	return reader.newContext((read, skip) => {
		let buffer = read(Buffer.alloc(10));
		let offset = 0;
		let id = buffer.slice(offset, offset + 3); offset += 3;
		let version = buffer.readUint8(offset); offset += 1;
		let revision = buffer.readUint8(offset); offset += 1;
		let flags = buffer.readUint8(offset); offset += 1;
		let is_unsynchronized = ((flags >> 7) & 0x01) === 1;
		let has_extended_header = ((flags >> 6) & 0x01) === 1;
		let is_experimental = ((flags >> 5) & 0x01) === 1;
		let payload_size = decodeSyncSafeInteger(buffer.slice(offset, offset + 4)); offset += 4;
		if (id.toString() !== "ID3" || version !== 3) {
			throw new Error(`Expected an ID3v2.3 tag!`);
		}
		return {
			version,
			revision,
			flags: {
				is_unsynchronized,
				has_extended_header,
				is_experimental
			},
			payload_size
		};
	});
};

type ID3v23FrameHeader = {
	id: string;
	payload_size: number;
	flags: {
		discard_on_tag_update_if_unknown: boolean;
		discard_on_file_update_if_unknown: boolean;
		is_read_only: boolean;
		is_compressed: boolean;
		is_encrypted: boolean;
		has_group_information: boolean;
	};
};

function parseID3v23FrameHeader(buffer: Buffer, cursor: { offset: number }): ID3v23FrameHeader {
	let id = buffer.slice(cursor.offset, cursor.offset + 4).toString(); cursor.offset += 4;
	let payload_size = decodeSyncSafeInteger(buffer.slice(cursor.offset, cursor.offset + 4)); cursor.offset += 4;
	let flags = buffer.readUint16BE(cursor.offset); cursor.offset += 2;
	let discard_on_tag_update_if_unknown = ((flags >> 15) & 0x01) === 1;
	let discard_on_file_update_if_unknown = ((flags >> 14) & 0x01) === 1;
	let is_read_only = ((flags >> 13) & 0x01) === 1;
	let is_compressed = ((flags >> 7) & 0x01) === 1;
	let is_encrypted = ((flags >> 6) & 0x01) === 1;
	let has_group_information = ((flags >> 5) & 0x01) === 1;
	return {
		id,
		payload_size,
		flags: {
			discard_on_tag_update_if_unknown,
			discard_on_file_update_if_unknown,
			is_read_only,
			is_compressed,
			is_encrypted,
			has_group_information
		}
	};
};

type ID3v23Frame = {
	header: ID3v23FrameHeader;
	body: Buffer;
};

function parseID3v23Frame(buffer: Buffer, cursor: { offset: number }): ID3v23Frame {
	let header = parseID3v23FrameHeader(buffer, cursor);
	let body = buffer.slice(cursor.offset, cursor.offset + header.payload_size); cursor.offset += header.payload_size;
	return {
		header,
		body
	};
};

enum ID3v23StringEncoding {
	LATIN_1,
	UTF16_BE_OR_LE
};

function parseID3v23String(buffer: Buffer): string {
	let type = buffer.readUint8(0) as ID3v23StringEncoding;
	if (type === ID3v23StringEncoding.LATIN_1) {
		let bytes = buffer.slice(1);
		return truncateID3v2String(bytes.toString("latin1"));
	}
	if (type === ID3v23StringEncoding.UTF16_BE_OR_LE) {
		let bom = buffer.readUint16BE(1);
		let bytes = buffer.slice(3);
		let is_big_endian = (bom === 0xFEFF);
		if (is_big_endian) {
			buffer.swap16();
		}
		return truncateID3v2String(bytes.toString("utf16le"));
	}
	throw new Error(`Expected a valid ID3v2.3 string encoding!`);
};

function parseID3v23Tags(reader: readers.Binary): Tags {
	return reader.newContext((read, skip) => {
		let header = parseID3v23Header(reader);
		let buffer_size = header.payload_size;
		if (header.flags.has_extended_header) {
			let extended_header_size = decodeSyncSafeInteger(read(Buffer.alloc(4)));
			buffer_size -= extended_header_size;
			skip(extended_header_size - 4);
		}
		let buffer = read(Buffer.alloc(buffer_size));
		let tags: Tags = {};
		let cursor = { offset: 0 };
		while (cursor.offset < buffer.length) {
			let frame = parseID3v23Frame(buffer, cursor);
			if (!/^[A-Z0-9]{4}$/.test(frame.header.id)) {
				break;
			}
			if (frame.header.flags.is_compressed) {
				console.warn(`Expected an uncompressed ID3v2.3 frame!`);
				continue;
			}
			if (frame.header.flags.is_encrypted) {
				console.warn(`Expected an unencrypted ID3v2.3 frame!`);
				continue;
			}
			if (frame.header.flags.has_group_information) {
				console.warn(`Expected an ID3v2.3 frame without group information!`);
				continue;
			}
			try {
				if (header.flags.is_unsynchronized) {
					frame.body = resynchronizeID3v2Data(frame.body);
				}
				if (frame.header.id === "TCOP") {
					tags.copyright = parseID3v23String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TIT2") {
					tags.title = parseID3v23String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TALB") {
					tags.album = parseID3v23String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TYER") {
					let string = parseID3v23String(frame.body);
					let parts = /^([0-9]+)$/.exec(string);
					if (is.present(parts)) {
						tags.year = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TRCK") {
					let string = parseID3v23String(frame.body);
					let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
					if (is.present(parts)) {
						tags.track_number = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TPOS") {
					let string = parseID3v23String(frame.body);
					let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
					if (is.present(parts)) {
						tags.disc_number = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TPE1") {
					tags.artist = parseID3v23String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TPE2") {
					tags.album_artist = parseID3v23String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TXXX") {
					let string = parseID3v23String(frame.body);
					let parts = /^ALBUM ARTIST\0(.+)$/.exec(string);
					if (is.present(parts)) {
						tags.album_artist = parts[1].trim() || undefined;
					}
					continue;
				}
			} catch (error) {
				console.warn(`Error while parsing frame with type ${frame.header.id}!`);
			}
		}
		return tags;
	});
};



























type ID3v24Header = {
	version: number;
	revision: number;
	flags: {
		is_unsynchronized: boolean;
		has_extended_header: boolean;
		is_experimental: boolean;
		has_footer: boolean;
	};
	payload_size: number;
};

function parseID3v24Header(reader: readers.Binary): ID3v24Header {
	return reader.newContext((read, skip) => {
		let buffer = read(Buffer.alloc(10));
		let offset = 0;
		let id = buffer.slice(offset, offset + 3); offset += 3;
		let version = buffer.readUint8(offset); offset += 1;
		let revision = buffer.readUint8(offset); offset += 1;
		let flags = buffer.readUint8(offset); offset += 1;
		let is_unsynchronized = ((flags >> 7) & 0x01) === 1;
		let has_extended_header = ((flags >> 6) & 0x01) === 1;
		let is_experimental = ((flags >> 5) & 0x01) === 1;
		let has_footer = ((flags >> 4) & 0x01) === 1;
		let payload_size = decodeSyncSafeInteger(buffer.slice(offset, offset + 4)); offset += 4;
		if (id.toString() !== "ID3" || version !== 4) {
			throw new Error(`Expected an ID3v2.4 tag!`);
		}
		return {
			version,
			revision,
			flags: {
				is_unsynchronized,
				has_extended_header,
				is_experimental,
				has_footer
			},
			payload_size
		};
	});
};

type ID3v24FrameHeader = {
	id: string;
	payload_size: number;
	flags: {
		discard_on_tag_update_if_unknown: boolean;
		discard_on_file_update_if_unknown: boolean;
		is_read_only: boolean;
		has_group_information: boolean;
		is_compressed: boolean;
		is_encrypted: boolean;
		is_unsynchronized: boolean;
		has_data_length_indicator: boolean;
	};
};

function parseID3v24FrameHeader(buffer: Buffer, cursor: { offset: number }): ID3v24FrameHeader {
	let id = buffer.slice(cursor.offset, cursor.offset + 4).toString(); cursor.offset += 4;
	let payload_size = decodeSyncSafeInteger(buffer.slice(cursor.offset, cursor.offset + 4)); cursor.offset += 4;
	let flags = buffer.readUint16BE(cursor.offset); cursor.offset += 2;
	let discard_on_tag_update_if_unknown = ((flags >> 14) & 0x01) === 1;
	let discard_on_file_update_if_unknown = ((flags >> 13) & 0x01) === 1;
	let is_read_only = ((flags >> 12) & 0x01) === 1;
	let has_group_information = ((flags >> 6) & 0x01) === 1;
	let is_compressed = ((flags >> 3) & 0x01) === 1;
	let is_encrypted = ((flags >> 2) & 0x01) === 1;
	let is_unsynchronized = ((flags >> 1) & 0x01) === 1;
	let has_data_length_indicator = ((flags >> 0) & 0x01) === 1;
	return {
		id,
		payload_size,
		flags: {
			discard_on_tag_update_if_unknown,
			discard_on_file_update_if_unknown,
			is_read_only,
			has_group_information,
			is_compressed,
			is_encrypted,
			is_unsynchronized,
			has_data_length_indicator
		}
	};
};

type ID3v24Frame = {
	header: ID3v24FrameHeader;
	body: Buffer;
};

function parseID3v24Frame(buffer: Buffer, cursor: { offset: number }): ID3v24Frame {
	let header = parseID3v24FrameHeader(buffer, cursor);
	let body = buffer.slice(cursor.offset, cursor.offset + header.payload_size); cursor.offset += header.payload_size;
	return {
		header,
		body
	};
};

enum ID3v24StringEncoding {
	LATIN_1,
	UTF16_BE_OR_LE,
	UTF16_BE,
	UTF8
};

function parseID3v24String(buffer: Buffer): string {
	let type = buffer.readUint8(0) as ID3v24StringEncoding;
	if (type === ID3v24StringEncoding.LATIN_1) {
		let bytes = buffer.slice(1);
		return truncateID3v2String(bytes.toString("latin1"));
	}
	if (type === ID3v24StringEncoding.UTF16_BE_OR_LE) {
		let bom = buffer.readUint16BE(1);
		let bytes = buffer.slice(3);
		let is_big_endian = (bom === 0xFEFF);
		if (is_big_endian) {
			buffer.swap16();
		}
		return truncateID3v2String(bytes.toString("utf16le"));
	}
	if (type === ID3v24StringEncoding.UTF16_BE) {
		let bytes = buffer.slice(1);
		buffer.swap16();
		return truncateID3v2String(bytes.toString("utf16le"));
	}
	if (type === ID3v24StringEncoding.UTF8) {
		let bytes = buffer.slice(1);
		return truncateID3v2String(bytes.toString("utf-8"));
	}
	throw new Error(`Expected a valid ID3v2.4 string encoding!`);
};

function parseID3v24Tags(reader: readers.Binary): Tags {
	return reader.newContext((read, skip) => {
		let header = parseID3v24Header(reader);
		let buffer_size = header.payload_size;
		if (header.flags.has_extended_header) {
			let extended_header_size = decodeSyncSafeInteger(read(Buffer.alloc(4)));
			buffer_size -= extended_header_size;
			skip(extended_header_size - 4);
		}
		let buffer = read(Buffer.alloc(buffer_size));
		let tags: Tags = {};
		let cursor = { offset: 0 };
		while (cursor.offset < buffer.length) {
			let frame = parseID3v24Frame(buffer, cursor);
			if (!/^[A-Z0-9]{4}$/.test(frame.header.id)) {
				break;
			}
			if (frame.header.flags.has_data_length_indicator) {
				console.warn(`Expected an ID3v2.4 frame without a data length indicator!`);
				continue;
			}
			if (frame.header.flags.has_group_information) {
				console.warn(`Expected an ID3v2.4 frame without group information!`);
				continue;
			}
			if (frame.header.flags.is_compressed) {
				console.warn(`Expected an uncompressed ID3v2.4 frame!`);
				continue;
			}
			if (frame.header.flags.is_encrypted) {
				console.warn(`Expected an unencrypted ID3v2.4 frame!`);
				continue;
			}
			try {
				if (header.flags.is_unsynchronized || frame.header.flags.is_unsynchronized) {
					frame.body = resynchronizeID3v2Data(frame.body);
				}
				if (frame.header.id === "TCOP") {
					tags.copyright = parseID3v24String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TIT2") {
					tags.title = parseID3v24String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TALB") {
					tags.album = parseID3v24String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TDRC") {
					let string = parseID3v24String(frame.body);
					let parts = /^([0-9]+)$/.exec(string);
					if (is.present(parts)) {
						tags.year = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TRCK") {
					let string = parseID3v24String(frame.body);
					let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
					if (is.present(parts)) {
						tags.track_number = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TPOS") {
					let string = parseID3v24String(frame.body);
					let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
					if (is.present(parts)) {
						tags.disc_number = parseInt(parts[1]);
					}
					continue;
				}
				if (frame.header.id === "TPE1") {
					tags.artist = parseID3v24String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TPE2") {
					tags.album_artist = parseID3v24String(frame.body).trim() || undefined;
					continue;
				}
				if (frame.header.id === "TXXX") {
					let string = parseID3v24String(frame.body);
					let parts = /^ALBUM ARTIST\0(.+)$/.exec(string);
					if (is.present(parts)) {
						tags.album_artist = parts[1].trim() || undefined;
					}
					continue;
				}
			} catch (error) {
				console.warn(`Error while parsing frame with type ${frame.header.id}!`);
			}
		}
		return tags;
	});
};

function parseID3v2Tags(reader: readers.Binary): Tags {
	try {
		return parseID3v24Tags(reader);
	} catch (error) {}
	try {
		return parseID3v23Tags(reader);
	} catch (error) {}
	try {
		return parseID3v22Tags(reader);
	} catch (error) {}
	throw new Error(`Expected a valid ID3v2 tag!`);
};

enum Version {
	V2_5,
	RESERVED,
	V2,
	V1
};

enum Layer {
	RESERVED,
	L3,
	L2,
	L1
};

enum Channels {
	STEREO,
	JOINT_STEREO,
	DUAL_CHANNEL,
	SINGLE_CHANNEL
};

enum Emphasis {
	NONE,
	EMPHASIS_50_OVER_15_MS,
	RESERVED,
	CCIT_J17
};

const KILOBITS_PER_SECOND = [
	// Version.V2_5
	[
		// Layer.RESERVED
		[
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		],
		// Layer.L3
		[
			0,
			8,
			16,
			24,
			32,
			40,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			144,
			160,
			-1
		],
		// Layer.L2
		[
			0,
			8,
			16,
			24,
			32,
			40,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			144,
			160,
			-1
		],
		// Layer.L1
		[
			0,
			32,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			144,
			160,
			176,
			192,
			224,
			256,
			-1
		]
	],
	// Version.RESERVED
	[
		// Layer.RESERVED
		[
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		],
		// Layer.L3
		[
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		],
		// Layer.L2
		[
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		],
		// Layer.L1
		[
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		]
	],
	// Version.V2
	[
		// Layer.RESERVED
		[
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		],
		// Layer.L3
		[
			0,
			8,
			16,
			24,
			32,
			40,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			144,
			160,
			-1
		],
		// Layer.L2
		[
			0,
			8,
			16,
			24,
			32,
			40,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			144,
			160,
			-1
		],
		// Layer.L1
		[
			0,
			32,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			144,
			160,
			176,
			192,
			224,
			256,
			-1
		]
	],
	// Version.V1
	[
		// Layer.RESERVED
		[
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		],
		// Layer.L3
		[
			0,
			32,
			40,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			160,
			192,
			224,
			256,
			320,
			-1
		],
		// Layer.L2
		[
			0,
			32,
			48,
			56,
			64,
			80,
			96,
			112,
			128,
			160,
			192,
			224,
			256,
			320,
			384,
			-1
		],
		// Layer.L1
		[
			0,
			32,
			64,
			96,
			128,
			160,
			192,
			224,
			256,
			288,
			320,
			352,
			384,
			416,
			448,
			-1
		]
	]
];

const SAMPLES_PER_SECOND = [
	// Version.V2_5
	[
		11025,
		1200,
		8000,
		-1
	],
	// Version.RESERVED
	[
		-1,
		-1,
		-1,
		-1
	],
	// Version.V2
	[
		22050,
		24000,
		16000,
		-1
	],
	// Version.V1
	[
		44100,
		48000,
		32000,
		-1
	]
];

const SAMPLES_PER_FRAME = [
	// Version.V2_5
	[
		// Layer.RESERVED
		-1,
		// Layer.L3
		576,
		// Layer.L2
		1152,
		// Layer.L1
		384
	],
	// Version.RESERVED
	[
		// Layer.RESERVED
		-1,
		// Layer.L3
		-1,
		// Layer.L2
		-1,
		// Layer.L1
		-1
	],
	// Version.V2
	[
		// Layer.RESERVED
		-1,
		// Layer.L3
		576,
		// Layer.L2
		1152,
		// Layer.L1
		384
	],
	// Version.V1
	[
		// Layer.RESERVED
		-1,
		// Layer.L3
		1152,
		// Layer.L2
		1152,
		// Layer.L1
		384
	]
];

const BYTES_PER_SLOT = [
	// Layer.RESERVED
	-1,
	// Layer.L3
	1,
	// Layer.L2
	1,
	// Layer.L1
	4
];

type MPEGAudioFrameHeader = {
	version: Version;
	layer: Layer;
	skip_crc: boolean;
	bitrate_index: number;
	sample_rate_index: number;
	padded: boolean;
	application_private: boolean;
	channels: Channels;
	mode_extension: number;
	copyrighted: boolean;
	original: boolean;
	emphasis: Emphasis;
	values: {
		samples_per_second: number;
		kilobits_per_second: number;
		samples_per_frame: number;
		bytes_per_slot: number;
		frame_length: number;
		payload_length: number;
	}
};

function parseMPEGAudioFrameHeader(reader: readers.Binary, probe_distance: number): MPEGAudioFrameHeader {
	return reader.newContext((read, skip, tell) => {
		for (let i = 0; i < probe_distance; i++) {
			let buffer = read(Buffer.alloc(4));
			let sync = ((buffer[0] & 0xFF) << 3) | ((buffer[1] & 0xE0) >> 5);
			let version = ((buffer[1] & 0x18) >> 3) as Version;
			let layer = ((buffer[1] & 0x06) >> 1) as Layer;
			let skip_crc = ((buffer[1] & 0x01) >> 0) === 1;
			let bitrate_index = ((buffer[2] & 0xF0) >> 4);
			let sample_rate_index = ((buffer[2] & 0x0C) >> 2);
			let padded = ((buffer[2] & 0x02) >> 1) === 1;
			let application_private = ((buffer[2] & 0x01) >> 0) === 1;
			let channels = ((buffer[3] & 0xC0) >> 6) as Channels;
			let mode_extension = ((buffer[3] & 0x30) >> 4);
			let copyrighted = ((buffer[3] & 0x08) >> 3) === 1;
			let original = ((buffer[3] & 0x04) >> 2) === 1;
			let emphasis = ((buffer[3] & 0x03) >> 0) as Emphasis;
			if (sync !== 0x07FF || version === Version.RESERVED || layer === Layer.RESERVED) {
				skip(-3);
				continue;
			}
			let samples_per_second = SAMPLES_PER_SECOND[version][sample_rate_index];
			if (samples_per_second === -1) {
				skip(-3);
				continue;
			}
			let kilobits_per_second = KILOBITS_PER_SECOND[version][layer][bitrate_index];
			if (kilobits_per_second === -1) {
				skip(-3);
				continue;
			}
			let samples_per_frame = SAMPLES_PER_FRAME[version][layer];
			if (samples_per_frame === -1) {
				skip(-3);
				continue;
			}
			let bytes_per_slot = BYTES_PER_SLOT[layer];
			if (bytes_per_slot === -1) {
				skip(-3);
				continue;
			}
			let bytes_per_frame = samples_per_frame * kilobits_per_second * 1000 / 8 / samples_per_second;
			let frame_slots = Math.floor(bytes_per_frame / bytes_per_slot);
			if (padded) {
				frame_slots += 1;
			}
			let frame_length = frame_slots * bytes_per_slot;
			let payload_length = frame_length - 4;
			if (i !== 0) {
				console.warn(`Skipped ${i} bytes of junk during MPEG header probe!`);
			}
			return {
				version,
				layer,
				skip_crc,
				bitrate_index,
				sample_rate_index,
				padded,
				application_private,
				channels,
				mode_extension,
				copyrighted,
				original,
				emphasis,
				values: {
					samples_per_second,
					kilobits_per_second,
					samples_per_frame,
					bytes_per_slot,
					frame_length,
					payload_length
				}
			};
		}
		throw new Error(`Expected a MPEG audio frame header!`);
	});
};

type MPEGAudioFrame = {
	header: MPEGAudioFrameHeader;
	body: Buffer;
};

function parseMPEGAudioFrame(reader: readers.Binary, probe_distance: number): MPEGAudioFrame {
	return reader.newContext((read, skip) => {
		let header = parseMPEGAudioFrameHeader(reader, probe_distance);
		let body = read(Buffer.alloc(header.values.payload_length));
		return {
			header,
			body
		};
	});
};

type XingHeader = {
	number_of_frames?: number;
	number_of_bytes?: number;
	toc?: number[];
	quality?: number;
};

function parseXingHeader(frame: MPEGAudioFrame): XingHeader {
	let offset = 0;
	let zeroes = frame.body.slice(offset, offset + 32); offset += 32;
	let id = frame.body.slice(offset, offset + 4); offset += 4;
	let flags = frame.body.slice(offset, offset + 4); offset += 4;
	if (id.toString() !== "Xing" && id.toString() !== "Info") {
		throw new Error(`Expected a Xing or Info header!`);
	}
	let has_quality = ((flags[3] & 0x08) >> 3) === 1;
	let has_toc = ((flags[3] & 0x04) >> 2) === 1;
	let has_bytes = ((flags[3] & 0x02) >> 1) === 1;
	let has_frames = ((flags[3] & 0x01) >> 0) === 1;
	let number_of_frames: number | undefined;
	let number_of_bytes: number | undefined;
	let toc: number[] | undefined;
	let quality: number | undefined;
	if (has_frames) {
		number_of_frames = frame.body.readUInt32BE(offset); offset += 4;
	}
	if (has_bytes) {
		number_of_bytes = frame.body.readUInt32BE(offset); offset += 4;
	}
	if (has_toc) {
		toc = [];
		for (let i = 0; i < 100; i++) {
			let entry = frame.body.readUint8(offset); offset += 1;
			toc.push(entry);
		}
	}
	if (has_quality) {
		quality = frame.body.readUInt32BE(offset); offset += 4;
	}
	return {
		number_of_frames,
		number_of_bytes,
		toc,
		quality
	};
};

export function probe(fd: number): schema.Probe {
	let reader = new readers.Binary(fd);
	let tags = {} as Tags;
	let id3v2_tags_found = false;
	while (true) {
		try {
			tags = {
				...tags,
				...parseID3v2Tags(reader)
			};
			id3v2_tags_found = true;
		} catch (error) {
			break;
		}
	}
	let frame = parseMPEGAudioFrame(reader, 1152);
	if (frame.header.version !== Version.V1 || frame.header.layer !== Layer.L3) {
		throw new Error(`Expected a MPEG ${Version[Version.V1]} ${Layer[Layer.L3]} header (found ${Version[frame.header.version]} ${Layer[frame.header.layer]})!`);
	}
	let duration_ms = 0;
	try {
		let xing = parseXingHeader(frame);
		if (xing.number_of_frames == null) {
			throw new Error(`Expected Xing header to contain number of frames!`);
		}
		duration_ms = Math.ceil((xing.number_of_frames * frame.header.values.samples_per_frame / frame.header.values.samples_per_second) * 1000);
	} catch (error) {
		duration_ms = Math.ceil((libfs.fstatSync(fd).size * 8) / (frame.header.values.kilobits_per_second * 1000) * 1000);
	}
	if (!id3v2_tags_found) {
		tags = parseID3v1Tags(reader);
	}
	let result: schema.Probe = {
		resources: [
			{
				type: "audio",
				duration_ms: duration_ms
			}
		]
	};
	if (is.present(tags.title) && is.present(tags.disc_number) && is.present(tags.track_number) && is.present(tags.album)) {
		let metadata: schema.TrackMetadata = {
			type: "track",
			title: tags.title,
			disc: tags.disc_number,
			track: tags.track_number,
			album: {
				title: tags.album,
				year: tags.year,
				artists: is.absent(tags.album_artist) ? [] : tags.album_artist.split(";").map((artist) => artist.trim())
			},
			artists: is.absent(tags.artist) ? [] : tags.artist.split(";").map((artist) => artist.trim()),
			copyright: tags.copyright
		};
		result.metadata = metadata;
	} else if (is.present(tags.title) && is.present(tags.artist)) {
		// TODO: Remove stray track indexing when media directories are presented in the UI.
		let metadata: schema.TrackMetadata = {
			type: "track",
			title: tags.title,
			disc: 1,
			track: 1,
			album: {
				title: `${tags.title} by ${tags.artist}`,
				year: tags.year,
				artists: is.absent(tags.artist) ? [] : tags.artist.split(";").map((artist) => artist.trim()),
			},
			artists: is.absent(tags.artist) ? [] : tags.artist.split(";").map((artist) => artist.trim()),
			copyright: tags.copyright
		};
		result.metadata = metadata;
	}
	return result;
};
