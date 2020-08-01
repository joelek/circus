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

function getIndex(): Map<string, Set<string>> {
	let media = JSON.parse($fs.readFileSync("./private/db/media.json", "utf8")) as $database.MediaDatabase;
	let index = new Map<string, Set<string>>();
	for (let subtitle of media.video.subtitles) {
		for (let cue of subtitle.cues) {
			let cue_id = getCueId(subtitle, cue);
			for (let line of cue[2].split("\n")) {
				let terms = $utils.getSearchTerms(line).filter((term) => term.length >= 4);
				for (let term of terms) {
					let cues = index.get(term);
					if (cues === undefined) {
						cues = new Set<string>();
						index.set(term, cues);
					}
					cues.add(cue_id);
				}
			}
		}
	}
	return index;
}

function convertToJSON(index: Map<string, Set<string>>): { [key: string]: string[] | undefined } {
	let json: { [key: string]: string[] | undefined } = {};
	for (let [key, value] of index) {
		let array = Array.from(value);
		if (array.length > 1) {
			json[key] = array;
		}
	}
	return json;
}

function run(): void {
	let json = convertToJSON(getIndex());
	$fs.writeFileSync("./private/db/subtitles.json", JSON.stringify(json, null, "\t"));
}

run();
