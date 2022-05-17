// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard/dist/lib-shared";

export const ShowMetadata: autoguard.serialization.MessageGuard<ShowMetadata> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("show"),
	"title": autoguard.guards.String,
	"genres": autoguard.guards.Array.of(autoguard.guards.String),
	"actors": autoguard.guards.Array.of(autoguard.guards.String)
}, {
	"summary": autoguard.guards.String,
	"imdb": autoguard.guards.String
});

export type ShowMetadata = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"show">,
	"title": autoguard.guards.String,
	"genres": autoguard.guards.Array<autoguard.guards.String>,
	"actors": autoguard.guards.Array<autoguard.guards.String>
}, {
	"summary": autoguard.guards.String,
	"imdb": autoguard.guards.String
}>;

export const EpisodeMetadata: autoguard.serialization.MessageGuard<EpisodeMetadata> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("episode"),
	"title": autoguard.guards.String,
	"season": autoguard.guards.Number,
	"episode": autoguard.guards.Number,
	"show": autoguard.guards.Object.of({
		"title": autoguard.guards.String,
		"genres": autoguard.guards.Array.of(autoguard.guards.String),
		"actors": autoguard.guards.Array.of(autoguard.guards.String)
	}, {
		"summary": autoguard.guards.String,
		"imdb": autoguard.guards.String
	})
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
});

export type EpisodeMetadata = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"episode">,
	"title": autoguard.guards.String,
	"season": autoguard.guards.Number,
	"episode": autoguard.guards.Number,
	"show": autoguard.guards.Object<{
		"title": autoguard.guards.String,
		"genres": autoguard.guards.Array<autoguard.guards.String>,
		"actors": autoguard.guards.Array<autoguard.guards.String>
	}, {
		"summary": autoguard.guards.String,
		"imdb": autoguard.guards.String
	}>
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
}>;

export const MovieMetadata: autoguard.serialization.MessageGuard<MovieMetadata> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("movie"),
	"title": autoguard.guards.String,
	"genres": autoguard.guards.Array.of(autoguard.guards.String),
	"actors": autoguard.guards.Array.of(autoguard.guards.String)
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
});

export type MovieMetadata = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"movie">,
	"title": autoguard.guards.String,
	"genres": autoguard.guards.Array<autoguard.guards.String>,
	"actors": autoguard.guards.Array<autoguard.guards.String>
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
}>;

export const TrackMetadata: autoguard.serialization.MessageGuard<TrackMetadata> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("track"),
	"title": autoguard.guards.String,
	"disc": autoguard.guards.Number,
	"track": autoguard.guards.Number,
	"album": autoguard.guards.Object.of({
		"title": autoguard.guards.String,
		"artists": autoguard.guards.Array.of(autoguard.guards.String)
	}, {
		"year": autoguard.guards.Number
	}),
	"artists": autoguard.guards.Array.of(autoguard.guards.String)
}, {
	"copyright": autoguard.guards.String
});

export type TrackMetadata = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"track">,
	"title": autoguard.guards.String,
	"disc": autoguard.guards.Number,
	"track": autoguard.guards.Number,
	"album": autoguard.guards.Object<{
		"title": autoguard.guards.String,
		"artists": autoguard.guards.Array<autoguard.guards.String>
	}, {
		"year": autoguard.guards.Number
	}>,
	"artists": autoguard.guards.Array<autoguard.guards.String>
}, {
	"copyright": autoguard.guards.String
}>;

export const AlbumMetadata: autoguard.serialization.MessageGuard<AlbumMetadata> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("album"),
	"title": autoguard.guards.String,
	"disc": autoguard.guards.Number,
	"artists": autoguard.guards.Array.of(autoguard.guards.String),
	"tracks": autoguard.guards.Array.of(autoguard.guards.Object.of({
		"title": autoguard.guards.String,
		"artists": autoguard.guards.Array.of(autoguard.guards.String)
	}, {
		"copyright": autoguard.guards.String
	}))
}, {
	"year": autoguard.guards.Number,
	"copyright": autoguard.guards.String
});

export type AlbumMetadata = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"album">,
	"title": autoguard.guards.String,
	"disc": autoguard.guards.Number,
	"artists": autoguard.guards.Array<autoguard.guards.String>,
	"tracks": autoguard.guards.Array<autoguard.guards.Object<{
		"title": autoguard.guards.String,
		"artists": autoguard.guards.Array<autoguard.guards.String>
	}, {
		"copyright": autoguard.guards.String
	}>>
}, {
	"year": autoguard.guards.Number,
	"copyright": autoguard.guards.String
}>;

export const ArtistMetadata: autoguard.serialization.MessageGuard<ArtistMetadata> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("artist"),
	"name": autoguard.guards.String
}, {
	"tidal": autoguard.guards.Number
});

export type ArtistMetadata = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"artist">,
	"name": autoguard.guards.String
}, {
	"tidal": autoguard.guards.Number
}>;

