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

enum MetadataBlockType {
	STREAMINFO = 0,
	PADDING = 1,
	APPLICATION = 2,
	SEEKTABLE = 3,
	VORBIS_COMMENT = 4,
	CUESHEET = 5,
	PICTURE = 6
};

type MetadataBlock = {
	last: boolean;
	type: MetadataBlockType;
	body: Section;
};

const MetadataBlock = {
	parse(fd: number, section: Section): MetadataBlock {
		let buffer = Buffer.alloc(4);
		if (libfs.readSync(fd, buffer, 0, buffer.length, section.offset) !== buffer.length) {
			throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
		}
		let bits = buffer.readUint32BE(0);
		let last = !!((bits >>> 31) & 0x01);
		let type = (bits >>> 24) & 0x7F;
		let size = (bits >>> 0) & 0x00FFFFFF;
		if (size > section.length - 4) {
			throw new Error(`Expected a size of at most ${section.length - 4} bytes, got ${size}!`);
		}
		let body: Section = {
			offset: section.offset + 4,
			length: size
		};
		return {
			last,
			type,
			body
		};
	}
};

type StreamInfoBlock = {
	min_block_size_samples: number;
	max_block_size_samples: number;
	min_frame_size_bytes: number;
	max_frame_size_bytes: number;
	sample_rate_hz: number;
	number_of_channels: number;
	bits_per_sample: number;
	total_samples: number;
	md5: Buffer;
};

const StreamInfoBlock = {
	parse(fd: number, block: MetadataBlock): StreamInfoBlock {
		if (block.type !== MetadataBlockType.STREAMINFO) {
			throw new Error(`Expected a "STREAMINFO" metadata block, got "${MetadataBlockType[block.type]}"!`);
		}
		let buffer = Buffer.alloc(34);
		if (libfs.readSync(fd, buffer, 0, buffer.length, block.body.offset) !== buffer.length) {
			throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
		}
		let min_block_size_samples = buffer.readUint16BE(0);
		let max_block_size_samples = buffer.readUint16BE(2);
		let min_frame_size_bytes = buffer.readUintBE(4, 3);
		let max_frame_size_bytes = buffer.readUintBE(7, 3);
		let bits = buffer.readBigInt64BE(10);
		let sample_rate_hz = Number((bits >> 44n) & 0x000FFFFFn);
		let number_of_channels = Number((bits >> 41n) & 0x00000007n) + 1;
		let bits_per_sample = Number((bits >> 36n) & 0x0000001Fn) + 1;
		let total_samples = Number((bits >> 0n) & 0x0000000F_FFFFFFFFn);
		let md5 = buffer.subarray(18, 18 + 16);
		return {
			min_block_size_samples,
			max_block_size_samples,
			min_frame_size_bytes,
			max_frame_size_bytes,
			sample_rate_hz,
			number_of_channels,
			bits_per_sample,
			total_samples,
			md5
		};
	}
};

type VorbisCommentBlock = {
	vendor: string;
	tags: Array<{ key: string; value: string; }>;
};

const VorbisCommentBlock = {
	parse(fd: number, block: MetadataBlock): VorbisCommentBlock {
		if (block.type !== MetadataBlockType.VORBIS_COMMENT) {
			throw new Error(`Expected a "VORBIS_COMMENT" metadata block, got "${MetadataBlockType[block.type]}"!`);
		}
		let offset = block.body.offset;
		let dword = Buffer.alloc(4);
		if (libfs.readSync(fd, dword, 0, dword.length, offset) !== dword.length) {
			throw new Error(`Expected to read exactly ${dword.length} bytes!`);
		}
		offset += dword.length;
		let vendor = Buffer.alloc(dword.readUint32LE(0));
		if (libfs.readSync(fd, vendor, 0, vendor.length, offset) !== vendor.length) {
			throw new Error(`Expected to read exactly ${vendor.length} bytes!`);
		}
		offset += vendor.length;
		if (libfs.readSync(fd, dword, 0, dword.length, offset) !== dword.length) {
			throw new Error(`Expected to read exactly ${dword.length} bytes!`);
		}
		offset += dword.length;
		let number_of_tags = dword.readUint32LE(0);
		let tags: Array<{ key: string; value: string; }> = [];
		for (let i = 0; i < number_of_tags; i++) {
			if (libfs.readSync(fd, dword, 0, dword.length, offset) !== dword.length) {
				throw new Error(`Expected to read exactly ${dword.length} bytes!`);
			}
			offset += dword.length;
			let buffer = Buffer.alloc(dword.readUint32LE(0));
			if (libfs.readSync(fd, buffer, 0, buffer.length, offset) !== buffer.length) {
				throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
			}
			offset += buffer.length;
			let string = buffer.toString("utf-8").split("=");
			let key = string[0];
			let value = string.slice(1).join("=");
			tags.push({ key, value });
		}
		return {
			vendor: vendor.toString("utf-8"),
			tags
		};
	}
};

