// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard";
import { AudioFile } from "../../../database/schema";
import { ImageFile } from "../../../database/schema";
import { SubtitleFile } from "../../../database/schema";
import { VideoFile } from "../../../database/schema";

export const ActorBase = autoguard.guards.Object.of({
	"actor_id": autoguard.guards.String,
	"name": autoguard.guards.String
});

export type ActorBase = ReturnType<typeof ActorBase["as"]>;

export const Actor = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => ActorBase),
	autoguard.guards.Object.of({})
);

export type Actor = ReturnType<typeof Actor["as"]>;

export const ArtistBase = autoguard.guards.Object.of({
	"artist_id": autoguard.guards.String,
	"title": autoguard.guards.String
});

export type ArtistBase = ReturnType<typeof ArtistBase["as"]>;

export const Artist = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => ArtistBase),
	autoguard.guards.Object.of({
		"albums": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Album))
	})
);

export type Artist = ReturnType<typeof Artist["as"]>;

export const AlbumBase = autoguard.guards.Object.of({
	"album_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
});

export type AlbumBase = ReturnType<typeof AlbumBase["as"]>;

export const Album = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => AlbumBase),
	autoguard.guards.Object.of({
		"artists": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ArtistBase)),
		"discs": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Disc)),
		"year": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.Number
		)
	})
);

export type Album = ReturnType<typeof Album["as"]>;

export const DiscBase = autoguard.guards.Object.of({
	"disc_id": autoguard.guards.String,
	"album": autoguard.guards.Reference.of(() => AlbumBase),
	"number": autoguard.guards.Number
});

export type DiscBase = ReturnType<typeof DiscBase["as"]>;

export const Disc = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => DiscBase),
	autoguard.guards.Object.of({
		"tracks": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Track))
	})
);

export type Disc = ReturnType<typeof Disc["as"]>;

export const TrackBase = autoguard.guards.Object.of({
	"track_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"disc": autoguard.guards.Reference.of(() => DiscBase),
	"number": autoguard.guards.Number
});

export type TrackBase = ReturnType<typeof TrackBase["as"]>;

export const Track = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => TrackBase),
	autoguard.guards.Object.of({
		"artists": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ArtistBase)),
		"last_stream_date": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.Number
		),
		"media": autoguard.guards.Reference.of(() => AudioFile)
	})
);

export type Track = ReturnType<typeof Track["as"]>;

export const UserBase = autoguard.guards.Object.of({
	"user_id": autoguard.guards.String,
	"name": autoguard.guards.String,
	"username": autoguard.guards.String
});

export type UserBase = ReturnType<typeof UserBase["as"]>;

export const User = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => UserBase),
	autoguard.guards.Object.of({})
);

export type User = ReturnType<typeof User["as"]>;

export const PlaylistBase = autoguard.guards.Object.of({
	"playlist_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"description": autoguard.guards.String,
	"user": autoguard.guards.Reference.of(() => UserBase)
});

export type PlaylistBase = ReturnType<typeof PlaylistBase["as"]>;

export const Playlist = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => PlaylistBase),
	autoguard.guards.Object.of({
		"items": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => PlaylistItem))
	})
);

export type Playlist = ReturnType<typeof Playlist["as"]>;

export const PlaylistItemBase = autoguard.guards.Object.of({
	"playlist_item_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"playlist": autoguard.guards.Reference.of(() => PlaylistBase),
	"track": autoguard.guards.Reference.of(() => Track)
});

export type PlaylistItemBase = ReturnType<typeof PlaylistItemBase["as"]>;

export const PlaylistItem = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => PlaylistItemBase),
	autoguard.guards.Object.of({})
);

export type PlaylistItem = ReturnType<typeof PlaylistItem["as"]>;

export const GenreBase = autoguard.guards.Object.of({
	"genre_id": autoguard.guards.String,
	"title": autoguard.guards.String
});

export type GenreBase = ReturnType<typeof GenreBase["as"]>;

export const Genre = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => GenreBase),
	autoguard.guards.Object.of({})
);

