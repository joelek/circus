import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as schema from "./schema";
import * as indices from "../jsondb/";
import * as is from "../is";
import * as probes from "./probes";
import { default as config } from "../config";
import * as jdb2 from "../jdb2";
import { transactionManager, stores, links, Directory, File, createStream } from "./atlas";
import { ReadableQueue, WritableQueue } from "@joelek/atlas";
import { binid, hexid } from "../utils";

function wordify(string: string | number): Array<string> {
	return String(string)
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\|\/\\\_\-]/g, " ")
		.replace(/[^a-z0-9 ]/g, "")
		.trim()
		.split(/[ ]+/g);
}

function makeId(...components: Array<string | number | undefined>): string {
	components = components
		.map((component) => wordify(component ?? ""))
		.map((words) => {
			return words.join(" ");
		});
	return libcrypto.createHash("sha256")
		.update(components.join("\0"))
		.digest("hex")
		.slice(0, 16);
}

function makeBinaryId(...components: Array<Uint8Array | string | number | undefined | null>): Uint8Array {
	components = components
		.map((component) => {
			if (component instanceof Uint8Array) {
				component = Buffer.from(component).toString("hex");
			}
			return wordify(component ?? "").join(" ");
		});
	let buffer = libcrypto.createHash("sha256")
		.update(components.join("\0"))
		.digest()
		.slice(0, 8);
	return Uint8Array.from(buffer);
}

if (!libfs.existsSync(config.media_path.join("/"))) {
	libfs.mkdirSync(config.media_path.join("/"));
}

const TABLES_ROOT = [
	".",
	"private",
	"tables"
];

const INDICES_ROOT = [
	".",
	"private",
	"indices"
];

function loadTable<A>(name: string, guard: autoguard.serialization.MessageGuard<A>, getKey: jdb2.ValueProvider<A>): jdb2.Table<A> {
	let blockHandler = new jdb2.BlockHandler([".", "private", "tables", name]);
	let table = new jdb2.Table<A>(blockHandler, (json) => guard.as(json), getKey);
	return table;
}

export async function getPath(queue: ReadableQueue, entry: Directory | File): Promise<Array<string>> {
	let path = new Array<string>();
	while (true) {
		path.unshift(entry.name);
		let parent_directory_id = entry.parent_directory_id;
		if (is.absent(parent_directory_id)) {
			break;
		}
		let newEntry = await links.directory_directories.lookup(queue, {
			parent_directory_id
		});
		if (is.absent(newEntry)) {
			break;
		}
		entry = newEntry;
	}
	return [...config.media_path, ...path];
};

function getDirectoryPath(queue: ReadableQueue, directory: Directory): Promise<Array<string>> {
	return getPath(queue, directory);
};

function getFilePath(queue: ReadableQueue, file: File): Promise<Array<string>> {
	return getPath(queue, file);
};

async function checkFile(queue: WritableQueue, root: File): Promise<void> {
	let paths = await getFilePath(queue, root);
	let path = paths.join("/");
	if (libfs.existsSync(path)) {
		let stats = libfs.statSync(path);
		if (stats.isFile()) {
			if (stats.mtime.valueOf() === root.index_timestamp) {
				return;
			}
		}
	}
	await stores.files.remove(queue, root);
};

async function checkDirectory(queue: WritableQueue, root: Directory): Promise<void> {
	let paths = await getDirectoryPath(queue, root);
	let path = paths.join("/");
	if (libfs.existsSync(path)) {
		let stats = libfs.statSync(path);
		if (stats.isDirectory()) {
			let directory_id = root.directory_id;
			for (let directory of await links.directory_directories.filter(queue, { directory_id })) {
				checkDirectory(queue, directory);
			}
			for (let file of await links.directory_files.filter(queue, { directory_id })) {
				checkFile(queue, file);
			}
			return;
		}
	}
	await stores.directories.remove(queue, root);
};

