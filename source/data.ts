/*
// Re-create cues from compact notation.
for (let subtitle of media.video.subtitle_contents) {
	let subtitle_id = subtitle.subtitle_id;
	for (let cue of subtitle.cues) {
		let start_ms = cue[0];
		let duration_ms = cue[1];
		let lines = cue[2].split("\n");
		let cue_id = libcrypto.createHash("md5")
			.update(subtitle_id)
			.update(`${start_ms}`)
			.digest("hex");
		media.video.cues.push({
			cue_id,
			subtitle_id,
			start_ms,
			duration_ms,
			lines
		});
	}
}
*/
