import * as libcp from 'child_process';
import * as libcrypto from 'crypto';
import * as librl from 'readline';
import * as libhttp from 'http';
import * as libfs from 'fs';
import * as utils from './source/utils';

interface Callback<T> {
	(value: T): void;
}

interface Parser<T> {
	(string: string): T | null;
}

type TrackMetadata = {
	artists: Array<string>;
	title: string;
	duration_ms: number;
	number: number;
	index: number;
};

type DiscMetadata = {
	id: string;
	artists: Array<string>;
	title: string;
	year: number;
	number: number;
	tracks: Array<TrackMetadata>;
};

type CDDA_TRACK = {
	track_number: number;
	track_index: number;
	duration_ms: number;
};

type CDDA_TOC = {
	disc_id: string;
	tracks: Array<CDDA_TRACK>;
};

function log(string: string): void {
	process.stdout.write(`${string}\n`);
	return;
}

function save_disc_to_db(disc_id: string, disc: DiscMetadata, cb: Callback<void>): void {
	let cddb = require(`../store/cddb.json`);
	cddb[disc_id] = disc;
	libfs.writeFile(`../store/cddb.json`, JSON.stringify(cddb, null, `\t`), (error) => {
		cb();
	});
}

function get_disc_from_db(disc_id: string): DiscMetadata | null {
	let cddb = require(`../store/cddb.json`);
	let disc = cddb[disc_id];
	if (disc != undefined) {
		return disc;
	}
	return null;
}

function get_raw_toc(cb: Callback<Buffer>): void {
	let chunks = new Array<Buffer>();
	let cp = libcp.spawn(`disc_reader`, [ `toc` ]);
	cp.stderr.pipe(process.stderr);
	cp.stdout.setEncoding(`binary`);
	cp.stdout.on(`data`, (chunk) => {
		chunks.push(Buffer.from(chunk, `binary`));
	});
	cp.on(`close`, (code) => {
		let toc = Buffer.concat(chunks);
		cb(toc);
	});
	return;
}

function sector_from_msf(m: number, s: number, f: number): number {
	return (((m * 60) + s) * 75) + f;
}

function duration_from_ms(ms: number): string {
	let s = Math.floor(ms / 1000);
	ms -= (s * 1000);
	let m = Math.floor(s / 60);
	s -= (m * 60);
	let h = Math.floor(m / 60);
	m -= (h * 60);
	let tch = `00${h}`.slice(-2);
	let tcm = `00${m}`.slice(-2);
	let tcs = `00${s}`.slice(-2);
	let tcms = `000${ms}`.slice(-3);
	return `${tch}:${tcm}:${tcs}.${tcms}`;
}

function parse_toc(buffer: Buffer): CDDA_TOC {
	let disc_id = get_disc_id(buffer);
	let offset = 0;
	let length = buffer.readUInt16BE(offset); offset += 2;
	let first_track = buffer.readUInt8(offset); offset += 1;
	let last_track = buffer.readUInt8(offset); offset += 1;
	let tracks = new Array<CDDA_TRACK>();
	for (let track_number = first_track; track_number <= last_track; track_number++) {
		let track_index = track_number - first_track;
		let c1 = buffer.readUInt8(offset + ((track_number - 1) * 8) + 1);
		let c2 = buffer.readUInt8(offset + ((track_number) * 8) + 1);
		if ((c1 & 0x04) === 0x00) {
			let m1 = buffer.readUInt8(offset + ((track_number - 1) * 8) + 5);
			let s1 = buffer.readUInt8(offset + ((track_number - 1) * 8) + 6);
			let f1 = buffer.readUInt8(offset + ((track_number - 1) * 8) + 7);
			let m2 = buffer.readUInt8(offset + ((track_number) * 8) + 5);
			let s2 = buffer.readUInt8(offset + ((track_number) * 8) + 6);
			let f2 = buffer.readUInt8(offset + ((track_number) * 8) + 7);
			if ((c2 & 0x04) === 0x04) {
				m2 -= 2;
				s2 -= 30;
				s2 -= 2;
			}
			let sectors1 = sector_from_msf(m1, s1, f1);
			let sectors2 = sector_from_msf(m2, s2, f2);
			let duration_ms = Math.floor((sectors2 - sectors1) * (1000 / 75));
			tracks.push({
				track_number,
				track_index,
				duration_ms
			});
		}
	}
	return {
		disc_id,
		tracks
	};
}