async function visitDirectory(queue: WritableQueue, path: Array<string>, parent_directory_id: Uint8Array | null): Promise<void> {
	let dirents = libfs.readdirSync(path.join("/"), { withFileTypes: true });
	for (let dirent of dirents) {
		let name = dirent.name;
		if (dirent.isDirectory()) {
			let directory_id = makeBinaryId("directory", parent_directory_id, name);
			try {
				await stores.directories.lookup(queue, { directory_id });
			} catch (error) {
				await stores.directories.insert(queue, {
					directory_id,
					name,
					parent_directory_id
				});
			}
			await visitDirectory(queue, [...path, dirent.name], directory_id);
		} else if (dirent.isFile()) {
			let file_id = makeBinaryId("file", parent_directory_id, name);
			try {
				await stores.files.lookup(queue, { file_id });
			} catch (error) {
				let stats = libfs.statSync(path.join("/"));
				let index_timestamp = null;
				let size = stats.size;
				await stores.files.insert(queue, {
					file_id,
					name,
					parent_directory_id,
					index_timestamp,
					size
				});
			}
		}
	}
};

async function indexMetadata(queue: WritableQueue, probe: probes.schema.Probe, ...file_ids: Array<Uint8Array>): Promise<void> {
	let metadata = probe.metadata;
	if (probes.schema.EpisodeMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.year)) {
			year_id = makeBinaryId("year", metadata.year);
			await stores.years.insert(queue, {
				year_id: year_id,
				year: metadata.year
			});
		}
		let show_id = makeBinaryId("show", metadata.show.title);
		await stores.shows.update(queue, {
			show_id: show_id,
			name: metadata.show.title,
			summary: metadata.show.summary ?? null,
			imdb: metadata.show.imdb ?? null,
			timestamp_ms: null
		});
		let season_id = makeBinaryId("season", show_id, `${metadata.season}`);
		await stores.seasons.update(queue, {
			season_id: season_id,
			show_id: show_id,
			number: metadata.season,
			timestamp_ms: null
		});
		let episode_id = makeBinaryId("episode", season_id, `${metadata.episode}`);
		await stores.episodes.update(queue, {
			episode_id: episode_id,
			season_id: season_id,
			title: metadata.title,
			number: metadata.episode,
			year_id: year_id ?? null,
			summary: metadata.summary ?? null,
			copyright: metadata.copyright ?? null,
			imdb: metadata.imdb ?? null,
			timestamp_ms: null
		});
		for (let file_id of file_ids) {
			await stores.episode_files.insert(queue, {
				episode_id: episode_id,
				file_id: file_id
			});
		}
		for (let [index, actor] of metadata.show.actors.entries()) {
			let actor_id = makeBinaryId("actor", actor);
			await stores.actors.insert(queue, {
				actor_id: actor_id,
				name: actor
			});
			await stores.show_actors.insert(queue, {
				actor_id: actor_id,
				show_id: show_id,
				order: index
			});
		}
		for (let [index, genre] of metadata.show.genres.entries()) {
			let genre_id = makeBinaryId("genre", genre);
			await stores.genres.insert(queue, {
				genre_id: genre_id,
				name: genre
			});
			await stores.show_genres.insert(queue, {
				genre_id: genre_id,
				show_id: show_id,
				order: index
			});
		}
	} else if (probes.schema.MovieMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.year)) {
			year_id = makeBinaryId("year", metadata.year);
			await stores.years.insert(queue, {
				year_id: year_id,
				year: metadata.year
			});
		}
		let movie_id = makeBinaryId("movie", metadata.title, metadata.year);
		await stores.movies.update(queue, {
			movie_id: movie_id,
			title: metadata.title,
			year_id: year_id ?? null,
			summary: metadata.summary ?? null,
			copyright: metadata.copyright ?? null,
			imdb: metadata.imdb ?? null,
			timestamp_ms: null
		});
		for (let file_id of file_ids) {
			await stores.movie_files.insert(queue, {
				movie_id: movie_id,
				file_id: file_id
			});
		}
		for (let [index, actor] of metadata.actors.entries()) {
			let actor_id = makeBinaryId("actor", actor);
			await stores.actors.insert(queue, {
				actor_id: actor_id,
				name: actor
			});
			await stores.movie_actors.insert(queue, {
				actor_id: actor_id,
				movie_id: movie_id,
				order: index
			});
		}
		for (let [index, genre] of metadata.genres.entries()) {
			let genre_id = makeBinaryId("genre", genre);
			await stores.genres.insert(queue, {
				genre_id: genre_id,
				name: genre
			});
			await stores.movie_genres.insert(queue, {
				genre_id: genre_id,
				movie_id: movie_id,
				order: index
			});
		}
	} else if (probes.schema.TrackMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.album.year)) {
			year_id = makeBinaryId("year", metadata.album.year);
			await stores.years.insert(queue, {
				year_id: year_id,
				year: metadata.album.year
			});
		}
		let album_id = makeBinaryId("album", metadata.album.title, metadata.album.year);
		await stores.albums.update(queue, {
			album_id: album_id,
			title: metadata.album.title,
			year_id: year_id ?? null,
			timestamp_ms: null
		});
		for (let [index, artist] of metadata.album.artists.entries()) {
			let artist_id = makeBinaryId("artist", artist);
			await stores.artists.insert(queue, {
				artist_id: artist_id,
				name: artist
			});
			await stores.album_artists.insert(queue, {
				album_id: album_id,
				artist_id: artist_id,
				order: index
			});
		}
		let disc_id = makeBinaryId("disc", album_id, `${metadata.disc}`);
		await stores.discs.update(queue, {
			disc_id: disc_id,
			album_id: album_id,
			number: metadata.disc,
			timestamp_ms: null
		});
		let track_id = makeBinaryId("track", disc_id, `${metadata.track}`);
		await stores.tracks.update(queue, {
			track_id: track_id,
			disc_id: disc_id,
			title: metadata.title,
			number: metadata.track,
			copyright: metadata.copyright ?? null,
			timestamp_ms: null
		});
		for (let file_id of file_ids) {
			await stores.track_files.insert(queue, {
				track_id: track_id,
				file_id: file_id
			});
		}
		for (let [index, artist] of metadata.artists.entries()) {
			let artist_id = makeBinaryId("artist", artist);
			await stores.artists.insert(queue, {
				artist_id: artist_id,
				name: artist
			});
			await stores.track_artists.insert(queue, {
				track_id: track_id,
				artist_id: artist_id,
				order: index
			});
		}
	} else if (probes.schema.AlbumMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.year)) {
			year_id = makeBinaryId("year", metadata.year);
			await stores.years.insert(queue, {
				year_id: year_id,
				year: metadata.year
			});
		}
		let album_id = makeBinaryId("album", metadata.title, metadata.year);
		await stores.albums.update(queue, {
			album_id: album_id,
			title: metadata.title,
			year_id: year_id ?? null,
			timestamp_ms: null
		});
		for (let [index, artist] of metadata.artists.entries()) {
			let artist_id = makeBinaryId("artist", artist);
			await stores.artists.insert(queue, {
				artist_id: artist_id,
				name: artist
			});
			await stores.album_artists.insert(queue, {
				album_id: album_id,
				artist_id: artist_id,
				order: index
			});
		}
		let disc_id = makeBinaryId("disc", album_id, `${metadata.disc}`);
		await stores.discs.update(queue, {
			disc_id: disc_id,
			album_id: album_id,
			number: metadata.disc,
			timestamp_ms: null
		});
		if (metadata.tracks.length === file_ids.length) {
			for (let [index, file_id] of file_ids.entries()) {
				let track = metadata.tracks[index];
				let track_id = makeBinaryId("track", disc_id, `${index}`);
				await stores.tracks.update(queue, {
					track_id: track_id,
					disc_id: disc_id,
					title: track.title,
					number: index + 1,
					copyright: track.copyright ?? metadata.copyright ?? null,
					timestamp_ms: null
				});
				await stores.track_files.insert(queue, {
					track_id: track_id,
					file_id: file_id
				});
				for (let [index, artist] of track.artists.entries()) {
					let artist_id = makeBinaryId("artist", artist);
					await stores.artists.insert(queue, {
						artist_id: artist_id,
						name: artist
					});
					await stores.track_artists.insert(queue, {
						track_id: track_id,
						artist_id: artist_id,
						order: index
					});
				}
			}
		}
	}
};

