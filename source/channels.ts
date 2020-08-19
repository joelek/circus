import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as libhttp from "http";
import * as data from "./data";
import * as api_response from "./api_response";
import * as database from "./database";
import { Segment, getKeyframeSegments } from "./keyframes";

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

function getAffinitiesForChannel(channel_id: number): Array<{ genre: database.VideoGenreEntry, weight: number }> {
	const seeder = makeSeeder(channel_id);
	return data.media.video.genres.map((genre) => {
		return {
			genre,
			weight: seeder()
		};
	});
}

function getChannel(channel_id: number): api_response.ChannelEntry {
	const type = makeSeeder(channel_id)() < 0.5 ? "Movies" : "Shows";
	const affinities = getAffinitiesForChannel(channel_id).sort((one, two) => {
		return two.weight - one.weight;
	});
	return {
		channel_id: channel_id,
		title: affinities[0].genre.title + " & " + affinities[1].genre.title + " " + type
	};
}

function getProgramming(channel_id: number): Array<database.ProgramEntry> {
	let channel: database.ChannelEntry | undefined;
	try {
		channel = data.getChannelFromChannelId("" + channel_id);
	} catch (error) {}
	if (!channel) {
		channel = data.createChannel({
			channel_id: "" + channel_id
		});
	}
	let programs = data.getProgramsFromChannelId("" + channel_id);
	let start = new Date();
	start.setUTCHours(0);
	start.setUTCMinutes(0);
	start.setUTCSeconds(0);
	start.setUTCMilliseconds(0);
	let currentMs = start.valueOf();
	let nowMs = Date.now();
	if (programs.length > 0) {
		let lastProgram = programs[programs.length - 1];
		let lastMetadata = data.lookupMetadata(lastProgram.file_id);
		let end_time_ms = lastProgram.start_time_ms + lastMetadata.duration;
		currentMs = end_time_ms;
	}
	let endMs = nowMs + (6 * 60 * 60 * 1000);
	if (currentMs >= endMs) {
		return programs;
	}
	while (currentMs < endMs) {
		let index = Math.floor(Math.random() * data.media.video.episodes.length);
		let episode = data.media.video.episodes[index];
		let program_id = libcrypto.createHash("md5")
			.update("" + channel_id)
			.update("\0")
			.update("" + currentMs)
			.digest("hex");
		let program = data.createProgram({
			program_id: program_id,
			channel_id: "" + channel_id,
			file_id: episode.file_id,
			start_time_ms: currentMs
		});
		programs.push(program);
		currentMs += episode.duration;
	}
	return programs;
}

function generateProgramming(channel_id: number, username: string): Array<api_response.Segment> {
	return getProgramming(channel_id).map((program) => {
		let metadata = data.lookupMetadata(program.file_id);
		if (database.EpisodeEntry.is(metadata)) {
			let episode = data.lookupEpisode(metadata.episode_id);
			let subtitles = data.lookupSubtitles(episode.file_id);
			return {
				episode: {
					...episode,
					subtitles
				}
			};
		}
		throw "Unreachable!";
	});
/*
	const affinities = getAffinitiesForChannel(channel_id);
	const type = makeSeeder(channel_id)() < 0.5 ? "movies" : "shows";
	if (type === "shows") {
		const shows = data.media.video.shows.map((show) => {
			let video_genres = data.getVideoGenresFromShowId(show.show_id);
			const genre_weights = video_genres
				.map((video_genre) => {
					const genre_affinity = affinities.find((genre_affinity) => {
						return genre_affinity.genre.title === video_genre.title;
					});
					if (genre_affinity == null) {
						return null;
					}
					return genre_affinity.weight;
				})
				.filter(autoguard.guards.Number.is);
			const weight = 1.0 + (genre_weights.length === 0 ? 0.0 : genre_weights.reduce((sum, genre_weight) => {
				return sum + genre_weight;
			}, 0.0) / genre_weights.length);
			let episodes = data.getEpisodesFromShowId(show.show_id).map((episode) => {
				let streams = data.getStreamsFromFileId(episode.file_id)
					.filter((stream) => {
						return stream.username === username;
					});
				let stream = streams.pop() || null;
				return {
					...episode,
					stream
				};
			});
			let lastIndex = episodes.reduce((index, currentEpisode, currentIndex) => {
				if (currentEpisode.stream) {
					let episode = episodes[index];
					if (episode.stream) {
						if (currentEpisode.stream.timestamp_ms > episode.stream.timestamp_ms) {
							return currentIndex;
						} else {
							return index;
						}
					} else {
						return currentIndex;
					}
				} else {
					return index;
				}
			}, episodes.length - 1);
			let startIndex = (lastIndex + 1) % episodes.length;
			episodes = episodes.slice(startIndex).concat(episodes.slice(0, startIndex));
			return {
				program: {
					show,
					episodes
				},
				weight
			};
		});
		const programmed = new Array<api_response.Segment>();
		while (shows.length > 0 && programmed.length < 20) {
			const sorted = shows
				.sort((one, two) => {
					return two.weight - one.weight;
				});
			const program = sorted[0];
			const episode = program.program.episodes[0];
			program.program.episodes = program.program.episodes.slice(1);
			program.program.episodes.push(episode);
			const subtitles = data.lookupSubtitles(episode.file_id);
			const season = data.seasons_index[episode.season_id];
			if (season == null) {
				throw "";
			}
			const show = data.shows_index[season.show_id];
			if (show == null) {
				throw "";
			}
			programmed.push({
				episode: {
					...episode,
					season: {
						...season,
						show
					},
					subtitles
				}
			});
			program.weight *= 0.75;
		}
		return programmed;
	} else {
		const movies = data.media.video.movies.map((movie) => {
			let movie_parts = data.getMoviePartsFromMovieId(movie.movie_id);
			let video_genres = data.getVideoGenresFromMovieId(movie.movie_id);
			const genre_weights = video_genres
				.map((video_genre) => {
					const genre_affinity = affinities.find((genre_affinity) => {
						return genre_affinity.genre.title === video_genre.title;
					});
					if (genre_affinity == null) {
						return null;
					}
					return genre_affinity.weight;
				})
				.filter(autoguard.guards.Number.is);
			const weight = 1.0 + (genre_weights.length === 0 ? 0.0 : genre_weights.reduce((sum, genre_weight) => {
				return sum + genre_weight;
			}, 0.0) / genre_weights.length);
			return {
				program: {
					...movie,
					movie_parts
				},
				weight
			};
		});
		const programmed = new Array<api_response.Segment>();
		while (movies.length > 0 && programmed.length < 20) {
			const sorted = movies
				.sort((one, two) => {
					return two.weight - one.weight;
				});
			const program = sorted[0];
			programmed.push({
				movie: program.program
			});
			program.weight = 0.0;
		}
		return programmed;
	}
	*/
}

function getProgrammingWithTiming(channel_id: number): Array<database.ProgramEntry & { duration_ms: number, end_time_ms: number }> {
	let programming = getProgramming(channel_id);
	let programs = programming.map((program) => {
		let metadata = data.lookupMetadata(program.file_id);
		let duration_ms = metadata.duration;
		let end_time_ms = program.start_time_ms + metadata.duration;
		return {
			...program,
			duration_ms,
			end_time_ms
		};
	});
	return programs;
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

function handleRequest(token: string, request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
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

export {
	getAffinitiesForChannel,
	getProgramming,
	generateProgramming,
	getChannel,
	handleRequest
};
