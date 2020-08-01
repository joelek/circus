function join(...parameters: any): string {
	return parameters.map((parameter: any) => {
		return String(parameter);
	}).join("");
}

function getSearchTerms(string: string): Array<string> {
	let normalized = string;
	normalized = normalized.toLowerCase();
	normalized = normalized.normalize("NFC");
	return Array.from(normalized.match(/(\p{L}+|\p{N}+)/gu) || []);
}

function formatSeasonEpisode(season: number, episode: number): string {
	return "s" + ("00" + season).slice(-2) + "e" + ("00" + episode).slice(-2);
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

type Index<A> = { [key: string]: A | undefined };

export {
	join,
	getSearchTerms,
	formatSeasonEpisode,
	formatTimestamp,
	Index
};
