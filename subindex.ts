import * as libfs from "fs";
import * as libcrypto from "crypto";
import * as libvtt from "./vtt";
import * as libreader from "./reader";
import * as libdatabase from "./database";
import * as libutils from "./utils";

let media = JSON.parse(libfs.readFileSync("./private/db/media.json", "utf8")) as libdatabase.MediaDatabase;
let file_index = new Map<string, libdatabase.FileEntry>();
media.files.forEach((file_entry) => {
	file_index.set(file_entry.file_id, file_entry);
});
media.video.cues = new Array<libdatabase.CueEntry>();
media.video.subtitles.forEach((subtitle_entry) => {
	let file_entry = file_index.get(subtitle_entry.file_id);
	if (file_entry === undefined) {
		return;
	}
	let path = [ ".", ...file_entry.path ].join("/");
	console.log(path);
	let string = libfs.readFileSync(path, "utf8");
	let reader = new libreader.Reader(string);
	let track = libvtt.readTrack(reader);
	track.body.cues.forEach((cue) => {
		let hash = libcrypto.createHash("md5");
		hash.update(subtitle_entry.file_id);
		hash.update("" + cue.start_ms);
		let cue_id = hash.digest("hex");
		let subtitle_id = subtitle_entry.subtitle_id;
		let start_ms = cue.start_ms;
		let duration_ms = cue.duration_ms;
		let lines = cue.lines.slice();
		media.video.cues.push({
			cue_id,
			subtitle_id,
			start_ms,
			duration_ms,
			lines
		});
	});
});
libfs.writeFileSync("./private/db/media.json", JSON.stringify(media, null, "\t"), "utf8");
let cue_search_index = new Map<string, Set<string>>();
media.video.cues.forEach((cue_entry) => {
	cue_entry.lines.forEach((line) => {
		let terms = libutils.getSearchTerms(line);
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