function get_toc(cb: Callback<CDDA_TOC>): void {
	return get_raw_toc((buffer) => {
		let toc = parse_toc(buffer);
		return cb(toc);
	});
}

function get_disc_id(toc: Buffer): string {
	let hash = libcrypto.createHash(`sha256`);
	hash.update(toc);
	let disc_id = hash.digest(`hex`);
	return disc_id;
}

function get_input<T>(message: string, value: string, parser: Parser<T>, cb: Callback<T>): void {
	let rl = librl.createInterface({
		input: process.stdin,
		output: process.stderr
	});
	log(message);
	rl.on(`line`, (line) => {
		let parsed = parser(line);
		if (parsed !== null) {
			rl.close();
			return cb(parsed);
		} else {
			log(message);
			rl.write(line);
		}
	});
	rl.write(value);
	return;
}

function string_validator(string: string): string | null {
	if (string.length > 0) {
		return string;
	} else {
		return null;
	}
}

function number_validator(string: string): number | null {
	let number = Number.parseInt(string);
	if (Number.isInteger(number)) {
		return number;
	} else {
		return null;
	}
}

function make_interval_validator(min: number, max: number): Parser<number> {
	return (string: string) => {
		let number = number_validator(string);
		if (number !== null) {
			if (false) {
			} else if (number < min) {
				return null;
			} else if (number > max) {
				return null;
			} else {
				return number;
			}
		} else {
			return null;
		}
	};
}

function boolean_validator(string: string): boolean | null {
	if (false) {
	} else if (/^(t|true|y|yes|1|on)$/i.test(string)) {
		return true;
	} else if (/^(f|false|n|no|0|off)$/i.test(string)) {
		return false;
	} else {
		return null;
	}
}

function get_track_from_cli(track: CDDA_TRACK, artist: string, cb: Callback<TrackMetadata>): void {
	log(`Track ${('00' + track.track_number).slice(-2)}: ${duration_from_ms(track.duration_ms)}`);
	return get_input(`Please specify artist:`, artist, string_validator, (artist) => {
		return get_input(`Please specify title:`, ``, string_validator, (title) => {
			return cb({
				title,
				artists: [ artist ],
				duration_ms: track.duration_ms,
				number: track.track_number,
				index: track.track_index
			});
		});
	});
}

function get_tracks_from_cli(toc: CDDA_TOC, artist: string, cb: Callback<Array<TrackMetadata>>): void {
	log(`Disc has ${toc.tracks.length} audio tracks.`);
	let tracks = new Array<TrackMetadata>();
	let iterator = () => {
		if (tracks.length < toc.tracks.length) {
			return get_track_from_cli(toc.tracks[tracks.length], artist, (track) => {
				tracks.push(track);
				return iterator();
			});
		} else {
			return cb(tracks);
		}
	};
	return iterator();
}

function get_disc_from_cli(toc: CDDA_TOC, cb: Callback<DiscMetadata>): void {
	return get_input(`Please specify artist:`, ``, string_validator, (artist) => {
		return get_input(`Please specify title:`, ``, string_validator, (title) => {
			return get_input(`Please specify year:`, `2000`, make_interval_validator(0, 9999), (year) => {
				return get_input(`Please specify number:`, `1`, make_interval_validator(1, 99), (number) => {
					return get_tracks_from_cli(toc, artist, (tracks) => {
						return cb({
							id: toc.disc_id,
							artists: [ artist ],
							title,
							year,
							number,
							tracks
						});
					});
				});
			});
		});
	});
}

