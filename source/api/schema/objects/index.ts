// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard/dist/lib-shared";
import { AudioFile } from "../../../database/schema";
import { ImageFile } from "../../../database/schema";
import { SubtitleFile } from "../../../database/schema";
import { VideoFile } from "../../../database/schema";

export const LanguageBase: autoguard.serialization.MessageGuard<LanguageBase> = autoguard.guards.Object.of({
	"language_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type LanguageBase = autoguard.guards.Object<{
	"language_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const Language: autoguard.serialization.MessageGuard<Language> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => LanguageBase),
	autoguard.guards.Object.of({
		"iso_639_1": autoguard.guards.String,
		"iso_639_2": autoguard.guards.String
	}, {})
);

export type Language = autoguard.guards.Intersection<[
	autoguard.guards.Reference<LanguageBase>,
	autoguard.guards.Object<{
		"iso_639_1": autoguard.guards.String,
		"iso_639_2": autoguard.guards.String
	}, {}>
]>;

export const CategoryBase: autoguard.serialization.MessageGuard<CategoryBase> = autoguard.guards.Object.of({
	"category_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {});

export type CategoryBase = autoguard.guards.Object<{
	"category_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {}>;

export const Category: autoguard.serialization.MessageGuard<Category> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => CategoryBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number
	}, {})
);

export type Category = autoguard.guards.Intersection<[
	autoguard.guards.Reference<CategoryBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number
	}, {}>
]>;

export const ActorBase: autoguard.serialization.MessageGuard<ActorBase> = autoguard.guards.Object.of({
	"actor_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type ActorBase = autoguard.guards.Object<{
	"actor_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const Actor: autoguard.serialization.MessageGuard<Actor> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => ActorBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number
	}, {})
);

export type Actor = autoguard.guards.Intersection<[
	autoguard.guards.Reference<ActorBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number
	}, {}>
]>;

export const ArtistBase: autoguard.serialization.MessageGuard<ArtistBase> = autoguard.guards.Object.of({
	"artist_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
}, {});

export type ArtistBase = autoguard.guards.Object<{
	"artist_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array<autoguard.guards.Reference<ImageFile>>
}, {}>;

export const Artist: autoguard.serialization.MessageGuard<Artist> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => ArtistBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"tidal": autoguard.guards.Number
	})
);

export type Artist = autoguard.guards.Intersection<[
	autoguard.guards.Reference<ArtistBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"tidal": autoguard.guards.Number
	}>
]>;

export const ArtistContext: autoguard.serialization.MessageGuard<ArtistContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Artist),
	autoguard.guards.Object.of({
		"albums": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => AlbumContext))
	}, {})
);

export type ArtistContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Artist>,
	autoguard.guards.Object<{
		"albums": autoguard.guards.Array<autoguard.guards.Reference<AlbumContext>>
	}, {}>
]>;

export const AlbumBase: autoguard.serialization.MessageGuard<AlbumBase> = autoguard.guards.Object.of({
	"album_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
}, {});

export type AlbumBase = autoguard.guards.Object<{
	"album_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array<autoguard.guards.Reference<ImageFile>>
}, {}>;

export const Album: autoguard.serialization.MessageGuard<Album> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => AlbumBase),
	autoguard.guards.Object.of({
		"artists": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ArtistBase)),
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"year": autoguard.guards.Reference.of(() => YearBase),
		"copyright": autoguard.guards.String,
		"tidal": autoguard.guards.Number,
		"categories": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => CategoryBase))
	})
);

export type Album = autoguard.guards.Intersection<[
	autoguard.guards.Reference<AlbumBase>,
	autoguard.guards.Object<{
		"artists": autoguard.guards.Array<autoguard.guards.Reference<ArtistBase>>,
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"year": autoguard.guards.Reference<YearBase>,
		"copyright": autoguard.guards.String,
		"tidal": autoguard.guards.Number,
		"categories": autoguard.guards.Array<autoguard.guards.Reference<CategoryBase>>
	}>
]>;