async function indexFile(queue: WritableQueue, file: File): Promise<void> {
	let file_id = file.file_id;
	let paths = await getFilePath(queue, file);
	let path = paths.join("/");
	let fd = libfs.openSync(path, "r");
	try {
		let probe: probes.schema.Probe = {
			resources: []
		};
		if (file.name.endsWith(".vtt")) {
			probe = probes.vtt.probe(fd);
			let subtitle_resources = probe.resources.filter((resource): resource is probes.schema.SubtitleResource => resource.type === "subtitle");
			let subtitle_resource = subtitle_resources.shift();
			if (is.present(subtitle_resource)) {
				await stores.subtitle_files.insert(queue, {
					file_id: file_id,
					mime: "text/vtt",
					duration_ms: subtitle_resource.duration_ms,
					language: subtitle_resource.language ?? null
				});
				let subtitle_id = makeBinaryId("subtitle", file.file_id);
				await stores.subtitles.insert(queue, {
					subtitle_id: subtitle_id,
					file_id: file.file_id
				});
/* 				for (let cue of subtitle_resource.cues) {
					let cue_id = makeBinaryId("cue", subtitle_id, `${cue.start_ms}`);
					await stores.cues.insert(queue, {
						cue_id: cue_id,
						subtitle_id: subtitle_id,
						start_ms: cue.start_ms,
						duration_ms: cue.duration_ms,
						lines: cue.lines.join("\n")
					});
				} */
			}
		} else if (file.name.endsWith(".json")) {
			probe = probes.json.probe(fd);
			let metadata_resources = probe.resources.filter((resource): resource is probes.schema.MetadataResource => resource.type === "metadata");
			let metadata_resource = metadata_resources.shift();
			if (is.present(metadata_resource)) {
				await stores.metadata_files.insert(queue, {
					file_id: file_id,
					mime: "application/json"
				});
			}
		} else if (file.name.endsWith(".mp3")) {
			probe = probes.mp3.probe(fd);
			let audio_resources = probe.resources.filter((resource): resource is probes.schema.AudioResource => resource.type === "audio");
			let audio_resource = audio_resources.shift();
			if (is.present(audio_resource)) {
				await stores.audio_files.insert(queue, {
					file_id: file_id,
					mime: "audio/mp3",
					duration_ms: audio_resource.duration_ms
				});
			}
		} else if (file.name.endsWith(".mp4")) {
			probe = probes.mp4.probe(fd);
			let audio_resources = probe.resources.filter((resource): resource is probes.schema.AudioResource => resource.type === "audio");
			let video_resources = probe.resources.filter((resource): resource is probes.schema.VideoResource => resource.type === "video");
			let audio_resource = audio_resources.shift();
			let video_resource = video_resources.shift();
			if (is.present(video_resource)) {
				await stores.video_files.insert(queue, {
					file_id: file_id,
					mime: "video/mp4",
					duration_ms: video_resource.duration_ms,
					width: video_resource.width,
					height: video_resource.height
				});
			} else if (is.present(audio_resource)) {
				await stores.audio_files.insert(queue, {
					file_id: file_id,
					mime: "audio/mp4",
					duration_ms: audio_resource.duration_ms
				});
			}
		} else if (file.name.endsWith(".jpg") || file.name.endsWith(".jpeg")) {
			probe = probes.jpeg.probe(fd);
			let image_resources = probe.resources.filter((resource): resource is probes.schema.ImageResource => resource.type === "image");
			let image_resource = image_resources.shift();
			if (is.present(image_resource)) {
				await stores.image_files.insert(queue, {
					file_id: file_id,
					mime: "image/jpeg",
					width: image_resource.width,
					height: image_resource.height
				});
			}
		}
		// TODO: Only index actual media files and not the metadata files themselves.
		indexMetadata(queue, probe, file_id);
	} catch (error) {
		console.log(`Indexing failed for "${path}"!`);
		console.log(error);
	}
	libfs.closeSync(fd);
	let stats = libfs.statSync(path);
	file.index_timestamp = stats.mtime.valueOf();
	file.size = stats.size;
	await stores.files.update(queue, file);
};

