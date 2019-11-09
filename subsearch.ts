import * as libfs from "fs";
import * as libcp from "child_process";
import * as libdatabase from "./database";
import * as libutils from "./utils";

let media = JSON.parse(libfs.readFileSync("./private/db/media.json", "utf8")) as libdatabase.MediaDatabase;
let cue_search_index = JSON.parse(libfs.readFileSync("./private/db/subtitles.json", "utf8"), (key, value) => {
	if (value instanceof Array) {
		return new Set<string>(value);
	}
	if (value instanceof Object) {
		return new Map<string, Set<string>>(Object.keys(value).map(k => [k, value[k]]));
	}
	return value;
}) as libdatabase.SubtitlesDatabase;
let query = process.argv[2];
let terms = libutils.getSearchTerms(query);
let cue_id_sets = terms.map((term) => {
	let cues = cue_search_index.get(term);
	if (cues !== undefined) {
		return cues;
	} else {
		return new Set<string>();
	}
}).filter((cues) => cues.size > 0);
let cue_ids = new Array<string>();
if (cue_id_sets.length > 0) {
	cue_id_sets[0].forEach((cue_id) => {
		for (let i = 1; i < cue_id_sets.length; i++) {
			if (!cue_id_sets[i].has(cue_id)) {
				return;
			}
		}
		cue_ids.push(cue_id);
	});
}
if (cue_ids.length > 0) {
	let cue_id = cue_ids[0];
	let cue = media.video.cues.find((cue) => cue.cue_id === cue_id) as libdatabase.CueEntry;
	let subtitle = media.video.subtitles.find((subtitle) => subtitle.subtitle_id === cue.subtitle_id) as libdatabase.SubtitleEntry;
	let file_subtitle = media.files.find((file) => file.file_id === subtitle.file_id) as libdatabase.FileEntry;
	let episode: libdatabase.EpisodeEntry | null = null;
	let file_media: libdatabase.FileEntry | null = null;
	if (subtitle.episode_id !== null) {
		episode = media.video.episodes.find((episode) => episode.episode_id === subtitle.episode_id) as libdatabase.EpisodeEntry;
		file_media = media.files.find((file) => file.file_id === (episode as libdatabase.EpisodeEntry).file_id) as libdatabase.FileEntry;
	}
	let movie: libdatabase.MovieEntry | null = null;
	if (subtitle.movie_id !== null) {
		movie = media.video.movies.find((movie) => movie.movie_id === subtitle.movie_id) as libdatabase.MovieEntry;
		file_media = media.files.find((file) => file.file_id === (movie as libdatabase.MovieEntry).file_id) as libdatabase.FileEntry;
	}
	let cp = libcp.spawn("ffmpeg", [
		"-ss", libutils.formatTimestamp(cue.start_ms),
		"-t", libutils.formatTimestamp(cue.duration_ms),
		"-i", [ ".", ...(file_subtitle as libdatabase.FileEntry).path ].join("/"),
		"./private/temp/subtitle.vtt",
		"-y"
	]);
	process.stdin.pipe(cp.stdin);
	cp.stdout.pipe(process.stdout);
	cp.stderr.pipe(process.stderr);
	cp.on("exit", () => {
		let cp = libcp.spawn("ffmpeg", [
			"-ss", libutils.formatTimestamp(cue.start_ms),
			"-t", libutils.formatTimestamp(cue.duration_ms),
			"-i", [ ".", ...(file_media as libdatabase.FileEntry).path ].join("/"),
			"-vf", "fps=10,subtitles=./private/temp/subtitle.vtt:force_style='Bold=1,Fontsize=32,Outline=2',scale=320:-1,palettegen",
			"./private/temp/palette.png",
			"-y"
		]);
		process.stdin.pipe(cp.stdin);
		cp.stdout.pipe(process.stdout);
		cp.stderr.pipe(process.stderr);
		cp.on("exit", () => {
			let cp = libcp.spawn("ffmpeg", [
				"-ss", libutils.formatTimestamp(cue.start_ms),
				"-t", libutils.formatTimestamp(cue.duration_ms),
				"-i", [ ".", ...(file_media as libdatabase.FileEntry).path ].join("/"),
				"-i", "./private/temp/palette.png",
				"-filter_complex", "fps=10,subtitles=./private/temp/subtitle.vtt:force_style='Bold=1,Fontsize=32,Outline=2',scale=320:-1[x];[x][1:v]paletteuse",
				"./private/temp/meme.gif",
				"-y"
			]);
			process.stdin.pipe(cp.stdin);
			cp.stdout.pipe(process.stdout);
			cp.stderr.pipe(process.stderr);
			cp.on("exit", () => {
				process.exit();
			});
		});
	});
};
