import * as libfs from "fs";
import * as is from "../is";
import * as vtt from "../vtt";
import * as schema from "./schema";

export function probe(fd: number): schema.Probe {
	let result: schema.Probe = {
		resources: []
	};
	let buffer = libfs.readFileSync(fd);
	let track = vtt.decode(buffer.toString());
	let cue = track.body.cues.pop();
	let duration_ms = is.present(cue) ? cue.start_ms + cue.duration_ms : 0;
	result.resources.push({
		type: "subtitle",
		duration_ms
	});
	return result;
};
