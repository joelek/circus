#!/usr/bin/env node

import * as $crypto from "crypto";
import * as $fs from "fs";
import * as $database from "./database";
import * as $utils from "./utils";

function getCueId(subtitle: $database.SubtitleEntry, cue: [number, number, string]): string {
	let hash = $crypto.createHash("md5");
	hash.update(subtitle.file_id);
	hash.update("" + cue[0]);
	let cue_id = hash.digest("hex");
	return cue_id;
}

function run(): void {
	let media = JSON.parse($fs.readFileSync("./private/db/media.json", "utf8")) as $database.MediaDatabase;
	let index: { [key: string]: string[] | undefined } = {};
	for (let subtitle of media.video.subtitles) {
		for (let cue of subtitle.cues) {
			let cue_id = getCueId(subtitle, cue);
			for (let line of cue[2].split("\n")) {
				let terms = $utils.getSearchTerms(line);
				for (let term of terms) {
					let cues = index[term];
					if (cues === undefined) {
						cues = [];
						index[term] = cues;
					}
					cues.push(cue_id);
				}
			}
		}
	}
	for (let key in index) {
		let set = new Set<string>(index[key]);
		let array = new Array(...set);
		if (array.length > 1) {
			index[key] = array;
		} else {
			delete index[key];
		}
	}
	$fs.writeFileSync("./private/db/subtitles.json", JSON.stringify(index, null, "\t"));
}

run();
