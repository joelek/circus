import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as schema from "./schema";
import * as indices from "../jsondb/";
import * as is from "../is";
import * as probes from "./probes";
import { Directory, File } from "./schema";
import { default as config } from "../config";
import * as jdb from "../jdb";

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

function loadTable<A>(name: string, guard: autoguard.serialization.MessageGuard<A>, getKey: (record: A) => string): jdb.Table<A> {
	return new jdb.Table<A>(TABLES_ROOT, name, guard, getKey);
}

function loadIndex<A, B>(name: string, parent: jdb.Table<A>, child: jdb.Table<B>, getGroupKey: (record: B) => string | number | undefined): jdb.Index<B> {
	let index = new jdb.Index<B>(INDICES_ROOT, name, (key) => child.lookup(key), getGroupKey, (record) => child.keyof(record));
	if (index.length() === 0) {
		for (let record of child) {
			index.insert(record);
		}
	}
	child.on("insert", (event) => {
		index.insert(event.next);
	});
	child.on("remove", (event) => {
		index.remove(event.last);
	});
	child.on("update", (event) => {
		index.update(event.last, event.next);
	});
	parent.on("remove", (event) => {
		let key = parent.keyof(event.last);
		for (let record of index.lookup(key)) {
			child.remove(record);
		}
	});
	return index;
}

