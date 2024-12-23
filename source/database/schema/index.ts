// This file was auto-generated by @joelek/autoguard. Edit at own risk.

import * as autoguard from "@joelek/autoguard/dist/lib-shared";

export const Directory: autoguard.serialization.MessageGuard<Directory> = autoguard.guards.Object.of({
	"directory_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {
	"parent_directory_id": autoguard.guards.String
});

export type Directory = autoguard.guards.Object<{
	"directory_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {
	"parent_directory_id": autoguard.guards.String
}>;

export const File: autoguard.serialization.MessageGuard<File> = autoguard.guards.Object.of({
	"file_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {
	"parent_directory_id": autoguard.guards.String,
	"index_timestamp": autoguard.guards.Number,
	"size": autoguard.guards.Number
});

export type File = autoguard.guards.Object<{
	"file_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {
	"parent_directory_id": autoguard.guards.String,
	"index_timestamp": autoguard.guards.Number,
	"size": autoguard.guards.Number
}>;

export const AudioFile: autoguard.serialization.MessageGuard<AudioFile> = autoguard.guards.Object.of({
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union.of(
		autoguard.guards.String,
		autoguard.guards.StringLiteral.of("audio/mp4"),
		autoguard.guards.StringLiteral.of("audio/mp3")
	),
	"duration_ms": autoguard.guards.Number
}, {
	"sample_rate_hz": autoguard.guards.Number,
	"channel_count": autoguard.guards.Number,
	"bits_per_sample": autoguard.guards.Number
});

export type AudioFile = autoguard.guards.Object<{
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union<[
		autoguard.guards.String,
		autoguard.guards.StringLiteral<"audio/mp4">,
		autoguard.guards.StringLiteral<"audio/mp3">
	]>,
	"duration_ms": autoguard.guards.Number
}, {
	"sample_rate_hz": autoguard.guards.Number,
	"channel_count": autoguard.guards.Number,
	"bits_per_sample": autoguard.guards.Number
}>;