async function indexFiles(queue: WritableQueue): Promise<void> {
	for (let file of await stores.files.filter(queue)) {
		if (is.absent(file.index_timestamp)) {
			console.log(`Indexing ${file.name}...`);
			await indexFile(queue, file);
		}
	}
};

async function getSiblingFiles(queue: ReadableQueue, subject: File): Promise<Array<File>> {
	let parent_directory = await links.directory_files.lookup(queue, subject);
	let candidates_in_directory = [] as Array<File>;
	for (let file of await links.directory_files.filter(queue, parent_directory)) {
		try {
			await stores.audio_files.lookup(queue, file);
			candidates_in_directory.push(file);
			continue;
		} catch (error) {}
		try {
			await stores.video_files.lookup(queue, file);
			candidates_in_directory.push(file);
			continue;
		} catch (error) {}
	}
	candidates_in_directory.sort(indices.LexicalSort.increasing((file) => file.name));
	let basename = subject.name.split(".")[0];
	let candidates_sharing_basename = candidates_in_directory
		.filter((file) => file.name.split(".")[0] === basename);
	if (candidates_sharing_basename.length > 0) {
		return candidates_sharing_basename;
	} else {
		return candidates_in_directory;
	}
};

async function associateMetadata(queue: WritableQueue): Promise<void> {
	for (let metadata_file of await stores.metadata_files.filter(queue)) {
		let file = await stores.files.lookup(queue, metadata_file);
		let path = await getFilePath(queue, file);
		let fd = libfs.openSync(path.join("/"), "r");
		let probe = probes.json.probe(fd);
		libfs.closeSync(fd);
		let siblings = await getSiblingFiles(queue, file);
		await indexMetadata(queue, probe, ...siblings.map((file) => file.file_id));
	}
};

