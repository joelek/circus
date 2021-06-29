// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard";
import { Album } from "../../../api/schema/objects";
import { Artist } from "../../../api/schema/objects";
import { Disc } from "../../../api/schema/objects";
import { Episode } from "../../../api/schema/objects";
import { Movie } from "../../../api/schema/objects";
import { Playlist } from "../../../api/schema/objects";
import { Season } from "../../../api/schema/objects";
import { Show } from "../../../api/schema/objects";
import { Track } from "../../../api/schema/objects";

export const ContextAlbum = autoguard.guards.Reference.of(() => Album);

export type ContextAlbum = ReturnType<typeof ContextAlbum["as"]>;

export const ContextArtist = autoguard.guards.Reference.of(() => Artist);

export type ContextArtist = ReturnType<typeof ContextArtist["as"]>;

export const ContextDisc = autoguard.guards.Reference.of(() => Disc);

export type ContextDisc = ReturnType<typeof ContextDisc["as"]>;

export const ContextTrack = autoguard.guards.Reference.of(() => Track);

export type ContextTrack = ReturnType<typeof ContextTrack["as"]>;

export const ContextPlaylist = autoguard.guards.Reference.of(() => Playlist);

export type ContextPlaylist = ReturnType<typeof ContextPlaylist["as"]>;

export const ContextMovie = autoguard.guards.Reference.of(() => Movie);

export type ContextMovie = ReturnType<typeof ContextMovie["as"]>;

export const ContextShow = autoguard.guards.Reference.of(() => Show);

export type ContextShow = ReturnType<typeof ContextShow["as"]>;

export const ContextSeason = autoguard.guards.Reference.of(() => Season);

export type ContextSeason = ReturnType<typeof ContextSeason["as"]>;

export const ContextEpisode = autoguard.guards.Reference.of(() => Episode);

export type ContextEpisode = ReturnType<typeof ContextEpisode["as"]>;

export const Context = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => ContextAlbum),
	autoguard.guards.Reference.of(() => ContextArtist),
	autoguard.guards.Reference.of(() => ContextDisc),
	autoguard.guards.Reference.of(() => ContextTrack),
	autoguard.guards.Reference.of(() => ContextPlaylist),
	autoguard.guards.Reference.of(() => ContextMovie),
	autoguard.guards.Reference.of(() => ContextShow),
	autoguard.guards.Reference.of(() => ContextSeason),
	autoguard.guards.Reference.of(() => ContextEpisode)
);

export type Context = ReturnType<typeof Context["as"]>;

export const ContextItem = autoguard.guards.Union.of(
	autoguard.guards.Reference.of(() => ContextTrack),
	autoguard.guards.Reference.of(() => ContextMovie),
	autoguard.guards.Reference.of(() => ContextEpisode)
);

export type ContextItem = ReturnType<typeof ContextItem["as"]>;

export const Device = autoguard.guards.Object.of({
	"id": autoguard.guards.String,
	"protocol": autoguard.guards.String,
	"name": autoguard.guards.String,
	"type": autoguard.guards.String
});

export type Device = ReturnType<typeof Device["as"]>;

export const Session = autoguard.guards.Object.of({
	"context": autoguard.guards.Union.of(
		autoguard.guards.Reference.of(() => Context),
		autoguard.guards.Undefined
	),
	"device": autoguard.guards.Union.of(
		autoguard.guards.Reference.of(() => Device),
		autoguard.guards.Undefined
	),
	"index": autoguard.guards.Union.of(
		autoguard.guards.Number,
		autoguard.guards.Undefined
	),
	"playback": autoguard.guards.Boolean,
	"progress": autoguard.guards.Union.of(
		autoguard.guards.Number,
		autoguard.guards.Undefined
	)
});

export type Session = ReturnType<typeof Session["as"]>;

export namespace Autoguard {
	export const Guards = {
		"ContextAlbum": autoguard.guards.Reference.of(() => ContextAlbum),
		"ContextArtist": autoguard.guards.Reference.of(() => ContextArtist),
		"ContextDisc": autoguard.guards.Reference.of(() => ContextDisc),
		"ContextTrack": autoguard.guards.Reference.of(() => ContextTrack),
		"ContextPlaylist": autoguard.guards.Reference.of(() => ContextPlaylist),
		"ContextMovie": autoguard.guards.Reference.of(() => ContextMovie),
		"ContextShow": autoguard.guards.Reference.of(() => ContextShow),
		"ContextSeason": autoguard.guards.Reference.of(() => ContextSeason),
		"ContextEpisode": autoguard.guards.Reference.of(() => ContextEpisode),
		"Context": autoguard.guards.Reference.of(() => Context),
		"ContextItem": autoguard.guards.Reference.of(() => ContextItem),
		"Device": autoguard.guards.Reference.of(() => Device),
		"Session": autoguard.guards.Reference.of(() => Session)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};