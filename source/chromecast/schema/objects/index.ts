// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard/dist/lib-shared";

export const Image: autoguard.serialization.MessageGuard<Image> = autoguard.guards.Object.of({
	"url": autoguard.guards.String
}, {
	"height": autoguard.guards.Number,
	"width": autoguard.guards.Number
});

export type Image = autoguard.guards.Object<{
	"url": autoguard.guards.String
}, {
	"height": autoguard.guards.Number,
	"width": autoguard.guards.Number
}>;

export const Volume: autoguard.serialization.MessageGuard<Volume> = autoguard.guards.Object.of({}, {
	"level": autoguard.guards.Number,
	"muted": autoguard.guards.Boolean
});

export type Volume = autoguard.guards.Object<{}, {
	"level": autoguard.guards.Number,
	"muted": autoguard.guards.Boolean
}>;

export const MediaInformation: autoguard.serialization.MessageGuard<MediaInformation> = autoguard.guards.Object.of({
	"contentId": autoguard.guards.String,
	"streamType": autoguard.guards.Union.of(
		autoguard.guards.StringLiteral.of("NONE"),
		autoguard.guards.StringLiteral.of("BUFFERED"),
		autoguard.guards.StringLiteral.of("LIVE")
	),
	"contentType": autoguard.guards.String
}, {
	"metadata": autoguard.guards.Union.of(
		autoguard.guards.Reference.of(() => GenericMediaMetadata),
		autoguard.guards.Reference.of(() => MovieMediaMetadata),
		autoguard.guards.Reference.of(() => TvShowMediaMetadata),
		autoguard.guards.Reference.of(() => MusicTrackMediaMetadata),
		autoguard.guards.Reference.of(() => PhotoMediaMetadata)
	),
	"duration": autoguard.guards.Number,
	"customData": autoguard.guards.Record.of(autoguard.guards.Any),
	"tracks": autoguard.guards.Array.of(autoguard.guards.Group.of(autoguard.guards.Union.of(
		autoguard.guards.Object.of({
			"trackId": autoguard.guards.Number,
			"type": autoguard.guards.String
		}, {}),
		autoguard.guards.Object.of({
			"trackId": autoguard.guards.Number,
			"type": autoguard.guards.StringLiteral.of("TEXT"),
			"trackType": autoguard.guards.StringLiteral.of("TEXT"),
			"trackContentId": autoguard.guards.String,
			"trackContentType": autoguard.guards.String,
			"subtype": autoguard.guards.StringLiteral.of("SUBTITLES"),
			"language": autoguard.guards.String
		}, {
			"name": autoguard.guards.String,
			"customData": autoguard.guards.Record.of(autoguard.guards.Any)
		})
	)))
});

export type MediaInformation = autoguard.guards.Object<{
	"contentId": autoguard.guards.String,
	"streamType": autoguard.guards.Union<[
		autoguard.guards.StringLiteral<"NONE">,
		autoguard.guards.StringLiteral<"BUFFERED">,
		autoguard.guards.StringLiteral<"LIVE">
	]>,
	"contentType": autoguard.guards.String
}, {
	"metadata": autoguard.guards.Union<[
		autoguard.guards.Reference<GenericMediaMetadata>,
		autoguard.guards.Reference<MovieMediaMetadata>,
		autoguard.guards.Reference<TvShowMediaMetadata>,
		autoguard.guards.Reference<MusicTrackMediaMetadata>,
		autoguard.guards.Reference<PhotoMediaMetadata>
	]>,
	"duration": autoguard.guards.Number,
	"customData": autoguard.guards.Record<autoguard.guards.Any>,
	"tracks": autoguard.guards.Array<autoguard.guards.Group<autoguard.guards.Union<[
		autoguard.guards.Object<{
			"trackId": autoguard.guards.Number,
			"type": autoguard.guards.String
		}, {}>,
		autoguard.guards.Object<{
			"trackId": autoguard.guards.Number,
			"type": autoguard.guards.StringLiteral<"TEXT">,
			"trackType": autoguard.guards.StringLiteral<"TEXT">,
			"trackContentId": autoguard.guards.String,
			"trackContentType": autoguard.guards.String,
			"subtype": autoguard.guards.StringLiteral<"SUBTITLES">,
			"language": autoguard.guards.String
		}, {
			"name": autoguard.guards.String,
			"customData": autoguard.guards.Record<autoguard.guards.Any>
		}>
	]>>>
}>;

