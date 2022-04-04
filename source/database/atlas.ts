import * as atlas from "@joelek/atlas";
import { WritableQueue } from "@joelek/atlas";

const context = atlas.createContext();

const directories = context.createStore({
	directory_id: context.createBinaryField(),
	name: context.createStringField(),
	parent_directory_id: context.createNullableBinaryField()
}, ["directory_id"], {

});

export type Directory = atlas.RecordOf<typeof directories>;

const files = context.createStore({
	file_id: context.createBinaryField(),
	name: context.createStringField(),
	parent_directory_id: context.createNullableBinaryField(),
	index_timestamp: context.createNullableIntegerField(),
	size: context.createIntegerField()
}, ["file_id"], {

});

export type File = atlas.RecordOf<typeof files>;

const audio_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "audio/mp4" | "audio/mp3"
	duration_ms: context.createIntegerField()
}, ["file_id"], {

});

export type AudioFile = atlas.RecordOf<typeof audio_files>;

const image_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "image/jpeg"
	width: context.createIntegerField(),
	height: context.createIntegerField()
}, ["file_id"], {

});

export type ImageFile = atlas.RecordOf<typeof image_files>;

const metadata_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField() // "application/json"
}, ["file_id"], {

});

export type MetadataFile = atlas.RecordOf<typeof metadata_files>;

const subtitle_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "text/vtt"
	duration_ms: context.createIntegerField(),
	language: context.createNullableStringField()
}, ["file_id"], {

});

export type SubtitleFile = atlas.RecordOf<typeof subtitle_files>;

const video_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "video/mp4"
	duration_ms: context.createIntegerField(),
	width: context.createIntegerField(),
	height: context.createIntegerField()
}, ["file_id"], {

});

export type VideoFile = atlas.RecordOf<typeof video_files>;

const video_subtitles = context.createStore({
	video_file_id: context.createBinaryField(),
	subtitle_file_id: context.createBinaryField()
}, ["video_file_id", "subtitle_file_id"], {

});

export type VideoSubtitle = atlas.RecordOf<typeof video_subtitles>;

const artists = context.createStore({
	artist_id: context.createBinaryField(),
	name: context.createStringField(),
	affinity: context.createNumberField()
}, ["artist_id"], {
	name: context.createIncreasingOrder()
});

export type Artist = atlas.RecordOf<typeof artists>;

const albums = context.createStore({
	album_id: context.createBinaryField(),
	title: context.createStringField(),
	year_id: context.createNullableBinaryField(),
	timestamp_ms: context.createNullableIntegerField(),
	affinity: context.createNumberField()
}, ["album_id"], {
	title: context.createIncreasingOrder()
});

export type Album = atlas.RecordOf<typeof albums>;

