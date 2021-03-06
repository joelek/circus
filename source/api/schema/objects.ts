// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import { AudioFile } from "../../database/schema";
import { ImageFile } from "../../database/schema";
import { SubtitleFile } from "../../database/schema";
import { VideoFile } from "../../database/schema";
import { guards as autoguard } from "@joelek/ts-autoguard";

export type ActorBase = {
	"actor_id": string,
	"name": string
};

export const ActorBase = autoguard.Object.of<ActorBase>({
	"actor_id": autoguard.String,
	"name": autoguard.String
});

export type Actor = ActorBase & {};

export const Actor = autoguard.Intersection.of(
	autoguard.Reference.of<ActorBase>(() => ActorBase),
	autoguard.Object.of<{}>({})
);

export type ArtistBase = {
	"artist_id": string,
	"title": string
};

export const ArtistBase = autoguard.Object.of<ArtistBase>({
	"artist_id": autoguard.String,
	"title": autoguard.String
});

export type Artist = ArtistBase & {
	"albums": Album[]
};

export const Artist = autoguard.Intersection.of(
	autoguard.Reference.of<ArtistBase>(() => ArtistBase),
	autoguard.Object.of<{
		"albums": Album[]
	}>({
		"albums": autoguard.Array.of(autoguard.Reference.of<Album>(() => Album))
	})
);

export type AlbumBase = {
	"album_id": string,
	"title": string,
	"artwork": ImageFile[]
};

export const AlbumBase = autoguard.Object.of<AlbumBase>({
	"album_id": autoguard.String,
	"title": autoguard.String,
	"artwork": autoguard.Array.of(autoguard.Reference.of<ImageFile>(() => ImageFile))
});

export type Album = AlbumBase & {
	"artists": ArtistBase[],
	"discs": Disc[],
	"year"?: number
};

export const Album = autoguard.Intersection.of(
	autoguard.Reference.of<AlbumBase>(() => AlbumBase),
	autoguard.Object.of<{
		"artists": ArtistBase[],
		"discs": Disc[],
		"year"?: number
	}>({
		"artists": autoguard.Array.of(autoguard.Reference.of<ArtistBase>(() => ArtistBase)),
		"discs": autoguard.Array.of(autoguard.Reference.of<Disc>(() => Disc)),
		"year": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.Number
		)
	})
);

export type DiscBase = {
	"disc_id": string,
	"album": AlbumBase,
	"number": number
};

export const DiscBase = autoguard.Object.of<DiscBase>({
	"disc_id": autoguard.String,
	"album": autoguard.Reference.of<AlbumBase>(() => AlbumBase),
	"number": autoguard.Number
});

export type Disc = DiscBase & {
	"tracks": Track[]
};

export const Disc = autoguard.Intersection.of(
	autoguard.Reference.of<DiscBase>(() => DiscBase),
	autoguard.Object.of<{
		"tracks": Track[]
	}>({
		"tracks": autoguard.Array.of(autoguard.Reference.of<Track>(() => Track))
	})
);

export type TrackBase = {
	"track_id": string,
	"title": string,
	"disc": DiscBase,
	"number": number
};

export const TrackBase = autoguard.Object.of<TrackBase>({
	"track_id": autoguard.String,
	"title": autoguard.String,
	"disc": autoguard.Reference.of<DiscBase>(() => DiscBase),
	"number": autoguard.Number
});

export type Track = TrackBase & {
	"artists": ArtistBase[],
	"last_stream_date"?: number,
	"media": AudioFile
};

export const Track = autoguard.Intersection.of(
	autoguard.Reference.of<TrackBase>(() => TrackBase),
	autoguard.Object.of<{
		"artists": ArtistBase[],
		"last_stream_date"?: number,
		"media": AudioFile
	}>({
		"artists": autoguard.Array.of(autoguard.Reference.of<ArtistBase>(() => ArtistBase)),
		"last_stream_date": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.Number
		),
		"media": autoguard.Reference.of<AudioFile>(() => AudioFile)
	})
);

export type UserBase = {
	"user_id": string,
	"name": string,
	"username": string
};

export const UserBase = autoguard.Object.of<UserBase>({
	"user_id": autoguard.String,
	"name": autoguard.String,
	"username": autoguard.String
});

export type User = UserBase & {};

export const User = autoguard.Intersection.of(
	autoguard.Reference.of<UserBase>(() => UserBase),
	autoguard.Object.of<{}>({})
);

