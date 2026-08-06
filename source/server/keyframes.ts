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

export function combineOffsets(offsets_ms: Array<number>, target_duration_ms: number | undefined): Array<number> {
	if (target_duration_ms == null) {
		return offsets_ms;
	}
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

export async function getPackets(paths: Array<string>, stream_index: number): Promise<libffprobe.PacketsResult> {
	return new Promise((resolve, reject) => {
		let ffprobe = libcp.spawn("ffprobe", [
			"-hide_banner",
			"-i", paths.join("/"),
			"-select_streams", `${stream_index}`,
			"-show_packets",
			"-show_entries", "packet",
			"-of", "json",
			"-read_intervals", "%+#1"
		]);
		let chunks = new Array<Buffer>();
		ffprobe.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		ffprobe.on("exit", (code) => {
			if (code === 0) {
				let string = Buffer.concat(chunks).toString();
				let json = libffprobe.PacketsResult.as(JSON.parse(string));
				resolve(json);
			} else {
				reject(code);
			}
		});
	});
}

export async function getStartOffsetMs(paths: Array<string>): Promise<number> {
	let streams = await getStreams(paths);
	let offset_ms = Infinity;
	for (let stream_index = 0; stream_index < streams.length; stream_index += 1) {
		let result = await getPackets(paths, stream_index);
		let packets = result.packets;
		if (result.packets.length !== 1) {
			throw new Error(`Expected exactly one packet for stream ${stream_index}!`);
		}
		let packet = packets[0];
		offset_ms = Math.min(offset_ms, Number.parseFloat(packet.pts_time) * 1000, Number.parseFloat(packet.dts_time) * 1000);
	}
	return offset_ms;
};

export async function getStreams(paths: Array<string>): Promise<Array<Segment>> {
	return new Promise((resolve, reject) => {
		let ffprobe = libcp.spawn("ffprobe", [
			"-hide_banner",
			"-i", paths.join("/"),
			"-show_streams",
			"-show_entries", "stream",
			"-of", "json"
		]);
		let chunks = new Array<Buffer>();
		ffprobe.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		ffprobe.on("exit", () => {
			let string = Buffer.concat(chunks).toString();
			let json = libffprobe.StreamsResult.as(JSON.parse(string));
			let streams = json.streams.filter((stream): stream is libffprobe.VideoStream | libffprobe.AudioStream => libffprobe.VideoStream.is(stream) || libffprobe.AudioStream.is(stream)).map((stream) => {
				let offset_ms = Math.round(Number.parseFloat(stream.start_time) * 1000);
				let duration_ms = Math.round(Number.parseFloat(stream.duration) * 1000);
				return {
					offset_ms,
					duration_ms
				};
			});
			resolve(streams);
		});
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
			"-show_entries", "frame=pts_time",
			"-of", "json"
		]);
		let chunks = new Array<Buffer>();
		ffprobe.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		ffprobe.on("error", (error) => {
			reject(error);
		});
		ffprobe.on("exit", (code) => {
			if (code === 0) {
				let string = Buffer.concat(chunks).toString();
				try {
					let json = libffprobe.FramesResult.as(JSON.parse(string));
					let frames = json.frames.map((frame) => {
						return Math.round(Number.parseFloat(frame.pts_time) * 1000);
					});
					resolve(frames);
				} catch (error) {
				console.log(string);
					reject(error);
				}
			} else {
				reject(code);
			}
		});
	});
}

export async function getKeyframeSegments(paths: Array<string>, streamIndex: number, targetDurationMs: number | undefined): Promise<Array<Segment>> {
	let streams = await getStreams(paths);
	let keyframeOffsets = await getKeyframeOffsets(paths, streamIndex);
	let stream = streams[streamIndex];
	let combinedOffsets = combineOffsets([ ...keyframeOffsets, stream.duration_ms ], targetDurationMs);
	let segments = makeSegments([ ...combinedOffsets, stream.duration_ms ]);
	return segments;
}
