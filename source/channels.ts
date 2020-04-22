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

function getAffinitiesForChannel(channel_id: number): api_response.Affinities {
	const genres = data.media.video.genres.map((genre) => {
		return genre.title;
	});
	const seeder = makeSeeder(channel_id);
	return {
		types: {
			show: seeder(),
			movie: seeder()
		},
		genres: genres.map((genre) => {
			return {
				name: genre,
				weight: seeder()
			};
		})
	};
}

function generateProgramming(channel_id: number, username: string): Array<api_response.Segment> {
	const affinities = getAffinitiesForChannel(channel_id);
	const shows = data.media.video.shows.map((show) => {
		const show_genres = data.media.video.show_genres
			.filter((show_genre) => {
				return show_genre.show_id === show.show_id;
			});
		const video_genres = show_genres
			.map((show_genre) => {
				return data.video_genres_index[show_genre.video_genre_id];
			})
			.filter(database.VideoGenreEntry.is);
		const genre_weights = video_genres
			.map((video_genre) => {
				const genre_affinity = affinities.genres.find((genre_affinity) => {
					return genre_affinity.name === video_genre.title;
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
			weight,
			new_weight: weight
		};
	});
	const movies = data.media.video.movies.map((movie) => {
		const movie_parts = data.media.video.movie_parts
			.filter((movie_part) => {
				return movie_part.movie_id === movie.movie_id;
			})
			.map((movie_part) => {
				const subtitles = data.media.video.subtitles.filter((subtitle) => {
					return subtitle.movie_part_id === movie_part.movie_part_id;
				});
				return {
					...movie_part,
					subtitles
				};
			});
		const movie_genres = data.media.video.movie_genres
			.filter((movie_genre) => {
				return movie_genre.movie_id === movie.movie_id;
			});
		const video_genres = movie_genres
			.map((movie_genre) => {
				return data.video_genres_index[movie_genre.video_genre_id];
			})
			.filter(database.VideoGenreEntry.is);
		const genre_weights = video_genres
			.map((video_genre) => {
				const genre_affinity = affinities.genres.find((genre_affinity) => {
					return genre_affinity.name === video_genre.title;
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
			weight,
			new_weight: weight
		};
	});
	const available = [
		...shows,
		...movies
	];
	const programmed = new Array<api_response.Segment>();
	while (available.length > 0 && programmed.length < 20) {
		const sorted = available
			.map((program) => {
				const factor = database.MovieEntry.is(program.program) ? affinities.types.movie : affinities.types.show;
				program.new_weight = program.weight * factor;
				return program;
			})
			.sort((one, two) => {
				return two.new_weight - one.new_weight;
			});
		const program = sorted[0];
		if (database.MovieEntry.is(program.program)) {
			affinities.types.movie *= 0.5;
			program.weight = 0.0;
			programmed.push({
				movie: program.program
			});
		} else {
			const episode = program.program.next_episode;
			affinities.types.show *= 0.75;
			const subtitles = data.media.video.subtitles.filter((subtitle) => {
				return subtitle.episode_id === episode.episode_id;
			});
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
		}
	}
	return programmed;
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
	handleRequest
};
