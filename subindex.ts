import * as libfs from "fs";
import * as libvtt from "./vtt";
import * as libreader from "./reader";

type MovieEntry = {
	movie_id: string;
	file_id: string;
	title: string;
	year: number;
	duration: number;
};

type ShowEntry = {
	show_id: string;
	title: string;
};

type SeasonEntry = {
	season_id: string;
	show_id: string;
	number: number;
};

type EpisodeEntry = {
	episode_id: string;
	season_id: string;
	file_id: string;
	title: string;
	number: number;
	duration: number;
};

type LinkEntry = {
	episode_id: string | null;
	movie_id: string | null;
	file_id: string;
};

type FileEntry = {
	file_id: string,
	path: Array<string>;
	mime: string;
};

type MediaDatabase = {
	audio: {};
	video: {
		movies: Array<MovieEntry>;
		shows: Array<ShowEntry>;
		seasons: Array<SeasonEntry>;
		episodes: Array<EpisodeEntry>;
		subtitles: Array<LinkEntry>;
	};
	files: Array<FileEntry>;
};

type SubtitleEntry = {
	episode_id: string | null;
	movie_id: string | null;
	offset_ms: number;
	duration_ms: number;
};

type SubtitleDatabase = {
	words: Map<string, Set<string>>;
};

let subtitles = {
	words: new Map<string, Set<string>>()
};
let media = JSON.parse(require("./private/db/media.json")) as MediaDatabase;
let file_index = new Map<string, FileEntry>();
media.files.forEach((file_entry) => {
	file_index.set(file_entry.file_id, file_entry);
});
media.video.subtitles.forEach((link_entry) => {
	let file_entry = file_index.get(link_entry.file_id);
	if (file_entry === undefined) {
		return;
	}
	let string = libfs.readFileSync([ ".", ...file_entry.path ].join("/"), { encoding: "utf8" });
	let reader = new libreader.Reader(string);
	let track = libvtt.readTrack(reader);
	track.body.cues.forEach((cue) => {
		cue.lines.forEach((line) => {
			let clean = line.toLowerCase().replace(/[^a-z ]/g, "").replace(/[ ]+/g, " ");
			let words = clean.split(" ");
			words.forEach((word) => {
				let words = subtitles.words.get(word);
				if (words === undefined) {
					words = new Set<string>();
					subtitles.words.set(word, words);
				}
				words.add((file_entry as FileEntry).file_id); // TSBUG
			});
		});
	});
});
