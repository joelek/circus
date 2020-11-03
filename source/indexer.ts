import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as indices from "./indices";
import * as is from "./is";
import * as probes from "./probes";
import * as databases from "./databases";
import { Directory, File } from "./databases/media";

function asInteger(string?: string): number | undefined {
	if (is.present(string)) {
		let number = Number.parseInt(string);
		if (Number.isInteger(number)) {
			return number;
		}
	}
}

function wordify(string: string): Array<string> {
	return string
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\|\/\\\_\-]/g, " ")
		.replace(/[^a-z0-9 ]/g, "")
		.trim()
		.split(/[ ]+/g);
}

function makeId(...components: Array<string | undefined>): string {
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

function loadIndex<A>(name: string, guard: autoguard.serialization.MessageGuard<A>, getKey: (record: A) => string): indices.RecordIndex<A> {
	let path = [
		...TABLES_ROOT,
		`${name}.json`
	].join("/");
	if (!libfs.existsSync(path)) {
		libfs.writeFileSync(path, JSON.stringify([], null, "\t"));
	}
	let json = JSON.parse(libfs.readFileSync(path, "utf-8"));
	let records = autoguard.guards.Array.of(guard).as(json);
	return indices.RecordIndex.from(records, getKey);
}

function saveIndex<A>(name: string, index: indices.RecordIndex<A>): void {
	let records = Array.from(index);
	let path = [
		...TABLES_ROOT,
		`${name}.json`
	].join("/");
	libfs.writeFileSync(path, JSON.stringify(records, null, "\t"));
}

const directories = loadIndex("directories", databases.media.Directory, (record) => record.directory_id);
const getDirectoryDirectories = indices.CollectionIndex.fromIndex(directories, directories, (record) => record.directory_id, (record) => record.parent_directory_id);
const files = loadIndex("files", databases.media.File, (record) => record.file_id);
const getDirectoryFiles = indices.CollectionIndex.fromIndex(directories, files, (record) => record.directory_id, (record) => record.parent_directory_id);
const audio_streams = loadIndex("audio_streams", databases.media.AudioStream, (record) => record.audio_stream_id);
const getFileAudioStreams = indices.CollectionIndex.fromIndex(files, audio_streams, (record) => record.file_id, (record) => record.file_id);
const image_streams = loadIndex("image_streams", databases.media.ImageStream, (record) => record.image_stream_id);
const getFileImageStreams = indices.CollectionIndex.fromIndex(files, image_streams, (record) => record.file_id, (record) => record.file_id);
const subtitle_streams = loadIndex("subtitle_streams", databases.media.SubtitleStream, (record) => record.subtitle_stream_id);
const getFileSubtitleStreams = indices.CollectionIndex.fromIndex(files, subtitle_streams, (record) => record.file_id, (record) => record.file_id);
const video_streams = loadIndex("video_streams", databases.media.VideoStream, (record) => record.video_stream_id);
const getFileVideoStreams = indices.CollectionIndex.fromIndex(files, video_streams, (record) => record.file_id, (record) => record.file_id);
const artists = loadIndex("artists", databases.media.Artist, (record) => record.artist_id);
const albums = loadIndex("albums", databases.media.Album, (record) => record.album_id);
const album_files = loadIndex("album_files", databases.media.AlbumFile, (record) => [record.album_id, record.file_id].join("\0"));
const getAlbumFiles = indices.CollectionIndex.fromIndex(files, album_files, (record) => record.file_id, (record) => record.file_id);
const discs = loadIndex("discs", databases.media.Disc, (record) => record.disc_id);
const getAlbumDiscs = indices.CollectionIndex.fromIndex(albums, discs, (record) => record.album_id, (record) => record.album_id);
const tracks = loadIndex("tracks", databases.media.Track, (record) => record.track_id);
const getDiscTracks = indices.CollectionIndex.fromIndex(discs, tracks, (record) => record.disc_id, (record) => record.disc_id);
const track_files = loadIndex("track_files", databases.media.TrackFile, (record) => [record.track_id, record.file_id].join("\0"));
const getTrackFiles = indices.CollectionIndex.fromIndex(files, track_files, (record) => record.file_id, (record) => record.file_id);
const album_artists = loadIndex("album_artists", databases.media.AlbumArtist, (record) => [record.album_id, record.artist_id].join("\0"));
const track_artists = loadIndex("track_artists", databases.media.TrackArtist, (record) => [record.track_id, record.artist_id].join("\0"));
const shows = loadIndex("shows", databases.media.Show, (record) => record.show_id);
const show_files = loadIndex("show_files", databases.media.ShowFile, (record) => [record.show_id, record.file_id].join("\0"));
const getShowFiles = indices.CollectionIndex.fromIndex(files, show_files, (record) => record.file_id, (record) => record.file_id);
const seasons = loadIndex("seasons", databases.media.Season, (record) => record.season_id);
const getShowSeasons = indices.CollectionIndex.fromIndex(shows, seasons, (record) => record.show_id, (record) => record.show_id);
const episodes = loadIndex("episodes", databases.media.Episode, (record) => record.episode_id);
const getSeasonEpisodes = indices.CollectionIndex.fromIndex(seasons, episodes, (record) => record.season_id, (record) => record.season_id);
const episode_files = loadIndex("episode_files", databases.media.EpisodeFile, (record) => [record.episode_id, record.file_id].join("\0"));
const getEpisodeFiles = indices.CollectionIndex.fromIndex(files, episode_files, (record) => record.file_id, (record) => record.file_id);
const movies = loadIndex("movies", databases.media.Movie, (record) => record.movie_id);
const movie_files = loadIndex("movie_files", databases.media.MovieFile, (record) => [record.movie_id, record.file_id].join("\0"));
const getMovieFiles = indices.CollectionIndex.fromIndex(files, movie_files, (record) => record.file_id, (record) => record.file_id);

function getPath(entry: Directory | File): Array<string> {
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
}

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
			for (let directory of getDirectoryDirectories.lookup(root.directory_id)) {
				checkDirectory(directory);
			}
			for (let file of getDirectoryFiles.lookup(root.directory_id)) {
				checkFile(file);
			}
			return;
		}
	}
	directories.remove(root);
}