function make_form_for_track(track: TrackMetadata): string {
	return `
		<p>Track ${('00' + track.number).slice(-2)}: ${duration_from_ms(track.duration_ms)}</p>
		<input type="text" name="track[${track.index}].artists[0]" placeholder="Artist" value="${track.artists[0]}" />
		<input type="text" name="track[${track.index}].artists[1]" placeholder="Artist" value="${track.artists[1]}" />
		<input type="text" name="track[${track.index}].artists[2]" placeholder="Artist" value="${track.artists[2]}" />
		<input type="text" name="track[${track.index}].artists[3]" placeholder="Artist" value="${track.artists[3]}" />
		<input type="text" name="track[${track.index}].artists[4]" placeholder="Artist" value="${track.artists[4]}" /><br />
		<input type="text" name="track[${track.index}].title" placeholder="Title" value="${track.title}" /><br />`;
}

function make_form_for_disc(disc: DiscMetadata): string {
	return `
		<!doctype html>
		<html>
		<meta charset="utf-8" />
		<title>Disco</title>
		<head>
		</head>
		<body>
		<form method="POST">
		<input type="text" name="disc.artists[0]" placeholder="Artist" value="${disc.artists[0]}" />
		<input type="text" name="disc.artists[1]" placeholder="Artist" value="${disc.artists[1]}" />
		<input type="text" name="disc.artists[2]" placeholder="Artist" value="${disc.artists[2]}" />
		<input type="text" name="disc.artists[3]" placeholder="Artist" value="${disc.artists[3]}" />
		<input type="text" name="disc.artists[4]" placeholder="Artist" value="${disc.artists[4]}" /><br />
		<input type="text" name="disc.title" placeholder="Title" value="${disc.title}" /><br />
		<input type="number" name="disc.year" placeholder="Year" value="${disc.year}" /><br />
		<input type="number" name="disc.number" placeholder="Number" value="${disc.number}" /><br />
		${disc.tracks.map(make_form_for_track).join('\n')}
		<input type="submit" /><br />
		</form>
		</body>
		</html>`;
}

function get_disc_from_qs(toc: CDDA_TOC, qs: string): DiscMetadata {
	let disc = make_disc_from_toc(toc);
	let parts = qs.split(`&`);
	for (let i = 0; i < parts.length; i++) {
		let kv = parts[i].split(`=`);
		let k = decodeURIComponent(kv[0].split(`+`).join(`%20`));
		let v = decodeURIComponent(kv[1].split(`+`).join(`%20`));
		let re: RegExpExecArray | null = null;
		if (false) {
		} else if ((re = /^disc\.artists\[([0-9]+)\]$/.exec(k)) !== null) {
			let artist = Number.parseInt(re[1]);
			disc.artists[artist] = v;
		} else if ((re = /^disc\.title$/.exec(k)) !== null) {
			disc.title = v;
		} else if ((re = /^disc\.year$/.exec(k)) !== null) {
			disc.year = Number.parseInt(v);
		} else if ((re = /^disc\.number$/.exec(k)) !== null) {
			disc.number = Number.parseInt(v);
		} else if ((re = /^track\[([0-9]+)\].artists\[([0-9]+)\]$/.exec(k)) !== null) {
			let track = Number.parseInt(re[1]);
			let artist = Number.parseInt(re[2]);
			disc.tracks[track].artists[artist] = v;
		} else if ((re = /^track\[([0-9]+)\]\.title$/.exec(k)) !== null) {
			let track = Number.parseInt(re[1]);
			disc.tracks[track].title = v;
		} else {
			log(`Bad input identifier: "${k}"`);
		}
	}
	return disc;
}

function is_disc_valid(disc: DiscMetadata): boolean {
	if (disc.artists.find((artist) => artist !== ``) === undefined) {
		return false;
	}
	if (disc.title === ``) {
		return false;
	}
	if (!Number.isInteger(disc.year) || disc.year < 0 || disc.year > 9999) {
		return false;
	}
	if (!Number.isInteger(disc.number) || disc.number < 1 || disc.number > 99) {
		return false;
	}
	for (let i = 0; i < disc.tracks.length; i++) {
		let track = disc.tracks[i];
		if (track.artists.find((artist) => artist !== ``) === undefined) {
			return false;
		}
		if (track.title === ``) {
			return false;
		}
	}
	return true;
}

function make_disc_from_toc(toc: CDDA_TOC): DiscMetadata {
	return {
		id: toc.disc_id,
		artists: new Array<string>(5).fill(``),
		title: ``,
		year: 0,
		number: 0,
		tracks: toc.tracks.map<TrackMetadata>((track) => ({
			artists: new Array<string>(5).fill(``),
			title: ``,
			duration_ms: track.duration_ms,
			number: track.track_number,
			index: track.track_index
		}))
	};
}

