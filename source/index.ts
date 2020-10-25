import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libpath from "path";
import * as libdb from "./database";
import * as libvtt from "./vtt";
import * as metadata from "./metadata";
import * as utils from "./utils";
import * as languages from "./languages";

let media_root = './private/media/';

if (!libfs.existsSync(media_root)) {
	libfs.mkdirSync(media_root, { recursive: true });
}

let db: libdb.MediaDatabase = {
	audio: {
		artists: new Array<libdb.ArtistEntry>(),
		albums: new Array<libdb.AlbumEntry>(),
		discs: new Array<libdb.DiscEntry>(),
		tracks: new Array<libdb.TrackEntry>(),
		album_artists: new Array<libdb.AlbumArtistEntry>(),
		track_artists: new Array<libdb.TrackArtistEntry>()
	},
	video: {
		genres: new Array<libdb.VideoGenreEntry>(),
		movie_parts: new Array<libdb.MoviePartEntry>(),
		movies: new Array<libdb.MovieEntry>(),
		movie_genres: new Array<libdb.MovieGenreEntry>(),
		movie_persons: new Array<libdb.MoviePersonEntry>(),
		shows: new Array<libdb.ShowEntry>(),
		show_genres: new Array<libdb.ShowGenreEntry>(),
		show_persons: new Array<libdb.ShowPersonEntry>(),
		seasons: new Array<libdb.SeasonEntry>(),
		episodes: new Array<libdb.EpisodeEntry>(),
		subtitles: new Array<libdb.SubtitleEntry>(),
		subtitle_contents: new Array<libdb.SubtitleContentEntry>(),
		cues: new Array<libdb.CueEntry>()
	},
	persons: new Array<libdb.PersonEntry>(),
	files: new Array<libdb.FileEntry>()
};

let video_genres_index: utils.Index<libdb.VideoGenreEntry> = {};
let show_genres_index: utils.Index<libdb.ShowGenreEntry> = {};
let movie_genres_index: utils.Index<libdb.MovieGenreEntry> = {};
let show_persons_index: utils.Index<libdb.ShowPersonEntry> = {};
let movie_persons_index: utils.Index<libdb.MoviePersonEntry> = {};
let movie_parts_index: utils.Index<libdb.MoviePartEntry> = {};
let movies_index: utils.Index<libdb.MovieEntry> = {};
let shows_index: utils.Index<libdb.ShowEntry> = {};
let seasons_index: utils.Index<libdb.SeasonEntry> = {};
let episodes_index: utils.Index<libdb.EpisodeEntry> = {};
let subtitles_index: utils.Index<libdb.SubtitleEntry> = {};

let artists_index: utils.Index<libdb.ArtistEntry> = {};
let albums_index: utils.Index<libdb.AlbumEntry> = {};
let discs_index: utils.Index<libdb.DiscEntry> = {};
let tracks_index: utils.Index<libdb.TrackEntry> = {};
let album_artists_index: utils.Index<libdb.AlbumArtistEntry> = {};
let track_artists_index: utils.Index<libdb.TrackArtistEntry> = {};

let persons_index: utils.Index<libdb.PersonEntry> = {};

let files_index: utils.Index<libdb.FileEntry> = {};

let add_person = (person: libdb.PersonEntry): void => {
	if (!(person.person_id in persons_index)) {
		persons_index[person.person_id] = person;
		db.persons.push(person);
	}
};

let add_show_person = (show_person: libdb.ShowPersonEntry): void => {
	let key = Array.of(show_person.show_id, show_person.person_id).join(":");
	if (!(key in show_persons_index)) {
		show_persons_index[key] = show_person;
		db.video.show_persons.push(show_person);
	}
};

let add_movie_person = (movie_person: libdb.MoviePersonEntry): void => {
	let key = Array.of(movie_person.movie_id, movie_person.person_id).join(":");
	if (!(key in movie_persons_index)) {
		movie_persons_index[key] = movie_person;
		db.video.movie_persons.push(movie_person);
	}
};

