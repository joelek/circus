import * as libreader from "./reader";

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

type Options = {
	eol: string
};

function readString(reader: libreader.Reader, expected: string): void {
	let string = reader.read(expected.length);
	if (string !== expected) {
		throw "Expected " + DQ + expected + DQ + " but read " + DQ + string + DQ + "!";
	}
}

function readBlank(reader: libreader.Reader): void {
	let line = reader.line();
	if (line !== "") {
		throw "Expected a blank line but read " + DQ + line + DQ + "!";
	}
}

function readTimecode(reader: libreader.Reader): number {
	let parts: RegExpExecArray | null = null;
	if ((parts = /^([0-9][0-9])[:]([0-5][0-9])[:]([0-5][0-9])[.]([0-9][0-9][0-9])$/.exec(reader.peek(12))) != null) {
		reader.read(12);
		let hours = parseInt(parts[1], 10);
		let minutes = parseInt(parts[2], 10);
		let seconds = parseInt(parts[3], 10);
		let milliseconds = parseInt(parts[4], 10);
		return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
	}
	if ((parts = /^([0-5][0-9])[:]([0-5][0-9])[.]([0-9][0-9][0-9])$/.exec(reader.peek(9))) != null) {
		reader.read(9);
		let hours = 0;
		let minutes = parseInt(parts[1], 10);
		let seconds = parseInt(parts[2], 10);
		let milliseconds = parseInt(parts[3], 10);
		return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
	}
	console.log("Expected a valid timecode!");
	return 0;
}

function serializeTimecode(ms: number): string {
	let s = Math.floor(ms / 1000);
	ms -= (s * 1000);
	let m = Math.floor(s / 60);
	s -= (m * 60);
	let h = Math.floor(m / 60);
	m -= (h * 60);
	let tch = `00${h}`.slice(-2);
	let tcm = `00${m}`.slice(-2);
	let tcs = `00${s}`.slice(-2);
	let tcms = `000${ms}`.slice(-3);
	return `${tch}:${tcm}:${tcs}.${tcms}`;
}

function readCue(reader: libreader.Reader): Cue {
	let start_ms = readTimecode(reader);
	readString(reader, " --> ");
	let end_ms = readTimecode(reader);
	readBlank(reader);
	let duration_ms = end_ms - start_ms;
	if (duration_ms < 0) {
		console.log("Expected a positive duration but read " + start_ms + " and " + end_ms + "!");
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

function serializeCue(cue: Cue, options: Options): string {
	let lines = new Array<string>();
	lines.push(serializeTimecode(cue.start_ms) + " --> " + serializeTimecode(cue.start_ms + cue.duration_ms));
	lines.push(...cue.lines);
	lines.push("");
	return lines.join(options.eol);
}

function readBody(reader: libreader.Reader): Body {
	let cues = new Array<Cue>();
	while (!reader.done()) {
		let cue = readCue(reader);
		cues.push(cue);
	}
	cues = cues.sort((one, two) => two.start_ms - one.start_ms);
	return {
		cues
	};
}

function serializeBody(body: Body, options: Options): string {
	let lines = new Array<string>();
	for (let cue of body.cues) {
		lines.push(serializeCue(cue, options));
	}
	return lines.join(options.eol);
}

function readHead(reader: libreader.Reader): Head {
	readString(reader, "WEBVTT");
	let metadata = reader.line();
	readBlank(reader);
	return {
		metadata
	};
}

function serializeHead(head: Head, options: Options): string {
	let lines = new Array<string>();
	lines.push("WEBVTT " + head.metadata);
	lines.push("");
	return lines.join(options.eol);
}

function readTrack(reader: libreader.Reader): Track {
	let head = readHead(reader);
	let body = readBody(reader);
	return {
		head,
		body
	};
}

function serializeTrack(track: Track, options: Options): string {
	let lines = new Array<string>();
	lines.push(serializeHead(track.head, options));
	lines.push(serializeBody(track.body, options));
	return lines.join(options.eol);
}

function decode(string: string): Track {
	let reader = new libreader.Reader(string);
	return readTrack(reader);
}

function encode(track: Track): string {
	return serializeTrack(track, {
		eol: "\r\n"
	});
}

export {
	Track,
	Options,
	decode,
	encode
};
