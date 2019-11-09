type MovieEntry = {
	movie_id: string;
	file_id: string;
	title: string;
	year: number;
	duration: number;
};

type ShowEntry = {
	show_id: string;
	title: string;
};

type SeasonEntry = {
	season_id: string;
	show_id: string;
	number: number;
};

type EpisodeEntry = {
	episode_id: string;
	season_id: string;
	file_id: string;
	title: string;
	number: number;
	duration: number;
};

type SubtitleEntry = {
	subtitle_id: string;
	episode_id: string | null;
	movie_id: string | null;
	file_id: string;
};

type CueEntry = {
	cue_id: string;
	subtitle_id: string;
	start_ms: number;
	duration_ms: number;
	lines: Array<string>;
};

type FileEntry = {
	file_id: string,
	path: Array<string>;
	mime: string;
};

type MediaDatabase = {
	audio: {};
	video: {
		movies: Array<MovieEntry>;
		shows: Array<ShowEntry>;
		seasons: Array<SeasonEntry>;
		episodes: Array<EpisodeEntry>;
		subtitles: Array<SubtitleEntry>;
		cues: Array<CueEntry>;
	};
	files: Array<FileEntry>;
};

type SubtitlesDatabase = Map<string, Set<string>>;

export {
	MovieEntry,
	ShowEntry,
	SeasonEntry,
	EpisodeEntry,
	SubtitleEntry,
	CueEntry,
	FileEntry,
	MediaDatabase,
	SubtitlesDatabase
};
