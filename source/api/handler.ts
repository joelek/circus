import * as libcrypto from "crypto";
import * as auth from "../server/auth";
import * as passwords from "../server/passwords";
import * as database from "../database/indexer";
import * as jsondb from "../jsondb";
import * as is from "../is";
import * as schema from "./schema/";
import { default as config } from "../config";
import { SearchResult } from "../jdb2";
import { Actor, Album, Artist, Cue, Episode, File, Genre, Movie, Playlist, Show, Stream, Track, User, Year } from "../database/schema";
import { ReadableQueue, WritableQueue } from "@joelek/atlas";
import * as atlas from "../database/atlas";

export function getStreamWeight(timestamp_ms: number): number {
	let ms = Date.now() - timestamp_ms;
	let weeks = ms / (1000 * 60 * 60 * 24 * 7);
	return Math.pow(0.5, weeks);
};

export async function lookupFile(queue: ReadableQueue, file_id: string, user_id: string): Promise<File & { mime: string }> {
	let file = database.files.lookup(file_id);
	let mime = "application/octet-stream";
	try {
		mime = database.audio_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = database.image_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = database.metadata_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = database.subtitle_files.lookup(file.file_id).mime;
	} catch (error) {}
	try {
		mime = database.video_files.lookup(file.file_id).mime;
	} catch (error) {}
	return {
		...file,
		mime
	};
};

export async function createStream(queue: WritableQueue, stream: Stream): Promise<void> {
	database.streams.insert(stream);
};

export async function createUser(queue: WritableQueue, request: schema.messages.RegisterRequest): Promise<schema.messages.RegisterResponse | schema.messages.ErrorMessage> {
	let { username, password, name, key_id } = { ...request };
	let errors = new Array<string>();
	if (database.getUsersFromUsername.lookup(username).collect().length > 0) {
		errors.push(`The requested username is not available.`);
	}
	if (config.use_registration_keys) {
		try {
			let key = database.keys.lookup(key_id);
			if (is.present(key.user_id)) {
				errors.push(`The registration key has already been used.`);
			}
		} catch (error) {
			errors.push(`The registration key is not valid.`);
		}
	}
	if (Buffer.from(username).length >= 256) {
		errors.push(`The username is too long!`);
	}
	if (Buffer.from(name).length >= 256) {
		errors.push(`The name is too long!`);
	}
	if (errors.length > 0) {
		return {
			errors
		};
	}
	let user_id = libcrypto.randomBytes(8).toString("hex");
	database.users.insert({
		user_id,
		username,
		name,
		password: passwords.generate(password)
	});
	if (config.use_registration_keys) {
		let key = database.keys.lookup(key_id);
		database.keys.update({
			...key,
			user_id
		});
	}
	let token = auth.createToken(username, password);
	return {
		token
	};
};

export async function lookupAlbumBase(queue: ReadableQueue, album_id: string, user_id: string): Promise<schema.objects.AlbumBase> {
	let album = database.albums.lookup(album_id);
	return {
		album_id: album.album_id,
		title: config.use_demo_mode ? "Album title" : album.title,
		artwork: database.getFilesFromAlbum.lookup(album_id)
			.map((record) => {
				try {
					return database.image_files.lookup(record.file_id);
				} catch (error) {}
			})
			.include(is.present)
			.collect()
	};
};

export async function lookupAlbum(queue: ReadableQueue, album_id: string, user_id: string): Promise<schema.objects.Album> {
	let record = database.albums.lookup(album_id);
	let album = await lookupAlbumBase(queue, album_id, user_id);
	return {
		...album,
		artists: await Promise.all(database.getArtistsFromAlbum.lookup(album_id)
			.sort(jsondb.NumericSort.increasing((record) => record.order))
			.map((record) => lookupArtistBase(queue, record.artist_id, user_id))
			.collect()),
		year: record.year,
		discs: await Promise.all(database.getDiscsFromAlbum.lookup(album_id)
			.sort(jsondb.NumericSort.increasing((record) => record.number))
			.map((record) => lookupDisc(queue, record.disc_id, user_id, album))
			.collect())
	};
};

export async function lookupArtistBase(queue: ReadableQueue, artist_id: string, user_id: string): Promise<schema.objects.ArtistBase> {
	let artist = database.artists.lookup(artist_id);
	return {
		artist_id: artist.artist_id,
		title: config.use_demo_mode ? "Artist name" : artist.name
	};
};

export async function lookupArtist(queue: ReadableQueue, artist_id: string, user_id: string): Promise<schema.objects.Artist> {
	let artist = await lookupArtistBase(queue, artist_id, user_id);
	return {
		...artist,
		albums: await Promise.all(database.getAlbumsFromArtist.lookup(artist_id)
			.map((record) => database.albums.lookup(record.album_id))
			.sort(jsondb.NumericSort.decreasing((record) => record.year))
			.map((record) => lookupAlbum(queue, record.album_id, user_id))
			.collect())
	};
};