export const Metadata: autoguard.serialization.MessageGuard<Metadata> = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => ShowMetadata),
	autoguard.guards.Reference.of(() => EpisodeMetadata),
	autoguard.guards.Reference.of(() => MovieMetadata),
	autoguard.guards.Reference.of(() => TrackMetadata),
	autoguard.guards.Reference.of(() => AlbumMetadata),
	autoguard.guards.Reference.of(() => ArtistMetadata)
);

export type Metadata = autoguard.guards.Union<[
	autoguard.guards.Reference<ShowMetadata>,
	autoguard.guards.Reference<EpisodeMetadata>,
	autoguard.guards.Reference<MovieMetadata>,
	autoguard.guards.Reference<TrackMetadata>,
	autoguard.guards.Reference<AlbumMetadata>,
	autoguard.guards.Reference<ArtistMetadata>
]>;

export const AudioResource: autoguard.serialization.MessageGuard<AudioResource> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("audio"),
	"duration_ms": autoguard.guards.Number
}, {});

export type AudioResource = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"audio">,
	"duration_ms": autoguard.guards.Number
}, {}>;

export const ImageResource: autoguard.serialization.MessageGuard<ImageResource> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("image"),
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {});

export type ImageResource = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"image">,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {}>;

export const MetadataResource: autoguard.serialization.MessageGuard<MetadataResource> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("metadata")
}, {});

export type MetadataResource = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"metadata">
}, {}>;

export const SubtitleResource: autoguard.serialization.MessageGuard<SubtitleResource> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("subtitle"),
	"duration_ms": autoguard.guards.Number,
	"cues": autoguard.guards.Array.of(autoguard.guards.Object.of({
		"start_ms": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number,
		"lines": autoguard.guards.Array.of(autoguard.guards.String)
	}, {}))
}, {
	"language": autoguard.guards.String
});

export type SubtitleResource = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"subtitle">,
	"duration_ms": autoguard.guards.Number,
	"cues": autoguard.guards.Array<autoguard.guards.Object<{
		"start_ms": autoguard.guards.Number,
		"duration_ms": autoguard.guards.Number,
		"lines": autoguard.guards.Array<autoguard.guards.String>
	}, {}>>
}, {
	"language": autoguard.guards.String
}>;

export const VideoResource: autoguard.serialization.MessageGuard<VideoResource> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("video"),
	"duration_ms": autoguard.guards.Number,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {});

export type VideoResource = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"video">,
	"duration_ms": autoguard.guards.Number,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {}>;

export const Resource: autoguard.serialization.MessageGuard<Resource> = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => AudioResource),
	autoguard.guards.Reference.of(() => ImageResource),
	autoguard.guards.Reference.of(() => MetadataResource),
	autoguard.guards.Reference.of(() => SubtitleResource),
	autoguard.guards.Reference.of(() => VideoResource)
);

export type Resource = autoguard.guards.Union<[
	autoguard.guards.Reference<AudioResource>,
	autoguard.guards.Reference<ImageResource>,
	autoguard.guards.Reference<MetadataResource>,
	autoguard.guards.Reference<SubtitleResource>,
	autoguard.guards.Reference<VideoResource>
]>;

export const Probe: autoguard.serialization.MessageGuard<Probe> = autoguard.guards.Object.of({
	"resources": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Resource))
}, {
	"metadata": autoguard.guards.Reference.of(() => Metadata)
});

export type Probe = autoguard.guards.Object<{
	"resources": autoguard.guards.Array<autoguard.guards.Reference<Resource>>
}, {
	"metadata": autoguard.guards.Reference<Metadata>
}>;

export namespace Autoguard {
	export const Guards = {
		"ShowMetadata": autoguard.guards.Reference.of(() => ShowMetadata),
		"EpisodeMetadata": autoguard.guards.Reference.of(() => EpisodeMetadata),
		"MovieMetadata": autoguard.guards.Reference.of(() => MovieMetadata),
		"TrackMetadata": autoguard.guards.Reference.of(() => TrackMetadata),
		"AlbumMetadata": autoguard.guards.Reference.of(() => AlbumMetadata),
		"ArtistMetadata": autoguard.guards.Reference.of(() => ArtistMetadata),
		"Metadata": autoguard.guards.Reference.of(() => Metadata),
		"AudioResource": autoguard.guards.Reference.of(() => AudioResource),
		"ImageResource": autoguard.guards.Reference.of(() => ImageResource),
		"MetadataResource": autoguard.guards.Reference.of(() => MetadataResource),
		"SubtitleResource": autoguard.guards.Reference.of(() => SubtitleResource),
		"VideoResource": autoguard.guards.Reference.of(() => VideoResource),
		"Resource": autoguard.guards.Reference.of(() => Resource),
		"Probe": autoguard.guards.Reference.of(() => Probe)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
