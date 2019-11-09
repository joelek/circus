import * as libreader from "./reader";
import * as libutils from "./utils";

const DQ = "\"";

type Cue = {
	start_ms: number;
	duration_ms: number;
	lines: Array<string>;
};

type Body = {
	cues: Array<Cue>;
};

type Head = {
	metadata: string;
};

type Track = {
	head: Head;
	body: Body;
};

function readString(reader: libreader.Reader, expected: string): void {
	let string = reader.read(expected.length);
	if (string !== expected) {
		throw new Error(libutils.join("Expected ", DQ, expected, DQ, " but read ", DQ, string, DQ, "!"));
	}
}

function readBlank(reader: libreader.Reader): void {
	let line = reader.line();
	if (line !== "") {
		throw new Error(libutils.join("Expected a blank line but read ", DQ, line, DQ, "!"));
	}
}

function readTimecode(reader: libreader.Reader): number {
	let string = reader.read(12);
	let parts = /^([0-9][0-9])[:]([0-5][0-9])[:]([0-5][0-9])[.]([0-9][0-9][0-9])$/.exec(string);
	if (parts === null) {
		throw new Error(libutils.join("Expected a valid timecode but read ", DQ, string, DQ, "!"));
	}
	let hours = parseInt(parts[1], 10);
	let minutes = parseInt(parts[2], 10);
	let seconds = parseInt(parts[3], 10);
	let milliseconds = parseInt(parts[4], 10);
	return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
}

function readCue(reader: libreader.Reader): Cue {
	let start_ms = readTimecode(reader);
	readString(reader, " --> ");
	let end_ms = readTimecode(reader);
	readBlank(reader);
	let duration_ms = end_ms - start_ms;
	if (duration_ms < 0) {
		throw new Error(libutils.join("Expected a positive duration but read ", start_ms, " and ", end_ms, "!"));
	}
	let lines = new Array<string>();
	while (true) {
		let line = reader.line();
		if (line === "") {
			break;
		}
		lines.push(line);
	}
	return {
		start_ms,
		duration_ms,
		lines
	};
}

function readBody(reader: libreader.Reader): Body {
	let cues = new Array<Cue>();
	while (!reader.done()) {
		let cue = readCue(reader);
		cues.push(cue);
	}
	return {
		cues
	};
}

function readHead(reader: libreader.Reader): Head {
	readString(reader, "WEBVTT ");
	let metadata = reader.line();
	readBlank(reader);
	return {
		metadata
	};
}

function readTrack(reader: libreader.Reader): Track {
	let head = readHead(reader);
	let body = readBody(reader);
	return {
		head,
		body
	};
}

export {
	Cue,
	Body,
	Head,
	Track,
	readTrack
};
