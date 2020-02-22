import * as libfs from "fs";
import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as data from "./data";
import * as database from "./database";
import * as utils from "./utils";

function getMediaFile(subtitle: database.SubtitleEntry): database.FileEntry | null {
	if (subtitle.episode_id !== null) {
		let episode = data.media.video.episodes.find((episode) => episode.episode_id === subtitle.episode_id) as database.EpisodeEntry;
		return data.media.files.find((file) => file.file_id === (episode as database.EpisodeEntry).file_id) as database.FileEntry;
	}
	if (subtitle.movie_id !== null) {
		let movie = data.media.video.movies.find((movie) => movie.movie_id === subtitle.movie_id) as database.MovieEntry;
		return data.media.files.find((file) => file.file_id === (movie as database.MovieEntry).file_id) as database.FileEntry;
	}
	return null
}

function createWorkingDirectory(cb: { (wd: string[], id: string): void }): void {
	let id = libcrypto.randomBytes(16).toString("hex");
	let wd = [".", "private", "jobs", id];
	libfs.mkdirSync(wd.join("/"), { recursive: true });
	return cb(wd, id);
}

function renameFile(source: string[], target: string[]): void {
	libfs.mkdirSync(target.slice(0, -1).join("/"), { recursive: true });
	libfs.renameSync(source.join("/"), target.join("/"));
}

function deleteTree(root: string): void {
	let stats = libfs.statSync(root);
	if (stats.isDirectory()) {
		let nodes = libfs.readdirSync(root).map((node) => {
			return root + "/" + node;
		});
		nodes.forEach(deleteTree);
		libfs.rmdirSync(root);
	} else if (stats.isFile()) {
		libfs.unlinkSync(root);
	}
}

function generateMeme(target: string[], cue: database.CueEntry, cb: { (): void }): void {
	let subtitle = data.media.video.subtitles.find((subtitle) => subtitle.subtitle_id === cue.subtitle_id) as database.SubtitleEntry;
	let file_subtitle = data.media.files.find((file) => file.file_id === subtitle.file_id) as database.FileEntry;
	const file_media = getMediaFile(subtitle);
	if (file_media == null) {
		return cb();
	} else {
		createWorkingDirectory((wd, id) => {
			let subtitle = [...wd, "subtitle.vtt"];
			let palette = [...wd, "palette.png"];
			let meme = [...wd, "meme.gif"];
			let cp = libcp.spawn("ffmpeg", [
				"-ss", utils.formatTimestamp(cue.start_ms),
				"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 2000)),
				"-i", [".", ...file_subtitle.path].join("/"),
				subtitle.join("/"),
				"-y"
			]);
			process.stdin.pipe(cp.stdin);
			cp.stdout.pipe(process.stdout);
			cp.stderr.pipe(process.stderr);
			cp.on("exit", () => {
				let cp = libcp.spawn("ffmpeg", [
					"-ss", utils.formatTimestamp(cue.start_ms),
					"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 2000)),
					"-i", [".", ...file_media.path].join("/"),
					"-vf", "fps=5,subtitles=" + subtitle.join("/") + ":force_style='Bold=1,Fontsize=32,Outline=2',scale=512:-1,palettegen",
					palette.join("/"),
					"-y"
				]);
				process.stdin.pipe(cp.stdin);
				cp.stdout.pipe(process.stdout);
				cp.stderr.pipe(process.stderr);
				cp.on("exit", () => {
					let cp = libcp.spawn("ffmpeg", [
						"-ss", utils.formatTimestamp(cue.start_ms),
						"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 2000)),
						"-i", [".", ...file_media.path].join("/"),
						"-i", palette.join("/"),
						"-filter_complex", "fps=5,subtitles=" + subtitle.join("/") + ":force_style='Bold=1,Fontsize=32,Outline=2',scale=512:-1[x];[x][1:v]paletteuse",
						"-map_metadata", "-1",
						meme.join("/"),
						"-y"
					]);
					process.stdin.pipe(cp.stdin);
					cp.stdout.pipe(process.stdout);
					cp.stderr.pipe(process.stderr);
					cp.on("exit", () => {
						renameFile(meme, target);
						deleteTree(wd.join("/"));
						return cb();
					});
				});
			});
		});
	}
}

export {
	generateMeme
};
