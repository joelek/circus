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
		.slice(0, 32);
}

const MEDIA_ROOT = [
	".",
	"private",
	"media"
];

if (!libfs.existsSync(MEDIA_ROOT.join("/"))) {
	libfs.mkdirSync(MEDIA_ROOT.join("/"));
}

const TABLES_ROOT = [
	".",
	"private",
	"tables"
];

if (!libfs.existsSync(TABLES_ROOT.join("/"))) {
	libfs.mkdirSync(TABLES_ROOT.join("/"));
}

function loadIndex<A>(name: string, guard: autoguard.serialization.MessageGuard<A>, getKey: (record: A) => string): jdb.Table<A> {
	return new jdb.Table<A>(TABLES_ROOT, name, guard, getKey);
}

export const directories = loadIndex("directories", schema.Directory, (record) => record.directory_id);
export const getDirectoriesFromDirectory = indices.CollectionIndex.fromTable(directories, directories, (record) => record.parent_directory_id);
export const files = loadIndex("files", schema.File, (record) => record.file_id);
export const getFilesFromDirectory = indices.CollectionIndex.fromTable(directories, files, (record) => record.parent_directory_id);
export const audio_files = loadIndex("audio_files", schema.AudioFile, (record) => record.file_id);
export const getAudioFiles = indices.CollectionIndex.fromTable(files, audio_files, (record) => record.file_id);
export const image_files = loadIndex("image_files", schema.ImageFile, (record) => record.file_id);
export const getImageFilesFromFile = indices.CollectionIndex.fromTable(files, image_files, (record) => record.file_id);
export const metadata_files = loadIndex("metadata_files", schema.MetadataFile, (record) => record.file_id);
export const getMetadataFilesFromFile = indices.CollectionIndex.fromTable(files, metadata_files, (record) => record.file_id);
export const subtitle_files = loadIndex("subtitle_files", schema.SubtitleFile, (record) => record.file_id);
export const getSubtitleFilesFromFile = indices.CollectionIndex.fromTable(files, subtitle_files, (record) => record.file_id);
export const video_files = loadIndex("video_files", schema.VideoFile, (record) => record.file_id);
export const getVideoFilesFromFile = indices.CollectionIndex.fromTable(files, video_files, (record) => record.file_id);
export const video_subtitles = loadIndex("video_subtitles", schema.VideoSubtitle, (record) => [record.video_file_id, record.subtitle_file_id].join("\0"));
export const getSubtitleFilesFromVideoFile = indices.CollectionIndex.fromTable(video_files, video_subtitles, (record) => record.video_file_id);
export const getVideoFilesFromSubtitleFile = indices.CollectionIndex.fromTable(subtitle_files, video_subtitles, (record) => record.subtitle_file_id);
export const artists = loadIndex("artists", schema.Artist, (record) => record.artist_id);
export const albums = loadIndex("albums", schema.Album, (record) => record.album_id);
export const album_files = loadIndex("album_files", schema.AlbumFile, (record) => [record.album_id, record.file_id].join("\0"));
export const getAlbumsFromFile = indices.CollectionIndex.fromTable(files, album_files, (record) => record.file_id);
export const getFilesFromAlbum = indices.CollectionIndex.fromTable(albums, album_files, (record) => record.album_id);
export const discs = loadIndex("discs", schema.Disc, (record) => record.disc_id);
export const getDiscsFromAlbum = indices.CollectionIndex.fromTable(albums, discs, (record) => record.album_id);
export const tracks = loadIndex("tracks", schema.Track, (record) => record.track_id);
export const getTracksFromDisc = indices.CollectionIndex.fromTable(discs, tracks, (record) => record.disc_id);
export const track_files = loadIndex("track_files", schema.TrackFile, (record) => [record.track_id, record.file_id].join("\0"));
export const getTracksFromFile = indices.CollectionIndex.fromTable(files, track_files, (record) => record.file_id);
export const getFilesFromTrack = indices.CollectionIndex.fromTable(tracks, track_files, (record) => record.track_id);
export const album_artists = loadIndex("album_artists", schema.AlbumArtist, (record) => [record.album_id, record.artist_id].join("\0"));
export const getArtistsFromAlbum = indices.CollectionIndex.fromTable(albums, album_artists, (record) => record.album_id);
export const getAlbumsFromArtist = indices.CollectionIndex.fromTable(artists, album_artists, (record) => record.artist_id);
export const track_artists = loadIndex("track_artists", schema.TrackArtist, (record) => [record.track_id, record.artist_id].join("\0"));
export const getArtistsFromTrack = indices.CollectionIndex.fromTable(tracks, track_artists, (record) => record.track_id);
export const getTracksFromArtist = indices.CollectionIndex.fromTable(artists, track_artists, (record) => record.artist_id);
export const shows = loadIndex("shows", schema.Show, (record) => record.show_id);
export const show_files = loadIndex("show_files", schema.ShowFile, (record) => [record.show_id, record.file_id].join("\0"));
export const getShowsFromFile = indices.CollectionIndex.fromTable(files, show_files, (record) => record.file_id);
export const getFilesFromShow = indices.CollectionIndex.fromTable(shows, show_files, (record) => record.show_id);
export const seasons = loadIndex("seasons", schema.Season, (record) => record.season_id);
export const getSeasonsFromShow = indices.CollectionIndex.fromTable(shows, seasons, (record) => record.show_id);
export const episodes = loadIndex("episodes", schema.Episode, (record) => record.episode_id);
export const getEpisodesFromSeason = indices.CollectionIndex.fromTable(seasons, episodes, (record) => record.season_id);
export const episode_files = loadIndex("episode_files", schema.EpisodeFile, (record) => [record.episode_id, record.file_id].join("\0"));
export const getEpisodesFromFile = indices.CollectionIndex.fromTable(files, episode_files, (record) => record.file_id);
export const getFilesFromEpisode = indices.CollectionIndex.fromTable(episodes, episode_files, (record) => record.episode_id);
export const movies = loadIndex("movies", schema.Movie, (record) => record.movie_id);
export const movie_files = loadIndex("movie_files", schema.MovieFile, (record) => [record.movie_id, record.file_id].join("\0"));
export const getMoviesFromFile = indices.CollectionIndex.fromTable(files, movie_files, (record) => record.file_id);
export const getFilesFromMovie = indices.CollectionIndex.fromTable(movies, movie_files, (record) => record.movie_id);
export const persons = loadIndex("persons", schema.Person, (record) => record.person_id);
export const movie_persons = loadIndex("movie_persons", schema.MoviePerson, (record) => [record.movie_id, record.person_id].join("\0"));
export const getMoviesFromPerson = indices.CollectionIndex.fromTable(persons, movie_persons, (record) => record.person_id);
export const getPersonsFromMovie = indices.CollectionIndex.fromTable(movies, movie_persons, (record) => record.movie_id);
export const show_persons = loadIndex("show_persons", schema.ShowPerson, (record) => [record.show_id, record.person_id].join("\0"));
export const getShowsFromPerson = indices.CollectionIndex.fromTable(persons, show_persons, (record) => record.person_id);
export const getPersonsFromShow = indices.CollectionIndex.fromTable(shows, show_persons, (record) => record.show_id);
export const genres = loadIndex("genres", schema.Genre, (record) => record.genre_id);
export const movie_genres = loadIndex("movie_genres", schema.MovieGenre, (record) => [record.movie_id, record.genre_id].join("\0"));
export const getMoviesFromGenre = indices.CollectionIndex.fromTable(genres, movie_genres, (record) => record.genre_id);
export const getGenresFromMovie = indices.CollectionIndex.fromTable(movies, movie_genres, (record) => record.movie_id);
export const show_genres = loadIndex("show_genres", schema.ShowGenre, (record) => [record.show_id, record.genre_id].join("\0"));
export const getShowsFromGenre = indices.CollectionIndex.fromTable(genres, show_genres, (record) => record.genre_id);
export const getGenresFromShow = indices.CollectionIndex.fromTable(shows, show_genres, (record) => record.show_id);
export const subtitles = loadIndex("subtitles", schema.Subtitle, (record) => record.subtitle_id);
export const cues = loadIndex("cues", schema.Cue, (record) => record.cue_id);
export const getCuesFromSubtitle = indices.CollectionIndex.fromTable(subtitles, cues, (record) => record.subtitle_id);
export const users = loadIndex("users", schema.User, (record) => record.user_id);
export const getUsersFromUsername = indices.CollectionIndex.fromTable(users, users, (record) => record.username);
export const keys = loadIndex("keys", schema.Key, (record) => record.key_id);
export const getKeysFromUser = indices.CollectionIndex.fromTable(users, keys, (record) => record.user_id);
export const tokens = loadIndex("tokens", schema.Token, (record) => record.token_id);
export const getTokensFromUser = indices.CollectionIndex.fromTable(users, tokens, (record) => record.user_id);
export const streams = loadIndex("streams", schema.Stream, (record) => record.stream_id);
export const getStreamsFromUser = indices.CollectionIndex.fromTable(users, streams, (record) => record.user_id);
export const getStreamsFromFile = indices.CollectionIndex.fromTable(files, streams, (record) => record.file_id);
export const playlists = loadIndex("playlists", schema.Playlist, (record) => record.playlist_id);
export const getPlaylistsFromUser = indices.CollectionIndex.fromTable(users, playlists, (record) => record.user_id);
export const playlist_items = loadIndex("playlist_items", schema.PlaylistItem, (record) => record.playlist_item_id);
export const getPlaylistsItemsFromPlaylist = indices.CollectionIndex.fromTable(playlists, playlist_items, (record) => record.playlist_id);
export const getPlaylistItemsFromTrack = indices.CollectionIndex.fromTable(tracks, playlist_items, (record) => record.track_id);
export const years = loadIndex("years", schema.Year, (record) => record.year_id);
export const getMoviesFromYear = indices.CollectionIndex.fromTable(years, movies, (record) => record.year?.toString());
export const getAlbumsFromYear = indices.CollectionIndex.fromTable(years, albums, (record) => record.year?.toString());

