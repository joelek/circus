import * as autoguard from "@joelek/autoguard";
import * as libfs from "fs";
import * as is from "../../is";
import * as vtt from "../vtt/vtt";
import * as schema from "./schema";

export function probe(fd: number): schema.Probe {
	let result: schema.Probe = {
		resources: []
	};
	let buffer = libfs.readFileSync(fd);
	let track = vtt.decode(buffer.toString());
	let cues = track.body.cues;
	let cue = cues.length > 0 ? cues[cues.length - 1] : undefined;
	let duration_ms = is.present(cue) ? cue.start_ms + cue.duration_ms : 0;
	let language: string | undefined;
	try {
		let json = JSON.parse(track.head.metadata);
		language = autoguard.guards.String.as(json.language);
	} catch (error) {}
	result.resources.push({
		type: "subtitle",
		duration_ms,
		language,
		cues
	});
	return result;
};