let add_video_genre = (video_genre: libdb.VideoGenreEntry): void => {
	if (!(video_genre.video_genre_id in video_genres_index)) {
		video_genres_index[video_genre.video_genre_id] = video_genre;
		db.video.genres.push(video_genre);
	}
};

let add_show_genre = (show_genre: libdb.ShowGenreEntry): void => {
	let key = Array.of(show_genre.show_id, show_genre.video_genre_id).join(":");
	if (!(key in show_genres_index)) {
		show_genres_index[key] = show_genre;
		db.video.show_genres.push(show_genre);
	}
};

let add_movie_genre = (movie_genre: libdb.MovieGenreEntry): void => {
	let key = Array.of(movie_genre.movie_id, movie_genre.video_genre_id).join(":");
	if (!(key in movie_genres_index)) {
		movie_genres_index[key] = movie_genre;
		db.video.movie_genres.push(movie_genre);
	}
};

let add_movie_part = (movie_part: libdb.MoviePartEntry): void => {
	if (!(movie_part.movie_part_id in movie_parts_index)) {
		movie_parts_index[movie_part.movie_part_id] = movie_part;
		db.video.movie_parts.push(movie_part);
	}
};

let add_movie = (movie: libdb.MovieEntry): void => {
	if (!(movie.movie_id in movies_index)) {
		movies_index[movie.movie_id] = movie;
		db.video.movies.push(movie);
	}
};

let add_show = (show: libdb.ShowEntry): void => {
	if (!(show.show_id in shows_index)) {
		shows_index[show.show_id] = show;
		db.video.shows.push(show);
	}
};

let add_season = (season: libdb.SeasonEntry): void => {
	if (!(season.season_id in seasons_index)) {
		seasons_index[season.season_id] = season;
		db.video.seasons.push(season);
	}
};

let add_episode = (episode: libdb.EpisodeEntry): void => {
	if (!(episode.episode_id in episodes_index)) {
		episodes_index[episode.episode_id] = episode;
		db.video.episodes.push(episode);
	}
};

let add_artist = (artist: libdb.ArtistEntry): void => {
	if (!(artist.artist_id in artists_index)) {
		artists_index[artist.artist_id] = artist;
		db.audio.artists.push(artist);
	}
};

let add_album = (album: libdb.AlbumEntry): void => {
	if (!(album.album_id in albums_index)) {
		albums_index[album.album_id] = album;
		db.audio.albums.push(album);
	}
};

let add_disc = (disc: libdb.DiscEntry): void => {
	if (!(disc.disc_id in discs_index)) {
		discs_index[disc.disc_id] = disc;
		db.audio.discs.push(disc);
	}
};

let add_track = (track: libdb.TrackEntry): void => {
	if (!(track.track_id in tracks_index)) {
		tracks_index[track.track_id] = track;
		db.audio.tracks.push(track);
	}
};

let add_album_artist = (album_artist: libdb.AlbumArtistEntry): void => {
	let key = Array.of(album_artist.album_id, album_artist.artist_id).join(":");
	if (!(key in album_artists_index)) {
		album_artists_index[key] = album_artist;
		db.audio.album_artists.push(album_artist);
	}
};

let add_track_artist = (track_artist: libdb.TrackArtistEntry): void => {
	let key = Array.of(track_artist.track_id, track_artist.artist_id).join(":");
	if (!(key in track_artists_index)) {
		track_artists_index[key] = track_artist;
		db.audio.track_artists.push(track_artist);
	}
};

let add_subtitle = (subtitle: libdb.SubtitleEntry): void => {
	if (!(subtitle.subtitle_id in subtitles_index)) {
		subtitles_index[subtitle.subtitle_id] = subtitle;
		db.video.subtitles.push(subtitle);
	}
};

let add_file = (file: libdb.FileEntry): void => {
	if (!(file.file_id in files_index)) {
		files_index[file.file_id] = file;
		db.files.push(file);
	}
};

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