export async function lookupCueBase(queue: ReadableQueue, cue_id: string, user_id: string, subtitle?: schema.objects.SubtitleBase): Promise<schema.objects.CueBase> {
	let cue = database.cues.lookup(cue_id);
	return {
		cue_id: cue.cue_id,
		subtitle: is.present(subtitle) ? subtitle : await lookupSubtitleBase(queue, cue.subtitle_id, user_id),
		start_ms: cue.start_ms,
		duration_ms: cue.duration_ms,
		lines: cue.lines.split("\n")
	};
};

export async function lookupCue(queue: ReadableQueue, cue_id: string, user_id: string, subtitle?: schema.objects.SubtitleBase): Promise<schema.objects.Cue> {
	let cue = await lookupCueBase(queue, cue_id, user_id, subtitle);
	let medias = await Promise.all(database.getVideoFilesFromSubtitleFile.lookup(cue.subtitle.subtitle.file_id)
		.map((video_subtitle) => {
			try {
				let episode_files = database.getEpisodesFromFile.lookup(video_subtitle.video_file_id);
				for (let episode_file of episode_files) {
					return lookupEpisode(queue, episode_file.episode_id, user_id);
				}
			} catch (error) {}
			try {
				let movie_files = database.getMoviesFromFile.lookup(video_subtitle.video_file_id);
				for (let movie_file of movie_files) {
					return lookupMovie(queue, movie_file.movie_id, user_id);
				}
			} catch (error) {}
		})
		.include(is.present)
		.collect());
	let media = medias.shift();
	if (is.absent(media)) {
		throw `Expected a media entity!`;
	}
	return {
		...cue,
		media
	};
};

export async function lookupDiscBase(queue: ReadableQueue, disc_id: string, user_id: string, album?: schema.objects.AlbumBase): Promise<schema.objects.DiscBase> {
	let disc = database.discs.lookup(disc_id);
	return {
		disc_id: disc.disc_id,
		album: is.present(album) ? album : await lookupAlbumBase(queue, disc.album_id, user_id),
		number: disc.number
	};
};

export async function lookupDisc(queue: ReadableQueue, disc_id: string, user_id: string, album?: schema.objects.AlbumBase): Promise<schema.objects.Disc> {
	let disc = await lookupDiscBase(queue, disc_id, user_id, album);
	return {
		...disc,
		tracks: await Promise.all(database.getTracksFromDisc.lookup(disc_id)
			.sort(jsondb.NumericSort.increasing((record) => record.number))
			.map((record) => lookupTrack(queue, record.track_id, user_id, disc))
			.collect())
	};
};

export async function lookupEpisodeBase(queue: ReadableQueue, episode_id: string, user_id: string, season?: schema.objects.SeasonBase): Promise<schema.objects.EpisodeBase> {
	let episode = database.episodes.lookup(episode_id);
	return {
		episode_id: episode.episode_id,
		title: config.use_demo_mode ? "Episode title" : episode.title,
		number: episode.number,
		season: is.present(season) ? season : await lookupSeasonBase(queue, episode.season_id, user_id)
	};
};

export async function lookupEpisode(queue: ReadableQueue, episode_id: string, user_id: string, season?: schema.objects.SeasonBase): Promise<schema.objects.Episode> {
	let episode = await lookupEpisodeBase(queue, episode_id, user_id, season);
	let record = database.episodes.lookup(episode_id);
	let files = database.getFilesFromEpisode.lookup(episode_id)
		.map((record) => {
			try {
				return database.video_files.lookup(record.file_id);
			} catch (error) {}
		})
		.include(is.present)
		.sort(jsondb.NumericSort.decreasing((record) => record.height))
		.collect();
	let media = files.shift();
	if (is.absent(media)) {
		throw `Expected a valid video file!`;
	}
	let subtitles = database.getSubtitleFilesFromVideoFile.lookup(media.file_id)
		.map((record) => database.subtitle_files.lookup(record.subtitle_file_id))
		.collect();
	let streams = database.getStreamsFromFile.lookup(media.file_id)
		.filter((stream) => stream.user_id === user_id)
		.sort((jsondb.NumericSort.increasing((stream) => stream.timestamp_ms)))
		.collect();
	return {
		...episode,
		year: record.year,
		summary: config.use_demo_mode ? "Episode summary." : record.summary,
		last_stream_date: streams.pop()?.timestamp_ms,
		media: media,
		subtitles: subtitles,
		copyright: record.copyright,
		imdb: record.imdb
	};
};

export async function lookupGenreBase(queue: ReadableQueue, genre_id: string, user_id: string): Promise<schema.objects.GenreBase> {
	let genre = database.genres.lookup(genre_id);
	return {
		genre_id: genre.genre_id,
		title: genre.name
	};
};

export async function lookupGenre(queue: ReadableQueue, genre_id: string, user_id: string): Promise<schema.objects.Genre> {
	let genre = await lookupGenreBase(queue, genre_id, user_id);
	return {
		...genre
	};
};

