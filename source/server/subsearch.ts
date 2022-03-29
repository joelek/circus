import * as libfs from "fs";
import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as indexer from "../database/indexer";
import * as is from "../is";
import * as utils from "../utils";
import * as keyframes from "./keyframes";
import * as dbschema from "../database/atlas"

function createWorkingDirectory(cb: { (wd: string[], id: string): void }): void {
	let id = libcrypto.randomBytes(8).toString("hex");
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

async function generateStill(target: string[], source: string[]): Promise<void> {
	let offsets = await keyframes.getKeyframeOffsets(source, 0);
	let offset = offsets[Math.floor(offsets.length / 2)];
	return new Promise( (resolve, reject) => {
		createWorkingDirectory((wd, id) => {
			let still = [...wd, "still.jpeg"];
			let cp = libcp.spawn("ffmpeg", [
				"-ss", utils.formatTimestamp(offset),
				"-i", source.join("/"),
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

function generateMeme(target: string[], video_path: string[], subtitle_path: string[], cue: dbschema.Cue, cb: { (): void }): void {
	createWorkingDirectory((wd, id) => {
		let subtitle = [...wd, "subtitle.vtt"];
		let palette = [...wd, "palette.png"];
		let meme = [...wd, "meme.gif"];
		let cp = libcp.spawn("ffmpeg", [
			"-ss", utils.formatTimestamp(cue.start_ms),
			"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 5000)),
			"-i", subtitle_path.join("/"),
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
				"-i", video_path.join("/"),
				"-vf", "fps=15,scale=w=384:h=216:force_original_aspect_ratio=decrease,pad=384:216:-1:-1,subtitles=" + subtitle.join("/") + ":force_style='Bold=1,Fontsize=24,Outline=2',palettegen",
				palette.join("/"),
				"-y"
			]);
			cp.on("exit", () => {
				let cp = libcp.spawn("ffmpeg", [
					"-ss", utils.formatTimestamp(cue.start_ms),
					"-t", utils.formatTimestamp(Math.min(cue.duration_ms, 5000)),
					"-i", video_path.join("/"),
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

const stillsTranscodingQueue = [] as Array<{
	source: Array<string>;
	target: Array<string>;
}>;

async function processQueue(): Promise<void> {
	let job = stillsTranscodingQueue.pop();
	if (is.absent(job)) {
		return;
	}
	try {
		await generateStill(job.target, job.source);
	} catch (error) {}
	setTimeout(processQueue, 10 * 1000);
}

dbschema.transactionManager.enqueueReadableTransaction(async (queue) => {
	for (let video_file of await dbschema.stores.video_files.filter(queue)) {
		let target = [".", "private", "stills", utils.hexid(video_file.file_id)];
		if (!libfs.existsSync(target.join("/"))) {
			let file = await dbschema.stores.files.lookup(queue, video_file);
			let source = await indexer.getPath(queue, file);
			stillsTranscodingQueue.push({
				source,
				target
			});
		}
	}
	setTimeout(processQueue);
});

export {
	generateStill,
	generateMeme
};
