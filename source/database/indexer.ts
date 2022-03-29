import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as schema from "./schema";
import * as indices from "../jsondb/";
import * as is from "../is";
import * as probes from "./probes";
import { default as config } from "../config";
import * as jdb2 from "../jdb2";
import { transactionManager, stores, links, Directory, File, queries } from "./atlas";
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

if (!libfs.existsSync(TABLES_ROOT.join("/"))) {
	libfs.mkdirSync(TABLES_ROOT.join("/"));
}

const INDICES_ROOT = [
	".",
	"private",
	"indices"
];

if (!libfs.existsSync(INDICES_ROOT.join("/"))) {
	libfs.mkdirSync(INDICES_ROOT.join("/"));
}

function loadTable<A>(name: string, guard: autoguard.serialization.MessageGuard<A>, getKey: jdb2.ValueProvider<A>): jdb2.Table<A> {
	let blockHandler = new jdb2.BlockHandler([".", "private", "tables", name]);
	let table = new jdb2.Table<A>(blockHandler, (json) => guard.as(json), getKey);
	return table;
}

function loadIndex<A, B>(name: string, parent: jdb2.Table<A>, child: jdb2.Table<B>, getGroupKey: jdb2.ValuesProvider<B>, tokenizer: jdb2.Tokenizer = jdb2.Index.VALUE_TOKENIZER): jdb2.Index<A, B> {
	let blockHandler = new jdb2.BlockHandler([".", "private", "indices", name]);
	let index = new jdb2.Index<A, B>(blockHandler, parent, child, getGroupKey, tokenizer);
	return index;
}