export async function lookupMovieBase(queue: ReadableQueue, movie_id: string, user_id: string): Promise<schema.objects.MovieBase> {
	let movie = database.movies.lookup(movie_id);
	return {
		movie_id: movie.movie_id,
		title: config.use_demo_mode ? "Movie title" : movie.title,
		artwork: database.getFilesFromMovie.lookup(movie_id)
			.map((record) => {
				try {
					return database.image_files.lookup(record.file_id);
				} catch (error) {}
			})
			.include(is.present)
			.collect()
	};
};

export async function lookupMovie(queue: ReadableQueue, movie_id: string, user_id: string): Promise<schema.objects.Movie> {
	let movie = await lookupMovieBase(queue, movie_id, user_id);
	let record = database.movies.lookup(movie_id);
	let files = database.getFilesFromMovie.lookup(movie_id)
		.map((record) => {
			try {
				return database.video_files.lookup(record.file_id);
			} catch (error) {}
		})
		.include(is.present)
		.sort(jsondb.NumericSort.decreasing((record) => record.height))
		.collect();
	let media = files.shift();
	if (is.absent(media)) {
		throw `Expected a valid video file!`;
	}
	let subtitles = database.getSubtitleFilesFromVideoFile.lookup(media.file_id)
		.map((record) => database.subtitle_files.lookup(record.subtitle_file_id))
		.collect();
	let streams = database.getStreamsFromFile.lookup(media.file_id)
		.filter((stream) => stream.user_id === user_id)
		.sort((jsondb.NumericSort.increasing((stream) => stream.timestamp_ms)))
		.collect();
	return {
		...movie,
		year: record.year,
		summary: config.use_demo_mode ? "Movie summary." : record.summary,
		genres: await Promise.all(database.getGenresFromMovie.lookup(movie_id)
			.sort(jsondb.NumericSort.increasing((record) => record.order))
			.map((record) => lookupGenreBase(queue, record.genre_id, user_id))
			.collect()),
		actors: await Promise.all(database.getActorsFromMovie.lookup(movie_id)
			.sort(jsondb.NumericSort.increasing((record) => record.order))
			.map((record) => lookupActor(queue, record.actor_id, user_id))
			.collect()),
		last_stream_date: streams.pop()?.timestamp_ms,
		media: media,
		subtitles: subtitles,
		copyright: record.copyright,
		imdb: record.imdb
	};
};

export async function lookupActorBase(queue: ReadableQueue, actor_id: string, user_id: string): Promise<schema.objects.ActorBase> {
	let actor = database.actors.lookup(actor_id);
	return {
		actor_id: actor.actor_id,
		name: config.use_demo_mode ? "Actor name" : actor.name
	};
};

export async function lookupActor(queue: ReadableQueue, actor_id: string, user_id: string): Promise<schema.objects.Actor> {
	let actor = await lookupActorBase(queue, actor_id, user_id);
	return {
		...actor
	};
};

export async function lookupPlaylistBase(queue: ReadableQueue, playlist_id: string, user_id: string, user?: schema.objects.UserBase): Promise<schema.objects.PlaylistBase> {
	let playlist = database.playlists.lookup(playlist_id);
	return {
		playlist_id: playlist.playlist_id,
		title: playlist.title,
		description: playlist.description,
		user: is.present(user) ? user : await lookupUserBase(queue, playlist.user_id, user_id)
	};
};

export async function lookupPlaylist(queue: ReadableQueue, playlist_id: string, user_id: string, user?: schema.objects.UserBase): Promise<schema.objects.Playlist> {
	let playlist = await lookupPlaylistBase(queue, playlist_id, user_id, user);
	return {
		...playlist,
		items: await Promise.all(database.getPlaylistsItemsFromPlaylist.lookup(playlist_id)
			.sort(jsondb.NumericSort.increasing((record) => record.number))
			.map((record) => lookupPlaylistItem(queue, record.playlist_item_id, user_id, playlist))
			.collect())
	};
};

export async function lookupPlaylistItemBase(queue: ReadableQueue, playlist_item_id: string, user_id: string, playlist?: schema.objects.PlaylistBase): Promise<schema.objects.PlaylistItemBase> {
	let playlist_item = database.playlist_items.lookup(playlist_item_id);
	return {
		playlist_item_id: playlist_item.playlist_item_id,
		number: playlist_item.number,
		playlist: is.present(playlist) ? playlist : await lookupPlaylistBase(queue, playlist_item.playlist_id, user_id),
		track: await lookupTrack(queue, playlist_item.track_id, user_id)
	};
};

export async function lookupPlaylistItem(queue: ReadableQueue, playlist_item_id: string, user_id: string, playlist?: schema.objects.PlaylistBase): Promise<schema.objects.PlaylistItem> {
	let playlist_item = await lookupPlaylistItemBase(queue, playlist_item_id, user_id, playlist);
	return {
		...playlist_item
	};
};

export async function lookupSeasonBase(queue: ReadableQueue, season_id: string, user_id: string, show?: schema.objects.ShowBase): Promise<schema.objects.SeasonBase> {
	let season = database.seasons.lookup(season_id);
	return {
		season_id: season.season_id,
		number: season.number,
		show: is.present(show) ? show : await lookupShowBase(queue, season.show_id, user_id)
	};
};

