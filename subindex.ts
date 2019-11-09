import * as libfs from "fs";
import * as libcrypto from "crypto";
import * as libvtt from "./vtt";
import * as libreader from "./reader";
import * as libdatabase from "./database";

let media = JSON.parse(libfs.readFileSync("./private/db/media.json", "utf8")) as libdatabase.MediaDatabase;
let file_index = new Map<string, libdatabase.FileEntry>();
media.files.forEach((file_entry) => {
	file_index.set(file_entry.file_id, file_entry);
});
media.video.cues = new Array<libdatabase.CueEntry>();
media.video.subtitles.forEach((subtitle_entry) => {
	let file_entry = file_index.get(subtitle_entry.file_id);
	if (file_entry === undefined) {
		return;
	}
	let string = libfs.readFileSync([ ".", ...file_entry.path ].join("/"), "utf8");
	let reader = new libreader.Reader(string);
	let track = libvtt.readTrack(reader);
	track.body.cues.forEach((cue) => {
		let hash = libcrypto.createHash("md5");
		hash.update(subtitle_entry.file_id);
		hash.update("" + cue.start_ms);
		let cue_id = hash.digest("hex");
		let subtitle_id = subtitle_entry.subtitle_id;
		let start_ms = cue.start_ms;
		let duration_ms = cue.duration_ms;
		let lines = cue.lines.slice();
		media.video.cues.push({
			cue_id,
			subtitle_id,
			start_ms,
			duration_ms,
			lines
		});
	});
});
libfs.writeFileSync("./private/db/media.json", JSON.stringify(media, null, "\t"), "utf8");