export const directories = loadTable("directories", schema.Directory, (record) => record.directory_id);
export const getDirectoriesFromDirectory = loadIndex("directory_directories", directories, directories, (record) => [record.parent_directory_id]);
export const files = loadTable("files", schema.File, (record) => record.file_id);
export const getFilesFromDirectory = loadIndex("directory_files", directories, files, (record) => [record.parent_directory_id]);
export const audio_files = loadTable("audio_files", schema.AudioFile, (record) => record.file_id);
export const getAudioFiles = loadIndex("file_audio_files", files, audio_files, (record) => [record.file_id]);
export const image_files = loadTable("image_files", schema.ImageFile, (record) => record.file_id);
export const getImageFilesFromFile = loadIndex("file_image_files", files, image_files, (record) => [record.file_id]);
export const metadata_files = loadTable("metadata_files", schema.MetadataFile, (record) => record.file_id);
export const getMetadataFilesFromFile = loadIndex("file_metadata_files", files, metadata_files, (record) => [record.file_id]);
export const subtitle_files = loadTable("subtitle_files", schema.SubtitleFile, (record) => record.file_id);
export const getSubtitleFilesFromFile = loadIndex("file_subtitle_files", files, subtitle_files, (record) => [record.file_id]);
export const video_files = loadTable("video_files", schema.VideoFile, (record) => record.file_id);
export const getVideoFilesFromFile = loadIndex("file_video_files", files, video_files, (record) => [record.file_id]);
export const video_subtitles = loadTable("video_subtitles", schema.VideoSubtitle, (record) => makeId(record.video_file_id, record.subtitle_file_id));
export const getSubtitleFilesFromVideoFile = loadIndex("video_file_video_subtitles", video_files, video_subtitles, (record) => [record.video_file_id]);
export const getVideoFilesFromSubtitleFile = loadIndex("subtitle_file_video_subtitles", subtitle_files, video_subtitles, (record) => [record.subtitle_file_id]);
export const artists = loadTable("artists", schema.Artist, (record) => record.artist_id);
export const albums = loadTable("albums", schema.Album, (record) => record.album_id);
export const album_files = loadTable("album_files", schema.AlbumFile, (record) => makeId(record.album_id, record.file_id));
export const getAlbumsFromFile = loadIndex("file_album_files", files, album_files, (record) => [record.file_id]);
export const getFilesFromAlbum = loadIndex("album_album_files", albums, album_files, (record) => [record.album_id]);
export const discs = loadTable("discs", schema.Disc, (record) => record.disc_id);
export const getDiscsFromAlbum = loadIndex("album_discs", albums, discs, (record) => [record.album_id]);
export const tracks = loadTable("tracks", schema.Track, (record) => record.track_id);
export const getTracksFromDisc = loadIndex("disc_tracks", discs, tracks, (record) => [record.disc_id]);
export const track_files = loadTable("track_files", schema.TrackFile, (record) => makeId(record.track_id, record.file_id));
export const getTracksFromFile = loadIndex("file_track_files", files, track_files, (record) => [record.file_id]);
export const getFilesFromTrack = loadIndex("track_track_files", tracks, track_files, (record) => [record.track_id]);
export const album_artists = loadTable("album_artists", schema.AlbumArtist, (record) => makeId(record.album_id, record.artist_id));
export const getArtistsFromAlbum = loadIndex("album_album_artists", albums, album_artists, (record) => [record.album_id]);
export const getAlbumsFromArtist = loadIndex("artist_album_artists", artists, album_artists, (record) => [record.artist_id]);
export const track_artists = loadTable("track_artists", schema.TrackArtist, (record) => makeId(record.track_id, record.artist_id));
export const getArtistsFromTrack = loadIndex("track_track_artists", tracks, track_artists, (record) => [record.track_id]);
export const getTracksFromArtist = loadIndex("artist_track_artists", artists, track_artists, (record) => [record.artist_id]);
export const shows = loadTable("shows", schema.Show, (record) => record.show_id);
export const show_files = loadTable("show_files", schema.ShowFile, (record) => makeId(record.show_id, record.file_id));
export const getShowsFromFile = loadIndex("file_show_files", files, show_files, (record) => [record.file_id]);
export const getFilesFromShow = loadIndex("show_show_files", shows, show_files, (record) => [record.show_id]);
export const seasons = loadTable("seasons", schema.Season, (record) => record.season_id);
export const getSeasonsFromShow = loadIndex("show_seasons", shows, seasons, (record) => [record.show_id]);
export const episodes = loadTable("episodes", schema.Episode, (record) => record.episode_id);
export const getEpisodesFromSeason = loadIndex("season_episodes", seasons, episodes, (record) => [record.season_id]);
export const episode_files = loadTable("episode_files", schema.EpisodeFile, (record) => makeId(record.episode_id, record.file_id));
export const getEpisodesFromFile = loadIndex("file_episode_files", files, episode_files, (record) => [record.file_id]);
export const getFilesFromEpisode = loadIndex("episode_episode_files", episodes, episode_files, (record) => [record.episode_id]);
export const movies = loadTable("movies", schema.Movie, (record) => record.movie_id);
export const movie_files = loadTable("movie_files", schema.MovieFile, (record) => makeId(record.movie_id, record.file_id));
export const getMoviesFromFile = loadIndex("file_movie_files", files, movie_files, (record) => [record.file_id]);
export const getFilesFromMovie = loadIndex("movie_movie_files", movies, movie_files, (record) => [record.movie_id]);
export const actors = loadTable("actors", schema.Actor, (record) => record.actor_id);
export const movie_actors = loadTable("movie_actors", schema.MovieActor, (record) => makeId(record.movie_id, record.actor_id));
export const getMoviesFromActor = loadIndex("actor_movie_actors", actors, movie_actors, (record) => [record.actor_id]);
export const getActorsFromMovie = loadIndex("movie_movie_actors", movies, movie_actors, (record) => [record.movie_id]);
export const show_actors = loadTable("show_actors", schema.ShowActor, (record) => makeId(record.show_id, record.actor_id));
export const getShowsFromActor = loadIndex("actor_show_actors", actors, show_actors, (record) => [record.actor_id]);
export const getActorsFromShow = loadIndex("show_show_actors", shows, show_actors, (record) => [record.show_id]);
export const genres = loadTable("genres", schema.Genre, (record) => record.genre_id);
export const movie_genres = loadTable("movie_genres", schema.MovieGenre, (record) => makeId(record.movie_id, record.genre_id));
export const getMoviesFromGenre = loadIndex("genre_movie_genres", genres, movie_genres, (record) => [record.genre_id]);
export const getGenresFromMovie = loadIndex("movie_movie_genres", movies, movie_genres, (record) => [record.movie_id]);
export const show_genres = loadTable("show_genres", schema.ShowGenre, (record) => makeId(record.show_id, record.genre_id));
export const getShowsFromGenre = loadIndex("genre_show_genres", genres, show_genres, (record) => [record.genre_id]);
export const getGenresFromShow = loadIndex("show_show_genres", shows, show_genres, (record) => [record.show_id]);
export const subtitles = loadTable("subtitles", schema.Subtitle, (record) => record.subtitle_id);
export const cues = loadTable("cues", schema.Cue, (record) => record.cue_id);
export const getCuesFromSubtitle = loadIndex("subtitle_cues", subtitles, cues, (record) => [record.subtitle_id]);
export const users = loadTable("users", schema.User, (record) => record.user_id);
export const getUsersFromUsername = loadIndex("user_users", users, users, (record) => [record.username]);
export const keys = loadTable("keys", schema.Key, (record) => record.key_id);
export const getKeysFromUser = loadIndex("user_keys", users, keys, (record) => [record.user_id]);
export const tokens = loadTable("tokens", schema.Token, (record) => record.token_id);
export const getTokensFromUser = loadIndex("user_tokens", users, tokens, (record) => [record.user_id]);
export const streams = loadTable("streams", schema.Stream, (record) => record.stream_id);
export const getStreamsFromUser = loadIndex("user_streams", users, streams, (record) => [record.user_id]);
export const getStreamsFromFile = loadIndex("file_streams", files, streams, (record) => [record.file_id]);
export const playlists = loadTable("playlists", schema.Playlist, (record) => record.playlist_id);
export const getPlaylistsFromUser = loadIndex("user_playlists", users, playlists, (record) => [record.user_id]);
export const playlist_items = loadTable("playlist_items", schema.PlaylistItem, (record) => record.playlist_item_id);
export const getPlaylistsItemsFromPlaylist = loadIndex("playlist_playlist_items", playlists, playlist_items, (record) => [record.playlist_id]);
export const getPlaylistItemsFromTrack = loadIndex("track_playlist_items", tracks, playlist_items, (record) => [record.track_id]);
export const years = loadTable("years", schema.Year, (record) => record.year_id);
export const getMoviesFromYear = loadIndex("year_movies", years, movies, (record) => [record.year]);
export const getAlbumsFromYear = loadIndex("year_albums", years, albums, (record) => [record.year]);

