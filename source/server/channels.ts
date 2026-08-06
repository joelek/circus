import * as libcp from "child_process";
import * as libfs from "fs";
import * as libpath from "path";
import * as keyframes from "./keyframes";
import { Segment, getKeyframeSegments } from "./keyframes";
import { Channel, Episode, Movie } from "../api/schema/objects";
import { ChannelProgram } from "../api/schema/api";
import * as atlas from "../database/atlas";
import * as handler from "../api/handler";
import { getPath } from "../database/indexer";
import { binid } from "../utils";
import * as vtt from "../database/vtt/vtt";

let CHANNELS: Array<{ channel: Channel; programs: Array<ChannelProgram>; }> | undefined;

type BreakProgram = {
	start_utc: number;
	program: {
		duration_ms: number;
		media: null;
		path: string;
		start: string;
		title: string;
		subtitle: string;
	}
};

export async function getChannels(api_user_id: string): Promise<Array<{ channel: Channel; programs: Array<ChannelProgram>; }>> {
	if (CHANNELS == null) {
		return atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			let start = new Date();
			start.setUTCSeconds(0);
			start.setUTCMilliseconds(0);
			CHANNELS = [
				{
					channel: {
						channel_id: "c4247eac28a83892",
						title: "ZTV"
					},
					programs: [
						{
							start_utc: start.getTime() + 1 * 60 * 1000,
							program: await handler.lookupMovie(queue, "94763c8933683b37", api_user_id)
						}
					]
				}
			];
			return CHANNELS;
		});
	} else {
		return CHANNELS;
	}
};

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

const SEGMENTS_DATABASE: {
	[key: string]: Segment[] | undefined;
} = {};
const BREAK_RENDER_DATABASE: {
	[key: string]: Promise<void> | undefined;
} = {};
const OFFSET_DATABASE: {
	[key: string]: Promise<number> | undefined;
} = {};

const TARGET_DURATION_S = 10;
const WINDOW_LENGTH_S = 2 * 60;

async function getSegments(program: ChannelProgram | BreakProgram): Promise<Array<Segment>> {
	if (ChannelProgram.is(program)) {
		let file_id = program.program.media.file_id;
		let segments = SEGMENTS_DATABASE[file_id];
		if (segments != null) {
			return segments;
		}
		return await atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			let file = await atlas.stores.files.lookup(queue, { file_id: binid(file_id) });
			segments = await getKeyframeSegments(await getPath(queue, file), 0, TARGET_DURATION_S * 1000);
			SEGMENTS_DATABASE[file_id] = segments;
			return segments;
		});
	} else {
		let path = program.program.path;
		if (!libfs.existsSync(path)) {
			let ffmpeg = BREAK_RENDER_DATABASE[path];
			if (ffmpeg == null) {
				libfs.mkdirSync(libpath.dirname(path), { recursive: true });
				function escape(string: string): string {
					return string
						.replaceAll("\\", "\\\\")
						.replaceAll(":", "\\:")
						.replaceAll("%", "\\%")
						.replaceAll("'", "\\'")
				};
				let start_local = new Date(program.start_utc);
				start_local.setUTCMinutes(start_local.getUTCMinutes() - start_local.getTimezoneOffset());
				ffmpeg = new Promise<void>((resolve, reject) => {
					let cp = libcp.spawn("ffmpeg", [
						"-hide_banner",
						"-f", "lavfi",
						"-i", `color=c=black:s=1920x1080`,
						"-f", "lavfi",
						"-i", "anullsrc=r=48000:cl=stereo",
						"-pix_fmt", "yuv420p",
						"-i", "./public/logo.png",
						"-filter_complex", [
							`[2:v]scale=64:64:force_original_aspect_ratio=decrease[img]`,
							`[0:v][img]overlay=x=W-w-48:y=48[bg]`,
							`[bg]drawtext=text='%{pts\\:gmtime\\:${start_local.getTime()/1000}\\:%H\\\\\\:%M\\\\\\:%S}':fontfile=./public/OpenSans-Regular.ttf:fontcolor=white:fontsize=20:x=W-48-32-tw/2:y=64+48+12[bg]`,
							`[bg]drawbox=x=0:y=ih-48-36-12-72-24-36-48:w=iw:h=48+36+12+72+24+36+48:color=0x1F1F1F:t=fill[bg]`,
							`[bg]drawtext=text='${escape(program.program.start)}':fontfile=./public/OpenSans-Regular.ttf:fontcolor=white:fontsize=36:x=48:y=H-48-36-12-72-24-36[bg]`,
							`[bg]drawtext=text='${escape(program.program.title)}':fontfile=./public/OpenSans-Regular.ttf:fontcolor=white:fontsize=72:x=48:y=H-48-36-12-72[bg]`,
							`[bg]drawtext=text='${escape(program.program.subtitle)}':fontfile=./public/OpenSans-Regular.ttf:fontcolor=white:fontsize=36:x=48:y=H-48-36`
						].join(";"),
						"-t", `${(program.program.duration_ms) / 1000}`,
						"-c:v", "libx264",
						"-preset", "veryslow",
						"-x264-params", [
							"crf=20",
							"ref=4",
							"bframes=0"
						].join(":"),
						"-c:a", "aac",
						"-q:a", "2",
						"-aac_coder", "fast",
						"-f", "mp4",
						"-fflags", "+bitexact",
						"-movflags", "+faststart",
						path, "-y"
					]);
					cp.on("exit", (code) => {
						if (code !== 0) {
							reject(code);
						} else {
							resolve();
						}
					});
				});
				BREAK_RENDER_DATABASE[path] = ffmpeg;
			}
			await ffmpeg;
		}
		let segments = SEGMENTS_DATABASE[path];
		if (segments != null) {
			return segments;
		}
		segments = await getKeyframeSegments([path], 0, TARGET_DURATION_S * 1000);
		SEGMENTS_DATABASE[path] = segments;
		return segments;
	}
};