export const directories = loadTable("directories", schema.Directory, (record) => record.directory_id);
export const getDirectoriesFromDirectory = loadIndex("directory_directories", directories, directories, (record) => record.parent_directory_id);
export const files = loadTable("files", schema.File, (record) => record.file_id);
export const getFilesFromDirectory = loadIndex("directory_files", directories, files, (record) => record.parent_directory_id);
export const audio_files = loadTable("audio_files", schema.AudioFile, (record) => record.file_id);
export const getAudioFiles = loadIndex("file_audio_files", files, audio_files, (record) => record.file_id);
export const image_files = loadTable("image_files", schema.ImageFile, (record) => record.file_id);
export const getImageFilesFromFile = loadIndex("file_image_files", files, image_files, (record) => record.file_id);
export const metadata_files = loadTable("metadata_files", schema.MetadataFile, (record) => record.file_id);
export const getMetadataFilesFromFile = loadIndex("file_metadata_files", files, metadata_files, (record) => record.file_id);
export const subtitle_files = loadTable("subtitle_files", schema.SubtitleFile, (record) => record.file_id);
export const getSubtitleFilesFromFile = loadIndex("file_subtitle_files", files, subtitle_files, (record) => record.file_id);
export const video_files = loadTable("video_files", schema.VideoFile, (record) => record.file_id);
export const getVideoFilesFromFile = loadIndex("file_video_files", files, video_files, (record) => record.file_id);
export const video_subtitles = loadTable("video_subtitles", schema.VideoSubtitle, (record) => makeId(record.video_file_id, record.subtitle_file_id));
export const getSubtitleFilesFromVideoFile = loadIndex("video_file_video_subtitles", video_files, video_subtitles, (record) => record.video_file_id);
export const getVideoFilesFromSubtitleFile = loadIndex("subtitle_file_video_subtitles", subtitle_files, video_subtitles, (record) => record.subtitle_file_id);
export const artists = loadTable("artists", schema.Artist, (record) => record.artist_id);
export const albums = loadTable("albums", schema.Album, (record) => record.album_id);
export const album_files = loadTable("album_files", schema.AlbumFile, (record) => makeId(record.album_id, record.file_id));
export const getAlbumsFromFile = loadIndex("file_album_files", files, album_files, (record) => record.file_id);
export const getFilesFromAlbum = loadIndex("album_album_files", albums, album_files, (record) => record.album_id);
export const discs = loadTable("discs", schema.Disc, (record) => record.disc_id);
export const getDiscsFromAlbum = loadIndex("album_discs", albums, discs, (record) => record.album_id);
export const tracks = loadTable("tracks", schema.Track, (record) => record.track_id);
export const getTracksFromDisc = loadIndex("disc_tracks", discs, tracks, (record) => record.disc_id);
export const track_files = loadTable("track_files", schema.TrackFile, (record) => makeId(record.track_id, record.file_id));
export const getTracksFromFile = loadIndex("file_track_files", files, track_files, (record) => record.file_id);
export const getFilesFromTrack = loadIndex("track_track_files", tracks, track_files, (record) => record.track_id);
export const album_artists = loadTable("album_artists", schema.AlbumArtist, (record) => makeId(record.album_id, record.artist_id));
export const getArtistsFromAlbum = loadIndex("album_album_artists", albums, album_artists, (record) => record.album_id);
export const getAlbumsFromArtist = loadIndex("artist_album_artists", artists, album_artists, (record) => record.artist_id);
export const track_artists = loadTable("track_artists", schema.TrackArtist, (record) => makeId(record.track_id, record.artist_id));
export const getArtistsFromTrack = loadIndex("track_track_artists", tracks, track_artists, (record) => record.track_id);
export const getTracksFromArtist = loadIndex("artist_track_artists", artists, track_artists, (record) => record.artist_id);
export const shows = loadTable("shows", schema.Show, (record) => record.show_id);
export const show_files = loadTable("show_files", schema.ShowFile, (record) => makeId(record.show_id, record.file_id));
export const getShowsFromFile = loadIndex("file_show_files", files, show_files, (record) => record.file_id);
export const getFilesFromShow = loadIndex("show_show_files", shows, show_files, (record) => record.show_id);
export const seasons = loadTable("seasons", schema.Season, (record) => record.season_id);
export const getSeasonsFromShow = loadIndex("show_seasons", shows, seasons, (record) => record.show_id);
export const episodes = loadTable("episodes", schema.Episode, (record) => record.episode_id);
export const getEpisodesFromSeason = loadIndex("season_episodes", seasons, episodes, (record) => record.season_id);
export const episode_files = loadTable("episode_files", schema.EpisodeFile, (record) => makeId(record.episode_id, record.file_id));
export const getEpisodesFromFile = loadIndex("file_episode_files", files, episode_files, (record) => record.file_id);
export const getFilesFromEpisode = loadIndex("episode_episode_files", episodes, episode_files, (record) => record.episode_id);
export const movies = loadTable("movies", schema.Movie, (record) => record.movie_id);
export const movie_files = loadTable("movie_files", schema.MovieFile, (record) => makeId(record.movie_id, record.file_id));
export const getMoviesFromFile = loadIndex("file_movie_files", files, movie_files, (record) => record.file_id);
export const getFilesFromMovie = loadIndex("movie_movie_files", movies, movie_files, (record) => record.movie_id);
export const actors = loadTable("actors", schema.Actor, (record) => record.actor_id);
export const movie_actors = loadTable("movie_actors", schema.MovieActor, (record) => makeId(record.movie_id, record.actor_id));
export const getMoviesFromActor = loadIndex("actor_movie_actors", actors, movie_actors, (record) => record.actor_id);
export const getActorsFromMovie = loadIndex("movie_movie_actors", movies, movie_actors, (record) => record.movie_id);
export const show_actors = loadTable("show_actors", schema.ShowActor, (record) => makeId(record.show_id, record.actor_id));
export const getShowsFromActor = loadIndex("actor_show_actors", actors, show_actors, (record) => record.actor_id);
export const getActorsFromShow = loadIndex("show_show_actors", shows, show_actors, (record) => record.show_id);
export const genres = loadTable("genres", schema.Genre, (record) => record.genre_id);
export const movie_genres = loadTable("movie_genres", schema.MovieGenre, (record) => makeId(record.movie_id, record.genre_id));
export const getMoviesFromGenre = loadIndex("genre_movie_genres", genres, movie_genres, (record) => record.genre_id);
export const getGenresFromMovie = loadIndex("movie_movie_genres", movies, movie_genres, (record) => record.movie_id);
export const show_genres = loadTable("show_genres", schema.ShowGenre, (record) => makeId(record.show_id, record.genre_id));
export const getShowsFromGenre = loadIndex("genre_show_genres", genres, show_genres, (record) => record.genre_id);
export const getGenresFromShow = loadIndex("show_show_genres", shows, show_genres, (record) => record.show_id);
export const subtitles = loadTable("subtitles", schema.Subtitle, (record) => record.subtitle_id);
export const cues = loadTable("cues", schema.Cue, (record) => record.cue_id);
export const getCuesFromSubtitle = loadIndex("subtitle_cues", subtitles, cues, (record) => record.subtitle_id);
export const users = loadTable("users", schema.User, (record) => record.user_id);
export const getUsersFromUsername = loadIndex("user_users", users, users, (record) => record.username);
export const keys = loadTable("keys", schema.Key, (record) => record.key_id);
export const getKeysFromUser = loadIndex("user_keys", users, keys, (record) => record.user_id);
export const tokens = loadTable("tokens", schema.Token, (record) => record.token_id);
export const getTokensFromUser = loadIndex("user_tokens", users, tokens, (record) => record.user_id);
export const streams = loadTable("streams", schema.Stream, (record) => record.stream_id);
export const getStreamsFromUser = loadIndex("user_streams", users, streams, (record) => record.user_id);
export const getStreamsFromFile = loadIndex("file_streams", files, streams, (record) => record.file_id);
export const playlists = loadTable("playlists", schema.Playlist, (record) => record.playlist_id);
export const getPlaylistsFromUser = loadIndex("user_playlists", users, playlists, (record) => record.user_id);
export const playlist_items = loadTable("playlist_items", schema.PlaylistItem, (record) => record.playlist_item_id);
export const getPlaylistsItemsFromPlaylist = loadIndex("playlist_playlist_items", playlists, playlist_items, (record) => record.playlist_id);
export const getPlaylistItemsFromTrack = loadIndex("track_playlist_items", tracks, playlist_items, (record) => record.track_id);
export const years = loadTable("years", schema.Year, (record) => record.year_id);
export const getMoviesFromYear = loadIndex("year_movies", years, movies, (record) => record.year);
export const getAlbumsFromYear = loadIndex("year_albums", years, albums, (record) => record.year);