export const album_search = loadIndex("search_albums", albums, albums, (entry) => [entry.title, entry.year].filter(is.present), jdb2.Index.QUERY_TOKENIZER);
export const artist_search = loadIndex("search_artists", artists, artists, (entry) => [entry.name], jdb2.Index.QUERY_TOKENIZER);
export const cue_search = loadIndex("search_cues", cues, cues, (entry) => [entry.lines], jdb2.Index.QUERY_TOKENIZER);
export const episode_search = loadIndex("search_episodes", episodes, episodes, (entry) => [entry.title, entry.year].filter(is.present), jdb2.Index.QUERY_TOKENIZER);
export const genre_search = loadIndex("search_genres", genres, genres, (entry) => [entry.name], jdb2.Index.QUERY_TOKENIZER);
export const movie_search = loadIndex("search_movies", movies, movies, (entry) => [entry.title, entry.year].filter(is.present), jdb2.Index.QUERY_TOKENIZER);
export const actor_search = loadIndex("search_actors", actors, actors, (entry) => [entry.name], jdb2.Index.QUERY_TOKENIZER);
export const playlist_search = loadIndex("search_playlists", playlists, playlists, (entry) => [entry.title], jdb2.Index.QUERY_TOKENIZER);
export const shows_search = loadIndex("search_shows", shows, shows, (entry) => [entry.name], jdb2.Index.QUERY_TOKENIZER);
export const track_search = loadIndex("search_tracks", tracks, tracks, (entry) => [entry.title], jdb2.Index.QUERY_TOKENIZER);
export const user_search = loadIndex("search_users", users, users, (entry) => [entry.name, entry.username], jdb2.Index.QUERY_TOKENIZER);
export const year_search = loadIndex("search_years", years, years, (entry) => [entry.year], jdb2.Index.QUERY_TOKENIZER);

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
		await stores.shows.insert(queue, {
			show_id: show_id,
			name: metadata.show.title,
			summary: metadata.show.summary ?? null,
			imdb: metadata.show.imdb ?? null
		});
		let season_id = makeBinaryId("season", show_id, `${metadata.season}`);
		await stores.seasons.insert(queue, {
			season_id: season_id,
			show_id: show_id,
			number: metadata.season
		});
		let episode_id = makeBinaryId("episode", season_id, `${metadata.episode}`);
		await stores.episodes.insert(queue, {
			episode_id: episode_id,
			season_id: season_id,
			title: metadata.title,
			number: metadata.episode,
			year_id: year_id ?? null,
			summary: metadata.summary ?? null,
			copyright: metadata.copyright ?? null,
			imdb: metadata.imdb ?? null
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
		await stores.movies.insert(queue, {
			movie_id: movie_id,
			title: metadata.title,
			year_id: year_id ?? null,
			summary: metadata.summary ?? null,
			copyright: metadata.copyright ?? null,
			imdb: metadata.imdb ?? null
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
		await stores.albums.insert(queue, {
			album_id: album_id,
			title: metadata.album.title,
			year_id: year_id ?? null
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
		await stores.discs.insert(queue, {
			disc_id: disc_id,
			album_id: album_id,
			number: metadata.disc
		});
		let track_id = makeBinaryId("track", disc_id, `${metadata.track}`);
		await stores.tracks.insert(queue, {
			track_id: track_id,
			disc_id: disc_id,
			title: metadata.title,
			number: metadata.track,
			copyright: metadata.copyright ?? null
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
		await stores.albums.insert(queue, {
			album_id: album_id,
			title: metadata.title,
			year_id: year_id ?? null
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
		await stores.discs.insert(queue, {
			disc_id: disc_id,
			album_id: album_id,
			number: metadata.disc
		});
		if (metadata.tracks.length === file_ids.length) {
			for (let [index, file_id] of file_ids.entries()) {
				let track = metadata.tracks[index];
				let track_id = makeBinaryId("track", disc_id, `${index}`);
				await stores.tracks.insert(queue, {
					track_id: track_id,
					disc_id: disc_id,
					title: track.title,
					number: index + 1,
					copyright: track.copyright ?? metadata.copyright ?? null
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