export async function lookupSeason(queue: ReadableQueue, season_id: string, user_id: string, show?: schema.objects.ShowBase): Promise<schema.objects.Season> {
	let season = await lookupSeasonBase(queue, season_id, user_id, show);
	return {
		...season,
		episodes: await Promise.all(database.getEpisodesFromSeason.lookup(season_id)
			.sort(jsondb.NumericSort.increasing((record) => record.number))
			.map((record) => lookupEpisode(queue, record.episode_id, user_id, season))
			.collect())
	}
};

export async function lookupShowBase(queue: ReadableQueue, show_id: string, user_id: string): Promise<schema.objects.ShowBase> {
	let show = database.shows.lookup(show_id);
	return {
		show_id: show.show_id,
		title: config.use_demo_mode ? "Show title" : show.name,
		artwork: database.getFilesFromShow.lookup(show_id)
			.map((record) => {
				try {
					return database.image_files.lookup(record.file_id);
				} catch (error) {}
			})
			.include(is.present)
			.slice(0, 1)
			.collect()
	};
};

export async function lookupShow(queue: ReadableQueue, show_id: string, user_id: string): Promise<schema.objects.Show> {
	let show = await lookupShowBase(queue, show_id, user_id);
	let record = database.shows.lookup(show_id);
	return {
		...show,
		summary: config.use_demo_mode ? "Show summary." : record.summary,
		genres: await Promise.all(database.getGenresFromShow.lookup(show_id)
			.sort(jsondb.NumericSort.increasing((record) => record.order))
			.map((record) => lookupGenreBase(queue, record.genre_id, user_id))
			.collect()),
		actors: await Promise.all(database.getActorsFromShow.lookup(show_id)
			.sort(jsondb.NumericSort.increasing((record) => record.order))
			.map((record) => lookupActorBase(queue, record.actor_id, user_id))
			.collect()),
		seasons: await Promise.all(database.getSeasonsFromShow.lookup(show_id)
			.sort(jsondb.NumericSort.increasing((record) => record.number))
			.map((record) => lookupSeason(queue, record.season_id, user_id, show))
			.collect()),
		imdb: record.imdb
	};
};

export async function lookupSubtitleBase(queue: ReadableQueue, subtitle_id: string, user_id: string): Promise<schema.objects.SubtitleBase> {
	let subtitle = database.subtitles.lookup(subtitle_id);
	return {
		subtitle_id: subtitle.subtitle_id,
		subtitle: database.subtitle_files.lookup(subtitle.file_id)
	};
};

export async function lookupSubtitle(queue: ReadableQueue, subtitle_id: string, user_id: string): Promise<schema.objects.Subtitle> {
	let subtitle = await lookupSubtitleBase(queue, subtitle_id, user_id);
	return {
		...subtitle,
		cues: await Promise.all(database.getCuesFromSubtitle.lookup(subtitle_id)
			.sort(jsondb.NumericSort.increasing((record) => record.start_ms))
			.map((record) => lookupCue(queue, record.cue_id, user_id))
			.collect())
	};
};

export async function lookupTrackBase(queue: ReadableQueue, track_id: string, user_id: string, disc?: schema.objects.DiscBase): Promise<schema.objects.TrackBase> {
	let track = database.tracks.lookup(track_id);
	return {
		track_id: track.track_id,
		title: config.use_demo_mode ? "Track title" : track.title,
		disc: is.present(disc) ? disc : await lookupDiscBase(queue, track.disc_id, user_id),
		number: track.number
	};
};

export async function lookupTrack(queue: ReadableQueue, track_id: string, user_id: string, disc?: schema.objects.DiscBase): Promise<schema.objects.Track> {
	let track = await lookupTrackBase(queue, track_id, user_id, disc);
	let record = database.tracks.lookup(track_id);
	let files = database.getFilesFromTrack.lookup(track_id)
		.map((record) => {
			try {
				return database.audio_files.lookup(record.file_id);
			} catch (error) {}
		})
		.include(is.present)
		.collect();
	let media = files.shift();
	if (is.absent(media)) {
		throw `Expected a valid audio file!`;
	}
	let streams = database.getStreamsFromFile.lookup(media.file_id)
		.filter((stream) => stream.user_id === user_id)
		.sort((jsondb.NumericSort.increasing((stream) => stream.timestamp_ms)))
		.collect();
	return {
		...track,
		artists: await Promise.all(database.getArtistsFromTrack.lookup(track_id)
			.sort(jsondb.NumericSort.increasing((record) => record.order))
			.map((record) => lookupArtistBase(queue, record.artist_id, user_id))
			.collect()),
		last_stream_date: streams.pop()?.timestamp_ms,
		media: media,
		copyright: record.copyright
	};
};

export async function lookupUserBase(queue: ReadableQueue, user_id: string, api_user_id: string): Promise<schema.objects.UserBase> {
	let user = database.users.lookup(user_id);
	return {
		user_id: user.user_id,
		name: user.name,
		username: user.username
	};
};