export const AlbumContext: autoguard.serialization.MessageGuard<AlbumContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Album),
	autoguard.guards.Object.of({
		"discs": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => DiscContext))
	}, {})
);

export type AlbumContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Album>,
	autoguard.guards.Object<{
		"discs": autoguard.guards.Array<autoguard.guards.Reference<DiscContext>>
	}, {}>
]>;

export const DiscBase: autoguard.serialization.MessageGuard<DiscBase> = autoguard.guards.Object.of({
	"disc_id": autoguard.guards.String,
	"album": autoguard.guards.Reference.of(() => AlbumBase),
	"number": autoguard.guards.Number
}, {
	"title": autoguard.guards.String
});

export type DiscBase = autoguard.guards.Object<{
	"disc_id": autoguard.guards.String,
	"album": autoguard.guards.Reference<AlbumBase>,
	"number": autoguard.guards.Number
}, {
	"title": autoguard.guards.String
}>;

export const Disc: autoguard.serialization.MessageGuard<Disc> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => DiscBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {})
);

export type Disc = autoguard.guards.Intersection<[
	autoguard.guards.Reference<DiscBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {}>
]>;

export const DiscContext: autoguard.serialization.MessageGuard<DiscContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Disc),
	autoguard.guards.Object.of({
		"tracks": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => TrackContext))
	}, {})
);

export type DiscContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Disc>,
	autoguard.guards.Object<{
		"tracks": autoguard.guards.Array<autoguard.guards.Reference<TrackContext>>
	}, {}>
]>;

export const TrackBase: autoguard.serialization.MessageGuard<TrackBase> = autoguard.guards.Object.of({
	"track_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"disc": autoguard.guards.Reference.of(() => DiscBase),
	"number": autoguard.guards.Number
}, {});

export type TrackBase = autoguard.guards.Object<{
	"track_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"disc": autoguard.guards.Reference<DiscBase>,
	"number": autoguard.guards.Number
}, {}>;

export const Track: autoguard.serialization.MessageGuard<Track> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => TrackBase),
	autoguard.guards.Object.of({
		"artists": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ArtistBase)),
		"media": autoguard.guards.Reference.of(() => AudioFile),
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"last_stream_date": autoguard.guards.Number,
		"copyright": autoguard.guards.String
	})
);

export type Track = autoguard.guards.Intersection<[
	autoguard.guards.Reference<TrackBase>,
	autoguard.guards.Object<{
		"artists": autoguard.guards.Array<autoguard.guards.Reference<ArtistBase>>,
		"media": autoguard.guards.Reference<AudioFile>,
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"last_stream_date": autoguard.guards.Number,
		"copyright": autoguard.guards.String
	}>
]>;

export const TrackContext: autoguard.serialization.MessageGuard<TrackContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Track),
	autoguard.guards.Object.of({}, {})
);

export type TrackContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Track>,
	autoguard.guards.Object<{}, {}>
]>;

export const UserBase: autoguard.serialization.MessageGuard<UserBase> = autoguard.guards.Object.of({
	"user_id": autoguard.guards.String,
	"name": autoguard.guards.String,
	"username": autoguard.guards.String
}, {});

export type UserBase = autoguard.guards.Object<{
	"user_id": autoguard.guards.String,
	"name": autoguard.guards.String,
	"username": autoguard.guards.String
}, {}>;

export const User: autoguard.serialization.MessageGuard<User> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => UserBase),
	autoguard.guards.Object.of({}, {})
);

export type User = autoguard.guards.Intersection<[
	autoguard.guards.Reference<UserBase>,
	autoguard.guards.Object<{}, {}>
]>;

export const PlaylistBase: autoguard.serialization.MessageGuard<PlaylistBase> = autoguard.guards.Object.of({
	"playlist_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"description": autoguard.guards.String,
	"user": autoguard.guards.Reference.of(() => UserBase)
}, {});

