import * as libcp from "child_process";
import * as libffprobe from "./ffprobe";

export type Segment = {
	offset_ms: number,
	duration_ms: number
};

export function makeSegments(offsets_ms: Array<number>): Array<Segment> {
	let segments = new Array<Segment>();
	for (let i = 0; i + 1 < offsets_ms.length; i++) {
		segments.push({
			offset_ms: offsets_ms[i],
			duration_ms: offsets_ms[i + 1] - offsets_ms[i]
		});
	}
	return segments;
}

export function combineOffsets(offsets_ms: Array<number>, target_duration_ms: number): Array<number> {
	let last_offset_ms = 0 - Infinity;
	let combined_offsets_ms = new Array<number>();
	for (let i = 1; i < offsets_ms.length; i++) {
		if (offsets_ms[i] - last_offset_ms > target_duration_ms) {
			last_offset_ms = offsets_ms[i - 1];
			combined_offsets_ms.push(last_offset_ms);
		}
	}
	return combined_offsets_ms;
}

export async function getStreams(paths: Array<string>): Promise<Array<Segment>> {
	return new Promise((resolve, reject) => {
		let ffprobe = libcp.spawn("ffprobe", [
			"-hide_banner",
			"-i", paths.join("/"),
			"-show_streams",
			"-show_entries", "stream=start_time,duration",
			"-of", "json"
		]);
		let chunks = new Array<Buffer>();
		ffprobe.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		ffprobe.on("exit", () => {
			let string = Buffer.concat(chunks).toString();
			let json = libffprobe.StreamsResult.as(JSON.parse(string));
			let streams = json.streams.filter((stream): stream is libffprobe.VideoStream => libffprobe.VideoStream.is(stream)).map((stream) => {
				let offset_ms = Math.round(Number.parseFloat(stream.start_time) * 1000);
				let duration_ms = Math.round(Number.parseFloat(stream.duration) * 1000);
				return {
					offset_ms,
					duration_ms
				};
			});
			resolve(streams);
		})
	});
}

export async function getKeyframeOffsets(paths: Array<string>, streamIndex: number): Promise<Array<number>> {
	return new Promise((resolve, reject) => {
		let ffprobe = libcp.spawn("ffprobe", [
			"-hide_banner",
			"-i", paths.join("/"),
			"-select_streams", `${streamIndex}`,
			"-skip_frame", "nokey",
			"-show_frames",
			"-show_entries", "frame=pkt_pts_time",
			"-of", "json"
		]);
		let chunks = new Array<Buffer>();
		ffprobe.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		ffprobe.on("error", (error) => {
			reject(error);
		});
		ffprobe.on("exit", () => {
			let string = Buffer.concat(chunks).toString();
			try {
				let json = libffprobe.FramesResult.as(JSON.parse(string));
				let frames = json.frames.map((frame) => {
					return Math.round(Number.parseFloat(frame.pkt_pts_time) * 1000);
				});
				resolve(frames);
			} catch (error) {
				//console.log(`Keyframes failed for ${paths.join("/")}!`);
				reject(error);
			}
		})
	});
}

export async function getKeyframeSegments(paths: Array<string>, streamIndex: number, targetDurationMs: number): Promise<Array<Segment>> {
	let streams = await getStreams(paths);
	let keyframeOffsets = await getKeyframeOffsets(paths, streamIndex);
	let stream = streams[streamIndex];
	let combinedOffsets = combineOffsets([ ...keyframeOffsets, stream.duration_ms ], targetDurationMs);
	let segments = makeSegments([ ...combinedOffsets, stream.duration_ms ]);
	return segments;
}