for (let directory of getDirectoryDirectories.lookup(undefined)) {
	checkDirectory(directory);
}

for (let file of getDirectoryFiles.lookup(undefined)) {
	checkFile(file);
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
				let mime = "application/octet-stream";
				files.insert({
					file_id,
					name,
					mime,
					parent_directory_id
				});
			}
		}
	}
}

visitDirectory(MEDIA_ROOT);

function indexMetadata(file_id: string, probe: probes.schema.Probe): void {
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
		episode_files.insert({
			episode_id: episode_id,
			file_id: file_id
		});
	} else if (probes.schema.MovieMetadata.is(metadata)) {
		let movie_id = makeId("movie", metadata.title);
		movies.insert({
			movie_id: movie_id,
			title: metadata.title,
			year: metadata.year,
			summary: metadata.summary
		});
		movie_files.insert({
			movie_id: movie_id,
			file_id: file_id
		});
	} else if (probes.schema.TrackMetadata.is(metadata)) {
		let album_id = makeId("album", metadata.album.title);
		albums.insert({
			album_id: album_id,
			title: metadata.album.title,
			year: metadata.album.year
		});
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
		track_files.insert({
			track_id: track_id,
			file_id: file_id
		});
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
			streams: []
		};
		if (file.name.endsWith(".vtt")) {
			probe = probes.vtt.probe(fd);
			file.mime = "text/vtt";
		} else if (file.name.endsWith(".json")) {
			probe = probes.json.probe(fd);
			file.mime = "application/json";
		} else if (file.name.endsWith(".mp4")) {
			probe = probes.mp4.probe(fd);
			if (probe.streams.find((stream) => stream.type === "video")) {
				file.mime = "video/mp4";
			} else if (probe.streams.find((stream) => stream.type === "audio")) {
				file.mime = "audio/mp4";
			}
		} else if (file.name.endsWith(".jpg") || file.name.endsWith(".jpeg")) {
			probe = probes.jpeg.probe(fd);
			file.mime = "image/jpeg";
		}
		for (let [index, stream] of probe.streams.entries()) {
			let stream_id = makeId("stream", file.file_id, `${index}`);
			if (stream.type === "audio") {
				audio_streams.insert({
					audio_stream_id: stream_id,
					file_id: file_id,
					stream_index: index,
					duration_ms: stream.duration_ms
				});
			} else if (stream.type === "image") {
				image_streams.insert({
					image_stream_id: stream_id,
					file_id: file_id,
					stream_index: index,
					width: stream.width,
					height: stream.height
				});
			} else if (stream.type === "subtitle") {
				subtitle_streams.insert({
					subtitle_stream_id: stream_id,
					file_id: file_id,
					stream_index: index,
					duration_ms: stream.duration_ms
				});
			} else if (stream.type === "video") {
				video_streams.insert({
					video_stream_id: stream_id,
					file_id: file_id,
					stream_index: index,
					width: stream.width,
					height: stream.height,
					duration_ms: stream.duration_ms
				});
			}
		}
		indexMetadata(file_id, probe);
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

indexFiles();

saveIndex("files", files);
saveIndex("directories", directories);
saveIndex("audio_streams", audio_streams);
saveIndex("image_streams", image_streams);
saveIndex("subtitle_streams", subtitle_streams);
saveIndex("video_streams", video_streams);
saveIndex("artists", artists);
saveIndex("albums", albums);
saveIndex("album_files", album_files);
saveIndex("discs", discs);
saveIndex("tracks", tracks);
saveIndex("track_files", track_files);
saveIndex("album_artists", album_artists);
saveIndex("track_artists", track_artists);
saveIndex("shows", shows);
saveIndex("show_files", show_files);
saveIndex("seasons", seasons);
saveIndex("episodes", episodes);
saveIndex("episode_files", episode_files);
saveIndex("movies", movies);
saveIndex("movie_files", movie_files);
