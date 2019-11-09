import * as libfs from "fs";
import * as libdatabase from "./database";

function getSearchTerms(string: string): Array<string> {
	let clean = string.toLowerCase().replace(/[^a-z ]/g, "").replace(/[ ]+/g, " "); // IMPROVE
	let terms = clean.split(" ").filter((word) => word.length >= 3);
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
console.log(cue_ids.map((cue_id) => {
	return media.video.cues.find((cue) => cue.cue_id === cue_id);
}));