if (users.length() === 0) {
	if (keys.length() === 0) {
		keys.insert({
			key_id: makeId("key", libcrypto.randomBytes(8).toString("hex"))
		});
	}
}

export const album_search = indices.SearchIndex.fromTable(albums, (entry) => [entry.title, entry.year?.toString()].filter(is.present));
export const artist_search = indices.SearchIndex.fromTable(artists, (entry) => [entry.name]);
export const cue_search = indices.SearchIndex.fromTable(cues, (entry) => entry.lines.split("\n"), 4);
export const episode_search = indices.SearchIndex.fromTable(episodes, (entry) => [entry.title, entry.year?.toString()].filter(is.present));
export const genre_search = indices.SearchIndex.fromTable(genres, (entry) => [entry.name]);
export const movie_search = indices.SearchIndex.fromTable(movies, (entry) => [entry.title, entry.year?.toString()].filter(is.present));
export const actor_search = indices.SearchIndex.fromTable(actors, (entry) => [entry.name]);
export const playlist_search = indices.SearchIndex.fromTable(playlists, (entry) => [entry.title]);
export const shows_search = indices.SearchIndex.fromTable(shows, (entry) => [entry.name]);
export const track_search = indices.SearchIndex.fromTable(tracks, (entry) => [entry.title]);
export const user_search = indices.SearchIndex.fromTable(users, (entry) => [entry.name, entry.username]);
export const year_search = indices.SearchIndex.fromTable(years, (entry) => [entry.year.toString()]);

export function getPath(entry: Directory | File): Array<string> {
	let path = new Array<string>();
	while (true) {
		path.unshift(entry.name);
		let parent_directory_id = entry.parent_directory_id;
		if (is.absent(parent_directory_id)) {
			break;
		}
		entry = directories.lookup(parent_directory_id);
	}
	return [...config.media_path, ...path];
};

function getDirectoryPath(directory: Directory): Array<string> {
	return getPath(directory);
}

function getFilePath(file: File): Array<string> {
	return getPath(file);
}

function checkFile(root: File): void {
	let path = getFilePath(root).join("/");
	if (libfs.existsSync(path)) {
		let stats = libfs.statSync(path);
		if (stats.isFile()) {
			if (stats.mtime.valueOf() === root.index_timestamp) {
				return;
			}
		}
	}
	files.remove(root);
}

