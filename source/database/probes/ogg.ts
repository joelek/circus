import * as libfs from "fs";
import * as schema from "./schema";
import * as is from "../../is";

type Tags = {
	title?: string,
	album?: string,
	year?: number,
	track_number?: number,
	disc_number?: number,
	artist?: string,
	album_artist?: string,
	copyright?: string,
	genre?: string
};

type Section = {
	offset: number;
	length: number;
};

type Cursor = {
	offset: number;
};

enum PageFlags {
	CONTINUATION = 0,
	BEGINNING_OF_STREAM = 2,
	END_OF_STREAM = 4
};

type Page = {
	version: number;
	page_flags: number;
	granule_position: bigint;
	bitstream_serial_number: number;
	page_sequence_number: number;
	checksum: number;
	segment_lengths: Array<number>;
};

const Page = {
	parse(fd: number, cursor?: Cursor): Page {
		cursor = cursor ?? { offset: 0 };
		let buffer = Buffer.alloc(27);
		if (libfs.readSync(fd, buffer, 0, buffer.length, cursor.offset) !== buffer.length) {
			throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
		}
		cursor.offset += buffer.length;
		let capture_pattern = buffer.subarray(0, 0 + 4).toString("ascii");
		if (capture_pattern !== "OggS") {
			throw new Error(`Expected the "OggS" capture pattern!`);
		}
		let version = buffer.readUint8(4);
		let page_flags = buffer.readUint8(5);
		let granule_position = buffer.readBigUInt64LE(6);
		let bitstream_serial_number = buffer.readUint32LE(14);
		let page_sequence_number = buffer.readUint32LE(18);
		let checksum = buffer.readUint32BE(22);
		let segment_lengths_count = buffer.readUint8(26);
		let segment_lengths = Buffer.alloc(segment_lengths_count);
		if (libfs.readSync(fd, segment_lengths, 0, segment_lengths.length, cursor.offset) !== segment_lengths.length) {
			throw new Error(`Expected to read exactly ${segment_lengths.length} bytes!`);
		}
		cursor.offset += segment_lengths.length;
		return {
			version,
			page_flags,
			granule_position,
			bitstream_serial_number,
			page_sequence_number,
			checksum,
			segment_lengths: Array.from(segment_lengths)
		};
	},

	readPacketData(fd: number, page: Page, cursor?: Cursor): Buffer {
		cursor = cursor ?? { offset: 0 };
		let total_length = page.segment_lengths.reduce((sum, length) => sum + length, 0);
		let buffer = Buffer.alloc(total_length);
		if (libfs.readSync(fd, buffer, 0, buffer.length, cursor.offset) !== buffer.length) {
			throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
		}
		cursor.offset += buffer.length;
		return buffer;
	}
};

enum VorbisHeaderType {
	IDENTIFICATION = 1,
	COMMENT = 3,
	SETUP = 5
};

type VorbisIdentificationHeader = {
	version: number;
	channel_count: number;
	sample_rate_hz: number;
	bitrate_maximum: number;
	bitrate_nominal: number;
	bitrate_minimum: number
	blocksize_0: number;
	blocksize_1: number;
};

const VorbisIdentificationHeader = {
	parse(fd: number, cursor?: Cursor): VorbisIdentificationHeader {
		cursor = cursor ?? { offset: 0 };
		let buffer = Page.readPacketData(fd, Page.parse(fd, cursor), cursor);
		let header_type = buffer.readUint8(0);
		if (header_type !== VorbisHeaderType.IDENTIFICATION) {
			throw new Error(`Expected an identification header!`);
		}
		let identifier = buffer.subarray(1, 1 + 6).toString("ascii");
		if (identifier !== "vorbis") {
			throw new Error(`Expected the "vorbis" identifier!`);
		}
		let version = buffer.readUint32LE(7);
		if (version !== 0) {
			throw new Error(`Expected a version 0 vorbis header!`);
		}
		let channel_count = buffer.readUint8(11);
		let sample_rate_hz = buffer.readUint32LE(12);
		let bitrate_maximum = buffer.readUint32LE(16);
		let bitrate_nominal = buffer.readUint32LE(20);
		let bitrate_minimum = buffer.readUint32LE(24);
		let bits = buffer.readUint8(28);
		let blocksize_0 = (bits >> 4) & 0x0F;
		let blocksize_1 = (bits >> 0) & 0x0F;
		let framing = buffer.readUint8(29);
		return {
			version,
			channel_count,
			sample_rate_hz,
			bitrate_maximum,
			bitrate_nominal,
			bitrate_minimum,
			blocksize_0,
			blocksize_1
		};
	}
};

type VorbisCommentHeader = {
	vendor: string;
	tags: Array<{ key: string; value: string; }>;
};