const album_files = context.createStore({
	album_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["album_id", "file_id"], {

});

export type AlbumFile = atlas.RecordOf<typeof album_files>;

const discs = context.createStore({
	disc_id: context.createBinaryField(),
	album_id: context.createBinaryField(),
	number: context.createIntegerField(),
	timestamp_ms: context.createNullableIntegerField(),
	affinity: context.createNumberField()
}, ["disc_id"], {

});

export type Disc = atlas.RecordOf<typeof discs>;

const tracks = context.createStore({
	track_id: context.createBinaryField(),
	disc_id: context.createBinaryField(),
	title: context.createStringField(),
	number: context.createIntegerField(),
	copyright: context.createNullableStringField(),
	timestamp_ms: context.createNullableIntegerField(),
	affinity: context.createNumberField()
}, ["track_id"], {
	title: context.createIncreasingOrder()
});

export type Track = atlas.RecordOf<typeof tracks>;

const track_files = context.createStore({
	track_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["track_id", "file_id"], {

});

export type TrackFile = atlas.RecordOf<typeof track_files>;

const album_artists = context.createStore({
	album_id: context.createBinaryField(),
	artist_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["album_id", "artist_id"], {

});

export type AlbumArtist = atlas.RecordOf<typeof album_artists>;

const track_artists = context.createStore({
	track_id: context.createBinaryField(),
	artist_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["track_id", "artist_id"], {

});

export type TrackArtist = atlas.RecordOf<typeof track_artists>;

const shows = context.createStore({
	show_id: context.createBinaryField(),
	name: context.createStringField(),
	summary: context.createNullableStringField(),
	imdb: context.createNullableStringField(),
	timestamp_ms: context.createNullableIntegerField(),
	affinity: context.createNumberField()
}, ["show_id"], {
	name: context.createIncreasingOrder()
});

export type Show = atlas.RecordOf<typeof shows>;

const show_files = context.createStore({
	show_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["show_id", "file_id"], {

});

export type ShowFile = atlas.RecordOf<typeof show_files>;

const seasons = context.createStore({
	season_id: context.createBinaryField(),
	show_id: context.createBinaryField(),
	number: context.createIntegerField(),
	timestamp_ms: context.createNullableIntegerField(),
	affinity: context.createNumberField()
}, ["season_id"], {

});

export type Season = atlas.RecordOf<typeof seasons>;

const episodes = context.createStore({
	episode_id: context.createBinaryField(),
	season_id: context.createBinaryField(),
	title: context.createStringField(),
	number: context.createIntegerField(),
	year_id: context.createNullableBinaryField(),
	summary: context.createNullableStringField(),
	copyright: context.createNullableStringField(),
	imdb: context.createNullableStringField(),
	timestamp_ms: context.createNullableIntegerField(),
	affinity: context.createNumberField()
}, ["episode_id"], {
	title: context.createIncreasingOrder()
});

export type Episode = atlas.RecordOf<typeof episodes>;

const episode_files = context.createStore({
	episode_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["episode_id", "file_id"], {

});

export type EpisodeFile = atlas.RecordOf<typeof episode_files>;

const movies = context.createStore({
	movie_id: context.createBinaryField(),
	title: context.createStringField(),
	year_id: context.createNullableBinaryField(),
	summary: context.createNullableStringField(),
	copyright: context.createNullableStringField(),
	imdb: context.createNullableStringField(),
	timestamp_ms: context.createNullableIntegerField(),
	affinity: context.createNumberField()
}, ["movie_id"], {
	title: context.createIncreasingOrder()
});

export type Movie = atlas.RecordOf<typeof movies>;

const movie_files = context.createStore({
	movie_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["movie_id", "file_id"], {

});

export type MovieFile = atlas.RecordOf<typeof movie_files>;

const actors = context.createStore({
	actor_id: context.createBinaryField(),
	name: context.createStringField(),
	affinity: context.createNumberField()
}, ["actor_id"], {
	name: context.createIncreasingOrder()
});

export type Actor = atlas.RecordOf<typeof actors>;

const movie_actors = context.createStore({
	movie_id: context.createBinaryField(),
	actor_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["movie_id", "actor_id"], {

});

export type MovieActor = atlas.RecordOf<typeof movie_actors>;

const show_actors = context.createStore({
	show_id: context.createBinaryField(),
	actor_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["show_id", "actor_id"], {

});

export type ShowActor = atlas.RecordOf<typeof show_actors>;

const genres = context.createStore({
	genre_id: context.createBinaryField(),
	name: context.createStringField(),
	affinity: context.createNumberField()
}, ["genre_id"], {
	name: context.createIncreasingOrder()
});

export type Genre = atlas.RecordOf<typeof genres>;

const movie_genres = context.createStore({
	movie_id: context.createBinaryField(),
	genre_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["movie_id", "genre_id"], {

});

export type MovieGenre = atlas.RecordOf<typeof movie_genres>;

const show_genres = context.createStore({
	show_id: context.createBinaryField(),
	genre_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["show_id", "genre_id"], {

});

export type ShowGenre = atlas.RecordOf<typeof show_genres>;

const subtitles = context.createStore({
	subtitle_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["subtitle_id"], {

});

export type Subtitle = atlas.RecordOf<typeof subtitles>;

const cues = context.createStore({
	cue_id: context.createBinaryField(),
	subtitle_id: context.createBinaryField(),
	start_ms: context.createIntegerField(),
	duration_ms: context.createIntegerField(),
	lines: context.createStringField()
}, ["cue_id"], {

});

export type Cue = atlas.RecordOf<typeof cues>;

const users = context.createStore({
	user_id: context.createBinaryField(),
	name: context.createStringField(),
	username: context.createStringField(),
	password: context.createStringField()
}, ["user_id"], {
	name: context.createIncreasingOrder()
});

export type User = atlas.RecordOf<typeof users>;

const keys = context.createStore({
	key_id: context.createBinaryField(),
	user_id: context.createNullableBinaryField()
}, ["key_id"], {

});

export type Key = atlas.RecordOf<typeof keys>;

const tokens = context.createStore({
	token_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	hash: context.createBinaryField(),
	expires_ms: context.createIntegerField()
}, ["token_id"], {

});

export type Token = atlas.RecordOf<typeof tokens>;

const streams = context.createStore({
	stream_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	file_id: context.createBinaryField(),
	timestamp_ms: context.createIntegerField()
}, ["stream_id"], {

});

export type Stream = atlas.RecordOf<typeof streams>;

const playlists = context.createStore({
	playlist_id: context.createBinaryField(),
	title: context.createStringField(),
	description: context.createStringField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["playlist_id"], {
	title: context.createIncreasingOrder()
});

export type Playlist = atlas.RecordOf<typeof playlists>;

const playlist_items = context.createStore({
	playlist_item_id: context.createBinaryField(),
	playlist_id: context.createBinaryField(),
	track_id: context.createBinaryField(),
	number: context.createIntegerField(),
	added_ms: context.createIntegerField()
}, ["playlist_item_id"], {

});

export type PlaylistItem = atlas.RecordOf<typeof playlist_items>;

const years = context.createStore({
	year_id: context.createBinaryField(),
	year: context.createIntegerField(),
	affinity: context.createNumberField()
}, ["year_id"], {
	year: context.createIncreasingOrder()
});

export type Year = atlas.RecordOf<typeof years>;

const artist_affinities = context.createStore({
	artist_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "artist_id"], {

});

export type ArtistAffinity = atlas.RecordOf<typeof artist_affinities>;

const actor_affinities = context.createStore({
	actor_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "actor_id"], {

});

export type ActorAffinity = atlas.RecordOf<typeof actor_affinities>;

const genre_affinities = context.createStore({
	genre_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "genre_id"], {

});

export type GenreAffinity = atlas.RecordOf<typeof genre_affinities>;

const playlist_affinities = context.createStore({
	playlist_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "playlist_id"], {

});

export type PlaylistAffinity = atlas.RecordOf<typeof playlist_affinities>;

const year_affinities = context.createStore({
	year_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "year_id"], {

});

export type YearAffinity = atlas.RecordOf<typeof year_affinities>;

const track_affinities = context.createStore({
	track_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "track_id"], {

});

export type TrackAffinity = atlas.RecordOf<typeof track_affinities>;

const disc_affinities = context.createStore({
	disc_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "disc_id"], {

});

export type DiscAffinity = atlas.RecordOf<typeof disc_affinities>;

const album_affinities = context.createStore({
	album_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "album_id"], {

});

export type AlbumAffinity = atlas.RecordOf<typeof album_affinities>;

const movie_affinities = context.createStore({
	movie_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "movie_id"], {

});

export type MovieAffinity = atlas.RecordOf<typeof movie_affinities>;

const episode_affinities = context.createStore({
	episode_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "episode_id"], {

});

export type EpisodeAffinity = atlas.RecordOf<typeof episode_affinities>;

const season_affinities = context.createStore({
	season_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "season_id"], {

});

export type SeasonAffinity = atlas.RecordOf<typeof season_affinities>;

const show_affinities = context.createStore({
	show_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["user_id", "show_id"], {

});

export type ShowAffinity = atlas.RecordOf<typeof show_affinities>;

const movie_suggestions = context.createStore({
	movie_id: context.createBinaryField(),
	suggested_movie_id: context.createBinaryField(),
	affinity: context.createNumberField()
}, ["movie_id", "suggested_movie_id"], {

});

export type MovieSuggestion = atlas.RecordOf<typeof movie_suggestions>;

const movie_movie_suggestions = context.createLink(movies, movie_suggestions, {
	movie_id: "movie_id"
}, {
	affinity: context.createDecreasingOrder()
});

const movie_movie_suggestions_two = context.createLink(movies, movie_suggestions, {
	movie_id: "suggested_movie_id"
}, {

});

const track_track_affinities = context.createLink(tracks, track_affinities, {
	track_id: "track_id"
}, {

});

const user_track_affinities = context.createLink(users, track_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const disc_disc_affinities = context.createLink(discs, disc_affinities, {
	disc_id: "disc_id"
}, {

});

const user_disc_affinities = context.createLink(users, disc_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const album_album_affinities = context.createLink(albums, album_affinities, {
	album_id: "album_id"
}, {

});

const user_album_affinities = context.createLink(users, album_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const movie_movie_affinities = context.createLink(movies, movie_affinities, {
	movie_id: "movie_id"
}, {

});

const user_movie_affinities = context.createLink(users, movie_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const episode_episode_affinities = context.createLink(episodes, episode_affinities, {
	episode_id: "episode_id"
}, {

});

const user_episode_affinities = context.createLink(users, episode_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const season_season_affinities = context.createLink(seasons, season_affinities, {
	season_id: "season_id"
}, {

});

const user_season_affinities = context.createLink(users, season_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const show_show_affinities = context.createLink(shows, show_affinities, {
	show_id: "show_id"
}, {

});

const user_show_affinities = context.createLink(users, show_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const artist_artist_affinities = context.createLink(artists, artist_affinities, {
	artist_id: "artist_id"
}, {

});

const user_artist_affinities = context.createLink(users, artist_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const genre_genre_affinities = context.createLink(genres, genre_affinities, {
	genre_id: "genre_id"
}, {

});

const user_genre_affinities = context.createLink(users, genre_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const actor_actor_affinities = context.createLink(actors, actor_affinities, {
	actor_id: "actor_id"
}, {

});

const user_actor_affinities = context.createLink(users, actor_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const playlist_playlist_affinities = context.createLink(playlists, playlist_affinities, {
	playlist_id: "playlist_id"
}, {

});

const user_playlist_affinities = context.createLink(users, playlist_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const year_year_affinities = context.createLink(years, year_affinities, {
	year_id: "year_id"
}, {

});

const user_year_affinities = context.createLink(users, year_affinities, {
	user_id: "user_id"
}, {
	affinity: context.createDecreasingOrder()
});

const directory_directories = context.createLink(directories, directories, {
	directory_id: "parent_directory_id"
}, {
	name: context.createIncreasingOrder()
});

const directory_files = context.createLink(directories, files, {
	directory_id: "parent_directory_id"
}, {
	name: context.createIncreasingOrder()
});

const file_audio_files = context.createLink(files, audio_files, {
	file_id: "file_id"
}, {

});

const file_image_files = context.createLink(files, image_files, {
	file_id: "file_id"
}, {

});

const file_metadata_files = context.createLink(files, metadata_files, {
	file_id: "file_id"
}, {

});

const file_subtitle_files = context.createLink(files, subtitle_files, {
	file_id: "file_id"
}, {

});

const file_video_files = context.createLink(files, video_files, {
	file_id: "file_id"
}, {

});

const video_file_video_subtitles = context.createLink(video_files, video_subtitles, {
	file_id: "video_file_id"
}, {

});

const subtitle_file_video_subtitles = context.createLink(subtitle_files, video_subtitles, {
	file_id: "subtitle_file_id"
}, {

});

const file_album_files = context.createLink(files, album_files, {
	file_id: "file_id"
}, {

});

const album_album_files = context.createLink(albums, album_files, {
	album_id: "album_id"
}, {

});

const album_discs = context.createLink(albums, discs, {
	album_id: "album_id"
}, {
	number: context.createIncreasingOrder()
});

const disc_tracks = context.createLink(discs, tracks, {
	disc_id: "disc_id"
}, {
	number: context.createIncreasingOrder()
});

const file_track_files = context.createLink(files, track_files, {
	file_id: "file_id"
}, {

});

const track_track_files = context.createLink(tracks, track_files, {
	track_id: "track_id"
}, {

});

const album_album_artists = context.createLink(albums, album_artists, {
	album_id: "album_id"
}, {
	order: context.createIncreasingOrder()
});

const artist_album_artists = context.createLink(artists, album_artists, {
	artist_id: "artist_id"
}, {

});

const track_track_artists = context.createLink(tracks, track_artists, {
	track_id: "track_id"
}, {
	order: context.createIncreasingOrder()
});

const artist_track_artists = context.createLink(artists, track_artists, {
	artist_id: "artist_id"
}, {

});

const file_show_files = context.createLink(files, show_files, {
	file_id: "file_id"
}, {

});

const show_show_files = context.createLink(shows, show_files, {
	show_id: "show_id"
}, {

});

const show_seasons = context.createLink(shows, seasons, {
	show_id: "show_id"
}, {
	number: context.createIncreasingOrder()
});

const season_episodes = context.createLink(seasons, episodes, {
	season_id: "season_id"
}, {
	number: context.createIncreasingOrder()
});

const file_episode_files = context.createLink(files, episode_files, {
	file_id: "file_id"
}, {

});

const episode_episode_files = context.createLink(episodes, episode_files, {
	episode_id: "episode_id"
}, {

});

const file_movie_files = context.createLink(files, movie_files, {
	file_id: "file_id"
}, {

});

const movie_movie_files = context.createLink(movies, movie_files, {
	movie_id: "movie_id"
}, {

});

const actor_movie_actors = context.createLink(actors, movie_actors, {
	actor_id: "actor_id"
}, {

});

const movie_movie_actors = context.createLink(movies, movie_actors, {
	movie_id: "movie_id"
}, {
	order: context.createIncreasingOrder()
});

const actor_show_actors = context.createLink(actors, show_actors, {
	actor_id: "actor_id"
}, {

});

const show_show_actors = context.createLink(shows, show_actors, {
	show_id: "show_id"
}, {
	order: context.createIncreasingOrder()
});

const genre_movie_genres = context.createLink(genres, movie_genres, {
	genre_id: "genre_id"
}, {

});

const movie_movie_genres = context.createLink(movies, movie_genres, {
	movie_id: "movie_id"
}, {
	order: context.createIncreasingOrder()
});

const genre_show_genres = context.createLink(genres, show_genres, {
	genre_id: "genre_id"
}, {

});

const show_show_genres = context.createLink(shows, show_genres, {
	show_id: "show_id"
}, {
	order: context.createIncreasingOrder()
});

const subtitle_cues = context.createLink(subtitles, cues, {
	subtitle_id: "subtitle_id"
}, {
	start_ms: context.createIncreasingOrder()
});

const user_keys = context.createLink(users, keys, {
	user_id: "user_id"
}, {

});

const user_tokens = context.createLink(users, tokens, {
	user_id: "user_id"
}, {

});

const user_streams = context.createLink(users, streams, {
	user_id: "user_id"
}, {
	timestamp_ms: context.createDecreasingOrder()
});

const file_streams = context.createLink(files, streams, {
	file_id: "file_id"
}, {
	timestamp_ms: context.createDecreasingOrder()
});

const user_playlists = context.createLink(users, playlists, {
	user_id: "user_id"
}, {
	title: context.createIncreasingOrder()
});

const playlist_playlist_items = context.createLink(playlists, playlist_items, {
	playlist_id: "playlist_id"
}, {
	number: context.createIncreasingOrder()
});

const track_playlist_items = context.createLink(tracks, playlist_items, {
	track_id: "track_id"
}, {

});

const year_movies = context.createLink(years, movies, {
	year_id: "year_id"
}, {
	title: context.createIncreasingOrder()
});

const year_albums = context.createLink(years, albums, {
	year_id: "year_id"
}, {
	title: context.createIncreasingOrder()
});

const year_episodes = context.createLink(years, episodes, {
	year_id: "year_id"
}, {
	title: context.createIncreasingOrder()
});

const getStreamsFromUserIdAndFileId = context.createQuery(streams, {
	file_id: context.createEqualityOperator(),
	user_id: context.createEqualityOperator()
}, {
	timestamp_ms: context.createDecreasingOrder()
});

const getUsersFromUsername = context.createQuery(users, {
	username: context.createEqualityOperator()
}, {

});

const getRecentlyUpdatedAlbums = context.createQuery(albums, {

}, {
	timestamp_ms: context.createDecreasingOrder()
});

const getRecentlyUpdatedDiscs = context.createQuery(discs, {

}, {
	timestamp_ms: context.createDecreasingOrder()
});

const getRecentlyUpdatedTracks = context.createQuery(tracks, {

}, {
	timestamp_ms: context.createDecreasingOrder()
});


const getRecentlyUpdatedMovies = context.createQuery(movies, {

}, {
	timestamp_ms: context.createDecreasingOrder()
});

const getRecentlyUpdatedShows = context.createQuery(shows, {

}, {
	timestamp_ms: context.createDecreasingOrder()
});

const getRecentlyUpdatedSeasons = context.createQuery(seasons, {

}, {
	timestamp_ms: context.createDecreasingOrder()
});

const getRecentlyUpdatedEpisodes = context.createQuery(episodes, {

}, {
	timestamp_ms: context.createDecreasingOrder()
});

export const { transactionManager } = context.createTransactionManager("./private/db/", {
	directories,
	files,
	audio_files,
	image_files,
	metadata_files,
	subtitle_files,
	video_files,
	video_subtitles,
	artists,
	albums,
	album_files,
	discs,
	tracks,
	track_files,
	album_artists,
	track_artists,
	shows,
	show_files,
	seasons,
	episodes,
	episode_files,
	movies,
	movie_files,
	actors,
	movie_actors,
	show_actors,
	genres,
	movie_genres,
	show_genres,
	subtitles,
	cues,
	users,
	keys,
	tokens,
	streams,
	playlists,
	playlist_items,
	years,
	track_affinities,
	disc_affinities,
	album_affinities,
	movie_affinities,
	episode_affinities,
	season_affinities,
	show_affinities,
	artist_affinities,
	actor_affinities,
	genre_affinities,
	playlist_affinities,
	year_affinities,
	movie_suggestions
}, {
	directory_directories,
	directory_files,
	file_audio_files,
	file_image_files,
	file_metadata_files,
	file_subtitle_files,
	file_video_files,
	video_file_video_subtitles,
	subtitle_file_video_subtitles,
	file_album_files,
	album_album_files,
	album_discs,
	disc_tracks,
	file_track_files,
	track_track_files,
	album_album_artists,
	artist_album_artists,
	track_track_artists,
	artist_track_artists,
	file_show_files,
	show_show_files,
	show_seasons,
	season_episodes,
	file_episode_files,
	episode_episode_files,
	file_movie_files,
	movie_movie_files,
	actor_movie_actors,
	movie_movie_actors,
	actor_show_actors,
	show_show_actors,
	genre_movie_genres,
	movie_movie_genres,
	genre_show_genres,
	show_show_genres,
	subtitle_cues,
	user_keys,
	user_tokens,
	user_streams,
	file_streams,
	user_playlists,
	playlist_playlist_items,
	track_playlist_items,
	year_movies,
	year_episodes,
	year_albums,
	user_track_affinities,
	track_track_affinities,
	user_disc_affinities,
	disc_disc_affinities,
	user_album_affinities,
	album_album_affinities,
	user_movie_affinities,
	movie_movie_affinities,
	user_episode_affinities,
	episode_episode_affinities,
	user_season_affinities,
	season_season_affinities,
	user_show_affinities,
	show_show_affinities,
	user_artist_affinities,
	artist_artist_affinities,
	user_actor_affinities,
	actor_actor_affinities,
	user_genre_affinities,
	genre_genre_affinities,
	user_playlist_affinities,
	playlist_playlist_affinities,
	user_year_affinities,
	year_year_affinities,
	movie_movie_suggestions,
	movie_movie_suggestions_two
}, {
	getUsersFromUsername,
	getStreamsFromUserIdAndFileId,
	getRecentlyUpdatedAlbums,
	getRecentlyUpdatedDiscs,
	getRecentlyUpdatedTracks,
	getRecentlyUpdatedMovies,
	getRecentlyUpdatedShows,
	getRecentlyUpdatedSeasons,
	getRecentlyUpdatedEpisodes
});

export const stores = transactionManager.createTransactionalStores();
export const links = transactionManager.createTransactionalLinks();
export const queries = transactionManager.createTransactionalQueries();

// Double precision can store positive values between 2^-1022 (inclusive) and 2^1024 (exclusive).
export function computeAffinity(timestamp_ms: number): number {
	let time_base_ms = (1000 * 60 * 60 * 24 * 7 * 2);
	let epoch_start_ms = new Date("2000-01-01T00:00:00Z").valueOf();
	let epoch_length_ms = (1024 + 1022) * time_base_ms;
	let time_bias_ms = epoch_start_ms + epoch_length_ms * 0.5;
	let time_delta_ms = timestamp_ms - time_bias_ms;
	return Math.pow(2.0, time_delta_ms / time_base_ms);
};

export function adjustAffinity(affinity: number): number {
	let time_base_ms = (1000 * 60 * 60 * 24 * 7 * 2);
	let epoch_start_ms = new Date("2000-01-01T00:00:00Z").valueOf();
	let epoch_length_ms = (1024 + 1022) * time_base_ms;
	let time_bias_ms = epoch_start_ms + epoch_length_ms * 0.5;
	let time_delta_ms = Math.log2(affinity) * time_base_ms;
	let timestamp_ms = time_delta_ms + time_bias_ms;
	let adjusted_time_delta_ms = timestamp_ms - Date.now();
	return Math.pow(2.0, adjusted_time_delta_ms / time_base_ms);
};

async function createTrackStream(queue: WritableQueue, stream: Stream): Promise<void> {
	let affinity = computeAffinity(stream.timestamp_ms);
	let track_files = await links.file_track_files.filter(queue, stream);
	if (track_files.length === 0) {
		throw ``;
	}
	for (let track_file of track_files) {
		let track = await stores.tracks.lookup(queue, track_file);
		await stores.tracks.insert(queue, {
			...track,
			affinity: track.affinity + affinity
		});
		let track_affinity: TrackAffinity = {
			...track,
			...stream,
			affinity
		};
		try {
			track_affinity.affinity += (await stores.track_affinities.lookup(queue, track_affinity)).affinity;
		} catch (error) {}
		await stores.track_affinities.insert(queue, track_affinity);
		let disc = await stores.discs.lookup(queue, track);
		await stores.discs.insert(queue, {
			...disc,
			affinity: disc.affinity + affinity
		});
		let disc_affinity: DiscAffinity = {
			...disc,
			...stream,
			affinity
		};
		try {
			disc_affinity.affinity += (await stores.disc_affinities.lookup(queue, disc_affinity)).affinity;
		} catch (error) {}
		await stores.disc_affinities.insert(queue, disc_affinity);
		let album = await stores.albums.lookup(queue, disc);
		await stores.albums.insert(queue, {
			...album,
			affinity: album.affinity + affinity
		});
		let album_affinity: AlbumAffinity = {
			...album,
			...stream,
			affinity
		};
		try {
			album_affinity.affinity += (await stores.album_affinities.lookup(queue, album_affinity)).affinity;
		} catch (error) {}
		await stores.album_affinities.insert(queue, album_affinity);
		if (album.year_id != null) {
			let year = await stores.years.lookup(queue, { year_id: album.year_id });
			await stores.years.insert(queue, {
				...year,
				affinity: year.affinity + affinity
			});
			let year_affinity: YearAffinity = {
				...year,
				...stream,
				affinity
			};
			try {
				year_affinity.affinity += (await stores.year_affinities.lookup(queue, year_affinity)).affinity;
			} catch (error) {}
			await stores.year_affinities.insert(queue, year_affinity);
		}
		let track_artists = await links.track_track_artists.filter(queue, track);
		for (let track_artist of track_artists) {
			let artist = await stores.artists.lookup(queue, track_artist);
			await stores.artists.insert(queue, {
				...artist,
				affinity: artist.affinity + affinity
			});
			let artist_affinity: ArtistAffinity = {
				...artist,
				...stream,
				affinity
			};
			try {
				artist_affinity.affinity += (await stores.artist_affinities.lookup(queue, artist_affinity)).affinity;
			} catch (error) {}
			await stores.artist_affinities.insert(queue, artist_affinity);
		}
		let album_artists = await links.album_album_artists.filter(queue, album);
		for (let album_artist of album_artists) {
			let artist = await stores.artists.lookup(queue, album_artist);
			await stores.artists.insert(queue, {
				...artist,
				affinity: artist.affinity + affinity
			});
			let artist_affinity: ArtistAffinity = {
				...artist,
				...stream,
				affinity
			};
			try {
				artist_affinity.affinity += (await stores.artist_affinities.lookup(queue, artist_affinity)).affinity;
			} catch (error) {}
			await stores.artist_affinities.insert(queue, artist_affinity);
		}
		let playlist_items = await links.track_playlist_items.filter(queue, track);
		for (let playlist_item of playlist_items) {
			let playlist = await stores.playlists.lookup(queue, playlist_item);
			await stores.playlists.insert(queue, {
				...playlist,
				affinity: playlist.affinity + affinity
			});
			let playlist_affinity: PlaylistAffinity = {
				...playlist,
				...stream,
				affinity
			};
			try {
				playlist_affinity.affinity += (await stores.playlist_affinities.lookup(queue, playlist_affinity)).affinity;
			} catch (error) {}
			await stores.playlist_affinities.insert(queue, playlist_affinity);
		}
	}
};

async function createMovieStream(queue: WritableQueue, stream: Stream): Promise<void> {
	let affinity = computeAffinity(stream.timestamp_ms);
	let movie_files = await links.file_movie_files.filter(queue, stream);
	if (movie_files.length === 0) {
		throw ``;
	}
	for (let movie_file of movie_files) {
		let movie = await stores.movies.lookup(queue, movie_file);
		await stores.movies.insert(queue, {
			...movie,
			affinity: movie.affinity + affinity
		});
		let movie_affinity: MovieAffinity = {
			...movie,
			...stream,
			affinity
		};
		try {
			movie_affinity.affinity += (await stores.movie_affinities.lookup(queue, movie_affinity)).affinity;
		} catch (error) {}
		await stores.movie_affinities.insert(queue, movie_affinity);
		if (movie.year_id != null) {
			let year = await stores.years.lookup(queue, { year_id: movie.year_id });
			await stores.years.insert(queue, {
				...year,
				affinity: year.affinity + affinity
			});
			let year_affinity: YearAffinity = {
				...year,
				...stream,
				affinity
			};
			try {
				year_affinity.affinity += (await stores.year_affinities.lookup(queue, year_affinity)).affinity;
			} catch (error) {}
			await stores.year_affinities.insert(queue, year_affinity);
		}
		let movie_actors = await links.movie_movie_actors.filter(queue, movie);
		for (let movie_actor of movie_actors) {
			let actor = await stores.actors.lookup(queue, movie_actor);
			await stores.actors.insert(queue, {
				...actor,
				affinity: actor.affinity + affinity
			});
			let actor_affinity: ActorAffinity = {
				...actor,
				...stream,
				affinity
			};
			try {
				actor_affinity.affinity += (await stores.actor_affinities.lookup(queue, actor_affinity)).affinity;
			} catch (error) {}
			await stores.actor_affinities.insert(queue, actor_affinity);
		}
		let movie_genres = await links.movie_movie_genres.filter(queue, movie);
		for (let movie_genre of movie_genres) {
			let genre = await stores.genres.lookup(queue, movie_genre);
			await stores.genres.insert(queue, {
				...genre,
				affinity: genre.affinity + affinity
			});
			let genre_affinity: GenreAffinity = {
				...genre,
				...stream,
				affinity
			};
			try {
				genre_affinity.affinity += (await stores.genre_affinities.lookup(queue, genre_affinity)).affinity;
			} catch (error) {}
			await stores.genre_affinities.insert(queue, genre_affinity);
		}
	}
};

async function createEpisodeStream(queue: WritableQueue, stream: Stream): Promise<void> {
	let affinity = computeAffinity(stream.timestamp_ms);
	let episode_files = await links.file_episode_files.filter(queue, stream);
	if (episode_files.length === 0) {
		throw ``;
	}
	for (let episode_file of episode_files) {
		let episode = await stores.episodes.lookup(queue, episode_file);
		await stores.episodes.insert(queue, {
			...episode,
			affinity: episode.affinity + affinity
		});
		let episode_affinity: EpisodeAffinity = {
			...episode,
			...stream,
			affinity
		};
		try {
			episode_affinity.affinity += (await stores.episode_affinities.lookup(queue, episode_affinity)).affinity;
		} catch (error) {}
		await stores.episode_affinities.insert(queue, episode_affinity);
		let season = await stores.seasons.lookup(queue, episode);
		await stores.seasons.insert(queue, {
			...season,
			affinity: season.affinity + affinity
		});
		let season_affinity: SeasonAffinity = {
			...season,
			...stream,
			affinity
		};
		try {
			season_affinity.affinity += (await stores.season_affinities.lookup(queue, season_affinity)).affinity;
		} catch (error) {}
		await stores.season_affinities.insert(queue, season_affinity);
		let show = await stores.shows.lookup(queue, season);
		await stores.shows.insert(queue, {
			...show,
			affinity: show.affinity + affinity
		});
		let show_affinity: ShowAffinity = {
			...show,
			...stream,
			affinity
		};
		try {
			show_affinity.affinity += (await stores.show_affinities.lookup(queue, show_affinity)).affinity;
		} catch (error) {}
		await stores.show_affinities.insert(queue, show_affinity);
		if (episode.year_id != null) {
			let year = await stores.years.lookup(queue, { year_id: episode.year_id });
			await stores.years.insert(queue, {
				...year,
				affinity: year.affinity + affinity
			});
			let year_affinity: YearAffinity = {
				...year,
				...stream,
				affinity
			};
			try {
				year_affinity.affinity += (await stores.year_affinities.lookup(queue, year_affinity)).affinity;
			} catch (error) {}
			await stores.year_affinities.insert(queue, year_affinity);
		}
		let show_actors = await links.show_show_actors.filter(queue, show);
		for (let show_actor of show_actors) {
			let actor = await stores.actors.lookup(queue, show_actor);
			await stores.actors.insert(queue, {
				...actor,
				affinity: actor.affinity + affinity
			});
			let actor_affinity: ActorAffinity = {
				...actor,
				...stream,
				affinity
			};
			try {
				actor_affinity.affinity += (await stores.actor_affinities.lookup(queue, actor_affinity)).affinity;
			} catch (error) {}
			await stores.actor_affinities.insert(queue, actor_affinity);
		}
		let show_genres = await links.show_show_genres.filter(queue, show);
		for (let show_genre of show_genres) {
			let genre = await stores.genres.lookup(queue, show_genre);
			await stores.genres.insert(queue, {
				...genre,
				affinity: genre.affinity + affinity
			});
			let genre_affinity: GenreAffinity = {
				...genre,
				...stream,
				affinity
			};
			try {
				genre_affinity.affinity += (await stores.genre_affinities.lookup(queue, genre_affinity)).affinity;
			} catch (error) {}
			await stores.genre_affinities.insert(queue, genre_affinity);
		}
	}
};

export async function createStream(queue: WritableQueue, stream: Stream): Promise<void> {
	await stores.streams.insert(queue, stream);
	try {
		await createTrackStream(queue, stream);
		return;
	} catch (error) {}
	try {
		await createMovieStream(queue, stream);
		return;
	} catch (error) {}
	try {
		await createEpisodeStream(queue, stream);
		return;
	} catch (error) {}
};