export async function lookupUser(queue: ReadableQueue, user_id: string, api_user_id: string): Promise<schema.objects.User> {
	let user = await lookupUserBase(queue, user_id, api_user_id);
	return {
		...user
	};
};

export async function lookupYearBase(queue: ReadableQueue, year_id: string, user_id: string): Promise<schema.objects.YearBase> {
	let year = database.years.lookup(year_id);
	return {
		year_id: year.year_id,
		year: year.year
	};
};

export async function lookupYear(queue: ReadableQueue, year_id: string, user_id: string): Promise<schema.objects.Year> {
	let year = await lookupYearBase(queue, year_id, user_id);
	return {
		...year
	};
};

export async function getNewAlbums(queue: ReadableQueue, user_id: string, offset: number, length: number): Promise<schema.objects.Album[]> {
	let albums = new Map<string, number>();
	for (let album of database.albums) {
		for (let disc of database.getDiscsFromAlbum.lookup(album.album_id)) {
			for (let track of database.getTracksFromDisc.lookup(disc.disc_id)) {
				for (let track_file of database.getFilesFromTrack.lookup(track.track_id)) {
					let file = database.files.lookup(track_file.file_id);
					if (is.present(file.index_timestamp)) {
						let index_timestamp = albums.get(album.album_id);
						if (is.absent(index_timestamp)) {
							index_timestamp = file.index_timestamp
						} else {
							index_timestamp = Math.max(index_timestamp, file.index_timestamp);
						}
						albums.set(album.album_id, index_timestamp);
					}
				}
			}
		}
	}
	return await Promise.all(Array.from(albums.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => lookupAlbum(queue, entry[0], user_id)));
};

export async function getNewMovies(queue: ReadableQueue, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let movies = new Map<string, number>();
	for (let movie of database.movies) {
		for (let movie_file of database.getFilesFromMovie.lookup(movie.movie_id)) {
			let file = database.files.lookup(movie_file.file_id);
			if (is.present(file.index_timestamp)) {
				let index_timestamp = movies.get(movie.movie_id);
				if (is.absent(index_timestamp)) {
					index_timestamp = file.index_timestamp
				} else {
					index_timestamp = Math.max(index_timestamp, file.index_timestamp);
				}
				movies.set(movie.movie_id, index_timestamp);
			}
		}
	}
	return await Promise.all(Array.from(movies.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => lookupMovie(queue, entry[0], user_id)));
};

export async function searchForAlbums(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Album[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.albums)
			.sort(jsondb.LexicalSort.increasing((record) => record.title))
			.slice(offset, offset + length)
			.map((record) => lookupAlbum(queue, record.album_id, user_id)));
	} else {
		return await Promise.all(database.album_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().album_id)
			.map((id) => lookupAlbum(queue, id, user_id))
			.collect());
	}
};

export async function searchForArtists(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Artist[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.artists)
			.map((artist) => ({
				artist,
				albums: database.getAlbumsFromArtist.lookup(artist.artist_id).collect()
			}))
			.sort(jsondb.CombinedSort.of(
				jsondb.CustomSort.increasing((entry) => entry.albums.length === 0),
				jsondb.LexicalSort.increasing((entry) => entry.artist.name)
			))
			.map((entry) => entry.artist)
			.slice(offset, offset + length)
			.map((record) => lookupArtist(queue, record.artist_id, user_id)));
	} else {
		return await Promise.all(database.artist_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().artist_id)
			.map((id) => lookupArtist(queue, id, user_id))
			.collect());
	}
};

export async function searchForCues(queue: ReadableQueue, query: string, offset: number, limit: number, user_id: string): Promise<(schema.objects.Cue & { media: schema.objects.Episode | schema.objects.Movie })[]> {
	return is.absent(database.cue_search) ? [] : await Promise.all(database.cue_search.search(query)
		.slice(offset, offset + limit)
		.map((record) => lookupCue(queue, record.lookup().cue_id, user_id))
		.include(is.present)
		.collect());
};

export async function searchForDiscs(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Disc[]> {
	return await Promise.all(Array.from(database.discs)
		.sort(jsondb.LexicalSort.increasing((record) => record.disc_id))
		.slice(offset, offset + length)
		.map((record) => lookupDisc(queue, record.disc_id, user_id)));
};

export async function searchForEpisodes(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Episode[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.episodes)
			.sort(jsondb.LexicalSort.increasing((record) => record.title))
			.slice(offset, offset + length)
			.map((record) => lookupEpisode(queue, record.episode_id, user_id)));
	} else {
		return await Promise.all(database.episode_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().episode_id)
			.map((id) => lookupEpisode(queue, id, user_id))
			.collect());
	}
};

export async function searchForGenres(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Genre[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.genres)
			.sort(jsondb.LexicalSort.increasing((record) => record.name))
			.map((record) => lookupGenre(queue, record.genre_id, user_id)));
	} else {
		return await Promise.all(database.genre_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().genre_id)
			.map((id) => lookupGenre(queue, id, user_id))
			.collect());
	}
};

