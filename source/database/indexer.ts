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

function getFilePath(queue: ReadableQueue, file: File): Promise<Array<string>> {
	return getPath(queue, file);
};

async function checkFile(queue: WritableQueue, root: File, paths: Array<string>): Promise<void> {
	let path = paths.join("/");
	if (libfs.existsSync(path)) {
		let stats = libfs.statSync(path);
		if (stats.isFile()) {
			if (stats.mtime.valueOf() === root.index_timestamp) {
				return;
			}
		}
	}
	console.log(`Removing ${path} from index.`);
	await stores.files.remove(queue, root);
};

async function checkDirectory(queue: WritableQueue, root: Directory, paths: Array<string>): Promise<void> {
	let path = paths.join("/");
	if (libfs.existsSync(path)) {
		let stats = libfs.statSync(path);
		if (stats.isDirectory()) {
			let directory_id = root.directory_id;
			for (let directory of await links.directory_directories.filter(queue, { directory_id })) {
				await checkDirectory(queue, directory, [...paths, directory.name]);
			}
			for (let file of await links.directory_files.filter(queue, { directory_id })) {
				await checkFile(queue, file, [...paths, file.name]);
			}
			return;
		}
	}
	console.log(`Removing ${path} from index.`);
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

async function associateShowFiles(queue: WritableQueue, show_id: Uint8Array, ...file_ids: Array<Uint8Array>): Promise<void> {
	for (let file_id of file_ids) {
		try {
			let image_file = await stores.image_files.lookup(queue, { file_id });
			await stores.show_files.insert(queue, {
				show_id: show_id,
				...image_file
			});
			continue;
		} catch (error) {}
	}
};

async function associateEpisodeFiles(queue: WritableQueue, episode_id: Uint8Array, ...file_ids: Array<Uint8Array>): Promise<void> {
	for (let file_id of file_ids) {
		try {
			let video_file = await stores.video_files.lookup(queue, { file_id });
			await stores.episode_files.insert(queue, {
				episode_id: episode_id,
				...video_file
			});
			continue;
		} catch (error) {}
	}
};

async function associateMovieFiles(queue: WritableQueue, movie_id: Uint8Array, ...file_ids: Array<Uint8Array>): Promise<void> {
	for (let file_id of file_ids) {
		try {
			let video_file = await stores.video_files.lookup(queue, { file_id });
			await stores.movie_files.insert(queue, {
				movie_id: movie_id,
				...video_file
			});
			continue;
		} catch (error) {}
		try {
			let image_file = await stores.image_files.lookup(queue, { file_id });
			await stores.movie_files.insert(queue, {
				movie_id: movie_id,
				...image_file
			});
			continue;
		} catch (error) {}
	}
};

async function associateTrackFiles(queue: WritableQueue, track_id: Uint8Array, ...file_ids: Array<Uint8Array>): Promise<void> {
	for (let file_id of file_ids) {
		try {
			let audio_file = await stores.audio_files.lookup(queue, { file_id });
			await stores.track_files.insert(queue, {
				track_id: track_id,
				...audio_file
			});
			continue;
		} catch (error) {}
	}
};

async function associateAlbumFiles(queue: WritableQueue, album_id: Uint8Array, ...file_ids: Array<Uint8Array>): Promise<void> {
	for (let file_id of file_ids) {
		try {
			let image_file = await stores.image_files.lookup(queue, { file_id });
			await stores.album_files.insert(queue, {
				album_id: album_id,
				...image_file
			});
			continue;
		} catch (error) {}
	}
};

async function indexMetadata(queue: WritableQueue, probe: probes.schema.Probe, ...file_ids: Array<Uint8Array>): Promise<void> {
	let metadata = probe.metadata;
	if (probes.schema.ShowMetadata.is(metadata)) {
		let show_id = makeBinaryId("show", metadata.title);
		await stores.shows.update(queue, {
			show_id: show_id,
			name: metadata.title,
			summary: metadata.summary ?? null,
			imdb: metadata.imdb ?? null
		});
		for (let [index, actor] of metadata.actors.entries()) {
			let actor_id = makeBinaryId("actor", actor);
			await stores.actors.update(queue, {
				actor_id: actor_id,
				name: actor
			});
			await stores.show_actors.insert(queue, {
				actor_id: actor_id,
				show_id: show_id,
				order: index
			});
		}
		for (let [index, genre] of metadata.genres.entries()) {
			let genre_id = makeBinaryId("genre", genre);
			await stores.genres.update(queue, {
				genre_id: genre_id,
				name: genre
			});
			await stores.show_genres.insert(queue, {
				genre_id: genre_id,
				show_id: show_id,
				order: index
			});
		}
		await associateShowFiles(queue, show_id, ...file_ids);
	} else if (probes.schema.EpisodeMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.year)) {
			year_id = makeBinaryId("year", metadata.year);
			await stores.years.update(queue, {
				year_id: year_id,
				year: metadata.year
			});
		}
		let show_id = makeBinaryId("show", metadata.show.title);
		await stores.shows.update(queue, {
			show_id: show_id,
			name: metadata.show.title,
			summary: metadata.show.summary ?? null,
			imdb: metadata.show.imdb ?? null
		});
		let season_id = makeBinaryId("season", show_id, `${metadata.season}`);
		await stores.seasons.update(queue, {
			season_id: season_id,
			show_id: show_id,
			number: metadata.season
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
			imdb: metadata.imdb ?? null
		});
		for (let [index, actor] of metadata.show.actors.entries()) {
			let actor_id = makeBinaryId("actor", actor);
			await stores.actors.update(queue, {
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
			await stores.genres.update(queue, {
				genre_id: genre_id,
				name: genre
			});
			await stores.show_genres.insert(queue, {
				genre_id: genre_id,
				show_id: show_id,
				order: index
			});
		}
		await associateEpisodeFiles(queue, episode_id, ...file_ids);
	} else if (probes.schema.MovieMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.year)) {
			year_id = makeBinaryId("year", metadata.year);
			await stores.years.update(queue, {
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
			imdb: metadata.imdb ?? null
		});
		for (let [index, actor] of metadata.actors.entries()) {
			let actor_id = makeBinaryId("actor", actor);
			await stores.actors.update(queue, {
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
			await stores.genres.update(queue, {
				genre_id: genre_id,
				name: genre
			});
			await stores.movie_genres.insert(queue, {
				genre_id: genre_id,
				movie_id: movie_id,
				order: index
			});
		}
		await associateMovieFiles(queue, movie_id, ...file_ids);
	} else if (probes.schema.TrackMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.album.year)) {
			year_id = makeBinaryId("year", metadata.album.year);
			await stores.years.update(queue, {
				year_id: year_id,
				year: metadata.album.year
			});
		}
		let album_id = makeBinaryId("album", metadata.album.title, metadata.album.year);
		await stores.albums.update(queue, {
			album_id: album_id,
			title: metadata.album.title,
			year_id: year_id ?? null
		});
		for (let [index, artist] of metadata.album.artists.entries()) {
			let artist_id = makeBinaryId("artist", artist);
			await stores.artists.update(queue, {
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
			number: metadata.disc
		});
		let track_id = makeBinaryId("track", disc_id, `${metadata.track}`);
		await stores.tracks.update(queue, {
			track_id: track_id,
			disc_id: disc_id,
			title: metadata.title,
			number: metadata.track,
			copyright: metadata.copyright ?? null
		});
		for (let [index, artist] of metadata.artists.entries()) {
			let artist_id = makeBinaryId("artist", artist);
			await stores.artists.update(queue, {
				artist_id: artist_id,
				name: artist
			});
			await stores.track_artists.insert(queue, {
				track_id: track_id,
				artist_id: artist_id,
				order: index
			});
		}
		await associateTrackFiles(queue, track_id, ...file_ids);
	} else if (probes.schema.AlbumMetadata.is(metadata)) {
		let year_id: Uint8Array | undefined;
		if (is.present(metadata.year)) {
			year_id = makeBinaryId("year", metadata.year);
			await stores.years.update(queue, {
				year_id: year_id,
				year: metadata.year
			});
		}
		let album_id = makeBinaryId("album", metadata.title, metadata.year);
		await stores.albums.update(queue, {
			album_id: album_id,
			title: metadata.title,
			year_id: year_id ?? null
		});
		for (let [index, artist] of metadata.artists.entries()) {
			let artist_id = makeBinaryId("artist", artist);
			await stores.artists.update(queue, {
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
			number: metadata.disc
		});
		for (let [index, track] of metadata.tracks.entries()) {
			let track_id = makeBinaryId("track", disc_id, `${index}`);
			await stores.tracks.update(queue, {
				track_id: track_id,
				disc_id: disc_id,
				title: track.title,
				number: index + 1,
				copyright: track.copyright ?? metadata.copyright ?? null
			});
			for (let [index, artist] of track.artists.entries()) {
				let artist_id = makeBinaryId("artist", artist);
				await stores.artists.update(queue, {
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
		await associateAlbumFiles(queue, album_id, ...file_ids);
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
				await indexMetadata(queue, probe);
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
				await indexMetadata(queue, probe);
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
				await indexMetadata(queue, probe, file_id);
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
				await indexMetadata(queue, probe, file_id);
			} else if (is.present(audio_resource)) {
				await stores.audio_files.insert(queue, {
					file_id: file_id,
					mime: "audio/mp4",
					duration_ms: audio_resource.duration_ms
				});
				await indexMetadata(queue, probe, file_id);
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
				await indexMetadata(queue, probe);
			}
		}
	} catch (error) {
		console.log(`Indexing failed for "${path}"!`);
		console.log(error);
	}
	let stats = libfs.fstatSync(fd);
	file.index_timestamp = stats.mtime.valueOf();
	file.size = stats.size;
	libfs.closeSync(fd);
	await stores.files.update(queue, file);
};

async function indexFiles(queue: WritableQueue): Promise<void> {
	console.log(`Indexing files...`);
	let files = await stores.files.filter(queue);
	console.log(`Database contains ${files.length} files.`);
	for (let file of files) {
		if (is.absent(file.index_timestamp)) {
			console.log(`Indexing ${file.name}...`);
			await indexFile(queue, file);
		}
	}
};

async function getSiblingFiles(queue: ReadableQueue, subject: File): Promise<Array<File>> {
	let parent_directory = await links.directory_files.lookup(queue, subject);
	let candidates_in_directory = (await links.directory_files.filter(queue, parent_directory))
		.sort(indices.LexicalSort.increasing((file) => file.name));
	let basename = subject.name.split(".")[0];
	let candidates_sharing_basename = candidates_in_directory
		.filter((file) => hexid(file.file_id) !== hexid(subject.file_id))
		.filter((file) => file.name.split(".")[0] === basename);
	if (candidates_sharing_basename.length > 0) {
		return candidates_sharing_basename;
	} else {
		return candidates_in_directory;
	}
};

async function associateMetadata(queue: WritableQueue): Promise<void> {
	console.log(`Associating metadata files...`);
	let metadata_files = await stores.metadata_files.filter(queue);
	console.log(`Database contains ${metadata_files.length} metadata files.`);
	for (let metadata_file of metadata_files) {
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
	console.log(`Associating image files...`);
	let image_files = await stores.image_files.filter(queue);
	console.log(`Database contains ${image_files.length} image files.`);
	for (let image_file of image_files) {
		let file = await stores.files.lookup(queue, image_file);
		let siblings = await getSiblingFiles(queue, file);
		for (let sibling of siblings) {
			let track_files = await links.file_track_files.filter(queue, sibling);
			if (track_files.length > 0) {
				for (let track_file of track_files) {
					let track = await stores.tracks.lookup(queue, track_file);
					let disc = await stores.discs.lookup(queue, track);
					let album = await stores.albums.lookup(queue, disc);
					await associateAlbumFiles(queue, album.album_id, image_file.file_id);
				}
				continue;
			}
			let movie_files = await links.file_movie_files.filter(queue, sibling);
			if (movie_files.length > 0) {
				for (let movie_file of movie_files) {
					let movie = await stores.movies.lookup(queue, movie_file);
					await associateMovieFiles(queue, movie.movie_id, image_file.file_id);
				}
				continue;
			}
			let episode_files = await links.file_episode_files.filter(queue, sibling);
			if (episode_files.length > 0) {
				for (let episode_file of episode_files) {
					let episode = await stores.episodes.lookup(queue, episode_file);
					await associateEpisodeFiles(queue, episode.episode_id, image_file.file_id);
				}
				continue;
			}
			let show_files = await links.file_show_files.filter(queue, sibling);
			if (show_files.length > 0) {
				for (let show_file of show_files) {
					let show = await stores.shows.lookup(queue, show_file);
					await associateShowFiles(queue, show.show_id, image_file.file_id);
				}
				continue;
			}
		}
	}
};

async function associateSubtitles(queue: WritableQueue): Promise<void> {
	console.log(`Associating subtitle files...`);
	let subtitle_files = await stores.subtitle_files.filter(queue);
	console.log(`Database contains ${subtitle_files.length} subtitle files.`);
	for (let subtitle_file of subtitle_files) {
		let file = await stores.files.lookup(queue, subtitle_file);
		let siblings = await getSiblingFiles(queue, file);
		for (let sibling of siblings) {
			try {
				let video_file = await stores.video_files.lookup(queue, sibling);
				await stores.video_subtitles.insert(queue, {
					video_file_id: video_file.file_id,
					subtitle_file_id: subtitle_file.file_id
				});
				continue;
			} catch (error) {}
		}
	}
};

async function removeBrokenEntities(queue: WritableQueue): Promise<void> {
	console.log(`Removing tracks without files...`);
	for (let track of await stores.tracks.filter(queue)) {
		let track_files = await links.track_track_files.filter(queue, track);
		if (track_files.length === 0) {
			await stores.tracks.remove(queue, track);
		}
	}
	console.log(`Removing discs without tracks...`);
	for (let disc of await stores.discs.filter(queue)) {
		let tracks = await links.disc_tracks.filter(queue, disc);
		if (tracks.length === 0) {
			await stores.discs.remove(queue, disc);
		}
	}
	console.log(`Removing albums without discs...`);
	for (let album of await stores.albums.filter(queue)) {
		let discs = await links.album_discs.filter(queue, album);
		if (discs.length === 0) {
			await stores.albums.remove(queue, album);
		}
	}
	console.log(`Removing artists without albums and tracks...`);
	for (let artist of await stores.artists.filter(queue)) {
		let album_artists = await links.artist_album_artists.filter(queue, artist);
		let track_artists = await links.artist_track_artists.filter(queue, artist);
		if (album_artists.length === 0 && track_artists.length === 0) {
			await stores.artists.remove(queue, artist);
		}
	}
	console.log(`Removing movies without files...`);
	for (let movie of await stores.movies.filter(queue)) {
		let movie_files = await links.movie_movie_files.filter(queue, movie);
		if (movie_files.length === 0) {
			await stores.movies.remove(queue, movie);
		}
	}
	console.log(`Removing episodes without files...`);
	for (let episode of await stores.episodes.filter(queue)) {
		let episode_files = await links.episode_episode_files.filter(queue, episode);
		if (episode_files.length === 0) {
			await stores.episodes.remove(queue, episode);
		}
	}
	console.log(`Removing seasons without episodes...`);
	for (let season of await stores.seasons.filter(queue)) {
		let episodes = await links.season_episodes.filter(queue, season);
		if (episodes.length === 0) {
			await stores.seasons.remove(queue, season);
		}
	}
	console.log(`Removing shows without seasons...`);
	for (let show of await stores.shows.filter(queue)) {
		let seasons = await links.show_seasons.filter(queue, show);
		if (seasons.length === 0) {
			await stores.shows.remove(queue, show);
		}
	}
	console.log(`Removing actors without movies and shows...`);
	for (let actor of await stores.actors.filter(queue)) {
		let movie_actors = await links.actor_movie_actors.filter(queue, actor);
		let show_actors = await links.actor_show_actors.filter(queue, actor);
		if (movie_actors.length === 0 && show_actors.length === 0) {
			await stores.actors.remove(queue, actor);
		}
	}
	console.log(`Removing genres without movies and shows...`);
	for (let genre of await stores.genres.filter(queue)) {
		let movie_genres = await links.genre_movie_genres.filter(queue, genre);
		let show_genres = await links.genre_show_genres.filter(queue, genre);
		if (movie_genres.length === 0 && show_genres.length === 0) {
			await stores.genres.remove(queue, genre);
		}
	}
	console.log(`Removing years without albums, movies and episodes...`);
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
	console.log(`Computing album timestamps...`);
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
	console.log(`Computing movie timestamps...`);
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
	console.log(`Computing show timestamps...`);
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
	console.log(`Computing movie suggestions...`);
	let movies = await Promise.all((await stores.movies.filter(queue)).map(async (movie) => {
		let movie_genres = await links.movie_movie_genres.filter(queue, movie);
		return {
			...movie,
			movie_genres
		};
	}));
	for (let movie of movies) {
		for (let suggested_movie of movies) {
			if (suggested_movie.movie_id === movie.movie_id) {
				continue;
			}
			let affinity = 0;
			for (let movie_genre of movie.movie_genres) {
				if (suggested_movie.movie_genres.find((suggested_movie_genre) => hexid(suggested_movie_genre.genre_id) === hexid(movie_genre.genre_id)) != null) {
					affinity += 1;
				} else {
					affinity -= 1;
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

export async function migrateLegacyData(queue: WritableQueue): Promise<void> {
	if (libfs.existsSync(TABLES_ROOT.join("/"))) {
		console.log(`Migrating legacy data...`);
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
					user_id: binid(playlist.user_id),
					affinity: 0
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
	console.log(`Running indexer...`);
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		console.log(`Updating file lists...`);
		for (let directory of await links.directory_directories.filter(queue)) {
			await checkDirectory(queue, directory, [...config.media_path, directory.name]);
		}
		for (let file of await links.directory_files.filter(queue)) {
			await checkFile(queue, file, [...config.media_path, file.name]);
		}
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		console.log(`Traversing media directory...`);
		await visitDirectory(queue, config.media_path, null);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await indexFiles(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await associateMetadata(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await associateImages(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await associateSubtitles(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await removeBrokenEntities(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await computeAlbumTimestamps(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await computeMovieTimestamps(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await computeShowTimestamps(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await computeMovieSuggestions(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		await migrateLegacyData(queue);
	});
	await transactionManager.enqueueWritableTransaction(async (queue) => {
		console.log(`Cleaning up...`);
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
	});
	console.log(`Indexing finished.`);
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

// slow because of tree.length() check