export type PlaylistBase = autoguard.guards.Object<{
	"playlist_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"description": autoguard.guards.String,
	"user": autoguard.guards.Reference<UserBase>
}, {}>;

export const Playlist: autoguard.serialization.MessageGuard<Playlist> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => PlaylistBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number,
		"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
	}, {})
);

export type Playlist = autoguard.guards.Intersection<[
	autoguard.guards.Reference<PlaylistBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number,
		"artwork": autoguard.guards.Array<autoguard.guards.Reference<ImageFile>>
	}, {}>
]>;

export const PlaylistContext: autoguard.serialization.MessageGuard<PlaylistContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Playlist),
	autoguard.guards.Object.of({
		"items": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => PlaylistItemContext))
	}, {})
);

export type PlaylistContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Playlist>,
	autoguard.guards.Object<{
		"items": autoguard.guards.Array<autoguard.guards.Reference<PlaylistItemContext>>
	}, {}>
]>;

export const PlaylistItemBase: autoguard.serialization.MessageGuard<PlaylistItemBase> = autoguard.guards.Object.of({
	"playlist_item_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"playlist": autoguard.guards.Reference.of(() => PlaylistBase),
	"track": autoguard.guards.Reference.of(() => Track),
	"duration_ms": autoguard.guards.Number
}, {});

export type PlaylistItemBase = autoguard.guards.Object<{
	"playlist_item_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"playlist": autoguard.guards.Reference<PlaylistBase>,
	"track": autoguard.guards.Reference<Track>,
	"duration_ms": autoguard.guards.Number
}, {}>;

export const PlaylistItem: autoguard.serialization.MessageGuard<PlaylistItem> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => PlaylistItemBase),
	autoguard.guards.Object.of({}, {})
);

export type PlaylistItem = autoguard.guards.Intersection<[
	autoguard.guards.Reference<PlaylistItemBase>,
	autoguard.guards.Object<{}, {}>
]>;

export const PlaylistItemContext: autoguard.serialization.MessageGuard<PlaylistItemContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => PlaylistItem),
	autoguard.guards.Object.of({}, {})
);

export type PlaylistItemContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<PlaylistItem>,
	autoguard.guards.Object<{}, {}>
]>;

export const GenreBase: autoguard.serialization.MessageGuard<GenreBase> = autoguard.guards.Object.of({
	"genre_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {});

export type GenreBase = autoguard.guards.Object<{
	"genre_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {}>;

export const Genre: autoguard.serialization.MessageGuard<Genre> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => GenreBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number
	}, {})
);

export type Genre = autoguard.guards.Intersection<[
	autoguard.guards.Reference<GenreBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number
	}, {}>
]>;

export const MovieBase: autoguard.serialization.MessageGuard<MovieBase> = autoguard.guards.Object.of({
	"movie_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
}, {});

export type MovieBase = autoguard.guards.Object<{
	"movie_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array<autoguard.guards.Reference<ImageFile>>
}, {}>;

export const Movie: autoguard.serialization.MessageGuard<Movie> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => MovieBase),
	autoguard.guards.Object.of({
		"genres": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => GenreBase)),
		"media": autoguard.guards.Reference.of(() => VideoFile),
		"subtitles": autoguard.guards.Array.of(autoguard.guards.Object.of({
			"file_id": autoguard.guards.String,
			"mime": autoguard.guards.Union.of(
				autoguard.guards.String,
				autoguard.guards.StringLiteral.of("text/vtt")
			),
			"duration_ms": autoguard.guards.Number
		}, {
			"language": autoguard.guards.Reference.of(() => Language)
		})),
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"year": autoguard.guards.Reference.of(() => YearBase),
		"summary": autoguard.guards.String,
		"last_stream_date": autoguard.guards.Number,
		"copyright": autoguard.guards.String,
		"imdb": autoguard.guards.String
	})
);