function checkDirectory(root: Directory): void {
	let path = getDirectoryPath(root).join("/");
	if (libfs.existsSync(path)) {
		let stats = libfs.statSync(path);
		if (stats.isDirectory()) {
			for (let directory of getDirectoriesFromDirectory.lookup(root.directory_id)) {
				checkDirectory(directory);
			}
			for (let file of getFilesFromDirectory.lookup(root.directory_id)) {
				checkFile(file);
			}
			return;
		}
	}
	directories.remove(root);
}

function visitDirectory(path: Array<string>, parent_directory_id?: string): void {
	let dirents = libfs.readdirSync(path.join("/"), { withFileTypes: true });
	for (let dirent of dirents) {
		let name = dirent.name;
		if (dirent.isDirectory()) {
			let directory_id = makeId("directory", parent_directory_id, name);
			try {
				directories.lookup(directory_id);
			} catch (error) {
				directories.insert({
					directory_id,
					name,
					parent_directory_id
				});
			}
			visitDirectory([...path, dirent.name], directory_id);
		} else if (dirent.isFile()) {
			let file_id = makeId("file", parent_directory_id, name);
			try {
				files.lookup(file_id);
			} catch (error) {
				files.insert({
					file_id,
					name,
					parent_directory_id
				});
			}
		}
	}
}

function indexMetadata(probe: probes.schema.Probe, ...file_ids: Array<string>): void {
	let metadata = probe.metadata;
	if (probes.schema.EpisodeMetadata.is(metadata)) {
		let show_id = makeId("show", metadata.show.title);
		shows.insert({
			show_id: show_id,
			name: metadata.show.title,
			summary: metadata.show.summary
		});
		let season_id = makeId("season", show_id, `${metadata.season}`);
		seasons.insert({
			season_id: season_id,
			show_id: show_id,
			number: metadata.season
		});
		let episode_id = makeId("episode", season_id, `${metadata.episode}`);
		episodes.insert({
			episode_id: episode_id,
			season_id: season_id,
			title: metadata.title,
			number: metadata.episode,
			year: metadata.year,
			summary: metadata.summary
		});
		for (let file_id of file_ids) {
			episode_files.insert({
				episode_id: episode_id,
				file_id: file_id
			});
		}
		for (let [index, actor] of metadata.show.actors.entries()) {
			let actor_id = makeId("actor", actor);
			actors.insert({
				actor_id: actor_id,
				name: actor
			});
			show_actors.insert({
				actor_id: actor_id,
				show_id: show_id,
				order: index
			});
		}
		for (let [index, genre] of metadata.show.genres.entries()) {
			let genre_id = makeId("genre", genre);
			genres.insert({
				genre_id: genre_id,
				name: genre
			});
			show_genres.insert({
				genre_id: genre_id,
				show_id: show_id,
				order: index
			});
		}
	} else if (probes.schema.MovieMetadata.is(metadata)) {
		let movie_id = makeId("movie", metadata.title, metadata.year);
		movies.insert({
			movie_id: movie_id,
			title: metadata.title,
			year: metadata.year,
			summary: metadata.summary
		});
		if (is.present(metadata.year)) {
			let year_id = makeId("year", metadata.year);
			years.insert({
				year_id: year_id,
				year: metadata.year
			});
		}
		for (let file_id of file_ids) {
			movie_files.insert({
				movie_id: movie_id,
				file_id: file_id
			});
		}
		for (let [index, actor] of metadata.actors.entries()) {
			let actor_id = makeId("actor", actor);
			actors.insert({
				actor_id: actor_id,
				name: actor
			});
			movie_actors.insert({
				actor_id: actor_id,
				movie_id: movie_id,
				order: index
			});
		}
		for (let [index, genre] of metadata.genres.entries()) {
			let genre_id = makeId("genre", genre);
			genres.insert({
				genre_id: genre_id,
				name: genre
			});
			movie_genres.insert({
				genre_id: genre_id,
				movie_id: movie_id,
				order: index
			});
		}
	} else if (probes.schema.TrackMetadata.is(metadata)) {
		let album_id = makeId("album", metadata.album.title, metadata.album.year);
		albums.insert({
			album_id: album_id,
			title: metadata.album.title,
			year: metadata.album.year
		});
		if (is.present(metadata.album.year)) {
			let year_id = makeId("year", metadata.album.year);
			years.insert({
				year_id: year_id,
				year: metadata.album.year
			});
		}
		for (let [index, artist] of metadata.album.artists.entries()) {
			let artist_id = makeId("artist", artist.title);
			artists.insert({
				artist_id: artist_id,
				name: artist.title
			});
			album_artists.insert({
				album_id: album_id,
				artist_id: artist_id,
				order: index
			});
		}
		let disc_id = makeId("disc", album_id, `${metadata.disc}`);
		discs.insert({
			disc_id: disc_id,
			album_id: album_id,
			number: metadata.disc
		});
		let track_id = makeId("track", disc_id, `${metadata.track}`);
		tracks.insert({
			track_id: track_id,
			disc_id: disc_id,
			title: metadata.title,
			number: metadata.track
		});
		for (let file_id of file_ids) {
			track_files.insert({
				track_id: track_id,
				file_id: file_id
			});
		}
		for (let [index, artist] of metadata.artists.entries()) {
			let artist_id = makeId("artist", artist.title);
			artists.insert({
				artist_id: artist_id,
				name: artist.title
			});
			track_artists.insert({
				track_id: track_id,
				artist_id: artist_id,
				order: index
			});
		}
	}
}