export type Genre = ReturnType<typeof Genre["as"]>;

export const MovieBase = autoguard.guards.Object.of({
	"movie_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
});

export type MovieBase = ReturnType<typeof MovieBase["as"]>;

export const Movie = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => MovieBase),
	autoguard.guards.Object.of({
		"year": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.Number
		),
		"summary": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.String
		),
		"genres": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Genre)),
		"actors": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Actor)),
		"last_stream_date": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.Number
		),
		"media": autoguard.guards.Reference.of(() => VideoFile),
		"subtitles": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => SubtitleFile))
	})
);

export type Movie = ReturnType<typeof Movie["as"]>;

export const ShowBase = autoguard.guards.Object.of({
	"show_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
});

export type ShowBase = ReturnType<typeof ShowBase["as"]>;

export const Show = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => ShowBase),
	autoguard.guards.Object.of({
		"summary": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.String
		),
		"genres": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Genre)),
		"actors": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Actor)),
		"seasons": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Season))
	})
);

export type Show = ReturnType<typeof Show["as"]>;

export const SeasonBase = autoguard.guards.Object.of({
	"season_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"show": autoguard.guards.Reference.of(() => ShowBase)
});

export type SeasonBase = ReturnType<typeof SeasonBase["as"]>;

export const Season = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => SeasonBase),
	autoguard.guards.Object.of({
		"episodes": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Episode))
	})
);

export type Season = ReturnType<typeof Season["as"]>;

export const EpisodeBase = autoguard.guards.Object.of({
	"episode_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"season": autoguard.guards.Reference.of(() => SeasonBase)
});

export type EpisodeBase = ReturnType<typeof EpisodeBase["as"]>;

export const Episode = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => EpisodeBase),
	autoguard.guards.Object.of({
		"year": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.Number
		),
		"summary": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.String
		),
		"last_stream_date": autoguard.guards.Union.of(
			autoguard.guards.Undefined,
			autoguard.guards.Number
		),
		"media": autoguard.guards.Reference.of(() => VideoFile),
		"subtitles": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => SubtitleFile))
	})
);

export type Episode = ReturnType<typeof Episode["as"]>;

export const SubtitleBase = autoguard.guards.Object.of({
	"subtitle_id": autoguard.guards.String,
	"subtitle": autoguard.guards.Reference.of(() => SubtitleFile)
});

export type SubtitleBase = ReturnType<typeof SubtitleBase["as"]>;

export const Subtitle = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => SubtitleBase),
	autoguard.guards.Object.of({
		"cues": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Cue))
	})
);

export type Subtitle = ReturnType<typeof Subtitle["as"]>;

export const CueBase = autoguard.guards.Object.of({
	"cue_id": autoguard.guards.String,
	"subtitle": autoguard.guards.Reference.of(() => SubtitleBase),
	"start_ms": autoguard.guards.Number,
	"duration_ms": autoguard.guards.Number,
	"lines": autoguard.guards.Array.of(autoguard.guards.String)
});

export type CueBase = ReturnType<typeof CueBase["as"]>;

export const Cue = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => CueBase),
	autoguard.guards.Object.of({
		"media": autoguard.guards.Union.of(
			autoguard.guards.Reference.of(() => Episode),
			autoguard.guards.Reference.of(() => Movie)
		)
	})
);

export type Cue = ReturnType<typeof Cue["as"]>;

export const YearBase = autoguard.guards.Object.of({
	"year_id": autoguard.guards.String,
	"year": autoguard.guards.Number
});

export type YearBase = ReturnType<typeof YearBase["as"]>;

export const Year = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => YearBase),
	autoguard.guards.Object.of({})
);

export type Year = ReturnType<typeof Year["as"]>;