export type PlaylistBase = {
	"playlist_id": string,
	"title": string,
	"description": string,
	"user": UserBase
};

export const PlaylistBase = autoguard.Object.of<PlaylistBase>({
	"playlist_id": autoguard.String,
	"title": autoguard.String,
	"description": autoguard.String,
	"user": autoguard.Reference.of<UserBase>(() => UserBase)
});

export type Playlist = PlaylistBase & {
	"items": PlaylistItem[]
};

export const Playlist = autoguard.Intersection.of(
	autoguard.Reference.of<PlaylistBase>(() => PlaylistBase),
	autoguard.Object.of<{
		"items": PlaylistItem[]
	}>({
		"items": autoguard.Array.of(autoguard.Reference.of<PlaylistItem>(() => PlaylistItem))
	})
);

export type PlaylistItemBase = {
	"playlist_item_id": string,
	"number": number,
	"playlist": PlaylistBase,
	"track": Track
};

export const PlaylistItemBase = autoguard.Object.of<PlaylistItemBase>({
	"playlist_item_id": autoguard.String,
	"number": autoguard.Number,
	"playlist": autoguard.Reference.of<PlaylistBase>(() => PlaylistBase),
	"track": autoguard.Reference.of<Track>(() => Track)
});

export type PlaylistItem = PlaylistItemBase & {};

export const PlaylistItem = autoguard.Intersection.of(
	autoguard.Reference.of<PlaylistItemBase>(() => PlaylistItemBase),
	autoguard.Object.of<{}>({})
);

export type GenreBase = {
	"genre_id": string,
	"title": string
};

export const GenreBase = autoguard.Object.of<GenreBase>({
	"genre_id": autoguard.String,
	"title": autoguard.String
});

export type Genre = GenreBase & {};

export const Genre = autoguard.Intersection.of(
	autoguard.Reference.of<GenreBase>(() => GenreBase),
	autoguard.Object.of<{}>({})
);

export type MovieBase = {
	"movie_id": string,
	"title": string,
	"artwork": ImageFile[]
};

export const MovieBase = autoguard.Object.of<MovieBase>({
	"movie_id": autoguard.String,
	"title": autoguard.String,
	"artwork": autoguard.Array.of(autoguard.Reference.of<ImageFile>(() => ImageFile))
});

export type Movie = MovieBase & {
	"year"?: number,
	"summary"?: string,
	"genres": Genre[],
	"actors": Actor[],
	"last_stream_date"?: number,
	"media": VideoFile,
	"subtitles": SubtitleFile[]
};

export const Movie = autoguard.Intersection.of(
	autoguard.Reference.of<MovieBase>(() => MovieBase),
	autoguard.Object.of<{
		"year"?: number,
		"summary"?: string,
		"genres": Genre[],
		"actors": Actor[],
		"last_stream_date"?: number,
		"media": VideoFile,
		"subtitles": SubtitleFile[]
	}>({
		"year": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.Number
		),
		"summary": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.String
		),
		"genres": autoguard.Array.of(autoguard.Reference.of<Genre>(() => Genre)),
		"actors": autoguard.Array.of(autoguard.Reference.of<Actor>(() => Actor)),
		"last_stream_date": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.Number
		),
		"media": autoguard.Reference.of<VideoFile>(() => VideoFile),
		"subtitles": autoguard.Array.of(autoguard.Reference.of<SubtitleFile>(() => SubtitleFile))
	})
);

export type ShowBase = {
	"show_id": string,
	"title": string,
	"artwork": ImageFile[]
};

export const ShowBase = autoguard.Object.of<ShowBase>({
	"show_id": autoguard.String,
	"title": autoguard.String,
	"artwork": autoguard.Array.of(autoguard.Reference.of<ImageFile>(() => ImageFile))
});

export type Show = ShowBase & {
	"summary"?: string,
	"genres": Genre[],
	"actors": Actor[],
	"seasons": Season[]
};

export const Show = autoguard.Intersection.of(
	autoguard.Reference.of<ShowBase>(() => ShowBase),
	autoguard.Object.of<{
		"summary"?: string,
		"genres": Genre[],
		"actors": Actor[],
		"seasons": Season[]
	}>({
		"summary": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.String
		),
		"genres": autoguard.Array.of(autoguard.Reference.of<Genre>(() => Genre)),
		"actors": autoguard.Array.of(autoguard.Reference.of<Actor>(() => Actor)),
		"seasons": autoguard.Array.of(autoguard.Reference.of<Season>(() => Season))
	})
);