async function associateImages(queue: WritableQueue): Promise<void> {
	for (let image_file of await stores.image_files.filter(queue)) {
		let file = await stores.files.lookup(queue, image_file);
		let siblings = await getSiblingFiles(queue, file);
		for (let sibling of siblings) {
			let track_files = (await links.file_track_files.filter(queue, sibling))
				.filter((track_file) => track_file.file_id !== image_file.file_id);
			for (let track_file of track_files) {
				try {
					let track = await stores.tracks.lookup(queue, track_file);
					let disc = await stores.discs.lookup(queue, track);
					let album = await stores.albums.lookup(queue, disc);
					await stores.album_files.insert(queue, {
						album_id: album.album_id,
						file_id: image_file.file_id
					});
				} catch (error) {}
			}
			let movies = (await links.file_movie_files.filter(queue, sibling))
				.filter((movie_file) => movie_file.file_id !== image_file.file_id);
			for (let movie of movies) {
				await stores.movie_files.insert(queue, {
					movie_id: movie.movie_id,
					file_id: image_file.file_id
				});
			}
			let episode_files = (await links.file_episode_files.filter(queue, sibling))
				.filter((episode_file) => episode_file.file_id !== image_file.file_id);
			for (let episode_file of episode_files) {
				try {
					let episode = await stores.episodes.lookup(queue, episode_file);
					let season = await stores.seasons.lookup(queue, episode);
					let show = await stores.shows.lookup(queue, season);
					await stores.show_files.insert(queue, {
						show_id: show.show_id,
						file_id: image_file.file_id
					});
				} catch (error) {}
			}
		}
	}
};

async function associateSubtitles(queue: WritableQueue): Promise<void> {
	for (let subtitle_file of await stores.subtitle_files.filter(queue)) {
		let file = await stores.files.lookup(queue, subtitle_file);
		let basename = file.name.split(".")[0];
		let siblings = (await getSiblingFiles(queue, file))
			.filter((file) => file.name.split(".")[0] === basename);
		for (let sibling of siblings) {
			await stores.video_subtitles.insert(queue, {
				video_file_id: sibling.file_id,
				subtitle_file_id: file.file_id
			});
		}
	}
};

