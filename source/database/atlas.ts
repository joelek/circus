import * as atlas from "@joelek/atlas";

const context = atlas.createContext();

const directories = context.createStore({
	directory_id: context.createBinaryField(),
	name: context.createStringField(),
	parent_directory_id: context.createNullableBinaryField()
}, ["directory_id"]);

const files = context.createStore({
	file_id: context.createBinaryField(),
	name: context.createStringField(),
	parent_directory_id: context.createNullableBinaryField(),
	index_timestamp: context.createNullableIntegerField(),
	size: context.createIntegerField()
}, ["file_id"]);

const audio_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "audio/mp4" | "audio/mp3"
	duration_ms: context.createIntegerField()
}, ["file_id"]);

const image_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "image/jpeg"
	width: context.createIntegerField(),
	height: context.createIntegerField()
}, ["file_id"]);

const metadata_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField() // "application/json"
}, ["file_id"]);

const subtitle_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "text/vtt"
	duration_ms: context.createIntegerField(),
	language: context.createNullableStringField()
}, ["file_id"]);

const video_files = context.createStore({
	file_id: context.createBinaryField(),
	mime: context.createStringField(), // "video/mp4"
	duration_ms: context.createIntegerField(),
	width: context.createIntegerField(),
	height: context.createIntegerField()
}, ["file_id"]);

const video_subtitles = context.createStore({
	video_file_id: context.createBinaryField(),
	subtitle_file_id: context.createBinaryField()
}, ["video_file_id", "subtitle_file_id"]);

const artists = context.createStore({
	artist_id: context.createBinaryField(),
	name: context.createStringField()
}, ["artist_id"]);

const albums = context.createStore({
	album_id: context.createBinaryField(),
	title: context.createStringField(),
	year: context.createNullableIntegerField()
}, ["album_id"]);

