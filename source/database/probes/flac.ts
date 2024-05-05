import * as libfs from "fs";
import * as schema from "./schema";

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
	result.resources.push({
		type: "audio",
		duration_ms
	});
	return result;
};