export const GenericMediaMetadata: autoguard.serialization.MessageGuard<GenericMediaMetadata> = autoguard.guards.Object.of({
	"metadataType": autoguard.guards.NumberLiteral.of(0)
}, {
	"title": autoguard.guards.String,
	"subtitle": autoguard.guards.String,
	"images": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Image)),
	"releaseDate": autoguard.guards.String
});

export type GenericMediaMetadata = autoguard.guards.Object<{
	"metadataType": autoguard.guards.NumberLiteral<0>
}, {
	"title": autoguard.guards.String,
	"subtitle": autoguard.guards.String,
	"images": autoguard.guards.Array<autoguard.guards.Reference<Image>>,
	"releaseDate": autoguard.guards.String
}>;

export const MovieMediaMetadata: autoguard.serialization.MessageGuard<MovieMediaMetadata> = autoguard.guards.Object.of({
	"metadataType": autoguard.guards.NumberLiteral.of(1)
}, {
	"title": autoguard.guards.String,
	"subtitle": autoguard.guards.String,
	"studio": autoguard.guards.String,
	"images": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Image)),
	"releaseDate": autoguard.guards.String
});

export type MovieMediaMetadata = autoguard.guards.Object<{
	"metadataType": autoguard.guards.NumberLiteral<1>
}, {
	"title": autoguard.guards.String,
	"subtitle": autoguard.guards.String,
	"studio": autoguard.guards.String,
	"images": autoguard.guards.Array<autoguard.guards.Reference<Image>>,
	"releaseDate": autoguard.guards.String
}>;

export const TvShowMediaMetadata: autoguard.serialization.MessageGuard<TvShowMediaMetadata> = autoguard.guards.Object.of({
	"metadataType": autoguard.guards.NumberLiteral.of(2)
}, {
	"seriesTitle": autoguard.guards.String,
	"subtitle": autoguard.guards.String,
	"season": autoguard.guards.Number,
	"episode": autoguard.guards.Number,
	"images": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Image)),
	"originalAirDate": autoguard.guards.String
});

export type TvShowMediaMetadata = autoguard.guards.Object<{
	"metadataType": autoguard.guards.NumberLiteral<2>
}, {
	"seriesTitle": autoguard.guards.String,
	"subtitle": autoguard.guards.String,
	"season": autoguard.guards.Number,
	"episode": autoguard.guards.Number,
	"images": autoguard.guards.Array<autoguard.guards.Reference<Image>>,
	"originalAirDate": autoguard.guards.String
}>;

export const MusicTrackMediaMetadata: autoguard.serialization.MessageGuard<MusicTrackMediaMetadata> = autoguard.guards.Object.of({
	"metadataType": autoguard.guards.NumberLiteral.of(3)
}, {
	"albumName": autoguard.guards.String,
	"title": autoguard.guards.String,
	"albumArtist": autoguard.guards.String,
	"artist": autoguard.guards.String,
	"composer": autoguard.guards.String,
	"trackNumber": autoguard.guards.Number,
	"discNumber": autoguard.guards.Number,
	"images": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Image)),
	"releaseDate": autoguard.guards.String
});

export type MusicTrackMediaMetadata = autoguard.guards.Object<{
	"metadataType": autoguard.guards.NumberLiteral<3>
}, {
	"albumName": autoguard.guards.String,
	"title": autoguard.guards.String,
	"albumArtist": autoguard.guards.String,
	"artist": autoguard.guards.String,
	"composer": autoguard.guards.String,
	"trackNumber": autoguard.guards.Number,
	"discNumber": autoguard.guards.Number,
	"images": autoguard.guards.Array<autoguard.guards.Reference<Image>>,
	"releaseDate": autoguard.guards.String
}>;