export type Movie = autoguard.guards.Intersection<[
	autoguard.guards.Reference<MovieBase>,
	autoguard.guards.Object<{
		"genres": autoguard.guards.Array<autoguard.guards.Reference<GenreBase>>,
		"media": autoguard.guards.Reference<VideoFile>,
		"subtitles": autoguard.guards.Array<autoguard.guards.Object<{
			"file_id": autoguard.guards.String,
			"mime": autoguard.guards.Union<[
				autoguard.guards.String,
				autoguard.guards.StringLiteral<"text/vtt">
			]>,
			"duration_ms": autoguard.guards.Number
		}, {
			"language": autoguard.guards.Reference<Language>
		}>>,
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"year": autoguard.guards.Reference<YearBase>,
		"summary": autoguard.guards.String,
		"last_stream_date": autoguard.guards.Number,
		"copyright": autoguard.guards.String,
		"imdb": autoguard.guards.String
	}>
]>;

export const MovieContext: autoguard.serialization.MessageGuard<MovieContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Movie),
	autoguard.guards.Object.of({}, {})
);

export type MovieContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Movie>,
	autoguard.guards.Object<{}, {}>
]>;

export const ShowBase: autoguard.serialization.MessageGuard<ShowBase> = autoguard.guards.Object.of({
	"show_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
}, {});

export type ShowBase = autoguard.guards.Object<{
	"show_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"artwork": autoguard.guards.Array<autoguard.guards.Reference<ImageFile>>
}, {}>;

export const Show: autoguard.serialization.MessageGuard<Show> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => ShowBase),
	autoguard.guards.Object.of({
		"genres": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => GenreBase)),
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"summary": autoguard.guards.String,
		"imdb": autoguard.guards.String
	})
);

export type Show = autoguard.guards.Intersection<[
	autoguard.guards.Reference<ShowBase>,
	autoguard.guards.Object<{
		"genres": autoguard.guards.Array<autoguard.guards.Reference<GenreBase>>,
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"summary": autoguard.guards.String,
		"imdb": autoguard.guards.String
	}>
]>;

export const ShowContext: autoguard.serialization.MessageGuard<ShowContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Show),
	autoguard.guards.Object.of({
		"seasons": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => SeasonContext))
	}, {})
);

export type ShowContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Show>,
	autoguard.guards.Object<{
		"seasons": autoguard.guards.Array<autoguard.guards.Reference<SeasonContext>>
	}, {}>
]>;

export const SeasonBase: autoguard.serialization.MessageGuard<SeasonBase> = autoguard.guards.Object.of({
	"season_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"show": autoguard.guards.Reference.of(() => ShowBase)
}, {});

export type SeasonBase = autoguard.guards.Object<{
	"season_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"show": autoguard.guards.Reference<ShowBase>
}, {}>;

export const Season: autoguard.serialization.MessageGuard<Season> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => SeasonBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {})
);

export type Season = autoguard.guards.Intersection<[
	autoguard.guards.Reference<SeasonBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {}>
]>;

export const SeasonContext: autoguard.serialization.MessageGuard<SeasonContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Season),
	autoguard.guards.Object.of({
		"episodes": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => EpisodeContext))
	}, {})
);

export type SeasonContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Season>,
	autoguard.guards.Object<{
		"episodes": autoguard.guards.Array<autoguard.guards.Reference<EpisodeContext>>
	}, {}>
]>;

export const EpisodeBase: autoguard.serialization.MessageGuard<EpisodeBase> = autoguard.guards.Object.of({
	"episode_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"season": autoguard.guards.Reference.of(() => SeasonBase)
}, {});

export type EpisodeBase = autoguard.guards.Object<{
	"episode_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"season": autoguard.guards.Reference<SeasonBase>
}, {}>;