export async function getChannelMediaSegment(channel_id: string, api_user_id: string, program_index: number, segment_index: number): Promise<Uint8Array> {
	let programs = await getPrograms(channel_id, api_user_id);
	if (program_index < 0) {
		throw 400;
	}
	if (program_index >= programs.length) {
		throw 400;
	}
	let program = programs[program_index];
	let segments = await getSegments(program);
	if (segment_index < 0) {
		throw 400;
	}
	if (segment_index >= segments.length) {
		throw 400;
	}
	let segment = segments[segment_index];
	let path = program.program.media == null ? program.program.path : await atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let file = await atlas.stores.files.lookup(queue, { file_id: binid(program.program.media?.file_id as string) });
		return (await getPath(queue, file)).join("/");
	});
	let offset_ms_promise = OFFSET_DATABASE[path];
	if (offset_ms_promise == null) {
		offset_ms_promise = keyframes.getStartOffsetMs([path]);
		OFFSET_DATABASE[path] = offset_ms_promise;
	}
	let offset_ms = await offset_ms_promise;
	return new Promise<Uint8Array>((resolve, reject) => {
		let video = libcp.spawn("ffmpeg", [
			"-hide_banner",
			"-ss", `${segment.offset_ms / 1000}`,
			"-i", path,
			"-frames:v", `${(segment.duration_ms / 40)}`,
			"-c", "copy",
			"-f", "mpegts",
			"-muxdelay", "0",
			"-muxpreload", "0",
			"-an",
			"-avoid_negative_ts", "disabled", // Required.
			"-output_ts_offset", `0`,
			"-copyts",
			"pipe:",
			"-y"
		]);
		let audio = libcp.spawn("ffmpeg", [
			"-hide_banner",
			"-ss", `${segment.offset_ms / 1000}`,
			"-i", path,
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
			"pipe:",
			"-y"
		]);
		let muxer = libcp.spawn("ffmpeg", [
			"-hide_banner",
			"-i", "pipe:3",
			"-i", "pipe:4",
			"-c", "copy",
			"-f", "mpegts",
			"-muxdelay", "0",
			"-muxpreload", "0",
			"-avoid_negative_ts", "disabled", // Required.
			"-output_ts_offset", `${-offset_ms / 1000}`, // Required to prevent negative pts/dts timestamps.
			"-copyts",
			"pipe:",
			"-y"
		], {
			stdio: [
				"ignore",
				"pipe",
				"pipe",
				"pipe",
				"pipe"
			]
		});
		let chunks = new Array<Buffer>();
		muxer.stdout?.on("data", (chunk) => {
			chunks.push(chunk);
		});
		muxer.on("exit", (code) => {
			if (code === 0) {
				let buffer = Buffer.concat(chunks);
				resolve(buffer);
			} else {
				reject(code);
			}
		});
		// @ts-ignore
		video.stdout.pipe(muxer.stdio[3]);
		// @ts-ignore
		audio.stdout.pipe(muxer.stdio[4]);
	});
};