if (users.length() === 0) {
	if (keys.length() === 0) {
		keys.insert({
			key_id: makeId("key", libcrypto.randomBytes(16).toString("hex"))
		});
	}
}

export const album_search = indices.SearchIndex.fromTable(albums, (entry) => [entry.title, entry.year?.toString()].filter(is.present));
export const artist_search = indices.SearchIndex.fromTable(artists, (entry) => [entry.name]);
export const cue_search = indices.SearchIndex.fromTable(cues, (entry) => entry.lines.split("\n"));
export const episode_search = indices.SearchIndex.fromTable(episodes, (entry) => [entry.title, entry.year?.toString()].filter(is.present));
export const genre_search = indices.SearchIndex.fromTable(genres, (entry) => [entry.name]);
export const movie_search = indices.SearchIndex.fromTable(movies, (entry) => [entry.title, entry.year?.toString()].filter(is.present));
export const person_search = indices.SearchIndex.fromTable(persons, (entry) => [entry.name]);
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
	return [...MEDIA_ROOT, ...path];
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
			let person_id = makeId("person", actor);
			persons.insert({
				person_id: person_id,
				name: actor
			});
			show_persons.insert({
				person_id: person_id,
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
			let person_id = makeId("person", actor);
			persons.insert({
				person_id: person_id,
				name: actor
			});
			movie_persons.insert({
				person_id: person_id,
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
	visitDirectory(MEDIA_ROOT);
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
};

runIndexer();
