import * as libfs from "fs";
import * as is from "../is";
import * as schema from "./schema";

type Scope = {
	offset: number,
	length: number
};

class Atom {
	private fd: number;
	private type: string;
	private body: Scope;

	constructor(fd: number, type: string, body: Scope) {
		this.fd = fd;
		this.type = type;
		this.body = body;
	}

	getAllChildren(): Array<Atom> {
		let scope = {
			...this.body
		};
		let atoms = new Array<Atom>();
		while (scope.length > 0) {
			let atom = Atom.parse(this.fd, scope);
			// The "udta" atom begins with a mandatory zero-terminated list.
			if (this.type === "udta") {
				atom.body.offset += 4;
				atom.body.length -= 4;
			}
			atoms.push(atom);
			scope.offset = atom.body.offset + atom.body.length;
			scope.length = this.body.offset + this.body.length - scope.offset;
		}
		return atoms;
	}

	getChild(type: string): Atom {
		let children = this.getChildren(type);
		if (children.length !== 1) {
			throw `Expected exactly one child!`;
		}
		return children[0];
	}

	getChildren(type: string): Array<Atom> {
		return this.getAllChildren().filter((atom) => {
			return atom.type === type;
		});
	}

	readBody(): Buffer {
		let buffer = Buffer.alloc(this.body.length);
		if (libfs.readSync(this.fd, buffer, 0, buffer.length, this.body.offset) !== buffer.length) {
			throw `Expected to read exactly ${buffer.length} bytes!`;
		}
		return buffer;
	}

	static parse(fd: number, scope: Scope): Atom {
		let offset = scope.offset;
		let buffer = Buffer.alloc(8);
		if (libfs.readSync(fd, buffer, 0, buffer.length, offset) !== buffer.length) {
			throw `Expected to read exactly ${buffer.length} bytes!`;
		}
		offset += buffer.length;
		let length = buffer.readUInt32BE(0);
		let type = buffer.slice(4, 4 + 4).toString("binary");
		if (length === 0) {
			length = scope.length - offset;
		} else if (length === 1) {
			if (libfs.readSync(fd, buffer, 0, buffer.length, offset) !== buffer.length) {
				throw `Expected to read exactly ${buffer.length} bytes!`;
			}
			offset += buffer.length;
			length = Number(buffer.readBigUInt64BE(0));
		}
		if (length < 8) {
			throw `Expected a length of at least 8 bytes, got ${length}!`;
		} else if (length > scope.length) {
			throw `Expected a length of at most ${scope.length} bytes, got ${length}!`;
		}
		length -= 8;
		return new Atom(fd, type, {
			offset,
			length
		});
	}
};

type Tags = {
	title?: string,
	year?: number,
	comment?: string,
	show?: string,
	season_number?: number,
	episode?: string,
	episode_number?: number,
	album?: string,
	artist?: string,
	album_artist?: string,
	disc_number?: number,
	track_number?: number
};

