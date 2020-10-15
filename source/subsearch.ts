import * as libfs from "fs";
import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as data from "./data";
import * as database from "./database";
import * as utils from "./utils";
import * as keyframes from "./keyframes";

function getMediaFile(subtitle: database.SubtitleEntry): database.FileEntry | null {
	return data.files_index[subtitle.video_file_id] || null;
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

function generateStill(target: string[], file: database.FileEntry): Promise<void> {
	return new Promise(async (resolve, reject) => {
		let offsets = await keyframes.getKeyframeOffsets([".", ...file.path], 0);
		let offset = offsets[Math.floor(offsets.length / 2)];
		createWorkingDirectory((wd, id) => {
			let still = [...wd, "still.jpeg"];
			let cp = libcp.spawn("ffmpeg", [
				"-ss", utils.formatTimestamp(offset),
				"-i", [".", ...file.path].join("/"),
				"-vf", "scale=w=960:h=540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1",
				"-map_metadata", "-1",
				still.join("/"),
				"-y"
			]);
			cp.on("error", () => {
				deleteTree(wd.join("/"));
				return reject();
			});
			cp.on("exit", () => {
				renameFile(still, target);
				deleteTree(wd.join("/"));
				return resolve();
			});
		});
	});
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
				"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 5000)),
				"-i", [".", ...file_subtitle.path].join("/"),
				subtitle.join("/"),
				"-y"
			]);
			cp.on("error", () => {
				console.log("ffmpeg command failed!");
				deleteTree(wd.join("/"));
				return cb();
			});
			cp.on("exit", () => {
				let cp = libcp.spawn("ffmpeg", [
					"-ss", utils.formatTimestamp(cue.start_ms),
					"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 5000)),
					"-i", [".", ...file_media.path].join("/"),
					"-vf", "fps=15,scale=w=384:h=216:force_original_aspect_ratio=decrease,pad=384:216:-1:-1,subtitles=" + subtitle.join("/") + ":force_style='Bold=1,Fontsize=24,Outline=2',palettegen",
					palette.join("/"),
					"-y"
				]);
				cp.on("exit", () => {
					let cp = libcp.spawn("ffmpeg", [
						"-ss", utils.formatTimestamp(cue.start_ms),
						"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 5000)),
						"-i", [".", ...file_media.path].join("/"),
						"-i", palette.join("/"),
						"-filter_complex", "fps=15,scale=w=384:h=216:force_original_aspect_ratio=decrease,pad=384:216:-1:-1,subtitles=" + subtitle.join("/") + ":force_style='Bold=1,Fontsize=24,Outline=2'[x];[x][1:v]paletteuse",
						"-map_metadata", "-1",
						meme.join("/"),
						"-y"
					]);
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
	generateStill,
	generateMeme
};