export async function searchForMovies(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Movie[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.movies)
			.sort(jsondb.LexicalSort.increasing((record) => record.title))
			.slice(offset, offset + length)
			.map((record) => lookupMovie(queue, record.movie_id, user_id)));
	} else {
		return await Promise.all(database.movie_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().movie_id)
			.map((id) => lookupMovie(queue, id, user_id))
			.collect());
	}
};

export async function searchForActors(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Actor[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.actors)
			.sort(jsondb.LexicalSort.increasing((record) => record.name))
			.slice(offset, offset + length)
			.map((record) => lookupActor(queue, record.actor_id, user_id)));
	} else {
		return await Promise.all(database.actor_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().actor_id)
			.map((id) => lookupActor(queue, id, user_id))
			.collect());
	}
};

export async function searchForPlaylists(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Playlist[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.playlists)
			.sort(jsondb.LexicalSort.increasing((record) => record.title))
			.slice(offset, offset + length)
			.map((record) => lookupPlaylist(queue, record.playlist_id, user_id)));
	} else {
		return await Promise.all(database.playlist_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().playlist_id)
			.map((id) => lookupPlaylist(queue, id, user_id))
			.collect());
	}
};

export async function searchForSeasons(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Season[]> {
	return await Promise.all(Array.from(database.seasons)
		.sort(jsondb.LexicalSort.increasing((record) => record.season_id))
		.slice(offset, offset + length)
		.map((record) => lookupSeason(queue, record.season_id, user_id)));
};

export async function searchForShows(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Show[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.shows)
			.sort(jsondb.LexicalSort.increasing((record) => record.name))
			.slice(offset, offset + length)
			.map((record) => lookupShow(queue, record.show_id, user_id)));
	} else {
		return await Promise.all(database.shows_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().show_id)
			.map((id) => lookupShow(queue, id, user_id))
			.collect());
	}
};

export async function searchForTracks(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Track[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.tracks)
			.sort(jsondb.LexicalSort.increasing((record) => record.title))
			.slice(offset, offset + length)
			.map((record) => lookupTrack(queue, record.track_id, user_id)));
	} else {
		return await Promise.all(database.track_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().track_id)
			.map((id) => lookupTrack(queue, id, user_id))
			.collect());
	}
};

export async function searchForUsers(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.User[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.users)
			.sort(jsondb.LexicalSort.increasing((record) => record.name))
			.slice(offset, offset + length)
			.map((record) => lookupUser(queue, record.user_id, user_id)));
	} else {
		return await Promise.all(database.user_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().user_id)
			.map((id) => lookupUser(queue, id, user_id))
			.collect());
	}
};

export async function searchForYears(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Year[]> {
	if (query === "") {
		return await Promise.all(Array.from(database.years)
			.sort(jsondb.NumericSort.decreasing((record) => record.year))
			.slice(offset, offset + length)
			.map((record) => lookupYear(queue, record.year_id, user_id)));
	} else {
		return await Promise.all(database.year_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().year_id)
			.map((id) => lookupYear(queue, id, user_id))
			.collect());
	}
};