function indexFile(file: File): void {
	let file_id = file.file_id;
	let path = getFilePath(file);
	let fd = libfs.openSync(path.join("/"), "r");
	try {
		let probe: probes.schema.Probe = {
			resources: []
		};
		if (file.name.endsWith(".vtt")) {
			probe = probes.vtt.probe(fd);
			let subtitle_resources = probe.resources.filter((resource): resource is probes.schema.SubtitleResource => resource.type === "subtitle");
			let subtitle_resource = subtitle_resources.shift();
			if (is.present(subtitle_resource)) {
				subtitle_files.insert({
					file_id: file_id,
					mime: "text/vtt",
					duration_ms: subtitle_resource.duration_ms,
					language: subtitle_resource.language
				});
				if (config.use_cue_index) {
					let subtitle_id = makeId("subtitle", file.file_id);
					subtitles.insert({
						subtitle_id: subtitle_id,
						file_id: file.file_id
					});
					for (let cue of subtitle_resource.cues) {
						let cue_id = makeId("cue", subtitle_id, `${cue.start_ms}`);
						cues.insert({
							cue_id: cue_id,
							subtitle_id: subtitle_id,
							start_ms: cue.start_ms,
							duration_ms: cue.duration_ms,
							lines: cue.lines.join("\n")
						});
					}
				}
			}
		} else if (file.name.endsWith(".json")) {
			probe = probes.json.probe(fd);
			let metadata_resources = probe.resources.filter((resource): resource is probes.schema.MetadataResource => resource.type === "metadata");
			let metadata_resource = metadata_resources.shift();
			if (is.present(metadata_resource)) {
				metadata_files.insert({
					file_id: file_id,
					mime: "application/json"
				});
			}
		} else if (file.name.endsWith(".mp3")) {
			probe = probes.mp3.probe(fd);
			let audio_resources = probe.resources.filter((resource): resource is probes.schema.AudioResource => resource.type === "audio");
			let audio_resource = audio_resources.shift();
			if (is.present(audio_resource)) {
				audio_files.insert({
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
				video_files.insert({
					file_id: file_id,
					mime: "video/mp4",
					duration_ms: video_resource.duration_ms,
					width: video_resource.width,
					height: video_resource.height
				});
			} else if (is.present(audio_resource)) {
				audio_files.insert({
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
				image_files.insert({
					file_id: file_id,
					mime: "image/jpeg",
					width: image_resource.width,
					height: image_resource.height
				});
			}
		}
		indexMetadata(probe, file_id);
	} catch (error) {
		console.log(`Indexing failed for "${path.join("/")}"!`);
	}
	libfs.closeSync(fd);
	let stats = libfs.statSync(path.join("/"));
	file.index_timestamp = stats.mtime.valueOf();
	files.update(file);
}

function indexFiles(): void {
	for (let file of files) {
		if (is.absent(file.index_timestamp)) {
			indexFile(file);
		}
	}
}

function getSiblingFiles(subject: File): Array<File> {
	let candidates_in_directory = getFilesFromDirectory.lookup(subject.parent_directory_id)
		.sort(indices.LexicalSort.increasing((file) => file.name))
		.map((file) => {
			try {
				audio_files.lookup(file.file_id);
				return file;
			} catch (error) {}
			try {
				video_files.lookup(file.file_id);
				return file;
			} catch (error) {}
		})
		.filter(is.present);
	let basename = subject.name.split(".")[0];
	let candidates_sharing_basename = candidates_in_directory
		.filter((file) => file.name.split(".")[0] === basename);
	if (candidates_sharing_basename.length > 0) {
		return candidates_sharing_basename;
	} else {
		return candidates_in_directory;
	}
}

function associateMetadata(): void {
	for (let metadata_file of metadata_files) {
		let file = files.lookup(metadata_file.file_id);
		let path = getFilePath(file);
		let fd = libfs.openSync(path.join("/"), "r");
		let probe = probes.json.probe(fd);
		libfs.closeSync(fd);
		let siblings = getSiblingFiles(file);
		indexMetadata(probe, ...siblings.map((file) => file.file_id));
	}
}

function associateImages(): void {
	for (let image_file of image_files) {
		let file = files.lookup(image_file.file_id);
		let siblings = getSiblingFiles(file);
		for (let sibling of siblings) {
			let track_files = getTracksFromFile.lookup(sibling.file_id)
				.filter((track_file) => track_file.file_id !== image_file.file_id);
			for (let track_file of track_files) {
				try {
					let track = tracks.lookup(track_file.track_id);
					let disc = discs.lookup(track.disc_id);
					let album = albums.lookup(disc.album_id);
					album_files.insert({
						album_id: album.album_id,
						file_id: image_file.file_id
					});
				} catch (error) {}
			}
			let movies = getMoviesFromFile.lookup(sibling.file_id)
				.filter((movie_file) => movie_file.file_id !== image_file.file_id);
			for (let movie of movies) {
				movie_files.insert({
					movie_id: movie.movie_id,
					file_id: image_file.file_id
				});
			}
			let episode_files = getEpisodesFromFile.lookup(sibling.file_id)
				.filter((episode_file) => episode_file.file_id !== image_file.file_id);
			for (let episode_file of episode_files) {
				try {
					let episode = episodes.lookup(episode_file.episode_id);
					let season = seasons.lookup(episode.season_id);
					let show = shows.lookup(season.show_id);
					show_files.insert({
						show_id: show.show_id,
						file_id: image_file.file_id
					});
				} catch (error) {}
			}
		}
	}
}

function associateSubtitles(): void {
	for (let subtitle_file of subtitle_files) {
		let file = files.lookup(subtitle_file.file_id);
		let basename = file.name.split(".")[0];
		let siblings = getSiblingFiles(file)
			.filter((file) => file.name.split(".")[0] === basename);
		for (let sibling of siblings) {
			video_subtitles.insert({
				video_file_id: sibling.file_id,
				subtitle_file_id: file.file_id
			});
		}
	}
}

export function runIndexer(): void {
	console.log(`Running indexer...`);
	for (let directory of getDirectoriesFromDirectory.lookup(undefined)) {
		checkDirectory(directory);
	}
	for (let file of getFilesFromDirectory.lookup(undefined)) {
		checkFile(file);
	}
	visitDirectory(config.media_path);
	indexFiles();
	associateMetadata();
	associateImages();
	associateSubtitles();
	for (let token of tokens) {
		if (token.expires_ms <= Date.now()) {
			tokens.remove(token);
		}
	}
	console.log(`Indexing finished.`);
	if (global.gc) {
		global.gc();
		let mbs = process.memoryUsage().heapUsed / 1024 / 1024;
		console.log(`Memory usage: ${mbs.toFixed()} MB`);
	}
};

runIndexer();
