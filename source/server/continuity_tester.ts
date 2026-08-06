import * as keyframes from "./keyframes";
import * as libcp from "child_process";
import * as libffprobe from "./ffprobe";

async function extractSegment(paths: Array<string>, segment: keyframes.Segment, offset_ms: number): Promise<Buffer> {
	await new Promise<void>((resolve, reject) => {
		let ffmpeg = libcp.spawn("ffmpeg", [
			"-hide_banner",
			"-ss", `${segment.offset_ms / 1000}`,
			"-i", paths.join("/"),
			"-frames:v", `${(segment.duration_ms / 40)}`,
			"-c", "copy",
			"-f", "mpegts",
			"-muxdelay", "0",
			"-muxpreload", "0",
			"-an",
			"-avoid_negative_ts", "disabled", // Required.
			"-output_ts_offset", `0`,
			"-copyts",
			"video.bin",
			"-y"
		]);
		ffmpeg.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(code);
			}
		});
	});
	await new Promise<void>((resolve, reject) => {
		let ffmpeg = libcp.spawn("ffmpeg", [
			"-hide_banner",
			"-ss", `${segment.offset_ms / 1000}`,
			"-i", paths.join("/"),
			"-ss", `${segment.offset_ms / 1000}`,
			"-t", `${(segment.duration_ms / 1000)}`,
			"-c", "copy",
			"-f", "mpegts",
			"-muxdelay", "0",
			"-muxpreload", "0",
			"-vn",
			"-avoid_negative_ts", "disabled", // Required.
			"-output_ts_offset", `${segment.offset_ms / 1000}`,
			"-copyts",
			"audio.bin",
			"-y"
		]);
		ffmpeg.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(code);
			}
		});
	});
	return new Promise<Buffer>((resolve, reject) => {
		let ffmpeg = libcp.spawn("ffmpeg", [
			"-hide_banner",
			"-i", "video.bin",
			"-i", "audio.bin",
			"-c", "copy",
			"-f", "mpegts",
			"-muxdelay", "0",
			"-muxpreload", "0",
			"-avoid_negative_ts", "disabled", // Required.
			"-output_ts_offset", `${-offset_ms / 1000}`, // Required to prevent negative pts/dts timestamps.
			"-copyts",
			"muxed.bin",
			"-y"
		]);
		let chunks = new Array<Buffer>();
		ffmpeg.stdout.on("data", (chunk) => {
			chunks.push(chunk);
		});
		ffmpeg.on("exit", (code) => {
			if (code === 0) {
				let buffer = Buffer.concat(chunks);
				resolve(buffer);
			} else {
				reject(code);
			}
		});
	});
};

async function run(): Promise<void> {
	let paths = [process.argv[2]];
	let master_stream_index = 0;
	let streams = await keyframes.getStreams(paths);
	let offset_ms = await keyframes.getStartOffsetMs(paths);
	let segments = await keyframes.getKeyframeSegments(paths, master_stream_index, undefined);
	let offsets = streams.map((stream) => undefined as number | undefined);
	for (let [segment_index, segment] of segments.entries()) {
		await extractSegment(paths, segment, offset_ms);
		let segments = await new Promise<Array<keyframes.Segment>>((resolve, reject) => {
			let ffprobe = libcp.spawn("ffprobe", [
				"-hide_banner",
				"-i", "muxed.bin",
				"-show_streams",
				"-show_entries", "stream",
				"-of", "json"
			]);
			let chunks = new Array<Buffer>();
			ffprobe.stdout.on("data", (chunk) => {
				chunks.push(chunk);
			});
			ffprobe.on("exit", (code) => {
				if (code === 0) {
					let string = Buffer.concat(chunks).toString();
					let json = libffprobe.StreamsResult.as(JSON.parse(string));
					let streams = json.streams.filter((stream): stream is libffprobe.VideoStream | libffprobe.AudioStream => libffprobe.VideoStream.is(stream) || libffprobe.AudioStream.is(stream)).map((stream) => {
						let offset_ms =  stream.start_pts;
						let duration_ms = stream.duration_ts;
						return {
							offset_ms,
							duration_ms,
							true_offset: Number.parseFloat(stream.start_time),
							true_duration: Number.parseFloat(stream.duration)
						};
					});
					resolve(streams);
				} else {
					reject(code);
				}
			});
		});
		if (segments.length !== offsets.length) {
			throw new Error(`Expected segments and offsets to have equal length!`);
		}
		for (let i = 0; i < segments.length; i += 1) {
			let segment = segments[i];
			let offset = offsets[i];
			if (offset == null) {
				offset = segment.offset_ms;
			}
			if (segment.offset_ms !== offset) {
				console.log(JSON.stringify({ expected: offset, observed: segment.offset_ms }, null, 2));
				throw new Error(`Continuity error in stream ${i}!`);
			}
			console.log(`Updating stream offset for stream ${i} from ${offset} to ${offset + segment.duration_ms}...`)
			offset += segment.duration_ms;
			offsets[i] = offset;
		}
	}
};

run();
