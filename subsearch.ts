import * as libfs from "fs";
import * as libcp from "child_process";
import * as libdatabase from "./database";
import * as libutils from "./utils";

function getSearchTerms(string: string): Array<string> {
	let clean = string.toLowerCase().replace(/[^a-z ]/g, "").replace(/[ ]+/g, " "); // IMPROVE
	let terms = clean.split(" ").filter((word) => word.length >= 4);
	return terms;
}

// Index subtitles on words.
let media = JSON.parse(libfs.readFileSync("./private/db/media.json", "utf8")) as libdatabase.MediaDatabase;
let cue_search_index = new Map<string, Set<string>>();
media.video.cues.forEach((cue_entry) => {
	cue_entry.lines.forEach((line) => {
		let terms = getSearchTerms(line);
		terms.forEach((term) => {
			let cues = cue_search_index.get(term);
			if (cues === undefined) {
				cues = new Set<string>();
				cue_search_index.set(term, cues);
			}
			cues.add(cue_entry.cue_id);
		});
	});
});
libfs.writeFileSync("./private/db/subtitles.json", JSON.stringify(cue_search_index, (key, value) => {
	if (false) {
	} else if (value instanceof Map) {
		return Array.from(value).reduce((object, [key, value]) => {
			// @ts-ignore
			object[key] = value;
			return object;
		}, {});
	} else if (value instanceof Set) {
		return Array.from(value).reduce((object, value) => {
			// @ts-ignore
			object.push(value);
			return object;
		}, []);
	} else {
		return value;
	}
}, "\t"));

// Search
let query = process.argv[2];
let terms = getSearchTerms(query);
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
	let file_media = media.files.find((file) => file.file_id === subtitle.file_id) as libdatabase.FileEntry;
	let episode: libdatabase.EpisodeEntry | null = null;
	let file: libdatabase.FileEntry | null = null;
	if (subtitle.episode_id !== null) {
		episode = media.video.episodes.find((episode) => episode.episode_id === subtitle.episode_id) as libdatabase.EpisodeEntry;
		file = media.files.find((file) => file.file_id === (episode as libdatabase.EpisodeEntry).file_id) as libdatabase.FileEntry;
	}
	let movie: libdatabase.MovieEntry | null = null;
	if (subtitle.movie_id !== null) {
		movie = media.video.movies.find((movie) => movie.movie_id === subtitle.movie_id) as libdatabase.MovieEntry;
		file = media.files.find((file) => file.file_id === (movie as libdatabase.MovieEntry).file_id) as libdatabase.FileEntry;
	}
	process.stderr.write(JSON.stringify({
		cue,
		subtitle,
		file,
		episode,
		movie
	}, null, "\t"));
	let cp = libcp.spawn("ffmpeg", [
		"-ss", libutils.formatTimestamp(cue.start_ms),
		"-t", libutils.formatTimestamp(cue.duration_ms),
		"-i", [ ".", ...(file as libdatabase.FileEntry).path ].join("/"),
		"-vf", libutils.join("subtitles=", [ ".", ...(file_media as libdatabase.FileEntry).path ].join("/")),
		"test.gif",
		"-y"
	]);
	process.stdin.pipe(cp.stdin);
	cp.stdout.pipe(process.stdout);
	cp.stderr.pipe(process.stderr);
	cp.on("exit", () => {
		process.exit();
	});
};
//palettegen