export const Episode: autoguard.serialization.MessageGuard<Episode> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => EpisodeBase),
	autoguard.guards.Object.of({
		"media": autoguard.guards.Reference.of(() => VideoFile),
		"subtitles": autoguard.guards.Array.of(autoguard.guards.Object.of({
			"file_id": autoguard.guards.String,
			"mime": autoguard.guards.Union.of(
				autoguard.guards.String,
				autoguard.guards.StringLiteral.of("text/vtt")
			),
			"duration_ms": autoguard.guards.Number
		}, {
			"language": autoguard.guards.Reference.of(() => Language)
		})),
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"year": autoguard.guards.Reference.of(() => YearBase),
		"summary": autoguard.guards.String,
		"last_stream_date": autoguard.guards.Number,
		"copyright": autoguard.guards.String,
		"imdb": autoguard.guards.String
	})
);

export type Episode = autoguard.guards.Intersection<[
	autoguard.guards.Reference<EpisodeBase>,
	autoguard.guards.Object<{
		"media": autoguard.guards.Reference<VideoFile>,
		"subtitles": autoguard.guards.Array<autoguard.guards.Object<{
			"file_id": autoguard.guards.String,
			"mime": autoguard.guards.Union<[
				autoguard.guards.String,
				autoguard.guards.StringLiteral<"text/vtt">
			]>,
			"duration_ms": autoguard.guards.Number
		}, {
			"language": autoguard.guards.Reference<Language>
		}>>,
		"affinity": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number
	}, {
		"year": autoguard.guards.Reference<YearBase>,
		"summary": autoguard.guards.String,
		"last_stream_date": autoguard.guards.Number,
		"copyright": autoguard.guards.String,
		"imdb": autoguard.guards.String
	}>
]>;

export const EpisodeContext: autoguard.serialization.MessageGuard<EpisodeContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Episode),
	autoguard.guards.Object.of({}, {})
);

export type EpisodeContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Episode>,
	autoguard.guards.Object<{}, {}>
]>;

export const SubtitleBase: autoguard.serialization.MessageGuard<SubtitleBase> = autoguard.guards.Object.of({
	"subtitle_id": autoguard.guards.String,
	"subtitle": autoguard.guards.Reference.of(() => SubtitleFile)
}, {});

export type SubtitleBase = autoguard.guards.Object<{
	"subtitle_id": autoguard.guards.String,
	"subtitle": autoguard.guards.Reference<SubtitleFile>
}, {}>;

export const Subtitle: autoguard.serialization.MessageGuard<Subtitle> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => SubtitleBase),
	autoguard.guards.Object.of({
		"cues": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Cue))
	}, {})
);

export type Subtitle = autoguard.guards.Intersection<[
	autoguard.guards.Reference<SubtitleBase>,
	autoguard.guards.Object<{
		"cues": autoguard.guards.Array<autoguard.guards.Reference<Cue>>
	}, {}>
]>;

export const CueBase: autoguard.serialization.MessageGuard<CueBase> = autoguard.guards.Object.of({
	"cue_id": autoguard.guards.String,
	"subtitle": autoguard.guards.Reference.of(() => SubtitleBase),
	"start_ms": autoguard.guards.Number,
	"duration_ms": autoguard.guards.Number,
	"lines": autoguard.guards.Array.of(autoguard.guards.String)
}, {});

export type CueBase = autoguard.guards.Object<{
	"cue_id": autoguard.guards.String,
	"subtitle": autoguard.guards.Reference<SubtitleBase>,
	"start_ms": autoguard.guards.Number,
	"duration_ms": autoguard.guards.Number,
	"lines": autoguard.guards.Array<autoguard.guards.String>
}, {}>;

export const Cue: autoguard.serialization.MessageGuard<Cue> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => CueBase),
	autoguard.guards.Object.of({
		"media": autoguard.guards.Union.of(
			autoguard.guards.Reference.of(() => Episode),
			autoguard.guards.Reference.of(() => Movie)
		)
	}, {})
);

export type Cue = autoguard.guards.Intersection<[
	autoguard.guards.Reference<CueBase>,
	autoguard.guards.Object<{
		"media": autoguard.guards.Union<[
			autoguard.guards.Reference<Episode>,
			autoguard.guards.Reference<Movie>
		]>
	}, {}>
]>;

