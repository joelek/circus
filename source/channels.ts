import * as libcp from "child_process";
import * as libhttp from "http";
import * as data from "./data";
import * as api_response from "./api_response";
import * as database from "./database";

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

const segment_length_s = 10;
const stream_start_ms = Date.parse("2020-01-01");

function getAffinitiesForChannel(channel_id: number): api_response.Affinities {
	const seeder = makeSeeder(channel_id);
	return {
		types: {
			show: seeder(),
			movie: seeder()
		},
		genres: {
			comedy: seeder(),
			action: seeder(),
			cartoon: seeder(),
			romance: seeder(),
			fantasy: seeder()
		}
	};
}

/*
loves long action movies:

duration: 1.0
action: 1.0
movie: 1.0

compute recency for each movie:

recency(die_hard) = 1.0 (just watched)
recency(robocop) = 0.0 (never watched)

compute recency for each show:

recency(how i met your mother) = 1.0 (just watched an episode)
receny(heroes) = 0.2 (watched an episode a long time ago)

compute randomization factor for each peice of content:

rand(die_hard) = 0.12
rand(robocop) = 0.82
rand(how i met your moter) = 0.44
rand(heroes) = 0.34



 */


function handleRequest(token: string, request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
	const method = request.method || "GET";
	const url = request.url || "/";
	let parts: RegExpExecArray | null = null;
	if (false) {
	} else if (method === "GET" && (parts = /^[/]media[/]channels[/]([0-9]+)[/]([0-9]+).ts/.exec(url)) != null) {
		const channel_id = Number.parseInt(parts[1]);
		const timestamp_ms = Number.parseInt(parts[2]);
		let media = data.media.video.episodes[channel_id];
		let file = data.files_index[media.file_id] as database.FileEntry;
		const stream_duration_ms = media.duration;
		const stream_segments = Math.ceil(stream_duration_ms / (segment_length_s * 1000));
		const duration_ms = stream_segments * (segment_length_s * 1000);
		const repeats = Math.floor(timestamp_ms / duration_ms);
		const offset_ms = timestamp_ms - (repeats * duration_ms);
		const ffmpeg = libcp.spawn("ffmpeg", [
			"-ss", `${offset_ms / 1000}`,
			"-i", file.path.join("/"),
			"-vframes", `${25 * segment_length_s}`,
			"-c:v", "copy",
			"-c:a", "copy",
			"-f", "mpegts",
			//"-muxdelay", "0",
			//"-avoid_negative_ts", "disabled",
			"pipe:"
		]);
		ffmpeg.stdout.pipe(response);
	} else if (method === "GET" && (parts = /^[/]media[/]channels[/]([0-9]+)[/]/.exec(url)) != null) {
		const channel_id = Number.parseInt(parts[1]);
		const stream_length_ms = Date.now() - stream_start_ms;
		const segment_offset = Math.floor(stream_length_ms / (segment_length_s * 1000));
		const segments = new Array<string>();
		for (let i = 0; i < 3; i++) {
			const timestamp_ms = (segment_offset  + i) * (segment_length_s * 1000);
			segments.push(`#EXTINF:${segment_length_s},`),
			segments.push(`${timestamp_ms}.ts?token=${token}`);
		}
		response.writeHead(200);
		response.end([
			"#EXTM3U",
			"#EXT-X-VERSION:3",
			`#EXT-X-TARGETDURATION:${segment_length_s}`,
			`#EXT-X-MEDIA-SEQUENCE:${segment_offset}`,
			...segments
		].join("\n"));
	} else {
		response.writeHead(404);
		response.end();
	}
}

export {
	getAffinitiesForChannel,
	handleRequest
};