export async function getChannelSubtitleSegment(channel_id: string, api_user_id: string, program_index: number, segment_index: number): Promise<Uint8Array> {
	let programs = await getPrograms(channel_id, api_user_id);
	if (program_index < 0) {
		throw 400;
	}
	if (program_index >= programs.length) {
		throw 400;
	}
	let program = programs[program_index];
	let segments = await getSegments(program);
	if (segment_index < 0) {
		throw 400;
	}
	if (segment_index >= segments.length) {
		throw 400;
	}
	let segment = segments[segment_index];
	if (program.program.media != null) {
		let path = await atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			let file = await atlas.stores.files.lookup(queue, { file_id: binid(program.program.media?.file_id as string) });
			return (await getPath(queue, file)).join("/");
		});
		let offset_ms_promise = OFFSET_DATABASE[path];
		if (offset_ms_promise == null) {
			offset_ms_promise = keyframes.getStartOffsetMs([path]);
			OFFSET_DATABASE[path] = offset_ms_promise;
		}
		let offset_ms = await offset_ms_promise;
		if (Episode.is(program.program) || Movie.is(program.program)) {
			let subtitles = program.program.subtitles;
			let subtitle = subtitles.find((subtitle) => subtitle.language?.iso_639_2 === "swe") ?? subtitles.find((subtitle) => subtitle.language?.iso_639_2 === "eng") ?? subtitles.find((subtitle) => true);
			if (subtitle != null) {
				let subs_path = await atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
					let file = await atlas.stores.files.lookup(queue, { file_id: binid(subtitle?.file_id as string) });
					return (await getPath(queue, file)).join("/");
				});
				return new Promise<Uint8Array>((resolve, reject) => {
					let subs = libcp.spawn("ffmpeg", [
						"-hide_banner",
						"-i", subs_path,
						"-ss", `${segment.offset_ms / 1000}`,
						"-t", `${segment.duration_ms / 1000}`,
						"-f", "webvtt",
						"-output_ts_offset", `${-offset_ms / 1000}`,
						"-copyts",
						"pipe:",
						"-y"
					]);
					let chunks = new Array<Buffer>();
					subs.stdout?.on("data", (chunk) => {
						chunks.push(chunk);
					});
					subs.on("exit", (code) => {
						if (code === 0) {
							let buffer = Buffer.concat(chunks);
							resolve(buffer);
						} else {
							reject(code);
						}
					});
				});
			}
		}
	}
	return Buffer.from("WEBVTT\n");
};

export async function getPrograms(channel_id: string, api_user_id: string): Promise<Array<ChannelProgram | BreakProgram>> {
	let channels = await getChannels(api_user_id);
	let channel = channels.find((channel) => channel.channel.channel_id === channel_id);
	if (channel == null) {
		throw 404;
	}
	let programs: Array<ChannelProgram | BreakProgram> = [];
	let last_program: ChannelProgram | undefined;
	for (let program of channel.programs) {
		let start_utc = last_program == null ? Math.min(Date.now(), program.start_utc - 1 * 60 * 1000) : last_program.start_utc + last_program.program.duration_ms;
		let start_local = new Date(program.start_utc);
		start_local.setUTCMinutes(start_local.getUTCMinutes() - start_local.getTimezoneOffset());
		if (Episode.is(program.program)) {
			let episode = program.program;
			let season = episode.season;
			let show = season.show;
			programs.push({
				start_utc: start_utc,
				program: {
					duration_ms: Math.max(0, program.start_utc - start_utc),
					media: null,
					path: `./private/breaks/${channel_id}/${program.start_utc}.mp4`,
					start: start_local.toISOString().slice(11, 11 + 8),
					title: episode.title,
					subtitle: [show.title, season.title ?? `Season ${season.number}`].join(" \u00b7 ")
				}
			});
		} else if (Movie.is(program.program)) {
			let movie = program.program;
			programs.push({
				start_utc: start_utc,
				program: {
					duration_ms: Math.max(0, program.start_utc - start_utc),
					media: null,
					path: `./private/breaks/${channel_id}/${program.start_utc}.mp4`,
					start: start_local.toISOString().slice(11, 11 + 8),
					title: movie.title,
					subtitle: movie.genres.map((genre) => genre.title).join(" \u00b7 "),
				}
			});
		} else {
			let dummy: never = program.program;
			throw new Error(`Expected code to be unreachable!`);
		}
		programs.push(program);
		last_program = program;
	}
	return programs;
};