function wordify(string: string): string[] {
	return string
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\|\/\\\_\-]/g, " ")
		.replace(/[^a-z0-9 ]/g, "")
		.trim()
		.split(/[ ]+/g);
}

function makeFileId(...parts: string[]): string {
	const string = parts.map(wordify).map((words) => {
		return words.join(" ");
	}).join(":");
	const hash = libcrypto.createHash("md5");
	hash.update(string);
	return hash.digest("hex");
}

function zeropad(number: number, length: number): string {
	return number.toString().padStart(length, "0");
}

let visit_audio = (node: string): void => {
	let tag = read_id3v24_tag(node);
	let nodes = node.split(libpath.sep);
	let file_id = makeFileId(...nodes);
	add_file({
		file_id: file_id,
		path: nodes,
		mime: 'audio/mp3'
	});
	if (tag.album_artists !== null && tag.album_name !== null && tag.year !== null && tag.disc !== null && tag.track !== null && tag.track_artists != null && tag.track_title !== null) {
		let album_id = makeFileId(...tag.album_artists, tag.album_name, zeropad(tag.year, 4));
		add_album({
			album_id: album_id,
			title: tag.album_name,
			year: tag.year,
			cover_file_id: null
		});
		for (let album_artist of tag.album_artists) {
			let album_artist_id = makeFileId(album_artist);
			add_artist({
				artist_id: album_artist_id,
				title: album_artist
			});
			add_album_artist({
				album_id: album_id,
				artist_id: album_artist_id
			});
		}
		let disc_id = makeFileId(...tag.album_artists, tag.album_name, zeropad(tag.year, 4), zeropad(tag.disc, 2));
		add_disc({
			disc_id: disc_id,
			album_id: album_id,
			number: tag.disc
		});
		let track_id = makeFileId(...tag.album_artists, tag.album_name, zeropad(tag.year, 4), zeropad(tag.disc, 2), zeropad(tag.track, 2));
		add_track({
			track_id: track_id,
			disc_id: disc_id,
			file_id: file_id,
			title: tag.track_title,
			number: tag.track,
			duration: tag.duration
		});
		for (let track_artist of tag.track_artists) {
			let track_artist_id = makeFileId(track_artist);
			add_artist({
				artist_id: track_artist_id,
				title: track_artist
			});
			add_track_artist({
				track_id: track_id,
				artist_id: track_artist_id
			});
		}
	}
};

let decode_mp4_length = (b: Buffer): number => {
	return (b[0] * 256*256*256) + ((b[1] << 16) | (b[2] << 8) | (b[3] << 0));
};

type FileDescriptor = {
	fd: number;
	offset: number;
};

type MP4AtomHeader = {
	kind: string;
	length: number;
};

let read_mp4_atom = (fds: FileDescriptor): MP4AtomHeader => {
	let header = Buffer.alloc(8);
	fds.offset += libfs.readSync(fds.fd, header, 0, header.length, fds.offset);
	let length = decode_mp4_length(header.slice(0, 0 + 4));
	let kind = header.slice(4, 4 + 4).toString('binary');
	return { kind, length };
};

let read_mp4_atom_body = (fds: FileDescriptor, atom: MP4AtomHeader): Buffer => {
	let body = Buffer.alloc(atom.length - 8);
	fds.offset += libfs.readSync(fds.fd, body, 0, body.length, fds.offset);
	return body;
};

type MP4Tag = {
	show: string | null;
	season: number | null;
	episode: number | null;
	title: string | null;
	year: number | null;
	duration: number;
	comment: string | null;
	artists: string[] | null;
	album_artists: string[] | null;
	album: string | null;
	track_number: number | null;
	disc_number: number | null;
};