async function removeBrokenEntities(queue: WritableQueue): Promise<void> {
	for (let track of await stores.tracks.filter(queue)) {
		let track_files = await links.track_track_files.filter(queue, track);
		if (track_files.length === 0) {
			await stores.tracks.remove(queue, track);
		}
	}
	for (let disc of await stores.discs.filter(queue)) {
		let tracks = await links.disc_tracks.filter(queue, disc);
		if (tracks.length === 0) {
			await stores.discs.remove(queue, disc);
		}
	}
	for (let album of await stores.albums.filter(queue)) {
		let discs = await links.album_discs.filter(queue, album);
		if (discs.length === 0) {
			await stores.albums.remove(queue, album);
		}
	}
	for (let artist of await stores.artists.filter(queue)) {
		let album_artists = await links.artist_album_artists.filter(queue, artist);
		let track_artists = await links.artist_track_artists.filter(queue, artist);
		if (album_artists.length === 0 && track_artists.length === 0) {
			await stores.artists.remove(queue, artist);
		}
	}
	for (let movie of await stores.movies.filter(queue)) {
		let movie_files = await links.movie_movie_files.filter(queue, movie);
		if (movie_files.length === 0) {
			await stores.movies.remove(queue, movie);
		}
	}
	for (let episode of await stores.episodes.filter(queue)) {
		let episode_files = await links.episode_episode_files.filter(queue, episode);
		if (episode_files.length === 0) {
			await stores.episodes.remove(queue, episode);
		}
	}
	for (let season of await stores.seasons.filter(queue)) {
		let episodes = await links.season_episodes.filter(queue, season);
		if (episodes.length === 0) {
			await stores.seasons.remove(queue, season);
		}
	}
	for (let show of await stores.shows.filter(queue)) {
		let seasons = await links.show_seasons.filter(queue, show);
		if (seasons.length === 0) {
			await stores.shows.remove(queue, show);
		}
	}
	for (let actor of await stores.actors.filter(queue)) {
		let movie_actors = await links.actor_movie_actors.filter(queue, actor);
		let show_actors = await links.actor_show_actors.filter(queue, actor);
		if (movie_actors.length === 0 && show_actors.length === 0) {
			await stores.actors.remove(queue, actor);
		}
	}
	for (let genre of await stores.genres.filter(queue)) {
		let movie_genres = await links.genre_movie_genres.filter(queue, genre);
		let show_genres = await links.genre_show_genres.filter(queue, genre);
		if (movie_genres.length === 0 && show_genres.length === 0) {
			await stores.genres.remove(queue, genre);
		}
	}
	for (let year of await stores.years.filter(queue)) {
		let albums = await links.year_albums.filter(queue, year);
		let movies = await links.year_movies.filter(queue, year);
		let episodes = await links.year_episodes.filter(queue, year);
		if (albums.length === 0 && movies.length === 0 && episodes.length === 0) {
			await stores.years.remove(queue, year);
		}
	}
};

export async function computeAlbumTimestamps(queue: WritableQueue): Promise<void> {
	let albums = await stores.albums.filter(queue);
	for (let album of albums) {
		let album_timestamp_ms = album.timestamp_ms;
		let discs = await links.album_discs.filter(queue, album);
		for (let disc of discs) {
			let disc_timestamp_ms = disc.timestamp_ms;
			let tracks = await links.disc_tracks.filter(queue, disc);
			for (let track of tracks) {
				let track_timestamp_ms = track.timestamp_ms;
				let track_files = await links.track_track_files.filter(queue, track);
				for (let track_file of track_files) {
					let file = await stores.files.lookup(queue, track_file);
					if (file.index_timestamp == null) {
						continue;
					}
					track_timestamp_ms = track_timestamp_ms != null ? Math.max(track_timestamp_ms, file.index_timestamp) : file.index_timestamp;
					disc_timestamp_ms = disc_timestamp_ms != null ? Math.max(disc_timestamp_ms, file.index_timestamp) : file.index_timestamp;
					album_timestamp_ms = album_timestamp_ms != null ? Math.max(album_timestamp_ms, file.index_timestamp) : file.index_timestamp;
				}
				if (track.timestamp_ms !== track_timestamp_ms) {
					await stores.tracks.insert(queue, {
						...track,
						timestamp_ms: track_timestamp_ms
					});
				}
			}
			if (disc.timestamp_ms !== disc_timestamp_ms) {
				await stores.discs.insert(queue, {
					...disc,
					timestamp_ms: disc_timestamp_ms
				});
			}
		}
		if (album.timestamp_ms !== album_timestamp_ms) {
			await stores.albums.insert(queue, {
				...album,
				timestamp_ms: album_timestamp_ms
			});
		}
	}
};

export async function computeMovieTimestamps(queue: WritableQueue): Promise<void> {
	let movies = await stores.movies.filter(queue);
	for (let movie of movies) {
		let movie_timestamp_ms = movie.timestamp_ms;
		let movie_files = await links.movie_movie_files.filter(queue, movie);
		for (let movie_file of movie_files) {
			let file = await stores.files.lookup(queue, movie_file);
			if (file.index_timestamp == null) {
				continue;
			}
			movie_timestamp_ms = movie_timestamp_ms != null ? Math.max(movie_timestamp_ms, file.index_timestamp) : file.index_timestamp;
		}
		if (movie.timestamp_ms !== movie_timestamp_ms) {
			await stores.movies.insert(queue, {
				...movie,
				timestamp_ms: movie_timestamp_ms
			});
		}
	}
};

