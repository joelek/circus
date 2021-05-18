import * as is from "./is";
import { Show } from "./api/schema/objects";

function join(...parameters: any): string {
	return parameters.map((parameter: any) => {
		return String(parameter);
	}).join("");
}

function formatTimestamp(ms: number): string {
	let s = Math.floor(ms / 1000);
	ms -= (s * 1000);
	let m = Math.floor(s / 60);
	s -= (m * 60);
	let h = Math.floor(m / 60);
	m -= (h * 60);
	let fh = join("00", h).slice(-2);
	let fm = join("00", m).slice(-2);
	let fs = join("00", s).slice(-2);
	let fms = join("000", ms).slice(-3);
	return join(fh, ":", fm, ":", fs, ".", fms);
}

function getNextEpisode(show: Show): undefined | { seasonIndex: number, episodeIndex: number } {
	let indices: undefined | {
		seasonIndex: number,
		episodeIndex: number;
	};
	show.seasons.forEach((season, seasonIndex) => {
		season.episodes.forEach((episode, episodeIndex) => {
			if (is.present(episode.last_stream_date)) {
				if (is.present(indices)) {
					if (episode.last_stream_date < (show.seasons[indices.seasonIndex].episodes[indices.episodeIndex].last_stream_date ?? 0)) {
						return;
					}
				}
				indices = {
					seasonIndex,
					episodeIndex
				};
			}
		});
	});
	if (is.present(indices)) {
		indices.episodeIndex += 1;
		if (indices.episodeIndex === show.seasons[indices.seasonIndex].episodes.length) {
			indices.episodeIndex = 0;
			indices.seasonIndex += 1;
			if (indices.seasonIndex === show.seasons.length) {
				indices.seasonIndex = 0;
			}
		}
	} else {
		if (show.seasons.length > 0 && show.seasons[0].episodes.length > 0) {
			indices = {
				seasonIndex: 0,
				episodeIndex: 0
			};
		}
	}
	return indices;
}

export {
	join,
	formatTimestamp,
	getNextEpisode
};