function get_disc_from_ws(toc: CDDA_TOC, cb: Callback<DiscMetadata>): void {
	let disc = make_disc_from_toc(toc);
	let http = libhttp.createServer((request, response) => {
		if (false) {
		} else if (request.url === `/${toc.disc_id}`) {
			if (false) {
			} else if (request.method === `GET`) {
				response.writeHead(200, {
					'content-type': `text/html; charset=utf-8`
				});
				return response.end(make_form_for_disc(disc));
			} else if (request.method === `POST`) {
				let chunks = new Array<Buffer>();
				request.on(`data`, (chunk) => {
					chunks.push(Buffer.from(chunk, `binary`));
				});
				request.on(`end`, () => {
					let buffer = Buffer.concat(chunks);
					let qs = buffer.toString(`utf-8`);
					disc = get_disc_from_qs(toc, qs);
					if (is_disc_valid(disc)) {
						response.writeHead(200, {
							'content-type': `text/html; charset=utf-8`
						});
						response.end(`<!doctype html>\n<html><head>\n<meta charset="utf-8" />\n<title>Disco</title>\n</head>\n<body>\n<p>Thanks!</p>\n</body>\n</html>`);
						return http.close(() => {
							cb(disc);
						});
					} else {
						response.writeHead(200, {
							'content-type': `text/html; charset=utf-8`
						});
						return response.end(make_form_for_disc(disc));
					}
				});
			} else {
				response.writeHead(405);
				return response.end();
			}
		} else {
			response.writeHead(404);
			return response.end();
		}
	});
	http.listen(80, () => {
		log(`Please supply disc metadata at: http://localhost/${toc.disc_id}`);
	});
}

function get_disc(cb: Callback<DiscMetadata>): void {
	return get_toc((toc) => {
		log(`Disc id determined as "${toc.disc_id}"`);
		let disc = get_disc_from_db(toc.disc_id);
		if (disc !== null) {
			log(`Disc recognized.`);
			return cb(disc);
		} else {
			log(`Disc not recognized.`);
			return get_disc_from_ws(toc, (disc) => {
				return save_disc_to_db(toc.disc_id, disc, () => {
					return cb(disc);
				});
			});
		}
	});
}

function backup_track(track_number: number, cb: Callback<Buffer>): void {
	let chunks = new Array<Buffer>();
	let cp = libcp.spawn(`disc_reader`, [ `ext`, `${track_number}` ]);
	cp.stderr.pipe(process.stderr);
	cp.stdout.setEncoding(`binary`);
	cp.stdout.on(`data`, (chunk) => {
		chunks.push(Buffer.from(chunk, `binary`));
	});
	cp.on(`close`, (code) => {
		let data = Buffer.concat(chunks);
		cb(data);
	});
	return;
}

function get_basename(disc_metadata: DiscMetadata, index: number): string {
	let track_metadata = disc_metadata.tracks[index];
	let number = ('00' + track_metadata.number).slice(-2);
	let artist = utils.pathify(track_metadata.artists[0]);
	let title = utils.pathify(track_metadata.title);
	let suffix = utils.pathify(utils.config.suffix);
	return `${number}-${artist}-${title}-${suffix}`;
}

function backup_disc(disc: DiscMetadata, cb: Callback<void>): void {
	let iterator = (index: number) => {
		if (index < disc.tracks.length) {
			return backup_track(disc.tracks[index].number, (data) => {
				let hash = libcrypto.createHash('sha256');
				hash.update(data);
				let tid = hash.digest('hex');
				log(`Track id: ${tid}`);
				log(`Basename: ${get_basename(disc, index)}`);
				return libfs.writeFile(`../jobs/queue/${disc.id}.${('00' + disc.tracks[index].number).slice(-2)}.raw`, data, (error) => {
					return iterator(index + 1);
				});
			});
		} else {
			cb();
		}
	};
	return iterator(0);
}













 get_disc((disc) => {
	 return backup_disc(disc, () => {
		process.exit(0);
	 })
 });