export async function searchForEntities(queue: ReadableQueue, query: string, user_id: string, offset: number, limit: number, options?: Partial<{ cues: boolean }>): Promise<schema.objects.Entity[]> {
	let results = [
		...database.actor_search.search(query).map((result) => ({ ...result, type: "ACTOR", type_rank: 1 })),
		...database.album_search.search(query).map((result) => ({ ...result, type: "ALBUM", type_rank: 9 })),
		...database.artist_search.search(query).map((result) => ({ ...result, type: "ARTIST", type_rank: 6 })),
		...database.episode_search.search(query).map((result) => ({ ...result, type: "EPISODE", type_rank: 4 })),
		...database.genre_search.search(query).map((result) => ({ ...result, type: "GENRE", type_rank: 2 })),
		...database.movie_search.search(query).map((result) => ({ ...result, type: "MOVIE", type_rank: 8 })),
		...database.playlist_search.search(query).map((result) => ({ ...result, type: "PLAYLIST", type_rank: 3 })),
		...database.shows_search.search(query).map((result) => ({ ...result, type: "SHOW", type_rank: 7 })),
		...database.track_search.search(query).map((result) => ({ ...result, type: "TRACK", type_rank: 5 })),
		...database.user_search.search(query).map((result) => ({ ...result, type: "USER", type_rank: 0 })),
		...database.year_search.search(query).map((result) => ({ ...result, type: "YEAR", type_rank: 10 })),
		...new Array<SearchResult<Cue> & { type: "CUE", type_rank: number }>()
	].sort(jsondb.CombinedSort.of(
		jsondb.NumericSort.decreasing((value) => value.rank),
		jsondb.NumericSort.decreasing((value) => value.type_rank)
	));
	if (options?.cues) {
		let cue = database.cue_search.search(query).shift();
		if (is.present(cue)) {
			let result = results[0];
			if (is.absent(result) || cue.rank > result.rank) {
				results.unshift({ ...cue, type: "CUE", type_rank: 11 });
			}
		}
	}
	let entities = await Promise.all(results.slice(offset, offset + limit).map((result) => {
		let type = result.type;
		if (false) {
		} else if (type === "ACTOR") {
			return lookupActor(queue, (result.lookup() as Actor).actor_id, user_id);
		} else if (type === "ALBUM") {
			return lookupAlbum(queue, (result.lookup() as Album).album_id, user_id);
		} else if (type === "ARTIST") {
			return lookupArtist(queue, (result.lookup() as Artist).artist_id, user_id);
		} else if (type === "CUE") {
			return lookupCue(queue, (result.lookup() as Cue).cue_id, user_id);
		} else if (type === "EPISODE") {
			return lookupEpisode(queue, (result.lookup() as Episode).episode_id, user_id);
		} else if (type === "GENRE") {
			return lookupGenre(queue, (result.lookup() as Genre).genre_id, user_id);
		} else if (type === "MOVIE") {
			return lookupMovie(queue, (result.lookup() as Movie).movie_id, user_id);
		} else if (type === "PLAYLIST") {
			return lookupPlaylist(queue, (result.lookup() as Playlist).playlist_id, user_id);
		} else if (type === "SHOW") {
			return lookupShow(queue, (result.lookup() as Show).show_id, user_id);
		} else if (type === "TRACK") {
			return lookupTrack(queue, (result.lookup() as Track).track_id, user_id);
		} else if (type === "USER") {
			return lookupUser(queue, (result.lookup() as User).user_id, user_id);
		} else if (type === "YEAR") {
			return lookupYear(queue, (result.lookup() as Year).year_id, user_id);
		}
		throw `Expected code to be unreachable!`;
	}));
	return entities;
};

export async function getArtistAppearances(queue: ReadableQueue, artist_id: string, user_id: string): Promise<schema.objects.Album[]> {
	let track_artists = database.getTracksFromArtist.lookup(artist_id);
	let tracks = track_artists.map((track_artist) => {
		return database.tracks.lookup(track_artist.track_id);
	});
	let disc_ids = tracks.map((track) => {
		return track.disc_id;
	})
	.collect();
	disc_ids = Array.from(new Set<string>(disc_ids));
	let discs = disc_ids.map((disc_id) => {
		return database.discs.lookup(disc_id);
	});
	let album_ids = discs.map((disc) => {
		return disc.album_id;
	});
	album_ids = Array.from(new Set<string>(album_ids));
	let result = new Array<string>();
	for (let album_id of album_ids) {
		let album_artists = database.getArtistsFromAlbum.lookup(album_id);
		if (album_artists.find((album_artist) => album_artist.artist_id === artist_id) == null) {
			result.push(album_id);
		}
	}
	return await Promise.all(result
		.map((entry) => database.albums.lookup(entry))
		.sort(jsondb.LexicalSort.increasing((entry) => entry.title))
		.map((entry) => {
			return lookupAlbum(queue, entry.album_id, user_id);
		}));
};

