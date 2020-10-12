// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import { guards as autoguard } from "@joelek/ts-autoguard";

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
	"year": number,
	"artists": ArtistBase[],
	"artwork"?: File
};

export const AlbumBase = autoguard.Object.of<AlbumBase>({
	"album_id": autoguard.String,
	"title": autoguard.String,
	"year": autoguard.Number,
	"artists": autoguard.Array.of(autoguard.Reference.of<ArtistBase>(() => ArtistBase)),
	"artwork": autoguard.Union.of(
		autoguard.Undefined,
		autoguard.Reference.of<File>(() => File)
	)
});

export type Album = AlbumBase & {
	"discs": Disc[]
};

export const Album = autoguard.Intersection.of(
	autoguard.Reference.of<AlbumBase>(() => AlbumBase),
	autoguard.Object.of<{
		"discs": Disc[]
	}>({
		"discs": autoguard.Array.of(autoguard.Reference.of<Disc>(() => Disc))
	})
);

export type DiscBase = {
	"disc_id": string,
	"album": AlbumBase
};

export const DiscBase = autoguard.Object.of<DiscBase>({
	"disc_id": autoguard.String,
	"album": autoguard.Reference.of<AlbumBase>(() => AlbumBase)
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
	"artists": ArtistBase[],
	"duration_ms": number,
	"file": File
};

export const TrackBase = autoguard.Object.of<TrackBase>({
	"track_id": autoguard.String,
	"title": autoguard.String,
	"disc": autoguard.Reference.of<DiscBase>(() => DiscBase),
	"artists": autoguard.Array.of(autoguard.Reference.of<ArtistBase>(() => ArtistBase)),
	"duration_ms": autoguard.Number,
	"file": autoguard.Reference.of<File>(() => File)
});

export type Track = TrackBase & {};

export const Track = autoguard.Intersection.of(
	autoguard.Reference.of<TrackBase>(() => TrackBase),
	autoguard.Object.of<{}>({})
);

export type FileBase = {
	"file_id": string,
	"mime": string
};

export const FileBase = autoguard.Object.of<FileBase>({
	"file_id": autoguard.String,
	"mime": autoguard.String
});

export type File = FileBase & {};

export const File = autoguard.Intersection.of(
	autoguard.Reference.of<FileBase>(() => FileBase),
	autoguard.Object.of<{}>({})
);

export type Autoguard = {
	"ArtistBase": ArtistBase,
	"Artist": Artist,
	"AlbumBase": AlbumBase,
	"Album": Album,
	"DiscBase": DiscBase,
	"Disc": Disc,
	"TrackBase": TrackBase,
	"Track": Track,
	"FileBase": FileBase,
	"File": File
};

export const Autoguard = {
	"ArtistBase": ArtistBase,
	"Artist": Artist,
	"AlbumBase": AlbumBase,
	"Album": Album,
	"DiscBase": DiscBase,
	"Disc": Disc,
	"TrackBase": TrackBase,
	"Track": Track,
	"FileBase": FileBase,
	"File": File
};