export function probe(fd: number): schema.Probe {
	let result: schema.Probe = {
		resources: []
	};
	let buffer = Buffer.alloc(4);
	if (libfs.readSync(fd, buffer, 0, buffer.length, 0) !== buffer.length) {
		throw new Error(`Expected to read exactly ${buffer.length} bytes!`);
	}
	if (buffer.subarray(0, 4).toString("ascii") !== "fLaC") {
		throw new Error(`Expected a "fLaC" identifier!`);
	}
	let file_size = libfs.fstatSync(fd).size;
	let section: Section = {
		offset: 4,
		length: file_size - 4
	};
	let metadata_blocks: Array<MetadataBlock> = [];
	while (true) {
		let metadata_block = MetadataBlock.parse(fd, section);
		metadata_blocks.push(metadata_block);
		section.offset = metadata_block.body.offset + metadata_block.body.length;
		section.length = file_size - section.offset;
		if (metadata_block.last) {
			break;
		}
	}
	let stream_info_block = StreamInfoBlock.parse(fd, metadata_blocks[0]);
	let duration_ms = Math.ceil(stream_info_block.total_samples / stream_info_block.sample_rate_hz * 1000);
	let sample_rate_hz = stream_info_block.sample_rate_hz;
	let channel_count = stream_info_block.number_of_channels;
	let bits_per_sample = stream_info_block.bits_per_sample;
	let tags: Tags = {};
	let vorbis_comment_block = metadata_blocks.find((one) => one.type === MetadataBlockType.VORBIS_COMMENT);
	if (vorbis_comment_block != null) {
		let vorbis_comment = VorbisCommentBlock.parse(fd, vorbis_comment_block);
		let album = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "album");
		if (album != null) {
			tags.album = album.value;
		}
		let artist = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "artist");
		if (artist != null) {
			tags.artist = artist.value;
		}
		let album_artist = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "albumartist");
		if (album_artist != null) {
			tags.album_artist = album_artist.value;
		}
		let disc_number = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "discnumber");
		if (disc_number != null) {
			let parts = /^([0-9]+)$/.exec(disc_number.value);
			if (parts != null) {
				tags.disc_number = parseInt(parts[1]);
			}
		}
		let track_number = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "tracknumber");
		if (track_number != null) {
			let parts = /^([0-9]+)$/.exec(track_number.value);
			if (parts != null) {
				tags.track_number = parseInt(parts[1]);
			}
		}
		let date = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "date");
		if (date != null) {
			let parts = /^([0-9]+)$/.exec(date.value);
			if (parts != null) {
				tags.year = parseInt(parts[1]);
			}
		}
		let title = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "title");
		if (title != null) {
			tags.title = title.value;
		}
		let copyright = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "copyright");
		if (copyright != null) {
			tags.copyright = copyright.value;
		}
		let genre = vorbis_comment.tags.find((tag) => tag.key.toLowerCase() === "genre");
		if (genre != null) {
			tags.genre = genre.value;
		}
	}
	if (is.present(tags.title) && is.present(tags.track_number) && is.present(tags.album)) {
		let metadata: schema.TrackMetadata = {
			type: "track",
			title: tags.title,
			disc: tags.disc_number ?? 1,
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