let visit_atom = (tag: MP4Tag, fds: FileDescriptor, path: string, maxlength: number): void => {
	let length = 0;
	while (length < maxlength) {
		let atom = read_mp4_atom(fds);
		if (atom.length === 0) {
			break;
		}
		length += atom.length;
		if (path === '' && atom.kind === 'moov') {
			visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
		} else if (path === '.moov' && atom.kind === 'udta') {
			visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
		} else if (path === '.moov.udta' && atom.kind === 'meta') {
			fds.offset += 4;
			visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
		} else if (path === '.moov.udta.meta' && atom.kind === 'ilst') {
			visit_atom(tag, fds, `${path}.${atom.kind}`, atom.length);
		} else if (path === '.moov' && atom.kind === 'mvhd') {
			let buffer = read_mp4_atom_body(fds, atom);
			let offset = 12;
			let ts = buffer.readUInt32BE(offset); offset += 4;
			let tsdur = buffer.readUInt32BE(offset); offset += 4;
			tag.duration = (tsdur / ts * 1000) | 0;
		} else if (path === '.moov.udta.meta.ilst') {
			if (atom.kind === 'tvsh') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.show = buffer.slice(16).toString();
			} else if (atom.kind === 'tven') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.title = buffer.slice(16).toString();
			} else if (atom.kind === 'tves') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.episode = decode_mp4_length(buffer.slice(16));
			} else if (atom.kind === 'tvsn') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.season = decode_mp4_length(buffer.slice(16));
			} else if (atom.kind === '\u00A9nam') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.title = buffer.slice(16).toString();
			} else if (atom.kind === '\u00A9day') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.year = parseInt(buffer.slice(16).toString());
			} else if (atom.kind === '\u00A9ART') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.artists = buffer.slice(16).toString().split(";").map((a) => a.trim());
			} else if (atom.kind === 'aART') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.album_artists = buffer.slice(16).toString().split(";").map((a) => a.trim());
			} else if (atom.kind === '\u00A9alb') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.album = buffer.slice(16).toString();
			} else if (atom.kind === 'trkn') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.track_number = decode_mp4_length(buffer.slice(16));
			} else if (atom.kind === 'disk') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.disc_number = decode_mp4_length(buffer.slice(16));
			} else if (atom.kind === '\u00A9cmt') {
				let buffer = read_mp4_atom_body(fds, atom);
				tag.comment = buffer.slice(16).toString();
			} else {
				fds.offset += atom.length - 8;
			}
		} else {
			fds.offset += atom.length - 8;
		}
	}
};

let read_mp4_tag = (file: string): MP4Tag => {
	let fds = {
		fd: libfs.openSync(file, 'r'),
		offset: 0
	};
	try {
		let header = read_mp4_atom(fds);
		if (header.kind !== 'ftyp') {
			throw new Error();
		}
		read_mp4_atom_body(fds, header);
		let tag = {
			show: null,
			season: null,
			episode: null,
			title: null,
			year: null,
			duration: 0,
			comment: null,
			artists:  null,
			album_artists: null,
			album: null,
			track_number: null,
			disc_number: null
		};
		visit_atom(tag, fds, '', header.length);
		libfs.closeSync(fds.fd);
		return tag;
	} catch (error) {
		libfs.closeSync(fds.fd);
		throw error;
	}
};