const VorbisCommentHeader = {
	parse(fd: number, cursor?: Cursor): VorbisCommentHeader {
		cursor = cursor ?? { offset: 0 };
		let buffer = Page.readPacketData(fd, Page.parse(fd, cursor), cursor);
		let offset = 0;
		let header_type = buffer.readUint8(offset); offset += 1;
		if (header_type !== VorbisHeaderType.COMMENT) {
			throw new Error(`Expected a comment header!`);
		}
		let identifier = buffer.subarray(offset, offset + 6).toString("ascii"); offset += 6;
		if (identifier !== "vorbis") {
			throw new Error(`Expected the "vorbis" identifier!`);
		}
		let vendor_length = buffer.readUint32LE(offset); offset += 4;
		let vendor = buffer.subarray(offset, offset + vendor_length).toString("utf-8"); offset += vendor_length;
		let number_of_tags = buffer.readUint32LE(offset); offset += 4;
		let tags: Array<{ key: string; value: string; }> = [];
		for (let i = 0; i < number_of_tags; i++) {
			let tag_length = buffer.readUint32LE(offset); offset += 4;
			let string = buffer.subarray(offset, offset + tag_length).toString("utf-8").split("="); offset += tag_length;
			let key = string[0];
			let value = string.slice(1).join("=");
			tags.push({ key, value });
		}
		return {
			vendor,
			tags
		};
	}
};

function getDurationMs(fd: number, sample_rate_hz: number): number {
	let file_size = libfs.fstatSync(fd).size;
	let start = Math.max(0, file_size - 65307);
	let buffer = Buffer.alloc(4);
	let cursor: Cursor = { offset: start };
	let duration_ms = 0;
	for (; cursor.offset < file_size - 4;) {
		if (libfs.readSync(fd, buffer, 0, buffer.length, cursor.offset) !== buffer.length) {
			throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
		}
		if (buffer.toString("ascii") === "OggS") {
			let page = Page.parse(fd, cursor);
			duration_ms = Math.ceil(Number(page.granule_position) / sample_rate_hz * 1000);
		} else {
			cursor.offset += 1;
		}
	}
	return duration_ms;
};

export function probe(fd: number): schema.Probe {
	let result: schema.Probe = {
		resources: []
	};
	let cursor: Cursor = { offset: 0 };
	// This may fail since a page may contain multiple headers.
	let identification_header = VorbisIdentificationHeader.parse(fd, cursor);
	let comment_header = VorbisCommentHeader.parse(fd, cursor);
	let duration_ms = getDurationMs(fd, identification_header.sample_rate_hz);
	let sample_rate_hz = identification_header.sample_rate_hz;
	let channel_count = identification_header.channel_count;
	let bits_per_sample = 16; // Not really technically correct.
	let tags: Tags = {};
	if (true) {
		let album = comment_header.tags.find((tag) => tag.key.toLowerCase() === "album");
		if (album != null) {
			tags.album = album.value;
		}
		let artist = comment_header.tags.find((tag) => tag.key.toLowerCase() === "artist");
		if (artist != null) {
			tags.artist = artist.value;
		}
		let album_artist = comment_header.tags.find((tag) => tag.key.toLowerCase() === "albumartist");
		if (album_artist != null) {
			tags.album_artist = album_artist.value;
		}
		let disc_number = comment_header.tags.find((tag) => tag.key.toLowerCase() === "discnumber");
		if (disc_number != null) {
			let parts = /^([0-9]+)$/.exec(disc_number.value);
			if (parts != null) {
				tags.disc_number = parseInt(parts[1]);
			}
		}
		let track_number = comment_header.tags.find((tag) => tag.key.toLowerCase() === "tracknumber");
		if (track_number != null) {
			let parts = /^([0-9]+)$/.exec(track_number.value);
			if (parts != null) {
				tags.track_number = parseInt(parts[1]);
			}
		}
		let date = comment_header.tags.find((tag) => tag.key.toLowerCase() === "date");
		if (date != null) {
			let parts = /^([0-9]+)$/.exec(date.value);
			if (parts != null) {
				tags.year = parseInt(parts[1]);
			}
		}
		let title = comment_header.tags.find((tag) => tag.key.toLowerCase() === "title");
		if (title != null) {
			tags.title = title.value;
		}
		let copyright = comment_header.tags.find((tag) => tag.key.toLowerCase() === "copyright");
		if (copyright != null) {
			tags.copyright = copyright.value;
		}
		let genre = comment_header.tags.find((tag) => tag.key.toLowerCase() === "genre");
		if (genre != null) {
			tags.genre = genre.value;
		}
	}
	if (is.present(tags.title) && is.present(tags.disc_number) && is.present(tags.track_number) && is.present(tags.album)) {
		let metadata: schema.TrackMetadata = {
			type: "track",
			title: tags.title,
			disc: tags.disc_number,
			track: tags.track_number,
			album: {
				title: tags.album,
				year: tags.year,
				artists: is.absent(tags.album_artist) ? [] : tags.album_artist.split(";").map((artist) => artist.trim()),
				genres: is.absent(tags.genre) ? [] : tags.genre.split(";").map((genre) => genre.trim())
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
				genres: is.absent(tags.genre) ? [] : tags.genre.split(";").map((genre) => genre.trim())
			},
			artists: is.absent(tags.artist) ? [] : tags.artist.split(";").map((artist) => artist.trim()),
			copyright: tags.copyright
		};
		result.metadata = metadata;
	}
	result.resources.push({
		type: "audio",
		duration_ms,
		sample_rate_hz,
		channel_count,
		bits_per_sample
	});
	return result;
};
