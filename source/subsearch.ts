import * as libfs from "fs";
import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as indexer from "./indexer";
import * as is from "./is";
import * as utils from "./utils";
import * as keyframes from "./keyframes";
import * as dbschema from "./databases/media"

function getMediaFile(subtitle: dbschema.Subtitle): dbschema.File {
	let video_files = indexer.getVideoFilesFromSubtitleFile.lookup(subtitle.file_id);
	return indexer.files.lookup(video_files[0].video_file_id);
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

function generateStill(target: string[], file: dbschema.File): Promise<void> {
	return new Promise(async (resolve, reject) => {
		let path = indexer.getPath(file);
		let offsets = await keyframes.getKeyframeOffsets(path, 0);
		let offset = offsets[Math.floor(offsets.length / 2)];
		createWorkingDirectory((wd, id) => {
			let still = [...wd, "still.jpeg"];
			let cp = libcp.spawn("ffmpeg", [
				"-ss", utils.formatTimestamp(offset),
				"-i", path.join("/"),
				"-q:v", "1",
				"-frames:v", "1",
				"-f", "singlejpeg",
				"-fflags", "+bitexact",
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

function generateMeme(target: string[], cue: dbschema.Cue, cb: { (): void }): void {
	let subtitle = indexer.subtitles.lookup(cue.subtitle_id);
	let file_subtitle = indexer.files.lookup(subtitle.file_id);
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
				"-i", indexer.getPath(file_subtitle).join("/"),
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
					"-i", indexer.getPath(file_media).join("/"),
					"-vf", "fps=15,scale=w=384:h=216:force_original_aspect_ratio=decrease,pad=384:216:-1:-1,subtitles=" + subtitle.join("/") + ":force_style='Bold=1,Fontsize=24,Outline=2',palettegen",
					palette.join("/"),
					"-y"
				]);
				cp.on("exit", () => {
					let cp = libcp.spawn("ffmpeg", [
						"-ss", utils.formatTimestamp(cue.start_ms),
						"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 5000)),
						"-i", indexer.getPath(file_media).join("/"),
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

const queue: {
	target: string[],
	file: dbschema.File
}[] = [];

async function processQueue(): Promise<void> {
	let job = queue.pop();
	if (is.absent(job)) {
		return;
	}
	await generateStill(job.target, job.file);
	setTimeout(processQueue, 10 * 1000);
}

for (let episode of indexer.video_files) {
	let target = [".", "private", "stills", episode.file_id];
	if (!libfs.existsSync(target.join("/"))) {
		let file = indexer.files.lookup(episode.file_id);
		queue.push({ target, file });
	}
}
setTimeout(processQueue);

export {
	generateStill,
	generateMeme
};
