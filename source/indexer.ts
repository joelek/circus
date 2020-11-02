import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as ffprobe from "./ffprobe";
import * as indices from "./indices";
import * as is from "./is";
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
			let directory_id = makeId(parent_directory_id, name);
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
			let file_id = makeId(parent_directory_id, name);
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

async function runProcess<A>(name: string, options: Array<string>, guard: autoguard.serialization.MessageGuard<A>): Promise<A> {
	return new Promise((resolve, reject) => {
		let cp = libcp.spawn(name, options);
		let chunks = new Array<Buffer>();
		cp.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		cp.on("exit", () => {
			let string = Buffer.concat(chunks).toString();
			let json = JSON.parse(string);
			resolve(guard.as(json));
		});
	});
}

async function getFormatResult(path: Array<string>): Promise<ffprobe.FormatResult> {
	return runProcess("ffprobe", [
		"-hide_banner",
		"-i", path.join("/"),
		"-show_format",
		"-of", "json"
	], ffprobe.FormatResult);
}

async function getStreamsResult(path: Array<string>): Promise<ffprobe.StreamsResult> {
	return runProcess("ffprobe", [
		"-hide_banner",
		"-i", path.join("/"),
		"-show_streams",
		"-of", "json"
	], ffprobe.StreamsResult);
}

function getMime(format: ffprobe.Format, stream: ffprobe.Stream): string {
	if (format.format_name.split(",").includes("mp4")) {
		if (stream.codec_type === "video") {
			return "video/mp4";
		} else if (stream.codec_type === "audio") {
			return "audio/mp4";
		}
	} else if (format.format_name === "image2") {
		if (stream.codec_name === "mjpeg") {
			return "image/jpeg";
		}
	} else if (format.format_name === "webvtt") {
		return "text/vtt";
	}
	return "application/octet-stream";
}

async function indexFile(file: File): Promise<void> {
	let path = getFilePath(file);
	let file_id = file.file_id;
	try {
		if (file.name.endsWith(".json")) {
			JSON.parse(libfs.readFileSync(path.join("/"), "utf-8"));
			file.mime = "application/json";
		} else {
			let format_result = await getFormatResult(path);
			let format = format_result.format;
			let streams_result = await getStreamsResult(path);
			let streams = streams_result.streams;
			for (let [index, stream] of streams.entries()) {
				let stream_id = makeId(file.file_id, `${index}`);
				if (ffprobe.AudioStream.is(stream)) {
					audio_streams.insert({
						audio_stream_id: stream_id,
						file_id: file_id,
						stream_index: index,
						duration_ms: Math.round(Number.parseFloat(stream.duration) * 1000)
					});
					if (file.mime === "application/octet-stream") {
						file.mime = getMime(format, stream);
					}
				} else if (ffprobe.ImageStream.is(stream)) {
					image_streams.insert({
						image_stream_id: stream_id,
						file_id: file_id,
						stream_index: index,
						width: stream.width,
						height: stream.height
					});
					if (file.mime === "application/octet-stream") {
						file.mime = getMime(format, stream);
					}
				} else if (ffprobe.SubtitleStream.is(stream)) {
					subtitle_streams.insert({
						subtitle_stream_id: stream_id,
						file_id: file_id,
						stream_index: index
					});
					if (file.mime === "application/octet-stream") {
						file.mime = getMime(format, stream);
					}
				} else if (ffprobe.VideoStream.is(stream)) {
					video_streams.insert({
						video_stream_id: stream_id,
						file_id: file_id,
						stream_index: index,
						width: stream.width,
						height: stream.height,
						duration_ms: Math.round(Number.parseFloat(stream.duration) * 1000)
					});
					if (file.mime === "application/octet-stream") {
						file.mime = getMime(format, stream);
					}
				}
			}
			let title = format.tags?.title;
			let year = asInteger(format.tags?.date);
			let comment = format.tags?.comment;
			let show_name = format.tags?.show;
			let episode_title = format.tags?.episode_id;
			let episode_number = asInteger(format.tags?.episode_sort);
			let season_number = asInteger(format.tags?.season_number);
			let track_number = asInteger(format.tags?.track);
			let track_artist_names = format.tags?.artist?.split(";").map((artist) => artist.trim()) ?? [];
			let album_artist_names = format.tags?.album_artist?.split(";").map((artist) => artist.trim()) ?? [];
			let album_title = format.tags?.album;
			let disc_number = asInteger(format.tags?.disc);
			if (is.present(show_name)) {
				let show_id = makeId(show_name);
				shows.insert({
					show_id: show_id,
					name: show_name,
					summary: undefined
				});
				if (is.present(season_number)) {
					let season_id = makeId(show_id, `${season_number}`);
					seasons.insert({
						season_id: season_id,
						show_id: show_id,
						number: season_number
					});
					if (is.present(episode_title) && is.present(episode_number)) {
						let episode_id = makeId(season_id, `${episode_number}`);
						episodes.insert({
							episode_id: episode_id,
							season_id: season_id,
							title: episode_title,
							number: episode_number,
							year: year,
							summary: comment
						});
						episode_files.insert({
							episode_id: episode_id,
							file_id: file_id
						});
					}
				}
			}
			if (is.present(album_title)) {
				let album_id = makeId(album_title);
				albums.insert({
					album_id: album_id,
					title: album_title,
					year: year
				});
				for (let [index, album_artist_name] of album_artist_names.entries()) {
					let artist_id = makeId(album_artist_name);
					artists.insert({
						artist_id: artist_id,
						name: album_artist_name
					});
					album_artists.insert({
						album_id: album_id,
						artist_id: artist_id,
						order: index
					});
				}
				if (is.present(disc_number)) {
					let disc_id = makeId(album_id, `${disc_number}`);
					discs.insert({
						disc_id: disc_id,
						album_id: album_id,
						number: disc_number
					});
					if (is.present(title) && is.present(track_number)) {
						let track_id = makeId(disc_id, `${track_number}`);
						tracks.insert({
							track_id: track_id,
							disc_id: disc_id,
							title: title,
							number: track_number
						});
						track_files.insert({
							track_id: track_id,
							file_id: file_id
						});
						for (let [index, track_artist_name] of track_artist_names.entries()) {
							let artist_id = makeId(track_artist_name);
							artists.insert({
								artist_id: artist_id,
								name: track_artist_name
							});
							track_artists.insert({
								track_id: track_id,
								artist_id: artist_id,
								order: index
							});
						}
					}
				}
			}
		}
	} catch (error) {
		console.log(`Indexing failed for "${path.join("/")}"!`);
	}
	let stats = libfs.statSync(path.join("/"));
	file.index_timestamp = stats.mtime.valueOf();
}

async function indexFiles(): Promise<void> {
	for (let file of files) {
		if (is.absent(file.index_timestamp)) {
			await indexFile(file);
		}
	}
}

indexFiles().then(() => {
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
});
