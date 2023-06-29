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

function decodeSyncSafeInteger(buffer: Buffer): number {
	let a = buffer.readUInt8(0);
	let b = buffer.readUInt8(1);
	let c = buffer.readUInt8(2);
	let d = buffer.readUInt8(3);
	return ((a & 0x7F) << 21) | ((b & 0x7F) << 14) | ((c & 0x7F) << 7) | ((d & 0x7F) << 0);
}

function parseID3v2Header(reader: readers.Binary): Tags {
	return reader.newContext((read, skip) => {
		let buffer = Buffer.alloc(10);
		read(buffer);
		if (buffer.slice(0, 5).toString("binary") !== "ID3\x04\x00") {
			throw `Expected an ID3v2 tag!`;
		}
		let length = decodeSyncSafeInteger(buffer.slice(6, 6 + 4));
		let body = Buffer.alloc(length);
		read(body);
		let tags: Tags = {};
		let offset = 0;
		while (offset < body.length) {
			let type = body.slice(offset, offset + 4).toString("binary");
			let length = decodeSyncSafeInteger(body.slice(offset + 4, offset + 4 + 4));
			let flags = body.slice(offset + 8, offset + 8 + 2);
			let data = body.slice(offset + 10, offset + 10 + length);
			offset += 10 + length;
			if (type === "\0\0\0\0") {
				break;
			} else if (type === "TCOP") {
				tags.copyright = data.slice(1, -1).toString();
			} else if (type === "TIT2") {
				tags.title = data.slice(1, -1).toString();
			} else if (type === "TALB") {
				tags.album = data.slice(1, -1).toString();
			} else if (type === "TDRC") {
				let string = data.slice(1, -1).toString();
				let parts = /^([0-9]+)$/.exec(string);
				if (is.present(parts)) {
					tags.year = parseInt(parts[1]);
				}
			} else if (type === "TRCK") {
				let string = data.slice(1, -1).toString();
				let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
				if (is.present(parts)) {
					tags.track_number = parseInt(parts[1]);
				}
			} else if (type === "TPOS") {
				let string = data.slice(1, -1).toString();
				let parts = /^([0-9]+)(?:\/([0-9]+))?$/.exec(string);
				if (is.present(parts)) {
					tags.disc_number = parseInt(parts[1]);
				}
			} else if (type === "TPE1") {
				tags.artist = data.slice(1, -1).toString();
			} else if (type === "TPE2") {
				tags.album_artist = data.slice(1, -1).toString();
			} else if (type === "TXXX") {
				let string = data.slice(1, -1).toString();
				let parts = /^ALBUM ARTIST\0(.+)$/.exec(string);
				if (is.present(parts)) {
					tags.album_artist = parts[1];
				}
			}
		}
		return tags;
	});
}

enum Version {
	V2_5,
	RESERVED,
	V2,
	V1
};

enum Layer {
	RESERVED,
	LAYER_3,
	LAYER_2,
	LAYER_1
};

const KILOBITS_PER_SECOND = [
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
	0
];

const SAMPLES_PER_SECOND = [
	44100,
	48000,
	32000,
	0
];

function parseXingHeader(reader: readers.Binary): number {
	return reader.newContext((read, skip) => {
		let buffer = Buffer.alloc(4);
		read(buffer);
		let sync = ((buffer[0] & 0xFF) << 3) | ((buffer[1] & 0xE0) >> 5);
		let version = ((buffer[1] & 0x18) >> 3) as Version;
		let layer = ((buffer[1] & 0x06) >> 1) as Layer;
		let skip_crc = ((buffer[1] & 0x01) >> 0);
		let bitrate = ((buffer[2] & 0xF0) >> 4);
		let sample_rate = ((buffer[2] & 0x0C) >> 2);
		let padded = ((buffer[2] & 0x02) >> 1);
		let application_private = ((buffer[2] & 0x01) >> 0);
		let channels = ((buffer[3] & 0xC0) >> 6);
		let mode_extension = ((buffer[3] & 0x30) >> 4);
		let copyrighted = ((buffer[3] & 0x08) >> 3);
		let original = ((buffer[3] & 0x04) >> 2);
		let emphasis = ((buffer[3] & 0x03) >> 0);
		if (sync === 0x07FF && version === Version.V1 && layer === Layer.LAYER_3) {
			let samples_per_frame = 1152;
			let slots = Math.floor(samples_per_frame * KILOBITS_PER_SECOND[bitrate] * 1000 / 8 / SAMPLES_PER_SECOND[sample_rate]);
			if (padded) {
				slots += 1;
			}
			let bytes = slots * 1;
			let body = Buffer.alloc(bytes - 4);
			read(body);
			let zeroes = body.slice(0, 0 + 32);
			let xing = body.slice(32, 32 + 4);
			if (xing.toString("binary") === "Xing" || xing.toString() === "Info") {
				let flags = body.slice(36, 36 + 4);
				let has_quality = ((flags[3] & 0x08) >> 3);
				let has_toc = ((flags[3] & 0x04) >> 2);
				let has_bytes = ((flags[3] & 0x02) >> 1);
				let has_frames = ((flags[3] & 0x01) >> 0);
				let offset = 40;
				if (has_frames) {
					let num_frames = body.readUInt32BE(offset); offset += 4;
					let duration_ms = Math.ceil((num_frames * samples_per_frame / SAMPLES_PER_SECOND[sample_rate]) * 1000);
					return duration_ms;
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
		throw `Expected a Xing header!`;
	});
}

export function probe(fd: number): schema.Probe {
	let reader = new readers.Binary(fd);
	let tags = parseID3v2Header(reader);
	let duration_ms = 3 * 60 * 1000;
	// TODO: Improve xing parsing.
	try {
		duration_ms = parseXingHeader(reader);
	} catch (error) {}
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
		let metadata: schema.TrackMetadata = {
			type: "track",
			title: tags.title,
			disc: 0,
			track: 0,
			album: {
				title: "Tracks",
				artists: is.absent(tags.album_artist) ? [] : tags.album_artist.split(";").map((artist) => artist.trim())
			},
			artists: is.absent(tags.artist) ? [] : tags.artist.split(";").map((artist) => artist.trim()),
			copyright: tags.copyright
		};
		result.metadata = metadata;
	}
	return result;
};