export const YearBase: autoguard.serialization.MessageGuard<YearBase> = autoguard.guards.Object.of({
	"year_id": autoguard.guards.String,
	"year": autoguard.guards.Number
}, {});

export type YearBase = autoguard.guards.Object<{
	"year_id": autoguard.guards.String,
	"year": autoguard.guards.Number
}, {}>;

export const Year: autoguard.serialization.MessageGuard<Year> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => YearBase),
	autoguard.guards.Object.of({
		"affinity": autoguard.guards.Number,
		"artwork": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => ImageFile))
	}, {})
);

export type Year = autoguard.guards.Intersection<[
	autoguard.guards.Reference<YearBase>,
	autoguard.guards.Object<{
		"affinity": autoguard.guards.Number,
		"artwork": autoguard.guards.Array<autoguard.guards.Reference<ImageFile>>
	}, {}>
]>;

export const YearContext: autoguard.serialization.MessageGuard<YearContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Year),
	autoguard.guards.Object.of({
		"albums": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => AlbumContext))
	}, {})
);

export type YearContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Year>,
	autoguard.guards.Object<{
		"albums": autoguard.guards.Array<autoguard.guards.Reference<AlbumContext>>
	}, {}>
]>;

export const DirectoryBase: autoguard.serialization.MessageGuard<DirectoryBase> = autoguard.guards.Object.of({
	"directory_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type DirectoryBase = autoguard.guards.Object<{
	"directory_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const Directory: autoguard.serialization.MessageGuard<Directory> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => DirectoryBase),
	autoguard.guards.Object.of({}, {
		"parent": autoguard.guards.Reference.of(() => DirectoryBase)
	})
);

export type Directory = autoguard.guards.Intersection<[
	autoguard.guards.Reference<DirectoryBase>,
	autoguard.guards.Object<{}, {
		"parent": autoguard.guards.Reference<DirectoryBase>
	}>
]>;

export const DirectoryContext: autoguard.serialization.MessageGuard<DirectoryContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => Directory),
	autoguard.guards.Object.of({
		"files": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => FileContext))
	}, {})
);

export type DirectoryContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<Directory>,
	autoguard.guards.Object<{
		"files": autoguard.guards.Array<autoguard.guards.Reference<FileContext>>
	}, {}>
]>;

export const FileBase: autoguard.serialization.MessageGuard<FileBase> = autoguard.guards.Object.of({
	"file_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type FileBase = autoguard.guards.Object<{
	"file_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const File: autoguard.serialization.MessageGuard<File> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => FileBase),
	autoguard.guards.Object.of({
		"size": autoguard.guards.Number,
		"media": autoguard.guards.Union.of(
			autoguard.guards.Reference.of(() => AudioFile),
			autoguard.guards.Reference.of(() => VideoFile)
		)
	}, {
		"parent": autoguard.guards.Reference.of(() => DirectoryBase)
	})
);

export type File = autoguard.guards.Intersection<[
	autoguard.guards.Reference<FileBase>,
	autoguard.guards.Object<{
		"size": autoguard.guards.Number,
		"media": autoguard.guards.Union<[
			autoguard.guards.Reference<AudioFile>,
			autoguard.guards.Reference<VideoFile>
		]>
	}, {
		"parent": autoguard.guards.Reference<DirectoryBase>
	}>
]>;

export const FileContext: autoguard.serialization.MessageGuard<FileContext> = autoguard.guards.Intersection.of(
	autoguard.guards.Reference.of(() => File),
	autoguard.guards.Object.of({}, {})
);

export type FileContext = autoguard.guards.Intersection<[
	autoguard.guards.Reference<File>,
	autoguard.guards.Object<{}, {}>
]>;

export const EntityBase: autoguard.serialization.MessageGuard<EntityBase> = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => ActorBase),
	autoguard.guards.Reference.of(() => AlbumBase),
	autoguard.guards.Reference.of(() => ArtistBase),
	autoguard.guards.Reference.of(() => CategoryBase),
	autoguard.guards.Reference.of(() => CueBase),
	autoguard.guards.Reference.of(() => DirectoryBase),
	autoguard.guards.Reference.of(() => DiscBase),
	autoguard.guards.Reference.of(() => EpisodeBase),
	autoguard.guards.Reference.of(() => FileBase),
	autoguard.guards.Reference.of(() => GenreBase),
	autoguard.guards.Reference.of(() => MovieBase),
	autoguard.guards.Reference.of(() => PlaylistBase),
	autoguard.guards.Reference.of(() => SeasonBase),
	autoguard.guards.Reference.of(() => ShowBase),
	autoguard.guards.Reference.of(() => TrackBase),
	autoguard.guards.Reference.of(() => UserBase),
	autoguard.guards.Reference.of(() => YearBase)
);