export async function computeShowTimestamps(queue: WritableQueue): Promise<void> {
	let shows = await stores.shows.filter(queue);
	for (let show of shows) {
		let show_timestamp_ms = show.timestamp_ms;
		let seasons = await links.show_seasons.filter(queue, show);
		for (let season of seasons) {
			let season_timestamp_ms = season.timestamp_ms;
			let episodes = await links.season_episodes.filter(queue, season);
			for (let episode of episodes) {
				let episode_timestamp_ms = episode.timestamp_ms;
				let episode_files = await links.episode_episode_files.filter(queue, episode);
				for (let episode_file of episode_files) {
					let file = await stores.files.lookup(queue, episode_file);
					if (file.index_timestamp == null) {
						continue;
					}
					episode_timestamp_ms = episode_timestamp_ms != null ? Math.max(episode_timestamp_ms, file.index_timestamp) : file.index_timestamp;
					season_timestamp_ms = season_timestamp_ms != null ? Math.max(season_timestamp_ms, file.index_timestamp) : file.index_timestamp;
					show_timestamp_ms = show_timestamp_ms != null ? Math.max(show_timestamp_ms, file.index_timestamp) : file.index_timestamp;
				}
				if (episode.timestamp_ms !== episode_timestamp_ms) {
					await stores.episodes.insert(queue, {
						...episode,
						timestamp_ms: episode_timestamp_ms
					});
				}
			}
			if (season.timestamp_ms !== season_timestamp_ms) {
				await stores.seasons.insert(queue, {
					...season,
					timestamp_ms: season_timestamp_ms
				});
			}
		}
		if (show.timestamp_ms !== show_timestamp_ms) {
			await stores.shows.insert(queue, {
				...show,
				timestamp_ms: show_timestamp_ms
			});
		}
	}
};

export async function computeMovieSuggestions(queue: WritableQueue): Promise<void> {
	let movie_suggestions = await stores.movie_suggestions.filter(queue);
	for (let movie_suggestion of movie_suggestions) {
		await stores.movie_suggestions.remove(queue, movie_suggestion);
	}
	let movies = await stores.movies.filter(queue);
	for (let movie of movies) {
		let movie_genres = await links.movie_movie_genres.filter(queue, movie);
		for (let suggested_movie of movies) {
			if (suggested_movie.movie_id === movie.movie_id) {
				continue;
			}
			let suggested_movie_genres = await links.movie_movie_genres.filter(queue, suggested_movie);
			let affinity = 0 - movie_genres.length;
			for (let movie_genre of movie_genres) {
				if (suggested_movie_genres.find((suggested_movie_genre) => hexid(suggested_movie_genre.genre_id) === hexid(movie_genre.genre_id)) != null) {
					affinity += 2;
				}
			}
			if (affinity >= 0) {
				await stores.movie_suggestions.insert(queue, {
					movie_id: movie.movie_id,
					suggested_movie_id: suggested_movie.movie_id,
					affinity: affinity
				});
			}
		}
	}
};

export async function computeDerivedValues(queue: WritableQueue): Promise<void> {
	await computeAlbumTimestamps(queue);
	await computeMovieTimestamps(queue);
	await computeShowTimestamps(queue);
	await computeMovieSuggestions(queue);
};

