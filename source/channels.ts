import * as libcp from "child_process";
import * as libhttp from "http";
import * as data from "./data";
import * as api_response from "./api_response";
import * as database from "./database";
import * as autoguard from "@joelek/ts-autoguard";

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

function generateProgramming(channel_id: number, username: string): Array<api_response.Segment> {
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
			let next_episode = data.getEpisodesInShow(show.show_id)[0];
			try {
				const most_recently = data.getMostRecentlyStreamedEpisode(show.show_id, username);
				next_episode = data.getNextEpisode(most_recently.episode_id);
			} catch (error) {}
			return {
				program: {
					show,
					next_episode
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
			const episode = program.program.next_episode;
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
			program.program.next_episode = data.getNextEpisode(episode.episode_id);
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
}

const segment_length_s = 10;
const stream_start_ms = Date.parse("2020-01-01");

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
	generateProgramming,
	getChannel,
	handleRequest
};