let visit_video = (node: string): void => {
	let tag = read_mp4_tag(node);
	let nodes = node.split(libpath.sep);
	let file_id = makeFileId(...nodes);
	if (tag.show !== null && tag.season !== null && tag.episode !== null && tag.title !== null) {
		add_file({
			file_id: file_id,
			path: nodes,
			mime: 'video/mp4'
		});
		let show_id = makeFileId(tag.show);
		let season_id = makeFileId(tag.show, zeropad(tag.season, 2));
		let episode_id = makeFileId(tag.show, zeropad(tag.season, 2), zeropad(tag.episode, 2));
		add_show({
			show_id: show_id,
			title: tag.show
		});
		add_season({
			season_id: season_id,
			show_id: show_id,
			number: tag.season
		});
		add_episode({
			episode_id: episode_id,
			season_id: season_id,
			file_id: file_id,
			title: tag.title,
			number: tag.episode,
			duration: tag.duration,
			year: tag.year,
			summary: tag.comment
		});
		return;
	}
	if (tag.album_artists != null && tag.album != null && tag.year != null && tag.disc_number != null && tag.track_number != null && tag.artists != null && tag.title != null) {
		add_file({
			file_id: file_id,
			path: nodes,
			mime: 'audio/mp4'
		});
		let album_id = makeFileId(...tag.album_artists, tag.album, zeropad(tag.year, 4));
		add_album({
			album_id: album_id,
			title: tag.album,
			year: tag.year,
			cover_file_id: null
		});
		for (let album_artist of tag.album_artists) {
			let album_artist_id = makeFileId(album_artist);
			add_artist({
				artist_id: album_artist_id,
				title: album_artist
			});
			add_album_artist({
				album_id: album_id,
				artist_id: album_artist_id
			});
		}
		let disc_id = makeFileId(...tag.album_artists, tag.album, zeropad(tag.year, 4), zeropad(tag.disc_number, 2));
		add_disc({
			disc_id: disc_id,
			album_id: album_id,
			number: tag.disc_number
		});
		let track_id = makeFileId(...tag.album_artists, tag.album, zeropad(tag.year, 4), zeropad(tag.disc_number, 2), zeropad(tag.track_number, 2));
		add_track({
			track_id: track_id,
			disc_id: disc_id,
			file_id: file_id,
			title: tag.title,
			number: tag.track_number,
			duration: tag.duration
		});
		for (let track_artist of tag.artists) {
			let track_artist_id = makeFileId(track_artist);
			add_artist({
				artist_id: track_artist_id,
				title: track_artist
			});
			add_track_artist({
				track_id: track_id,
				artist_id: track_artist_id
			});
		}
		return;
	}
	if (tag.title !== null && tag.year !== null) {
		add_file({
			file_id: file_id,
			path: nodes,
			mime: 'video/mp4'
		});
		let movie_id = makeFileId(tag.title, zeropad(tag.year, 4));
		let number = tag.track_number || 1;
		let movie_part_id = makeFileId(tag.title, zeropad(tag.year, 4), zeropad(number, 2));
		add_movie_part({
			movie_part_id,
			movie_id,
			file_id,
			duration: tag.duration,
			number
		});
		add_movie({
			movie_id: movie_id,
			title: tag.title,
			year: tag.year,
			poster_file_id: null,
			summary: tag.comment
		});
		return;
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

let parse_jpeg = (node: string): void => {
	let fds = {
		fd: libfs.openSync(node, 'r'),
		offset: 0
	};
	try {
		let buffer = Buffer.alloc(10);
		fds.offset += libfs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
		if (buffer.toString('binary') !== '\u00FF\u00D8\u00FF\u00E0\u0000\u0010JFIF') {
			throw new Error();
		}
		let nodes = node.split(libpath.sep);
		let file_id = makeFileId(...nodes);
		add_file({
			file_id: file_id,
			path: nodes,
			mime: 'image/jpeg'
		});
		libfs.closeSync(fds.fd);
	} catch (error) {
		libfs.closeSync(fds.fd);
		throw error;
	}
};

let parse_vtt = (node: string): void => {
	let fds = {
		fd: libfs.openSync(node, 'r'),
		offset: 0
	};
	try {
		let buffer = Buffer.alloc(1024);
		fds.offset += libfs.readSync(fds.fd, buffer, 0, buffer.length, fds.offset);
		let str = buffer.toString('utf8');
		let lines = str.split('\r\n').reduce((lines, line) => {
			lines.push(...line.split('\n'));
			return lines;
		}, new Array<string>());
		if (lines[0].substr(0, 6) !== 'WEBVTT') {
			throw new Error();
		}
		let metadata = lines[0].substr(7);
		let nodes = node.split(libpath.sep);
		let file_id = makeFileId(...nodes);
		add_file({
			file_id: file_id,
			path: nodes,
			mime: 'text/vtt'
		});
		libfs.closeSync(fds.fd);
	} catch (error) {
		libfs.closeSync(fds.fd);
		throw error;
	}
};

let visit_image = (node: string): void => {
	try {
		return parse_png(node);
	} catch (error) {}
	try {
		return parse_jpeg(node);
	} catch (error) {}
	throw new Error();
};

let visit_subtitle = (node: string): void => {
	try {
		return parse_vtt(node);
	} catch (error) {}
	throw new Error();
};

let parse_json = (node: string): void => {
	let contents = libfs.readFileSync(node, "utf8");
	JSON.parse(contents);
	let nodes = node.split(libpath.sep);
	let file_id = makeFileId(...nodes);
	add_file({
		file_id: file_id,
		path: nodes,
		mime: 'application/json'
	});
};

let visit_metadata = (node: string): void => {
	try {
		return parse_json(node);
	} catch (error) {}
	throw new Error();
};

let visit = (node: string): void => {
	let stat = libfs.statSync(node);
	if (stat.isDirectory()) {
		libfs.readdirSync(node).map((subnode) => {
			return libpath.join(node, subnode);
		}).map(visit);
	} else if (stat.isFile()) {
		try {
			return visit_audio(node);
		} catch (error) {}
		try {
			return visit_video(node);
		} catch (error) {}
		try {
			return visit_subtitle(node);
		} catch (error) {}
		try {
			return visit_image(node);
		} catch (error) {}
		try {
			return visit_metadata(node);
		} catch (error) {}
	}
};

visit(media_root);

let image_files = db.files.filter(im => /^image[/]/.test(im.mime));

db.audio.tracks.forEach((track) => {
	let track_file = files_index[track.file_id];
	if (track_file === undefined) {
		return;
	}
	const track_file_directory = track_file.path.slice(0, -1).join("/");
	for (const image_file of image_files) {
		const image_file_directory = image_file.path.slice(0, -1).join("/");
		if (image_file_directory === track_file_directory) {
			let disc = discs_index[track.disc_id];
			if (disc === undefined) {
				continue;
			}
			let album = albums_index[disc.album_id];
			if (album === undefined) {
				continue;
			}
			album.cover_file_id = image_file.file_id;
			break;
		}
	}
});

for (const movie_part of db.video.movie_parts) {
	const movie_part_file = files_index[movie_part.file_id];
	if (movie_part_file == null) {
		continue;
	}
	const movie = movies_index[movie_part.movie_id];
	if (movie == null) {
		continue;
	}
	const movie_part_file_directory = movie_part_file.path.slice(0, -1).join("/");
	for (const image_file of image_files) {
		const image_file_directory = image_file.path.slice(0, -1).join("/");
		if (image_file_directory === movie_part_file_directory) {
			movie.poster_file_id = image_file.file_id;
			break;
		}
	}
}

const all_video_files = db.files.filter(file => /^video[/]/.test(file.mime))
	.sort((one, two) => {
		let basename_one = one.path.join("/");
		let basename_two = two.path.join("/");
		if (basename_one < basename_two) {
			return -1;
		}
		if (basename_one > basename_two) {
			return 1;
		}
		return 0;
	});
const metadata_files = db.files.filter(im => /^application[/]json$/.test(im.mime));

for (const metadata_file of metadata_files) {
	const metadata_file_directory = metadata_file.path.slice(0, -1).join("/");
	let json: any = null;
	try {
		json = JSON.parse(libfs.readFileSync(metadata_file.path.join("/"), "utf8"));
	} catch (error) {}
	if (json == null) {
		continue;
	}
	const video_files = all_video_files.filter((video_file) => {
		const video_file_directory = video_file.path.slice(0, -1).join("/");
		return video_file_directory === metadata_file_directory;
	});
	if (metadata.MovieMetadata.is(json)) {
		for (let video_file of video_files) {
			const movie_part = db.video.movie_parts.find((movie_part) => {
				return movie_part.file_id === video_file.file_id;
			});
			if (movie_part == null) {
				continue;
			}
			const movie = db.video.movies.find((movie) => {
				return movie.movie_id === movie_part.movie_id;
			});
			if (movie == null) {
				continue;
			}
			for (const genre of json.genres) {
				const video_genre_id = makeFileId("video", genre);
				add_video_genre({
					video_genre_id: video_genre_id,
					title: genre
				});
				add_movie_genre({
					movie_id: movie.movie_id,
					video_genre_id: video_genre_id
				});
			}
			for (const person of json.actors) {
				const person_id = makeFileId(person);
				add_person({
					person_id: person_id,
					name: person
				});
				add_movie_person({
					movie_id: movie.movie_id,
					person_id: person_id
				});
			}
		}
	} else if (metadata.EpisodeMetadata.is(json)) {
		for (let video_file of video_files) {
			const episode = db.video.episodes.find((episode) => {
				return episode.file_id === video_file.file_id;
			});
			if (episode == null) {
				continue;
			}
			const season = db.video.seasons.find((season) => {
				return season.season_id === episode.season_id;
			});
			if (season == null) {
				continue;
			}
			const show = db.video.shows.find((show) => {
				return show.show_id === season.show_id;
			});
			if (show == null) {
				continue;
			}
			show.summary = json.show.summary;
			for (const genre of json.show.genres) {
				const video_genre_id = makeFileId("video", genre);
				add_video_genre({
					video_genre_id: video_genre_id,
					title: genre
				});
				add_show_genre({
					show_id: show.show_id,
					video_genre_id: video_genre_id
				});
			}
			for (const person of json.show.actors) {
				const person_id = makeFileId(person);
				add_person({
					person_id: person_id,
					name: person
				});
				add_show_person({
					show_id: show.show_id,
					person_id: person_id
				});
			}
		}
	}
}

// TODO: Create indexable structure for directories and files.
function getFilesInSameDirectory(file: libdb.FileEntry): Array<libdb.FileEntry> {
	let directoryOne = file.path.slice(0, -1).join("/");
	return db.files.filter((file) => {
		let directoryTwo = file.path.slice(0, -1).join("/");
		return directoryOne === directoryTwo;
	});
}

let vtt_files = db.files.filter(file => /^text[/]vtt$/.test(file.mime));

for (let vttFile of vtt_files) {
	let videoFiles = getFilesInSameDirectory(vttFile).filter((file) => {
		return /^video[/]/.test(file.mime);
	});
	if (videoFiles.length > 0) {
		let vttFilenameParts = vttFile.path[vttFile.path.length - 1].split(".");
		for (let videoFile of videoFiles) {
			let videoFilenameParts = videoFile.path[videoFile.path.length - 1].split(".");
			if (vttFilenameParts[0] === videoFilenameParts[0]) {
				let fileId = vttFile.file_id;
				let subtitleId = makeFileId(fileId);
				let language = vttFilenameParts.reverse().find((part) => {
					return part in languages.db;
				}) || null;
				add_subtitle({
					subtitle_id: subtitleId,
					file_id: fileId,
					video_file_id: videoFile.file_id,
					language: language
				});
				break;
			}
		}
	}
}

db.video.subtitles.forEach((subtitle_entry) => {
	let file_entry = files_index[subtitle_entry.file_id];
	if (file_entry === undefined) {
		return;
	}
	let path = [ ".", ...file_entry.path ].join("/");
	try {
		let string = libfs.readFileSync(path, { encoding: "utf8" });
		let track = libvtt.decode(string);
		let metadata = JSON.parse(track.head.metadata);
		if (typeof metadata === "object" && typeof metadata.language === "string") {
			subtitle_entry.language = metadata.language;
		}
		let cues = track.body.cues.map<[number, number, string]>((cue) => {
			let start_ms = cue.start_ms;
			let duration_ms = cue.duration_ms;
			let lines = cue.lines.join("\n");
			return [
				start_ms,
				duration_ms,
				lines
			];
		});
		db.video.subtitle_contents.push({
			subtitle_id: subtitle_entry.subtitle_id,
			cues
		})
	} catch (error) {
		console.log(path);
	}
});

libfs.writeFileSync("./private/db/media.json", JSON.stringify(db, null, "\t"));
