import * as libvtt from "./vtt";
import * as libreader from "./reader";





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
let reader = new libreader.Reader(strings.join("\n"));
let track = libvtt.readTrack(reader);
console.log(JSON.stringify(track, null, "\t"));
