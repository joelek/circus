type Entry = {

};

type Index<T extends Entry> = {
	[id: string]: T | undefined;
};

type ArtistEntry = {
	artist_id: string;
	title: string;
};

type AlbumEntry = {
	album_id: string;
	title: string;
	year: number;
	cover_file_id: string | null;
};

type DiscEntry = {
	disc_id: string;
	album_id: string;
	number: number;
};

type TrackEntry = {
	track_id: string;
	disc_id: string;
	file_id: string;
	title: string;
	number: number;
	duration: number;
};

type AlbumArtistEntry = {
	album_id: string;
	artist_id: string;
};

type TrackArtistEntry = {
	track_id: string;
	artist_id: string;
};

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
	language: string | null;
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
	audio: {
		artists: Array<ArtistEntry>;
		albums: Array<AlbumEntry>;
		discs: Array<DiscEntry>;
		tracks: Array<TrackEntry>;
		album_artists: Array<AlbumArtistEntry>;
		track_artists: Array<TrackArtistEntry>;
	};
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

type UserEntry = {
	user_id: string;
	username: string;
	password: string;
};

type AudiolistItemEntry = {
	audiolist_id: string;
	track_id: string;
	number: number;
};

type AudiolistEntry = {
	audiolist_id: string;
	title: string;
};

type ListDatabase = {
	audiolists: Array<AudiolistEntry>;
	audiolist_items: Array<AudiolistItemEntry>;
};

export {
	Entry,
	Index,
	ArtistEntry,
	AlbumEntry,
	DiscEntry,
	TrackEntry,
	AlbumArtistEntry,
	TrackArtistEntry,
	MovieEntry,
	ShowEntry,
	SeasonEntry,
	EpisodeEntry,
	SubtitleEntry,
	CueEntry,
	FileEntry,
	MediaDatabase,
	SubtitlesDatabase,
	UserEntry,
	AudiolistItemEntry,
	AudiolistEntry,
	ListDatabase
};
