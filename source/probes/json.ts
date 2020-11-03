import * as libfs from "fs";
import * as schema from "./schema";

export function probe(fd: number): schema.Probe {
	let result: schema.Probe = {
		streams: []
	};
	let buffer = libfs.readFileSync(fd);
	let json = JSON.parse(buffer.toString());
	if (schema.Metadata.is(json)) {
		result.metadata = json;
	}
	return result;
};
