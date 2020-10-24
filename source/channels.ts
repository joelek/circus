import * as libcp from "child_process";
import * as libhttp from "http";
import * as data from "./data";
import * as database from "./database";
import { Segment, getKeyframeSegments } from "./keyframes";
/*
type Supplier<A> = {
	(): A
};

function makeSeeder(seed: number): Supplier<number> {
	seed = seed % 2147483647;
	if (seed <= 0) {
		seed += 2147483646;
	}
	const seeder = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};
	seeder();
	return seeder;
}

let keyframe_db: { [key: string]: Segment[] | undefined } = {};
const target_duration_s = 10;

async function getKeyframes(file_id: string): Promise<Segment[]> {
	let keyframes = keyframe_db[file_id];
	if (!keyframes) {
		let file = data.files_index[file_id] as database.FileEntry;
		keyframes = await getKeyframeSegments(file.path, 0, target_duration_s * 1000);
		keyframe_db[file_id] = keyframes;
	}
	return keyframes;
}

export function handleRequest(token: string, request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
	const method = request.method || "GET";
	const url = request.url || "/";
	let parts: RegExpExecArray | null = null;
	if (false) {
	} else if (method === "GET" && (parts = /^[/]media[/]channels[/]([0-9]+)[/]([0-9]+)[/]([0-9]+)_([0-9a-f]+)[_]([0-9]+)(?:[_]([0-9]+)?)[.]ts/.exec(url)) != null) {
		(async () => {
			const channel_id = Number.parseInt(parts[1]);
			const start_time_ms = Number.parseInt(parts[2]);
			const index = Number.parseInt(parts[3]);
			const file_id = parts[4];
			const offset_ms = Number.parseInt(parts[5]);
			const duration_ms = parts[6] ? Number.parseInt(parts[6]) : null;
			let file = data.files_index[file_id];
			if (!file) {
				throw "Expected a valid file id!";
			}
			// We subtract two frames (80ms@25fps) from the duration since there is a bug in ffmpeg affecting the demuxing of videos using b-frames.
			const ffmpeg = libcp.spawn("ffmpeg", [
				"-hide_banner",
				"-ss", `${offset_ms / 1000}`,
				...(duration_ms != null ? ["-t", `${(duration_ms - 80) / 1000}`] : []),
				"-i", file.path.join("/"),
				"-c", "copy",
				"-f", "mpegts",
				"-muxdelay", "0",
				"-avoid_negative_ts", "disabled",
				"-output_ts_offset", "0",
				"-copyts",
				"pipe:"
			]);
			let connection = request.headers.connection || "close";
			response.writeHead(200, {
				"Connection": connection
			});
			ffmpeg.stdout.pipe(response);
		})();
	} else if (method === "GET" && (parts = /^[/]media[/]channels[/]([0-9]+)[/]([0-9]+)[/]/.exec(url)) != null) {
		(async () => {
			const channel_id = Number.parseInt(parts[1]);
			const start_time_ms = Number.parseInt(parts[2]);
			const now_ms = Date.now();
			const programs = getProgrammingWithTiming(channel_id);
			let programIndex = 0;
			for (; programIndex < programs.length; programIndex++) {
				let program = programs[programIndex];
				if (program.start_time_ms <= now_ms && now_ms < program.end_time_ms) {
					break;
				}
			}
			let program = programs[programIndex];
			let keyframes = await getKeyframes(program.file_id);
			let index = 0;
			while (true) {
				let segment = keyframes[index];
				if (program.start_time_ms + segment.offset_ms + segment.duration_ms >= now_ms) {
					break;
				}
				index += 1;
			}
			let sequence = index;
			const segments = new Array<string>();
			let segments_pushed = 0;
			let total_duration_ms = 0;
			while (segments_pushed < 6 && total_duration_ms < target_duration_s * 1000 * 3) {
				if (index >= keyframes.length) {
					segments.push("");
					segments.push("#EXT-X-DISCONTINUITY");
					programIndex += 1;
					index = 0;
					program = programs[programIndex];
					keyframes = await getKeyframes(program.file_id);
				}
				let keyframe = keyframes[index];
				segments.push("");
				segments.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(program.start_time_ms + keyframe.offset_ms).toISOString()}`);
				segments.push(`#EXTINF:${(keyframe.duration_ms/1000).toFixed(3)},`),
				segments.push(`${index}_${program.file_id}_${keyframe.offset_ms}_${keyframe.duration_ms}.ts?token=${token}`);
				index += 1;
				segments_pushed += 1;
				total_duration_ms += keyframe.duration_ms;
			}
			let payload = [
				"#EXTM3U",
				"#EXT-X-VERSION:3",
				`#EXT-X-TARGETDURATION:${target_duration_s}`,
				`#EXT-X-DISCONTINUITY-SEQUENCE:${programIndex}`,
				`#EXT-X-MEDIA-SEQUENCE:${sequence}`,
				...segments
			].join("\n");
			let connection = request.headers.connection || "close";
			response.writeHead(200, {
				"Connection": connection
			});
			response.end(payload);
		})();
	} else {
		response.writeHead(404);
		response.end();
	}
}
*/