export const ImageFile: autoguard.serialization.MessageGuard<ImageFile> = autoguard.guards.Object.of({
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union.of(
		autoguard.guards.String,
		autoguard.guards.StringLiteral.of("image/jpeg")
	),
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {});

export type ImageFile = autoguard.guards.Object<{
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union<[
		autoguard.guards.String,
		autoguard.guards.StringLiteral<"image/jpeg">
	]>,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {}>;

export const MetadataFile: autoguard.serialization.MessageGuard<MetadataFile> = autoguard.guards.Object.of({
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union.of(
		autoguard.guards.String,
		autoguard.guards.StringLiteral.of("application/json")
	)
}, {});

export type MetadataFile = autoguard.guards.Object<{
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union<[
		autoguard.guards.String,
		autoguard.guards.StringLiteral<"application/json">
	]>
}, {}>;

export const SubtitleFile: autoguard.serialization.MessageGuard<SubtitleFile> = autoguard.guards.Object.of({
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union.of(
		autoguard.guards.String,
		autoguard.guards.StringLiteral.of("text/vtt")
	),
	"duration_ms": autoguard.guards.Number
}, {
	"language": autoguard.guards.String
});

export type SubtitleFile = autoguard.guards.Object<{
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union<[
		autoguard.guards.String,
		autoguard.guards.StringLiteral<"text/vtt">
	]>,
	"duration_ms": autoguard.guards.Number
}, {
	"language": autoguard.guards.String
}>;

export const VideoFile: autoguard.serialization.MessageGuard<VideoFile> = autoguard.guards.Object.of({
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union.of(
		autoguard.guards.String,
		autoguard.guards.StringLiteral.of("video/mp4")
	),
	"duration_ms": autoguard.guards.Number,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {});

export type VideoFile = autoguard.guards.Object<{
	"file_id": autoguard.guards.String,
	"mime": autoguard.guards.Union<[
		autoguard.guards.String,
		autoguard.guards.StringLiteral<"video/mp4">
	]>,
	"duration_ms": autoguard.guards.Number,
	"width": autoguard.guards.Number,
	"height": autoguard.guards.Number
}, {}>;

export const VideoSubtitle: autoguard.serialization.MessageGuard<VideoSubtitle> = autoguard.guards.Object.of({
	"video_file_id": autoguard.guards.String,
	"subtitle_file_id": autoguard.guards.String
}, {});

export type VideoSubtitle = autoguard.guards.Object<{
	"video_file_id": autoguard.guards.String,
	"subtitle_file_id": autoguard.guards.String
}, {}>;

export const Artist: autoguard.serialization.MessageGuard<Artist> = autoguard.guards.Object.of({
	"artist_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type Artist = autoguard.guards.Object<{
	"artist_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const Album: autoguard.serialization.MessageGuard<Album> = autoguard.guards.Object.of({
	"album_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {
	"year": autoguard.guards.Number
});

export type Album = autoguard.guards.Object<{
	"album_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {
	"year": autoguard.guards.Number
}>;

export const AlbumFile: autoguard.serialization.MessageGuard<AlbumFile> = autoguard.guards.Object.of({
	"album_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {});

export type AlbumFile = autoguard.guards.Object<{
	"album_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {}>;

export const Disc: autoguard.serialization.MessageGuard<Disc> = autoguard.guards.Object.of({
	"disc_id": autoguard.guards.String,
	"album_id": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {});

export type Disc = autoguard.guards.Object<{
	"disc_id": autoguard.guards.String,
	"album_id": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {}>;

export const Track: autoguard.serialization.MessageGuard<Track> = autoguard.guards.Object.of({
	"track_id": autoguard.guards.String,
	"disc_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {
	"copyright": autoguard.guards.String
});

export type Track = autoguard.guards.Object<{
	"track_id": autoguard.guards.String,
	"disc_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {
	"copyright": autoguard.guards.String
}>;

export const TrackFile: autoguard.serialization.MessageGuard<TrackFile> = autoguard.guards.Object.of({
	"track_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {});

export type TrackFile = autoguard.guards.Object<{
	"track_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {}>;

export const AlbumArtist: autoguard.serialization.MessageGuard<AlbumArtist> = autoguard.guards.Object.of({
	"album_id": autoguard.guards.String,
	"artist_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {});

export type AlbumArtist = autoguard.guards.Object<{
	"album_id": autoguard.guards.String,
	"artist_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {}>;

export const TrackArtist: autoguard.serialization.MessageGuard<TrackArtist> = autoguard.guards.Object.of({
	"track_id": autoguard.guards.String,
	"artist_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {});

export type TrackArtist = autoguard.guards.Object<{
	"track_id": autoguard.guards.String,
	"artist_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {}>;

export const Category: autoguard.serialization.MessageGuard<Category> = autoguard.guards.Object.of({
	"category_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type Category = autoguard.guards.Object<{
	"category_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const AlbumCategory: autoguard.serialization.MessageGuard<AlbumCategory> = autoguard.guards.Object.of({
	"album_id": autoguard.guards.String,
	"category_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {});

export type AlbumCategory = autoguard.guards.Object<{
	"album_id": autoguard.guards.String,
	"category_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {}>;

export const Show: autoguard.serialization.MessageGuard<Show> = autoguard.guards.Object.of({
	"show_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {
	"summary": autoguard.guards.String,
	"imdb": autoguard.guards.String
});

export type Show = autoguard.guards.Object<{
	"show_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {
	"summary": autoguard.guards.String,
	"imdb": autoguard.guards.String
}>;

export const ShowFile: autoguard.serialization.MessageGuard<ShowFile> = autoguard.guards.Object.of({
	"show_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {});

export type ShowFile = autoguard.guards.Object<{
	"show_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {}>;

export const Season: autoguard.serialization.MessageGuard<Season> = autoguard.guards.Object.of({
	"season_id": autoguard.guards.String,
	"show_id": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {
	"title": autoguard.guards.String
});

export type Season = autoguard.guards.Object<{
	"season_id": autoguard.guards.String,
	"show_id": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {
	"title": autoguard.guards.String
}>;

export const Episode: autoguard.serialization.MessageGuard<Episode> = autoguard.guards.Object.of({
	"episode_id": autoguard.guards.String,
	"season_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
});

export type Episode = autoguard.guards.Object<{
	"episode_id": autoguard.guards.String,
	"season_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"number": autoguard.guards.Number
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
}>;

export const EpisodeFile: autoguard.serialization.MessageGuard<EpisodeFile> = autoguard.guards.Object.of({
	"episode_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {});

export type EpisodeFile = autoguard.guards.Object<{
	"episode_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {}>;

export const Movie: autoguard.serialization.MessageGuard<Movie> = autoguard.guards.Object.of({
	"movie_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
});

export type Movie = autoguard.guards.Object<{
	"movie_id": autoguard.guards.String,
	"title": autoguard.guards.String
}, {
	"year": autoguard.guards.Number,
	"summary": autoguard.guards.String,
	"copyright": autoguard.guards.String,
	"imdb": autoguard.guards.String
}>;

export const MovieFile: autoguard.serialization.MessageGuard<MovieFile> = autoguard.guards.Object.of({
	"movie_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {});

export type MovieFile = autoguard.guards.Object<{
	"movie_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {}>;

export const Actor: autoguard.serialization.MessageGuard<Actor> = autoguard.guards.Object.of({
	"actor_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type Actor = autoguard.guards.Object<{
	"actor_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const MovieActor: autoguard.serialization.MessageGuard<MovieActor> = autoguard.guards.Object.of({
	"movie_id": autoguard.guards.String,
	"actor_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {});

export type MovieActor = autoguard.guards.Object<{
	"movie_id": autoguard.guards.String,
	"actor_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {}>;

export const ShowActor: autoguard.serialization.MessageGuard<ShowActor> = autoguard.guards.Object.of({
	"show_id": autoguard.guards.String,
	"actor_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {});

export type ShowActor = autoguard.guards.Object<{
	"show_id": autoguard.guards.String,
	"actor_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {}>;

export const Genre: autoguard.serialization.MessageGuard<Genre> = autoguard.guards.Object.of({
	"genre_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {});

export type Genre = autoguard.guards.Object<{
	"genre_id": autoguard.guards.String,
	"name": autoguard.guards.String
}, {}>;

export const MovieGenre: autoguard.serialization.MessageGuard<MovieGenre> = autoguard.guards.Object.of({
	"movie_id": autoguard.guards.String,
	"genre_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {});

export type MovieGenre = autoguard.guards.Object<{
	"movie_id": autoguard.guards.String,
	"genre_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {}>;

export const ShowGenre: autoguard.serialization.MessageGuard<ShowGenre> = autoguard.guards.Object.of({
	"show_id": autoguard.guards.String,
	"genre_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {});

export type ShowGenre = autoguard.guards.Object<{
	"show_id": autoguard.guards.String,
	"genre_id": autoguard.guards.String,
	"order": autoguard.guards.Number
}, {}>;

export const Subtitle: autoguard.serialization.MessageGuard<Subtitle> = autoguard.guards.Object.of({
	"subtitle_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {});

export type Subtitle = autoguard.guards.Object<{
	"subtitle_id": autoguard.guards.String,
	"file_id": autoguard.guards.String
}, {}>;

export const Cue: autoguard.serialization.MessageGuard<Cue> = autoguard.guards.Object.of({
	"cue_id": autoguard.guards.String,
	"subtitle_id": autoguard.guards.String,
	"start_ms": autoguard.guards.Number,
	"duration_ms": autoguard.guards.Number,
	"lines": autoguard.guards.String
}, {});

export type Cue = autoguard.guards.Object<{
	"cue_id": autoguard.guards.String,
	"subtitle_id": autoguard.guards.String,
	"start_ms": autoguard.guards.Number,
	"duration_ms": autoguard.guards.Number,
	"lines": autoguard.guards.String
}, {}>;

export const User: autoguard.serialization.MessageGuard<User> = autoguard.guards.Object.of({
	"user_id": autoguard.guards.String,
	"name": autoguard.guards.String,
	"username": autoguard.guards.String,
	"password": autoguard.guards.String
}, {});

export type User = autoguard.guards.Object<{
	"user_id": autoguard.guards.String,
	"name": autoguard.guards.String,
	"username": autoguard.guards.String,
	"password": autoguard.guards.String
}, {}>;

export const Key: autoguard.serialization.MessageGuard<Key> = autoguard.guards.Object.of({
	"key_id": autoguard.guards.String
}, {
	"user_id": autoguard.guards.String
});

export type Key = autoguard.guards.Object<{
	"key_id": autoguard.guards.String
}, {
	"user_id": autoguard.guards.String
}>;

export const Token: autoguard.serialization.MessageGuard<Token> = autoguard.guards.Object.of({
	"token_id": autoguard.guards.String,
	"user_id": autoguard.guards.String,
	"hash": autoguard.guards.String,
	"expires_ms": autoguard.guards.Number
}, {});

export type Token = autoguard.guards.Object<{
	"token_id": autoguard.guards.String,
	"user_id": autoguard.guards.String,
	"hash": autoguard.guards.String,
	"expires_ms": autoguard.guards.Number
}, {}>;

export const Stream: autoguard.serialization.MessageGuard<Stream> = autoguard.guards.Object.of({
	"stream_id": autoguard.guards.String,
	"user_id": autoguard.guards.String,
	"file_id": autoguard.guards.String,
	"timestamp_ms": autoguard.guards.Number
}, {});

export type Stream = autoguard.guards.Object<{
	"stream_id": autoguard.guards.String,
	"user_id": autoguard.guards.String,
	"file_id": autoguard.guards.String,
	"timestamp_ms": autoguard.guards.Number
}, {}>;

export const Playlist: autoguard.serialization.MessageGuard<Playlist> = autoguard.guards.Object.of({
	"playlist_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"description": autoguard.guards.String,
	"user_id": autoguard.guards.String
}, {});

export type Playlist = autoguard.guards.Object<{
	"playlist_id": autoguard.guards.String,
	"title": autoguard.guards.String,
	"description": autoguard.guards.String,
	"user_id": autoguard.guards.String
}, {}>;

export const PlaylistItem: autoguard.serialization.MessageGuard<PlaylistItem> = autoguard.guards.Object.of({
	"playlist_item_id": autoguard.guards.String,
	"playlist_id": autoguard.guards.String,
	"track_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"added_ms": autoguard.guards.Number
}, {});

export type PlaylistItem = autoguard.guards.Object<{
	"playlist_item_id": autoguard.guards.String,
	"playlist_id": autoguard.guards.String,
	"track_id": autoguard.guards.String,
	"number": autoguard.guards.Number,
	"added_ms": autoguard.guards.Number
}, {}>;

export const Year: autoguard.serialization.MessageGuard<Year> = autoguard.guards.Object.of({
	"year_id": autoguard.guards.String,
	"year": autoguard.guards.Number
}, {});

export type Year = autoguard.guards.Object<{
	"year_id": autoguard.guards.String,
	"year": autoguard.guards.Number
}, {}>;

export namespace Autoguard {
	export const Guards = {
		"Directory": autoguard.guards.Reference.of(() => Directory),
		"File": autoguard.guards.Reference.of(() => File),
		"AudioFile": autoguard.guards.Reference.of(() => AudioFile),
		"ImageFile": autoguard.guards.Reference.of(() => ImageFile),
		"MetadataFile": autoguard.guards.Reference.of(() => MetadataFile),
		"SubtitleFile": autoguard.guards.Reference.of(() => SubtitleFile),
		"VideoFile": autoguard.guards.Reference.of(() => VideoFile),
		"VideoSubtitle": autoguard.guards.Reference.of(() => VideoSubtitle),
		"Artist": autoguard.guards.Reference.of(() => Artist),
		"Album": autoguard.guards.Reference.of(() => Album),
		"AlbumFile": autoguard.guards.Reference.of(() => AlbumFile),
		"Disc": autoguard.guards.Reference.of(() => Disc),
		"Track": autoguard.guards.Reference.of(() => Track),
		"TrackFile": autoguard.guards.Reference.of(() => TrackFile),
		"AlbumArtist": autoguard.guards.Reference.of(() => AlbumArtist),
		"TrackArtist": autoguard.guards.Reference.of(() => TrackArtist),
		"Category": autoguard.guards.Reference.of(() => Category),
		"AlbumCategory": autoguard.guards.Reference.of(() => AlbumCategory),
		"Show": autoguard.guards.Reference.of(() => Show),
		"ShowFile": autoguard.guards.Reference.of(() => ShowFile),
		"Season": autoguard.guards.Reference.of(() => Season),
		"Episode": autoguard.guards.Reference.of(() => Episode),
		"EpisodeFile": autoguard.guards.Reference.of(() => EpisodeFile),
		"Movie": autoguard.guards.Reference.of(() => Movie),
		"MovieFile": autoguard.guards.Reference.of(() => MovieFile),
		"Actor": autoguard.guards.Reference.of(() => Actor),
		"MovieActor": autoguard.guards.Reference.of(() => MovieActor),
		"ShowActor": autoguard.guards.Reference.of(() => ShowActor),
		"Genre": autoguard.guards.Reference.of(() => Genre),
		"MovieGenre": autoguard.guards.Reference.of(() => MovieGenre),
		"ShowGenre": autoguard.guards.Reference.of(() => ShowGenre),
		"Subtitle": autoguard.guards.Reference.of(() => Subtitle),
		"Cue": autoguard.guards.Reference.of(() => Cue),
		"User": autoguard.guards.Reference.of(() => User),
		"Key": autoguard.guards.Reference.of(() => Key),
		"Token": autoguard.guards.Reference.of(() => Token),
		"Stream": autoguard.guards.Reference.of(() => Stream),
		"Playlist": autoguard.guards.Reference.of(() => Playlist),
		"PlaylistItem": autoguard.guards.Reference.of(() => PlaylistItem),
		"Year": autoguard.guards.Reference.of(() => Year)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