export async function getChannelContent(channel_id: string, token: string, api_user_id: string): Promise<string> {
	let lines = [
		"#EXTM3U",
		"#EXT-X-VERSION:3",
		"",
		`#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles",NAME="Default",DEFAULT=YES,AUTOSELECT=YES,URI="subtitle/?token=${token}"`,
		"",
		`#EXT-X-STREAM-INF:BANDWIDTH=1000000,SUBTITLES="subtitles"`,
		`media/?token=${token}`
	];
	return lines.join("\n");
};

export async function getChannelContentPlaylist(channel_id: string, token: string, api_user_id: string): Promise<string> {
	let current_time_utc = Date.now();
	let window_length_ms = WINDOW_LENGTH_S * 1000;
	let window_start_utc = current_time_utc - window_length_ms;
	let window_end_utc = current_time_utc;
	let programs = await getPrograms(channel_id, api_user_id);
	let program_index = 0;
	let segment_index = 0;
	let media_sequence = 0;
	for (; program_index < programs.length; program_index++) {
		let program = programs[program_index];
		let segments = await getSegments(program);
		let end_utc = program.start_utc + program.program.duration_ms;
		if (end_utc >= window_start_utc) {
			for (; segment_index < segments.length; segment_index++) {
				let segment = segments[segment_index];
				if (program.start_utc + segment.offset_ms + segment.duration_ms >= window_start_utc) {
					break;
				}
			}
			media_sequence += segment_index;
			break;
		} else {
			media_sequence += segments.length;
		}
	}
	let lines = [
		"#EXTM3U",
		"#EXT-X-VERSION:3",
		`#EXT-X-TARGETDURATION:${TARGET_DURATION_S}`,
		`#EXT-X-DISCONTINUITY-SEQUENCE:${program_index}`,
		`#EXT-X-MEDIA-SEQUENCE:${media_sequence}`
	];
	let needs_time = true;
	let reached_end = false;
	if (program_index < programs.length) {
		let program = programs[program_index];
		let segments = await getSegments(program);
		while (true) {
			if (segment_index >= segments.length) {
				program_index += 1;
				segment_index = 0;
				if (program_index >= programs.length) {
					reached_end = true;
					break;
				}
				lines.push("");
				lines.push("#EXT-X-DISCONTINUITY");
				program = programs[program_index];
				segments = await getSegments(program);
				needs_time = true;
			}
			let segment = segments[segment_index];
			let segment_start_utc = program.start_utc + segment.offset_ms;
			let segment_end_utc = segment_start_utc + segment.duration_ms;
			if (segment_end_utc > window_end_utc) {
				break;
			}
			if (needs_time) {
				lines.push("");
				lines.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(program.start_utc + segment.offset_ms).toISOString()}`);
			}
			lines.push("");
			lines.push(`#EXTINF:${(segment.duration_ms/1000).toFixed(6)},`),
			lines.push(`${program_index}/${segment_index}/?token=${token}`);
			segment_index += 1;
			needs_time = false;
		}
	} else {
		reached_end = true;
	}
	if (reached_end) {
		lines.push("");
		lines.push("#EXT-X-ENDLIST");
	}
	return lines.join("\n");
};