const album_files = context.createStore({
	album_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["album_id", "file_id"]);

const discs = context.createStore({
	disc_id: context.createBinaryField(),
	album_id: context.createBinaryField(),
	number: context.createIntegerField()
}, ["disc_id"]);

const tracks = context.createStore({
	track_id: context.createBinaryField(),
	disc_id: context.createBinaryField(),
	title: context.createStringField(),
	number: context.createIntegerField(),
	copyright: context.createNullableStringField()
}, ["track_id"]);

const track_files = context.createStore({
	track_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["track_id", "file_id"]);

const album_artists = context.createStore({
	album_id: context.createBinaryField(),
	artist_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["album_id", "artist_id"]);

const track_artists = context.createStore({
	track_id: context.createBinaryField(),
	artist_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["track_id", "artist_id"]);

const shows = context.createStore({
	show_id: context.createBinaryField(),
	name: context.createStringField(),
	summary: context.createNullableStringField(),
	imdb: context.createNullableStringField()
}, ["show_id"]);

const show_files = context.createStore({
	show_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["show_id", "file_id"]);

const seasons = context.createStore({
	season_id: context.createBinaryField(),
	show_id: context.createBinaryField(),
	number: context.createIntegerField()
}, ["season_id"]);

const episodes = context.createStore({
	episode_id: context.createBinaryField(),
	season_id: context.createBinaryField(),
	title: context.createStringField(),
	number: context.createIntegerField(),
	year: context.createNullableIntegerField(),
	summary: context.createNullableStringField(),
	copyright: context.createNullableStringField(),
	imdb: context.createNullableStringField()
}, ["episode_id"]);

const episode_files = context.createStore({
	episode_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["episode_id", "file_id"]);

const movies = context.createStore({
	movie_id: context.createBinaryField(),
	title: context.createStringField(),
	year: context.createNullableIntegerField(),
	summary: context.createNullableStringField(),
	copyright: context.createNullableStringField(),
	imdb: context.createNullableStringField()
}, ["movie_id"]);

const movie_files = context.createStore({
	movie_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["movie_id", "file_id"]);

const actors = context.createStore({
	actor_id: context.createBinaryField(),
	name: context.createStringField()
}, ["actor_id"]);

const movie_actors = context.createStore({
	movie_id: context.createBinaryField(),
	actor_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["movie_id", "actor_id"]);

const show_actors = context.createStore({
	show_id: context.createBinaryField(),
	actor_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["show_id", "actor_id"]);

const genres = context.createStore({
	genre_id: context.createBinaryField(),
	name: context.createStringField()
}, ["genre_id"]);

const movie_genres = context.createStore({
	movie_id: context.createBinaryField(),
	genre_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["movie_id", "genre_id"]);

const show_genres = context.createStore({
	show_id: context.createBinaryField(),
	genre_id: context.createBinaryField(),
	order: context.createIntegerField()
}, ["show_id", "genre_id"]);

const subtitles = context.createStore({
	subtitle_id: context.createBinaryField(),
	file_id: context.createBinaryField()
}, ["subtitle_id"]);

const cues = context.createStore({
	cue_id: context.createBinaryField(),
	subtitle_id: context.createBinaryField(),
	start_ms: context.createIntegerField(),
	duration_ms: context.createIntegerField(),
	lines: context.createStringField()
}, ["cue_id"]);

const users = context.createStore({
	user_id: context.createBinaryField(),
	name: context.createStringField(),
	username: context.createStringField(),
	password: context.createStringField()
}, ["user_id"]);

const keys = context.createStore({
	key_id: context.createBinaryField(),
	user_id: context.createNullableBinaryField()
}, ["key_id"]);

const tokens = context.createStore({
	token_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	hash: context.createBinaryField(),
	expires_ms: context.createIntegerField()
}, ["token_id"]);

const streams = context.createStore({
	stream_id: context.createBinaryField(),
	user_id: context.createBinaryField(),
	file_id: context.createBinaryField(),
	timestamp_ms: context.createIntegerField()
}, ["stream_id"]);

const playlists = context.createStore({
	playlist_id: context.createBinaryField(),
	title: context.createStringField(),
	description: context.createStringField(),
	user_id: context.createBinaryField()
}, ["playlist_id"]);

const playlist_items = context.createStore({
	playlist_item_id: context.createBinaryField(),
	playlist_id: context.createBinaryField(),
	track_id: context.createBinaryField(),
	number: context.createIntegerField(),
	added_ms: context.createIntegerField()
}, ["playlist_item_id"]);

const years = context.createStore({
	year_id: context.createBinaryField(),
	year: context.createIntegerField()
}, ["year_id"]);

const directory_directories = context.createLink(directories, directories, {
	directory_id: "parent_directory_id"
});

const directory_files = context.createLink(directories, files, {
	directory_id: "parent_directory_id"
});

const file_audio_files = context.createLink(files, audio_files, {
	file_id: "file_id"
});

const file_image_files = context.createLink(files, image_files, {
	file_id: "file_id"
});

const file_metadata_files = context.createLink(files, metadata_files, {
	file_id: "file_id"
});

const file_subtitle_files = context.createLink(files, subtitle_files, {
	file_id: "file_id"
});

const file_video_files = context.createLink(files, video_files, {
	file_id: "file_id"
});

const video_file_video_subtitles = context.createLink(video_files, video_subtitles, {
	file_id: "video_file_id"
});

const subtitle_file_video_subtitles = context.createLink(subtitle_files, video_subtitles, {
	file_id: "subtitle_file_id"
});

const file_album_files = context.createLink(files, album_files, {
	file_id: "file_id"
});

const album_album_files = context.createLink(albums, album_files, {
	album_id: "album_id"
});

const album_discs = context.createLink(albums, discs, {
	album_id: "album_id"
});

const disc_tracks = context.createLink(discs, tracks, {
	disc_id: "disc_id"
});

const file_track_files = context.createLink(files, track_files, {
	file_id: "file_id"
});

const track_track_files = context.createLink(tracks, track_files, {
	track_id: "track_id"
});

const album_album_artists = context.createLink(albums, album_artists, {
	album_id: "album_id"
});

const artist_album_artists = context.createLink(artists, album_artists, {
	artist_id: "artist_id"
});

const track_track_artists = context.createLink(tracks, track_artists, {
	track_id: "track_id"
});

const artist_track_artists = context.createLink(artists, track_artists, {
	artist_id: "artist_id"
});

const file_show_files = context.createLink(files, show_files, {
	file_id: "file_id"
});

const show_show_files = context.createLink(shows, show_files, {
	show_id: "show_id"
});

const show_seasons = context.createLink(shows, seasons, {
	show_id: "show_id"
});

const season_episodes = context.createLink(seasons, episodes, {
	season_id: "season_id"
});

const file_episode_files = context.createLink(files, episode_files, {
	file_id: "file_id"
});

const episode_episode_files = context.createLink(episodes, episode_files, {
	episode_id: "episode_id"
});

const file_movie_files = context.createLink(files, movie_files, {
	file_id: "file_id"
});

const movie_movie_files = context.createLink(movies, movie_files, {
	movie_id: "movie_id"
});

const actor_movie_actors = context.createLink(actors, movie_actors, {
	actor_id: "actor_id"
});

const movie_movie_actors = context.createLink(movies, movie_actors, {
	movie_id: "movie_id"
});

const actor_show_actors = context.createLink(actors, show_actors, {
	actor_id: "actor_id"
});

const show_show_actors = context.createLink(shows, show_actors, {
	show_id: "show_id"
});

const genre_movie_genres = context.createLink(genres, movie_genres, {
	genre_id: "genre_id"
});

const movie_movie_genres = context.createLink(movies, movie_genres, {
	movie_id: "movie_id"
});

const genre_show_genres = context.createLink(genres, show_genres, {
	genre_id: "genre_id"
});

const show_show_genres = context.createLink(shows, show_genres, {
	show_id: "show_id"
});

const subtitle_cues = context.createLink(subtitles, cues, {
	subtitle_id: "subtitle_id"
});

const user_keys = context.createLink(users, keys, {
	user_id: "user_id"
});

const user_tokens = context.createLink(users, tokens, {
	user_id: "user_id"
});

const user_streams = context.createLink(users, streams, {
	user_id: "user_id"
});

const file_streams = context.createLink(files, streams, {
	file_id: "file_id"
});

const user_playlists = context.createLink(users, playlists, {
	user_id: "user_id"
});

const playlist_playlist_items = context.createLink(playlists, playlist_items, {
	playlist_id: "playlist_id"
});

const track_playlist_items = context.createLink(tracks, playlist_items, {
	track_id: "track_id"
});

const getUsersFromUsername = context.createQuery(users, {
	username: context.createEqualityOperator()
});

const getMoviesFromYear = context.createQuery(movies, {
	year: context.createEqualityOperator()
});

const getAlbumsFromYear = context.createQuery(albums, {
	year: context.createEqualityOperator()
});

export const transactionManager = context.createTransactionManager("./private/db/", {
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
	years
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
	track_playlist_items
}, {
	getUsersFromUsername,
	getMoviesFromYear,
	getAlbumsFromYear
});
