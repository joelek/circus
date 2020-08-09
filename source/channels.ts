import * as libcp from "child_process";
import * as libcrypto from "crypto";
import * as libhttp from "http";
import * as data from "./data";
import * as api_response from "./api_response";
import * as database from "./database";
import { getKeyframes } from "./keyframes";

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

function getCurrentlyPlaying(channel_id: number, timestamp_ms: number): database.ProgramEntry & { duration_ms: number, end_time_ms: number } {
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
	for (let program of programs) {
		if (program.start_time_ms <= timestamp_ms && timestamp_ms < program.end_time_ms) {
			return program;
		}
	}
	throw "Expected a currently playing program!";
}

let keyframe_db: { [key: string]: number[] | undefined } = {};
let segment_db: { [key: string]: number | undefined } = {};

const segment_length_s = 10;

function handleRequest(token: string, request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
	const method = request.method || "GET";
	const url = request.url || "/";
	let parts: RegExpExecArray | null = null;
	console.log(url);
	if (false) {
	} else if (method === "GET" && (parts = /^[/]media[/]channels[/]([0-9]+)[/]([0-9]+)[/]([0-9a-f]+)[_]([0-9]+)[.]ts/.exec(url)) != null) {
		(async () => {
			const channel_id = Number.parseInt(parts[1]);
			const start_time_ms = Number.parseInt(parts[2]);
			const file_id = parts[3];
			const segment = Number.parseInt(parts[4]);
			let file = data.files_index[file_id];
			if (!file) {
				throw "Expected a valid file id!";
			}
			let keyframes = keyframe_db[file_id];
			if (!keyframes) {
				keyframe_db[file_id] = keyframes = await getKeyframes(file.path);
			}
			if (segment >= keyframes.length) {
				throw "Expected a valid segment!";
			}
			let metadata = data.lookupMetadata(file_id);
			let keyframe_offset_ms = keyframes[segment];
			let duration_ms = (segment + 1 < keyframes.length ? keyframes[segment + 1] : metadata.duration) - keyframe_offset_ms;
			const ffmpeg = libcp.spawn("ffmpeg", [
				"-ss", `${keyframe_offset_ms / 1000}`,
				"-i", file.path.join("/"),
				"-vframes", `${Math.round(25 * duration_ms) - 1}`,
				"-c:v", "copy",
				"-c:a", "copy",
				"-f", "mpegts",
				//"-muxdelay", "0",
				//"-avoid_negative_ts", "disabled",
				"pipe:"
			]);
			ffmpeg.stdout.pipe(response);
		})();
	} else if (method === "GET" && (parts = /^[/]media[/]channels[/]([0-9]+)[/]([0-9]+)[/]/.exec(url)) != null) {
		(async () => {
			const channel_id = Number.parseInt(parts[1]);
			const start_time_ms = Number.parseInt(parts[2]);
			const now_ms = Date.now();
			const program = getCurrentlyPlaying(channel_id, now_ms);
			let keyframes = keyframe_db[program.file_id];
			if (!keyframes) {
				keyframe_db[program.file_id] = keyframes = await getKeyframes((data.files_index[program.file_id] as database.FileEntry).path);
			}
			let segment = segment_db[start_time_ms] || 0;
			let index = 0;
			for (let keyframe of keyframes) {
				if (program.start_time_ms + keyframe > now_ms) {
					break;
				}
				index += 1;
			}
			segment_db[start_time_ms] = segment = segment + index;
			let total_duration = 0;
			const segments = new Array<string>();
			while (total_duration < 30 * 1000) {
				if (index >= keyframes.length) {
					break;
				}
				let keyframe_offset_ms = keyframes[index];
				let duration_ms = (index + 1 < keyframes.length ? keyframes[index + 1] : program.duration_ms) - keyframe_offset_ms;
				segments.push(`#EXTINF:${(duration_ms/1000).toFixed(3)},`),
				segments.push(`${program.file_id}_${index}.ts?token=${token}`);
				index += 1;
				total_duration += duration_ms;
			}
			response.writeHead(200);
			response.end([
				"#EXTM3U",
				"#EXT-X-VERSION:3",
				`#EXT-X-TARGETDURATION:${segment_length_s}`,
				`#EXT-X-MEDIA-SEQUENCE:${segment}`,
				...segments
			].join("\n"));
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