export function probe(fd: number): schema.Probe {
	let atom = new Atom(fd, "root", {
		offset: 0,
		length: libfs.fstatSync(fd).size
	});
	let moov = atom.getChild("moov");
	let mvhd = moov.getChild("mvhd");
	let buffer = mvhd.readBody();
	let ts = buffer.readUInt32BE(12);
	let result: schema.Probe = {
		streams: moov.getChildren("trak").map((trak) => {
			let tkhd = trak.getChild("tkhd");
			let buffer = tkhd.readBody();
			let duration_ts = buffer.readUInt32BE(20);
			let width = buffer.readUInt16BE(76);
			let height = buffer.readUInt16BE(80);
			let duration_ms = Math.ceil(duration_ts / ts * 1000);
			if (duration_ms > 0 && width > 0 && height > 0) {
				let stream: schema.VideoStream = {
					type: "video",
					duration_ms,
					width,
					height
				};
				return stream;
			} else if (duration_ms > 0) {
				let stream: schema.AudioStream = {
					type: "audio",
					duration_ms
				};
				return stream;
			} else {
				let stream: schema.UnknownStream = {
					type: "unknown"
				};
				return stream
			}
		})
	};
	try {
		let udta = moov.getChild("udta");
		let meta = udta.getChild("meta");
		let ilst = meta.getChild("ilst");
		let tags: Tags = {};
		try {
			let buffer = ilst.getChild("tvsh").getChild("data").readBody();
			tags.show = buffer.slice(8).toString();
		} catch (error) {}
		try {
			let buffer = ilst.getChild("tven").getChild("data").readBody();
			tags.episode = buffer.slice(8).toString();
		} catch (error) {}
		try {
			let buffer = ilst.getChild("tves").getChild("data").readBody();
			tags.episode_number = buffer.readUInt32BE(8);
		} catch (error) {}
		try {
			let buffer = ilst.getChild("tvsn").getChild("data").readBody();
			tags.season_number = buffer.readUInt32BE(8);
		} catch (error) {}
		try {
			let buffer = ilst.getChild("\u00A9nam").getChild("data").readBody();
			tags.title = buffer.slice(8).toString();
		} catch (error) {}
		try {
			let buffer = ilst.getChild("\u00A9day").getChild("data").readBody();
			tags.year = Number.parseInt(buffer.slice(8).toString());
		} catch (error) {}
		try {
			let buffer = ilst.getChild("\u00A9cmt").getChild("data").readBody();
			tags.comment = buffer.slice(8).toString();
		} catch (error) {}
		try {
			let buffer = ilst.getChild("\u00A9ART").getChild("data").readBody();
			tags.artist = buffer.slice(8).toString();
		} catch (error) {}
		try {
			let buffer = ilst.getChild("\u00A9alb").getChild("data").readBody();
			tags.album = buffer.slice(8).toString();
		} catch (error) {}
		try {
			let buffer = ilst.getChild("aART").getChild("data").readBody();
			tags.album_artist = buffer.slice(8).toString();
		} catch (error) {}
		try {
			let buffer = ilst.getChild("trkn").getChild("data").readBody();
			tags.track_number = buffer.readUInt32BE(8);
		} catch (error) {}
		try {
			let buffer = ilst.getChild("disk").getChild("data").readBody();
			tags.disc_number = buffer.readUInt32BE(8);
		} catch (error) {}
		if (result.streams.find((stream) => stream.type === "video")) {
			if (is.present(tags.episode) && is.present(tags.season_number) && is.present(tags.episode_number) && is.present(tags.show)) {
				let metadata: schema.EpisodeMetadata = {
					type: "episode",
					title: tags.episode,
					season: tags.season_number,
					episode: tags.episode_number,
					year: tags.year,
					summary: tags.comment,
					show: {
						title: tags.show,
						summary: undefined,
						genres: [],
						actors: []
					}
				};
				result.metadata = metadata;
			} else if (is.present(tags.title)) {
				let metadata: schema.MovieMetadata = {
					type: "movie",
					title: tags.title,
					year: tags.year,
					summary: tags.comment,
					genres: [],
					actors: []
				};
				result.metadata = metadata;
			}
		} else if (result.streams.find((stream) => stream.type === "audio")) {
			if (is.present(tags.title) && is.present(tags.disc_number) && is.present(tags.track_number) && is.present(tags.album)) {
				let metadata: schema.TrackMetadata = {
					type: "track",
					title: tags.title,
					disc: tags.disc_number,
					track: tags.track_number,
					album: {
						title: tags.album,
						year: tags.year,
						artists: is.absent(tags.album_artist) ? [] : tags.album_artist.split(";").map((artist) => artist.trim()).map((artist) => ({
							title: artist
						}))
					},
					artists: is.absent(tags.artist) ? [] : tags.artist.split(";").map((artist) => artist.trim()).map((artist) => ({
						title: artist
					}))
				};
				result.metadata = metadata;
			}
		}
	} catch (error) {}
	return result;
};