export type SeasonBase = {
	"season_id": string,
	"number": number,
	"show": ShowBase
};

export const SeasonBase = autoguard.Object.of<SeasonBase>({
	"season_id": autoguard.String,
	"number": autoguard.Number,
	"show": autoguard.Reference.of<ShowBase>(() => ShowBase)
});

export type Season = SeasonBase & {
	"episodes": Episode[]
};

export const Season = autoguard.Intersection.of(
	autoguard.Reference.of<SeasonBase>(() => SeasonBase),
	autoguard.Object.of<{
		"episodes": Episode[]
	}>({
		"episodes": autoguard.Array.of(autoguard.Reference.of<Episode>(() => Episode))
	})
);

export type EpisodeBase = {
	"episode_id": string,
	"title": string,
	"number": number,
	"season": SeasonBase
};

export const EpisodeBase = autoguard.Object.of<EpisodeBase>({
	"episode_id": autoguard.String,
	"title": autoguard.String,
	"number": autoguard.Number,
	"season": autoguard.Reference.of<SeasonBase>(() => SeasonBase)
});

export type Episode = EpisodeBase & {
	"year"?: number,
	"summary"?: string,
	"last_stream_date"?: number,
	"media": VideoFile,
	"subtitles": SubtitleFile[]
};

export const Episode = autoguard.Intersection.of(
	autoguard.Reference.of<EpisodeBase>(() => EpisodeBase),
	autoguard.Object.of<{
		"year"?: number,
		"summary"?: string,
		"last_stream_date"?: number,
		"media": VideoFile,
		"subtitles": SubtitleFile[]
	}>({
		"year": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.Number
		),
		"summary": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.String
		),
		"last_stream_date": autoguard.Union.of(
			autoguard.Undefined,
			autoguard.Number
		),
		"media": autoguard.Reference.of<VideoFile>(() => VideoFile),
		"subtitles": autoguard.Array.of(autoguard.Reference.of<SubtitleFile>(() => SubtitleFile))
	})
);

export type SubtitleBase = {
	"subtitle_id": string,
	"subtitle": SubtitleFile
};

export const SubtitleBase = autoguard.Object.of<SubtitleBase>({
	"subtitle_id": autoguard.String,
	"subtitle": autoguard.Reference.of<SubtitleFile>(() => SubtitleFile)
});

export type Subtitle = SubtitleBase & {
	"cues": Cue[]
};

export const Subtitle = autoguard.Intersection.of(
	autoguard.Reference.of<SubtitleBase>(() => SubtitleBase),
	autoguard.Object.of<{
		"cues": Cue[]
	}>({
		"cues": autoguard.Array.of(autoguard.Reference.of<Cue>(() => Cue))
	})
);

export type CueBase = {
	"cue_id": string,
	"subtitle": SubtitleBase,
	"start_ms": number,
	"duration_ms": number,
	"lines": string[]
};

export const CueBase = autoguard.Object.of<CueBase>({
	"cue_id": autoguard.String,
	"subtitle": autoguard.Reference.of<SubtitleBase>(() => SubtitleBase),
	"start_ms": autoguard.Number,
	"duration_ms": autoguard.Number,
	"lines": autoguard.Array.of(autoguard.String)
});

export type Cue = CueBase & {
	"media": Episode | Movie
};

export const Cue = autoguard.Intersection.of(
	autoguard.Reference.of<CueBase>(() => CueBase),
	autoguard.Object.of<{
		"media": Episode | Movie
	}>({
		"media": autoguard.Union.of(
			autoguard.Reference.of<Episode>(() => Episode),
			autoguard.Reference.of<Movie>(() => Movie)
		)
	})
);

export type YearBase = {
	"year_id": string,
	"year": number
};

export const YearBase = autoguard.Object.of<YearBase>({
	"year_id": autoguard.String,
	"year": autoguard.Number
});

export type Year = YearBase & {};

export const Year = autoguard.Intersection.of(
	autoguard.Reference.of<YearBase>(() => YearBase),
	autoguard.Object.of<{}>({})
);

export type EntityBase = ActorBase | AlbumBase | ArtistBase | CueBase | DiscBase | EpisodeBase | GenreBase | MovieBase | PlaylistBase | SeasonBase | ShowBase | TrackBase | UserBase | YearBase;

