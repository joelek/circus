import * as libcp from "child_process";
import * as libffprobe from "./ffprobe";

export function getKeyframes(paths: Array<string>): Promise<Array<number>> {
	return new Promise((resolve, reject) => {
		let ffprobe = libcp.spawn("ffprobe", [
			"-i", paths.join("/"),
			"-skip_frame", "nokey",
			"-select_streams", "v",
			"-show_frames",
			"-show_entries", "frame=pkt_pts_time",
			"-hide_banner",
			"-of", "json"
		]);
		let chunks = new Array<Buffer>();
		ffprobe.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		ffprobe.on("exit", () => {
			let string = Buffer.concat(chunks).toString();
			let json = libffprobe.ShowFrames.as(JSON.parse(string));
			let frames = json.frames.map((frame) => {
				return Math.floor(Number.parseFloat(frame.pkt_pts_time) * 1000);
			});
			resolve(frames);
		})
	});
}
