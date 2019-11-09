import * as libfs from 'fs';

const DQ = "\"";

function interpolate(...parameters: any): string {
	return parameters.map((parameter: any) => {
		return String(parameter);
	}).join("");
}

class Reader {
	private string: string;
	private offset: number;
	private length: number;

	constructor(string: string) {
		this.string = string;
		this.offset = 0;
		this.length = string.length;
	}

	done(): boolean {
		return (this.offset === this.length);
	}

	line(): string {
		let string = "";
		while (!this.done()) {
			let one = this.string[this.offset];
			this.offset += 1;
			if (false) {
			} else if (one === "\r") {
				if (!this.done()) {
					let two = this.string[this.offset];
					if (two === "\n") {
						this.offset += 1;
					}
				}
				break;
			} else if (one === "\n") {
				if (!this.done()) {
					let two = this.string[this.offset];
					if (two === "\r") {
						this.offset += 1;
					}
				}
				break;
			} else {
				string += one;
			}
		}
		return string;
	}

	peek(length: number): string {
		let min = Math.min(this.offset, this.offset + length);
		let max = Math.max(this.offset, this.offset + length);
		if ((min < 0) || (min >= this.length) || (max < 0) || (max >= this.length)) {
			throw new Error(interpolate("Unable to read between offsets ", min, " and ", max, "!", "Length is", this.length, "."));
		}
		return this.string.substring(min, max);
	}

	read(length: number): string {
		let string = this.peek(length);
		this.offset += length;
		return string;
	}
}

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

function readString(reader: Reader, expected: string): void {
	let string = reader.read(expected.length);
	if (string !== expected) {
		throw new Error(interpolate("Expected ", DQ, expected, DQ, " but read ", DQ, string, DQ, "!"));
	}
}

function readBlank(reader: Reader): void {
	let line = reader.line();
	if (line !== "") {
		throw new Error(interpolate("Expected a blank line but read ", DQ, line, DQ, "!"));
	}
}

function readTimecode(reader: Reader): number {
	let string = reader.read(12);
	let parts = /^([0-9][0-9])[:]([0-5][0-9])[:]([0-5][0-9])[.]([0-9][0-9][0-9])$/.exec(string);
	if (parts === null) {
		throw new Error(interpolate("Expected a valid timecode but read ", DQ, string, DQ, "!"));
	}
	let hours = parseInt(parts[1], 10);
	let minutes = parseInt(parts[2], 10);
	let seconds = parseInt(parts[3], 10);
	let milliseconds = parseInt(parts[4], 10);
	return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;
}

function readCue(reader: Reader): Cue {
	let start_ms = readTimecode(reader);
	readString(reader, " --> ");
	let end_ms = readTimecode(reader);
	readBlank(reader);
	let duration_ms = end_ms - start_ms;
	if (duration_ms < 0) {
		throw new Error(interpolate("Expected a positive duration but read ", start_ms, " and ", end_ms, "!"));
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

function readBody(reader: Reader): Body {
	let cues = new Array<Cue>();
	while (!reader.done()) {
		let cue = readCue(reader);
		cues.push(cue);
	}
	return {
		cues
	};
}

function readHead(reader: Reader): Head {
	readString(reader, "WEBVTT ");
	let metadata = reader.line();
	readBlank(reader);
	return {
		metadata
	};
}

function readTrack(reader: Reader): Track {
	let head = readHead(reader);
	let body = readBody(reader);
	return {
		head,
		body
	};
}







let strings = [
	'WEBVTT { "language": "swe", "count": 2 }',
	'',
	'00:00:52.280 --> 00:00:57.229',
	'line1',
	'line2',
	'',
	'00:00:57.320 --> 00:01:03.429',
	'line3',
	'line4'
];
let reader = new Reader(strings.join("\n"));
let track = readTrack(reader);
console.log(JSON.stringify(track, null, "\t"));