export type EntityBase = autoguard.guards.Union<[
	autoguard.guards.Reference<ActorBase>,
	autoguard.guards.Reference<AlbumBase>,
	autoguard.guards.Reference<ArtistBase>,
	autoguard.guards.Reference<CategoryBase>,
	autoguard.guards.Reference<CueBase>,
	autoguard.guards.Reference<DirectoryBase>,
	autoguard.guards.Reference<DiscBase>,
	autoguard.guards.Reference<EpisodeBase>,
	autoguard.guards.Reference<FileBase>,
	autoguard.guards.Reference<GenreBase>,
	autoguard.guards.Reference<MovieBase>,
	autoguard.guards.Reference<PlaylistBase>,
	autoguard.guards.Reference<SeasonBase>,
	autoguard.guards.Reference<ShowBase>,
	autoguard.guards.Reference<TrackBase>,
	autoguard.guards.Reference<UserBase>,
	autoguard.guards.Reference<YearBase>
]>;

export const Entity: autoguard.serialization.MessageGuard<Entity> = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => Actor),
	autoguard.guards.Reference.of(() => Album),
	autoguard.guards.Reference.of(() => Artist),
	autoguard.guards.Reference.of(() => Category),
	autoguard.guards.Reference.of(() => Cue),
	autoguard.guards.Reference.of(() => Directory),
	autoguard.guards.Reference.of(() => Disc),
	autoguard.guards.Reference.of(() => Episode),
	autoguard.guards.Reference.of(() => File),
	autoguard.guards.Reference.of(() => Genre),
	autoguard.guards.Reference.of(() => Movie),
	autoguard.guards.Reference.of(() => Playlist),
	autoguard.guards.Reference.of(() => Season),
	autoguard.guards.Reference.of(() => Show),
	autoguard.guards.Reference.of(() => Track),
	autoguard.guards.Reference.of(() => User),
	autoguard.guards.Reference.of(() => Year)
);

export type Entity = autoguard.guards.Union<[
	autoguard.guards.Reference<Actor>,
	autoguard.guards.Reference<Album>,
	autoguard.guards.Reference<Artist>,
	autoguard.guards.Reference<Category>,
	autoguard.guards.Reference<Cue>,
	autoguard.guards.Reference<Directory>,
	autoguard.guards.Reference<Disc>,
	autoguard.guards.Reference<Episode>,
	autoguard.guards.Reference<File>,
	autoguard.guards.Reference<Genre>,
	autoguard.guards.Reference<Movie>,
	autoguard.guards.Reference<Playlist>,
	autoguard.guards.Reference<Season>,
	autoguard.guards.Reference<Show>,
	autoguard.guards.Reference<Track>,
	autoguard.guards.Reference<User>,
	autoguard.guards.Reference<Year>
]>;