export const PhotoMediaMetadata: autoguard.serialization.MessageGuard<PhotoMediaMetadata> = autoguard.guards.Object.of({
	"metadataType": autoguard.guards.NumberLiteral.of(4)
}, {
	"title": autoguard.guards.String,
	"artist": autoguard.guards.String,
	"location": autoguard.guards.String,
	"latitude": autoguard.guards.Number,
	"longitude": autoguard.guards.Number,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number,
	"creationDateTime": autoguard.guards.String
});

export type PhotoMediaMetadata = autoguard.guards.Object<{
	"metadataType": autoguard.guards.NumberLiteral<4>
}, {
	"title": autoguard.guards.String,
	"artist": autoguard.guards.String,
	"location": autoguard.guards.String,
	"latitude": autoguard.guards.Number,
	"longitude": autoguard.guards.Number,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number,
	"creationDateTime": autoguard.guards.String
}>;

export const MediaStatus: autoguard.serialization.MessageGuard<MediaStatus> = autoguard.guards.Object.of({
	"mediaSessionId": autoguard.guards.Number,
	"playbackRate": autoguard.guards.Number,
	"playerState": autoguard.guards.Union.of(
		autoguard.guards.StringLiteral.of("IDLE"),
		autoguard.guards.StringLiteral.of("PLAYING"),
		autoguard.guards.StringLiteral.of("BUFFERING"),
		autoguard.guards.StringLiteral.of("PAUSED")
	),
	"currentTime": autoguard.guards.Number,
	"supportedMediaCommands": autoguard.guards.Number,
	"volume": autoguard.guards.Reference.of(() => Volume)
}, {
	"media": autoguard.guards.Union.of(
		autoguard.guards.Reference.of(() => MediaInformation),
		autoguard.guards.Object.of({}, {})
	),
	"idleReason": autoguard.guards.Union.of(
		autoguard.guards.StringLiteral.of("CANCELLED"),
		autoguard.guards.StringLiteral.of("INTERRUPTED"),
		autoguard.guards.StringLiteral.of("FINISHED"),
		autoguard.guards.StringLiteral.of("ERROR")
	),
	"customData": autoguard.guards.Record.of(autoguard.guards.Any)
});

export type MediaStatus = autoguard.guards.Object<{
	"mediaSessionId": autoguard.guards.Number,
	"playbackRate": autoguard.guards.Number,
	"playerState": autoguard.guards.Union<[
		autoguard.guards.StringLiteral<"IDLE">,
		autoguard.guards.StringLiteral<"PLAYING">,
		autoguard.guards.StringLiteral<"BUFFERING">,
		autoguard.guards.StringLiteral<"PAUSED">
	]>,
	"currentTime": autoguard.guards.Number,
	"supportedMediaCommands": autoguard.guards.Number,
	"volume": autoguard.guards.Reference<Volume>
}, {
	"media": autoguard.guards.Union<[
		autoguard.guards.Reference<MediaInformation>,
		autoguard.guards.Object<{}, {}>
	]>,
	"idleReason": autoguard.guards.Union<[
		autoguard.guards.StringLiteral<"CANCELLED">,
		autoguard.guards.StringLiteral<"INTERRUPTED">,
		autoguard.guards.StringLiteral<"FINISHED">,
		autoguard.guards.StringLiteral<"ERROR">
	]>,
	"customData": autoguard.guards.Record<autoguard.guards.Any>
}>;

export namespace Autoguard {
	export const Guards = {
		"Image": autoguard.guards.Reference.of(() => Image),
		"Volume": autoguard.guards.Reference.of(() => Volume),
		"MediaInformation": autoguard.guards.Reference.of(() => MediaInformation),
		"GenericMediaMetadata": autoguard.guards.Reference.of(() => GenericMediaMetadata),
		"MovieMediaMetadata": autoguard.guards.Reference.of(() => MovieMediaMetadata),
		"TvShowMediaMetadata": autoguard.guards.Reference.of(() => TvShowMediaMetadata),
		"MusicTrackMediaMetadata": autoguard.guards.Reference.of(() => MusicTrackMediaMetadata),
		"PhotoMediaMetadata": autoguard.guards.Reference.of(() => PhotoMediaMetadata),
		"MediaStatus": autoguard.guards.Reference.of(() => MediaStatus)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