export async function getArtistTracks(queue: ReadableQueue, artist_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Track[]> {
	let track_weights = new Map<string, number>();
	for (let track_artist of database.getTracksFromArtist.lookup(artist_id)) {
		let track_id = track_artist.track_id;
		for (let file of database.getFilesFromTrack.lookup(track_id)) {
			let streams = database.getStreamsFromFile.lookup(file.file_id);
			for (let stream of streams) {
				let weight = track_weights.get(track_id) ?? 0;
				weight += getStreamWeight(stream.timestamp_ms);
				track_weights.set(track_id, weight);
			}
		}
	}
	return await Promise.all(Array.from(track_weights.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((track_id) => lookupTrack(queue, track_id, user_id)));
}

export async function getPlaylistAppearances(queue: ReadableQueue, track_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Playlist[]> {
	let playlist_ids = new Set<string>();
	for (let playlist_item of database.getPlaylistItemsFromTrack.lookup(track_id)) {
		playlist_ids.add(playlist_item.playlist_id);
	}
	return await Promise.all(Array.from(playlist_ids)
		.map((playlist_id) => database.playlists.lookup(playlist_id))
		.sort(jsondb.LexicalSort.increasing((playlist) => playlist.title))
		.slice(offset, offset + length)
		.map((playlist) => lookupPlaylist(queue, playlist.playlist_id, user_id)));
};

export async function getMovieSuggestions(queue: ReadableQueue, movie_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Movie[]> {
	let genres = database.getGenresFromMovie.lookup(movie_id);
	let map = new Map<string, number>();
	for (let genre of genres) {
		let movie_genres = database.getMoviesFromGenre.lookup(genre.genre_id);
		for (let movie_genre of movie_genres) {
			let value = map.get(movie_genre.movie_id) ?? 0;
			map.set(movie_genre.movie_id, value + 2);
		}
	}
	for (let entry of map) {
		let video_genres = database.getGenresFromMovie.lookup(entry[0]).collect();
		map.set(entry[0], entry[1] - video_genres.length);
	}
	map.delete(movie_id);
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((movie_id) => lookupMovie(queue, movie_id, user_id)));
};

export async function getMoviesFromGenre(queue: ReadableQueue, video_genre_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	return await Promise.all(database.getMoviesFromGenre.lookup(video_genre_id)
		.map((entry) => database.movies.lookup(entry.movie_id))
		.sort(jsondb.LexicalSort.increasing((entry) => entry.title))
		.slice(offset, offset + length)
		.map((entry) => lookupMovie(queue, entry.movie_id, user_id))
		.collect());
};

export async function getMoviesFromActor(queue: ReadableQueue, actor_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	return await Promise.all(database.getMoviesFromActor.lookup(actor_id)
		.map((entry) => database.movies.lookup(entry.movie_id))
		.sort(jsondb.LexicalSort.increasing((movie) => movie.title))
		.slice(offset, offset + length)
		.map((entry) => lookupMovie(queue, entry.movie_id, user_id))
		.collect());
};

export async function getShowsFromGenre(queue: ReadableQueue, video_genre_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Show[]> {
	return await Promise.all(database.getShowsFromGenre.lookup(video_genre_id)
		.map((entry) => database.shows.lookup(entry.show_id))
		.sort(jsondb.LexicalSort.increasing((entry) => entry.name))
		.slice(offset, offset + length)
		.map((entry) => lookupShow(queue, entry.show_id, user_id))
		.collect());
};

export async function getShowsFromActor(queue: ReadableQueue, actor_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Show[]> {
	return await Promise.all(database.getShowsFromActor.lookup(actor_id)
		.map((entry) => database.shows.lookup(entry.show_id))
		.sort(jsondb.LexicalSort.increasing((entry) => entry.name))
		.slice(offset, offset + length)
		.map((entry) => lookupShow(queue, entry.show_id, user_id))
		.collect());
};

export async function getUserPlaylists(queue: ReadableQueue, subject_user_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Playlist[]> {
	return await Promise.all(database.getPlaylistsFromUser.lookup(subject_user_id)
		.sort(jsondb.LexicalSort.increasing((entry) => entry.title))
		.slice(offset, offset + length)
		.map((entry) => lookupPlaylist(queue, entry.playlist_id, user_id))
		.collect());
};

export async function getUserAlbums(queue: ReadableQueue, subject_user_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Album[]> {
	let album_weights = new Map<string, number>();
	let streams = database.getStreamsFromUser.lookup(subject_user_id);
	for (let stream of streams) {
		let track_files = database.getTracksFromFile.lookup(stream.file_id);
		for (let track_file of track_files) {
			let track = database.tracks.lookup(track_file.track_id);
			let disc = database.discs.lookup(track.disc_id);
			let album = database.albums.lookup(disc.album_id);
			let album_id = album.album_id;
			let weight = album_weights.get(album_id) ?? 0;
			weight += getStreamWeight(stream.timestamp_ms);
			album_weights.set(album_id, weight);
		}
	}
	return await Promise.all(Array.from(album_weights.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((album_id) => lookupAlbum(queue, album_id, user_id)));
};

export async function getUserShows(queue: ReadableQueue, subject_user_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Show[]> {
	let show_weights = new Map<string, number>();
	let streams = database.getStreamsFromUser.lookup(subject_user_id);
	for (let stream of streams) {
		let episode_files = database.getEpisodesFromFile.lookup(stream.file_id);
		for (let episode_file of episode_files) {
			let episode = database.episodes.lookup(episode_file.episode_id);
			let season = database.seasons.lookup(episode.season_id);
			let show = database.shows.lookup(season.show_id);
			let show_id = show.show_id;
			let weight = show_weights.get(show_id) ?? 0;
			weight += getStreamWeight(stream.timestamp_ms);
			show_weights.set(show_id, weight);
		}
	}
	return await Promise.all(Array.from(show_weights.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((artist_id) => lookupShow(queue, artist_id, user_id)));
};

export async function getMoviesFromYear(queue: ReadableQueue, year_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	return await Promise.all(database.getMoviesFromYear.lookup((await lookupYearBase(queue, year_id, user_id)).year)
		.map((entry) => database.movies.lookup(entry.movie_id))
		.sort(jsondb.LexicalSort.increasing((entry) => entry.title))
		.slice(offset, offset + length)
		.map((entry) => lookupMovie(queue, entry.movie_id, user_id))
		.collect());
};

export async function getAlbumsFromYear(queue: ReadableQueue, year_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Album[]> {
	return await Promise.all(database.getAlbumsFromYear.lookup((await lookupYearBase(queue, year_id, user_id)).year)
		.map((entry) => database.albums.lookup(entry.album_id))
		.sort(jsondb.LexicalSort.increasing((entry) => entry.title))
		.slice(offset, offset + length)
		.map((entry) => lookupAlbum(queue, entry.album_id, user_id))
		.collect());
};
