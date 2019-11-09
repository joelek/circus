import * as libfs from "fs";
import * as libcrypto from "crypto";
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

type CueEntry = {
	cue_id: string;
	link_entry: LinkEntry;
	cue: libvtt.Cue;
};

type SubtitleDatabase = {
	cues: Array<CueEntry>;
	words: Map<string, Set<string>>;
};

let cue_index = new Map<string, CueEntry>();
let subtitles = {
	cues: new Array<CueEntry>(),
	words: new Map<string, Set<string>>()
};
function getCueEntry(link_entry: LinkEntry, cue: libvtt.Cue): CueEntry {
	let hash = libcrypto.createHash("md5");
	hash.update(link_entry.file_id);
	hash.update("" + cue.start_ms);
	let cue_id = hash.digest("hex");
	let cue_entry = cue_index.get(cue_id);
	if (cue_entry !== undefined) {
		return cue_entry;
	}
	cue_entry = {
		cue_id,
		link_entry,
		cue
	};
	cue_index.set(cue_id, cue_entry);
	subtitles.cues.push(cue_entry);
	return cue_entry;
}
let media = JSON.parse(libfs.readFileSync("./private/db/media.json", { encoding: "utf8" })) as MediaDatabase;
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
		let cue_entry = getCueEntry(link_entry, cue);
		cue.lines.forEach((line) => {
			let clean = line.toLowerCase().replace(/[^a-z ]/g, "").replace(/[ ]+/g, " ");
			let words = clean.split(" ").filter((word) => word.length >= 4);
			words.forEach((word) => {
				let words = subtitles.words.get(word);
				if (words === undefined) {
					words = new Set<string>();
					subtitles.words.set(word, words);
				}
				words.add(cue_entry.cue_id);
			});
		});
	});
});
libfs.writeFileSync("./private/db/subtitles.json", JSON.stringify(subtitles, (key, value) => {
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