export namespace Autoguard {
	export const Guards = {
		"LanguageBase": autoguard.guards.Reference.of(() => LanguageBase),
		"Language": autoguard.guards.Reference.of(() => Language),
		"CategoryBase": autoguard.guards.Reference.of(() => CategoryBase),
		"Category": autoguard.guards.Reference.of(() => Category),
		"ActorBase": autoguard.guards.Reference.of(() => ActorBase),
		"Actor": autoguard.guards.Reference.of(() => Actor),
		"ArtistBase": autoguard.guards.Reference.of(() => ArtistBase),
		"Artist": autoguard.guards.Reference.of(() => Artist),
		"ArtistContext": autoguard.guards.Reference.of(() => ArtistContext),
		"AlbumBase": autoguard.guards.Reference.of(() => AlbumBase),
		"Album": autoguard.guards.Reference.of(() => Album),
		"AlbumContext": autoguard.guards.Reference.of(() => AlbumContext),
		"DiscBase": autoguard.guards.Reference.of(() => DiscBase),
		"Disc": autoguard.guards.Reference.of(() => Disc),
		"DiscContext": autoguard.guards.Reference.of(() => DiscContext),
		"TrackBase": autoguard.guards.Reference.of(() => TrackBase),
		"Track": autoguard.guards.Reference.of(() => Track),
		"TrackContext": autoguard.guards.Reference.of(() => TrackContext),
		"UserBase": autoguard.guards.Reference.of(() => UserBase),
		"User": autoguard.guards.Reference.of(() => User),
		"PlaylistBase": autoguard.guards.Reference.of(() => PlaylistBase),
		"Playlist": autoguard.guards.Reference.of(() => Playlist),
		"PlaylistContext": autoguard.guards.Reference.of(() => PlaylistContext),
		"PlaylistItemBase": autoguard.guards.Reference.of(() => PlaylistItemBase),
		"PlaylistItem": autoguard.guards.Reference.of(() => PlaylistItem),
		"PlaylistItemContext": autoguard.guards.Reference.of(() => PlaylistItemContext),
		"GenreBase": autoguard.guards.Reference.of(() => GenreBase),
		"Genre": autoguard.guards.Reference.of(() => Genre),
		"MovieBase": autoguard.guards.Reference.of(() => MovieBase),
		"Movie": autoguard.guards.Reference.of(() => Movie),
		"MovieContext": autoguard.guards.Reference.of(() => MovieContext),
		"ShowBase": autoguard.guards.Reference.of(() => ShowBase),
		"Show": autoguard.guards.Reference.of(() => Show),
		"ShowContext": autoguard.guards.Reference.of(() => ShowContext),
		"SeasonBase": autoguard.guards.Reference.of(() => SeasonBase),
		"Season": autoguard.guards.Reference.of(() => Season),
		"SeasonContext": autoguard.guards.Reference.of(() => SeasonContext),
		"EpisodeBase": autoguard.guards.Reference.of(() => EpisodeBase),
		"Episode": autoguard.guards.Reference.of(() => Episode),
		"EpisodeContext": autoguard.guards.Reference.of(() => EpisodeContext),
		"SubtitleBase": autoguard.guards.Reference.of(() => SubtitleBase),
		"Subtitle": autoguard.guards.Reference.of(() => Subtitle),
		"CueBase": autoguard.guards.Reference.of(() => CueBase),
		"Cue": autoguard.guards.Reference.of(() => Cue),
		"YearBase": autoguard.guards.Reference.of(() => YearBase),
		"Year": autoguard.guards.Reference.of(() => Year),
		"YearContext": autoguard.guards.Reference.of(() => YearContext),
		"DirectoryBase": autoguard.guards.Reference.of(() => DirectoryBase),
		"Directory": autoguard.guards.Reference.of(() => Directory),
		"DirectoryContext": autoguard.guards.Reference.of(() => DirectoryContext),
		"FileBase": autoguard.guards.Reference.of(() => FileBase),
		"File": autoguard.guards.Reference.of(() => File),
		"FileContext": autoguard.guards.Reference.of(() => FileContext),
		"EntityBase": autoguard.guards.Reference.of(() => EntityBase),
		"Entity": autoguard.guards.Reference.of(() => Entity)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