export async function migrateLegacyData(queue: WritableQueue): Promise<void> {
	if (libfs.existsSync(TABLES_ROOT.join("/"))) {
		console.log(`Migrating legacy user data...`);
		let users = loadTable("users", schema.User, (record) => record.user_id);
		for (let user of users) {
			try {
				await stores.users.insert(queue, {
					...user,
					user_id: binid(user.user_id)
				});
			} catch (error) {}
		}
		users.close();
		let keys = loadTable("keys", schema.Key, (record) => record.key_id);
		for (let key of keys) {
			try {
				await stores.keys.insert(queue, {
					...key,
					key_id: binid(key.key_id),
					user_id: key.user_id != null ? binid(key.user_id) : null
				});
			} catch (error) {}
		}
		keys.close();
		let tokens = loadTable("tokens", schema.Token, (record) => record.token_id);
		for (let token of tokens) {
			try {
				await stores.tokens.insert(queue, {
					...token,
					token_id: binid(token.token_id),
					user_id: binid(token.user_id),
					hash: binid(token.hash)
				});
			} catch (error) {}
		}
		tokens.close();
		let streams = loadTable("streams", schema.Stream, (record) => record.stream_id);
		for (let stream of streams) {
			try {
				let file = await stores.files.lookup(queue, { file_id: binid(stream.file_id) });
				let mime = "application/octet-stream";
				try {
					mime = (await stores.audio_files.lookup(queue, file)).mime;
				} catch (error) {}
				try {
					mime = (await stores.image_files.lookup(queue, file)).mime;
				} catch (error) {}
				try {
					mime = (await stores.metadata_files.lookup(queue, file)).mime;
				} catch (error) {}
				try {
					mime = (await stores.subtitle_files.lookup(queue, file)).mime;
				} catch (error) {}
				try {
					mime = (await stores.video_files.lookup(queue, file)).mime;
				} catch (error) {}
				if (mime.startsWith("audio/") || mime.startsWith("video/")) {
					await createStream(queue, {
						...stream,
						stream_id: binid(stream.stream_id),
						user_id: binid(stream.user_id),
						file_id: binid(stream.file_id)
					});
				}
			} catch (error) {}
		}
		streams.close();
		let playlists = loadTable("playlists", schema.Playlist, (record) => record.playlist_id);
		for (let playlist of playlists) {
			try {
				await stores.playlists.insert(queue, {
					...playlist,
					playlist_id: binid(playlist.playlist_id),
					user_id: binid(playlist.user_id)
				});
			} catch (error) {}
		}
		playlists.close();
		let playlist_items = loadTable("playlist_items", schema.PlaylistItem, (record) => record.playlist_item_id);
		for (let playlist_item of playlist_items) {
			try {
				await stores.playlist_items.insert(queue, {
					...playlist_item,
					playlist_item_id: binid(playlist_item.playlist_item_id),
					playlist_id: binid(playlist_item.playlist_id),
					track_id: binid(playlist_item.track_id)
				});
			} catch (error) {}
		}
		playlist_items.close();
		libfs.rmSync(TABLES_ROOT.join("/"), { force: true, recursive: true });
	}
	if (libfs.existsSync(INDICES_ROOT.join("/"))) {
		libfs.rmSync(INDICES_ROOT.join("/"), { force: true, recursive: true });
	}
};

export async function runIndexer(): Promise<void> {
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		console.log(`Running indexer...`);
		for (let directory of await links.directory_directories.filter(queue)) {
			await checkDirectory(queue, directory);
		}
		for (let file of await links.directory_files.filter(queue)) {
			await checkFile(queue, file);
		}
		await visitDirectory(queue, config.media_path, null);
		await indexFiles(queue);
		console.log(`Associating...`);
		await associateMetadata(queue);
		await associateImages(queue);
		await associateSubtitles(queue);
		console.log(`Cleaning up...`);
		await removeBrokenEntities(queue);
		console.log(`Computing derived values...`);
		await computeDerivedValues(queue);
		await migrateLegacyData(queue);
		for (let token of await stores.tokens.filter(queue)) {
			if (token.expires_ms <= Date.now()) {
				await stores.tokens.remove(queue, token);
			}
		}
		if ((await links.user_keys.filter(queue)).length === 0) {
			await stores.keys.insert(queue, {
				key_id: binid(makeId("key", libcrypto.randomBytes(8).toString("hex"))),
				user_id: null
			});
		}
		for (let key of await links.user_keys.filter(queue)) {
			console.log(`Registration key available: ${hexid(key.key_id)}`);
		}
		console.log(`Indexing finished.`);
	});
	if (global.gc) {
		global.gc();
		let mbs = process.memoryUsage().heapUsed / 1024 / 1024;
		console.log(`Memory usage: ${mbs.toFixed()} MB`);
	}
};

runIndexer()
	.catch((error) => console.log(error));

process.on("SIGTERM", () => {
	console.log("SIGTERM");
	process.exit(0);
});

process.on("SIGINT", () => {
	console.log("SIGINT");
	process.exit(0);
});