export const EntityBase = autoguard.Union.of(
	autoguard.Reference.of<ActorBase>(() => ActorBase),
	autoguard.Reference.of<AlbumBase>(() => AlbumBase),
	autoguard.Reference.of<ArtistBase>(() => ArtistBase),
	autoguard.Reference.of<CueBase>(() => CueBase),
	autoguard.Reference.of<DiscBase>(() => DiscBase),
	autoguard.Reference.of<EpisodeBase>(() => EpisodeBase),
	autoguard.Reference.of<GenreBase>(() => GenreBase),
	autoguard.Reference.of<MovieBase>(() => MovieBase),
	autoguard.Reference.of<PlaylistBase>(() => PlaylistBase),
	autoguard.Reference.of<SeasonBase>(() => SeasonBase),
	autoguard.Reference.of<ShowBase>(() => ShowBase),
	autoguard.Reference.of<TrackBase>(() => TrackBase),
	autoguard.Reference.of<UserBase>(() => UserBase),
	autoguard.Reference.of<YearBase>(() => YearBase)
);

export type Entity = Actor | Album | Artist | Cue | Disc | Episode | Genre | Movie | Playlist | Season | Show | Track | User | Year;

export const Entity = autoguard.Union.of(
	autoguard.Reference.of<Actor>(() => Actor),
	autoguard.Reference.of<Album>(() => Album),
	autoguard.Reference.of<Artist>(() => Artist),
	autoguard.Reference.of<Cue>(() => Cue),
	autoguard.Reference.of<Disc>(() => Disc),
	autoguard.Reference.of<Episode>(() => Episode),
	autoguard.Reference.of<Genre>(() => Genre),
	autoguard.Reference.of<Movie>(() => Movie),
	autoguard.Reference.of<Playlist>(() => Playlist),
	autoguard.Reference.of<Season>(() => Season),
	autoguard.Reference.of<Show>(() => Show),
	autoguard.Reference.of<Track>(() => Track),
	autoguard.Reference.of<User>(() => User),
	autoguard.Reference.of<Year>(() => Year)
);

export type Autoguard = {
	"ActorBase": ActorBase,
	"Actor": Actor,
	"ArtistBase": ArtistBase,
	"Artist": Artist,
	"AlbumBase": AlbumBase,
	"Album": Album,
	"DiscBase": DiscBase,
	"Disc": Disc,
	"TrackBase": TrackBase,
	"Track": Track,
	"UserBase": UserBase,
	"User": User,
	"PlaylistBase": PlaylistBase,
	"Playlist": Playlist,
	"PlaylistItemBase": PlaylistItemBase,
	"PlaylistItem": PlaylistItem,
	"GenreBase": GenreBase,
	"Genre": Genre,
	"MovieBase": MovieBase,
	"Movie": Movie,
	"ShowBase": ShowBase,
	"Show": Show,
	"SeasonBase": SeasonBase,
	"Season": Season,
	"EpisodeBase": EpisodeBase,
	"Episode": Episode,
	"SubtitleBase": SubtitleBase,
	"Subtitle": Subtitle,
	"CueBase": CueBase,
	"Cue": Cue,
	"YearBase": YearBase,
	"Year": Year,
	"EntityBase": EntityBase,
	"Entity": Entity
};

export const Autoguard = {
	"ActorBase": ActorBase,
	"Actor": Actor,
	"ArtistBase": ArtistBase,
	"Artist": Artist,
	"AlbumBase": AlbumBase,
	"Album": Album,
	"DiscBase": DiscBase,
	"Disc": Disc,
	"TrackBase": TrackBase,
	"Track": Track,
	"UserBase": UserBase,
	"User": User,
	"PlaylistBase": PlaylistBase,
	"Playlist": Playlist,
	"PlaylistItemBase": PlaylistItemBase,
	"PlaylistItem": PlaylistItem,
	"GenreBase": GenreBase,
	"Genre": Genre,
	"MovieBase": MovieBase,
	"Movie": Movie,
	"ShowBase": ShowBase,
	"Show": Show,
	"SeasonBase": SeasonBase,
	"Season": Season,
	"EpisodeBase": EpisodeBase,
	"Episode": Episode,
	"SubtitleBase": SubtitleBase,
	"Subtitle": Subtitle,
	"CueBase": CueBase,
	"Cue": Cue,
	"YearBase": YearBase,
	"Year": Year,
	"EntityBase": EntityBase,
	"Entity": Entity
};