export const EntityBase = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => ActorBase),
	autoguard.guards.Reference.of(() => AlbumBase),
	autoguard.guards.Reference.of(() => ArtistBase),
	autoguard.guards.Reference.of(() => CueBase),
	autoguard.guards.Reference.of(() => DiscBase),
	autoguard.guards.Reference.of(() => EpisodeBase),
	autoguard.guards.Reference.of(() => GenreBase),
	autoguard.guards.Reference.of(() => MovieBase),
	autoguard.guards.Reference.of(() => PlaylistBase),
	autoguard.guards.Reference.of(() => SeasonBase),
	autoguard.guards.Reference.of(() => ShowBase),
	autoguard.guards.Reference.of(() => TrackBase),
	autoguard.guards.Reference.of(() => UserBase),
	autoguard.guards.Reference.of(() => YearBase)
);

export type EntityBase = ReturnType<typeof EntityBase["as"]>;

export const Entity = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => Actor),
	autoguard.guards.Reference.of(() => Album),
	autoguard.guards.Reference.of(() => Artist),
	autoguard.guards.Reference.of(() => Cue),
	autoguard.guards.Reference.of(() => Disc),
	autoguard.guards.Reference.of(() => Episode),
	autoguard.guards.Reference.of(() => Genre),
	autoguard.guards.Reference.of(() => Movie),
	autoguard.guards.Reference.of(() => Playlist),
	autoguard.guards.Reference.of(() => Season),
	autoguard.guards.Reference.of(() => Show),
	autoguard.guards.Reference.of(() => Track),
	autoguard.guards.Reference.of(() => User),
	autoguard.guards.Reference.of(() => Year)
);

export type Entity = ReturnType<typeof Entity["as"]>;

export namespace Autoguard {
	export const Guards = {
		"ActorBase": autoguard.guards.Reference.of(() => ActorBase),
		"Actor": autoguard.guards.Reference.of(() => Actor),
		"ArtistBase": autoguard.guards.Reference.of(() => ArtistBase),
		"Artist": autoguard.guards.Reference.of(() => Artist),
		"AlbumBase": autoguard.guards.Reference.of(() => AlbumBase),
		"Album": autoguard.guards.Reference.of(() => Album),
		"DiscBase": autoguard.guards.Reference.of(() => DiscBase),
		"Disc": autoguard.guards.Reference.of(() => Disc),
		"TrackBase": autoguard.guards.Reference.of(() => TrackBase),
		"Track": autoguard.guards.Reference.of(() => Track),
		"UserBase": autoguard.guards.Reference.of(() => UserBase),
		"User": autoguard.guards.Reference.of(() => User),
		"PlaylistBase": autoguard.guards.Reference.of(() => PlaylistBase),
		"Playlist": autoguard.guards.Reference.of(() => Playlist),
		"PlaylistItemBase": autoguard.guards.Reference.of(() => PlaylistItemBase),
		"PlaylistItem": autoguard.guards.Reference.of(() => PlaylistItem),
		"GenreBase": autoguard.guards.Reference.of(() => GenreBase),
		"Genre": autoguard.guards.Reference.of(() => Genre),
		"MovieBase": autoguard.guards.Reference.of(() => MovieBase),
		"Movie": autoguard.guards.Reference.of(() => Movie),
		"ShowBase": autoguard.guards.Reference.of(() => ShowBase),
		"Show": autoguard.guards.Reference.of(() => Show),
		"SeasonBase": autoguard.guards.Reference.of(() => SeasonBase),
		"Season": autoguard.guards.Reference.of(() => Season),
		"EpisodeBase": autoguard.guards.Reference.of(() => EpisodeBase),
		"Episode": autoguard.guards.Reference.of(() => Episode),
		"SubtitleBase": autoguard.guards.Reference.of(() => SubtitleBase),
		"Subtitle": autoguard.guards.Reference.of(() => Subtitle),
		"CueBase": autoguard.guards.Reference.of(() => CueBase),
		"Cue": autoguard.guards.Reference.of(() => Cue),
		"YearBase": autoguard.guards.Reference.of(() => YearBase),
		"Year": autoguard.guards.Reference.of(() => Year),
		"EntityBase": autoguard.guards.Reference.of(() => EntityBase),
		"Entity": autoguard.guards.Reference.of(() => Entity)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
