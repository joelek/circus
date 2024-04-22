import * as libcrypto from "crypto";
import * as auth from "../server/auth";
import * as passwords from "../server/passwords";
import * as jsondb from "../jsondb";
import * as is from "../is";
import * as schema from "./schema/";
import { default as config } from "../config";
import { File, ImageFile, VideoFile, AudioFile } from "../database/schema";
import { ReadableQueue, WritableQueue } from "@joelek/atlas";
import * as atlas from "../database/atlas";
import { binid, hexid } from "../utils";
import { getPath } from "../database/indexer";
import { createDecreasingOrder } from "@joelek/atlas";
import { ActorResult, AlbumResult, ArtistResult, DiscResult, EpisodeResult, GenreResult, MovieResult, PlaylistResult, SeasonResult, ShowResult, TrackResult, UserResult, YearResult } from "./schema/api";
import { string } from "../jdb2/asserts";
import { FileContext, TrackContext } from "./schema/objects";

export async function getLanguageFromSubtitleFile(queue: ReadableQueue, subtitle_file: atlas.SubtitleFile, api_user_id: string): Promise<schema.objects.Language | undefined> {
	if (subtitle_file.language_id != null) {
		let language = await atlas.stores.languages.lookup(queue, { language_id: subtitle_file.language_id });
		return {
			language_id: hexid(language.language_id),
			name: language.name,
			iso_639_1: language.iso_639_1,
			iso_639_2: language.iso_639_2
		};
	}
	if (subtitle_file.language != null) {
		let languages = await atlas.queries.getLanguagesFromIso6392.filter(queue, { iso_639_2: subtitle_file.language });
		for (let language of languages) {
			return {
				language_id: hexid(language.language_id),
				name: language.name,
				iso_639_1: language.iso_639_1,
				iso_639_2: language.iso_639_2
			};
		}
	}
};

export function getStreamWeight(timestamp_ms: number): number {
	let ms = Date.now() - timestamp_ms;
	let weeks = ms / (1000 * 60 * 60 * 24 * 7);
	return Math.pow(0.5, weeks);
};

export async function lookupFileWithPathAndMime(queue: ReadableQueue, file_id: string, user_id: string): Promise<File & { mime: string, path: string }> {
	let file = await atlas.stores.files.lookup(queue, { file_id: binid(file_id) });
	let mime = "application/octet-stream";
	try {
		mime = (await atlas.stores.audio_files.lookup(queue, file)).mime;
	} catch (error) {}
	try {
		mime = (await atlas.stores.image_files.lookup(queue, file)).mime;
	} catch (error) {}
	try {
		mime = (await atlas.stores.metadata_files.lookup(queue, file)).mime;
	} catch (error) {}
	try {
		mime = (await atlas.stores.subtitle_files.lookup(queue, file)).mime;
	} catch (error) {}
	try {
		mime = (await atlas.stores.video_files.lookup(queue, file)).mime;
	} catch (error) {}
	let paths = await getPath(queue, file);
	let path = paths.join("/");
	return {
		...file,
		file_id: hexid(file.file_id),
		parent_directory_id: file.parent_directory_id != null ? hexid(file.parent_directory_id) : undefined,
		index_timestamp: file.index_timestamp ?? undefined,
		mime,
		path
	};
};

export async function createUser(queue: WritableQueue, request: schema.messages.RegisterRequest): Promise<schema.messages.RegisterResponse | schema.messages.ErrorMessage> {
	let { username, password, name, key_id } = { ...request };
	let errors = new Array<string>();
	if ((await atlas.queries.getUsersFromUsername.filter(queue, { username })).length > 0) {
		errors.push(`The requested username is not available.`);
	}
	if (config.use_registration_keys) {
		try {
			let key = await atlas.stores.keys.lookup(queue, { key_id: binid(key_id) });
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
	let user_id = Uint8Array.from(libcrypto.randomBytes(8));
	await atlas.stores.users.insert(queue, {
		user_id,
		username,
		name,
		password: passwords.generate(password)
	});
	if (config.use_registration_keys) {
		let key = await atlas.stores.keys.lookup(queue, { key_id: binid(key_id) });
		await atlas.stores.keys.update(queue, {
			...key,
			user_id
		});
	}
	let token = await auth.createToken(queue, username, password);
	return {
		token
	};
};

export async function lookupAlbumBase(queue: ReadableQueue, album_id: string, api_user_id: string): Promise<schema.objects.AlbumBase> {
	let album = await atlas.stores.albums.lookup(queue, { album_id: binid(album_id) });
	let image_files = [] as Array<atlas.ImageFile>;
	let album_files = await atlas.links.album_album_files.filter(queue, album);
	for (let album_file of album_files) {
		try {
			image_files.push(await atlas.stores.image_files.lookup(queue, album_file));
		} catch (error) {}
	}
	return {
		album_id: hexid(album.album_id),
		title: config.use_demo_mode ? "Album title" : album.title,
		artwork: image_files.map((image_file) => ({
			...image_file,
			file_id: hexid(image_file.file_id)
		}))
	};
};

export async function lookupAlbum(queue: ReadableQueue, album_id: string, api_user_id: string): Promise<schema.objects.Album> {
	let album_base = await lookupAlbumBase(queue, album_id, api_user_id);
	let album = await atlas.stores.albums.lookup(queue, { album_id: binid(album_id) });
	return {
		...album_base,
		artists: await Promise.all((await atlas.links.album_album_artists.filter(queue, album))
			.map((record) => lookupArtistBase(queue, hexid(record.artist_id), api_user_id))),
		year: album.year_id != null ? await lookupYearBase(queue, hexid(album.year_id), api_user_id) : undefined,
		affinity: atlas.adjustAffinity(album.affinity),
		duration_ms: album.duration_ms,
		tidal: album.tidal ?? undefined,
		copyright: album.copyright ?? undefined
	};
};

export async function lookupAlbumDiscs(queue: ReadableQueue, album_id: string, api_user_id: string, album: schema.objects.AlbumBase): Promise<Array<schema.objects.Disc>> {
	let discs = await Promise.all((await atlas.links.album_discs.filter(queue, { album_id: binid(album_id) }))
		.map((record) => lookupDisc(queue, hexid(record.disc_id), api_user_id, album)));
	return discs;
};

export async function lookupAlbumContext(queue: ReadableQueue, album_id: string, api_user_id: string): Promise<schema.objects.AlbumContext> {
	let album = await lookupAlbum(queue, album_id, api_user_id);
	let discs = await Promise.all((await atlas.links.album_discs.filter(queue, { album_id: binid(album_id) }))
		.map((record) => lookupDiscContext(queue, hexid(record.disc_id), api_user_id, album)));
	return {
		...album,
		discs
	};
};

export async function lookupArtistBase(queue: ReadableQueue, artist_id: string, api_user_id: string): Promise<schema.objects.ArtistBase> {
	let artist = await atlas.stores.artists.lookup(queue, { artist_id: binid(artist_id) });
	let artist_files = await atlas.links.artist_artist_files.filter(queue, artist);
	let artwork = [] as Array<ImageFile>;
	for (let artist_file of artist_files) {
		try {
			let image_file = await atlas.stores.image_files.lookup(queue, artist_file);
			artwork.push({
				...image_file,
				file_id: hexid(image_file.file_id)
			});
		} catch (error) {}
	}
	return {
		artist_id: hexid(artist.artist_id),
		title: config.use_demo_mode ? "Artist name" : artist.name,
		artwork: artwork
	};
};

export async function lookupArtist(queue: ReadableQueue, artist_id: string, api_user_id: string): Promise<schema.objects.Artist> {
	let artist_base = await lookupArtistBase(queue, artist_id, api_user_id);
	let artist = await atlas.stores.artists.lookup(queue, { artist_id: binid(artist_id) });
	return {
		...artist_base,
		affinity: atlas.adjustAffinity(artist.affinity),
		duration_ms: artist.duration_ms,
		tidal: artist.tidal ?? undefined
	};
};

export async function lookupArtistAlbums(queue: ReadableQueue, artist_id: string, api_user_id: string, artist: schema.objects.ArtistBase): Promise<Array<schema.objects.Album>> {
	let albums = (await Promise.all((await atlas.links.artist_album_artists.filter(queue, { artist_id: binid(artist_id) }))
		.map((album_artist) => lookupAlbum(queue, hexid(album_artist.album_id), api_user_id))))
		.sort(jsondb.NumericSort.decreasing((album) => album.year?.year));
	return albums;
};

export async function lookupArtistContext(queue: ReadableQueue, artist_id: string, api_user_id: string): Promise<schema.objects.ArtistContext> {
	let artist = await lookupArtist(queue, artist_id, api_user_id);
	let albums = (await Promise.all((await atlas.links.artist_album_artists.filter(queue, { artist_id: binid(artist_id) }))
		.map((record) => lookupAlbumContext(queue, hexid(record.album_id), api_user_id))))
		.sort(jsondb.NumericSort.decreasing((album) => album.year?.year));
	return {
		...artist,
		albums
	};
};

export async function lookupCueBase(queue: ReadableQueue, cue_id: string, api_user_id: string, subtitle?: schema.objects.SubtitleBase): Promise<schema.objects.CueBase> {
	let cue = await atlas.stores.cues.lookup(queue, { cue_id: binid(cue_id) });
	return {
		cue_id: hexid(cue.cue_id),
		subtitle: is.present(subtitle) ? subtitle : await lookupSubtitleBase(queue, hexid(cue.subtitle_id), api_user_id),
		start_ms: cue.start_ms,
		duration_ms: cue.duration_ms,
		lines: cue.lines.split("\n")
	};
};

export async function lookupCue(queue: ReadableQueue, cue_id: string, api_user_id: string, subtitle?: schema.objects.SubtitleBase): Promise<schema.objects.Cue> {
	let cue_base = await lookupCueBase(queue, cue_id, api_user_id, subtitle);
	let video_subtitles = await atlas.links.subtitle_file_video_subtitles.filter(queue, { file_id: binid(cue_base.subtitle.subtitle.file_id) });
	let entities = [] as Array<schema.objects.Episode | schema.objects.Movie>;
	for (let video_subtitle of video_subtitles) {
		let episode_files = await atlas.links.file_episode_files.filter(queue, { file_id: video_subtitle.video_file_id });
		for (let episode_file of episode_files) {
			try {
				entities.push(await lookupEpisode(queue, hexid(episode_file.episode_id), api_user_id));
			} catch (error) {}
		}
		let movie_files = await atlas.links.file_movie_files.filter(queue, { file_id: video_subtitle.video_file_id });
		for (let movie_file of movie_files) {
			try {
				entities.push(await lookupMovie(queue, hexid(movie_file.movie_id), api_user_id));
			} catch (error) {}
		}
	}
	let entity = entities.pop();
	if (is.absent(entity)) {
		throw `Expected a valid video file!`;
	}
	return {
		...cue_base,
		media: entity
	};
};

export async function lookupDiscBase(queue: ReadableQueue, disc_id: string, api_user_id: string, album?: schema.objects.AlbumBase): Promise<schema.objects.DiscBase> {
	let disc = await atlas.stores.discs.lookup(queue, { disc_id: binid(disc_id) });
	return {
		disc_id: hexid(disc.disc_id),
		album: is.present(album) ? album : await lookupAlbumBase(queue, hexid(disc.album_id), api_user_id),
		number: disc.number
	};
};

export async function lookupDisc(queue: ReadableQueue, disc_id: string, api_user_id: string, album?: schema.objects.AlbumBase): Promise<schema.objects.Disc> {
	let disc_base = await lookupDiscBase(queue, disc_id, api_user_id, album);
	let disc = await atlas.stores.discs.lookup(queue, { disc_id: binid(disc_id) });
	return {
		...disc_base,
		affinity: atlas.adjustAffinity(disc.affinity),
		duration_ms: disc.duration_ms
	};
};

export async function lookupDiscTracks(queue: ReadableQueue, disc_id: string, api_user_id: string, disc: schema.objects.DiscBase): Promise<Array<schema.objects.Track>> {
	let tracks = await Promise.all((await atlas.links.disc_tracks.filter(queue, { disc_id: binid(disc_id) }))
		.map((record) => lookupTrack(queue, hexid(record.track_id), api_user_id, disc)))
	return tracks;
};

export async function lookupDiscContext(queue: ReadableQueue, disc_id: string, api_user_id: string, album?: schema.objects.AlbumBase): Promise<schema.objects.DiscContext> {
	let disc = await lookupDisc(queue, disc_id, api_user_id, album);
	let tracks = await Promise.all((await atlas.links.disc_tracks.filter(queue, { disc_id: binid(disc_id) }))
		.map((record) => lookupTrackContext(queue, hexid(record.track_id), api_user_id, disc)));
	return {
		...disc,
		tracks
	};
};

export async function lookupEpisodeBase(queue: ReadableQueue, episode_id: string, api_user_id: string, season?: schema.objects.SeasonBase): Promise<schema.objects.EpisodeBase> {
	let episode = await atlas.stores.episodes.lookup(queue, { episode_id: binid(episode_id) });
	return {
		episode_id: hexid(episode.episode_id),
		title: config.use_demo_mode ? "Episode title" : episode.title,
		number: episode.number,
		season: is.present(season) ? season : await lookupSeasonBase(queue, hexid(episode.season_id), api_user_id)
	};
};

export async function lookupEpisode(queue: ReadableQueue, episode_id: string, api_user_id: string, season?: schema.objects.SeasonBase): Promise<schema.objects.Episode> {
	let episode_base = await lookupEpisodeBase(queue, episode_id, api_user_id, season);
	let episode = await atlas.stores.episodes.lookup(queue, { episode_id: binid(episode_id) });
	let video_files = [] as Array<atlas.VideoFile>;
	let episode_files = await atlas.links.episode_episode_files.filter(queue, episode);
	for (let episode_file of episode_files) {
		try {
			video_files.push(await atlas.stores.video_files.lookup(queue, episode_file));
		} catch (error) {}
	}
	video_files.sort(jsondb.NumericSort.increasing((record) => record.height));
	let video_file = video_files.pop();
	if (is.absent(video_file)) {
		throw `Expected a valid video file!`;
	}
	let subtitle_files = [] as Array<atlas.SubtitleFile>
	let video_file_video_subtitles = (await atlas.links.video_file_video_subtitles.filter(queue, video_file));
	for (let video_file_video_subtitle of video_file_video_subtitles) {
		subtitle_files.push(await atlas.stores.subtitle_files.lookup(queue, { file_id: video_file_video_subtitle.subtitle_file_id }));
	}
	let streams = await atlas.queries.getStreamsFromUserIdAndFileId.filter(queue, {
		user_id: binid(api_user_id),
		file_id: video_file.file_id
	}, undefined, 1);
	return {
		...episode_base,
		year: episode.year_id != null ? await lookupYearBase(queue, hexid(episode.year_id), api_user_id) : undefined,
		summary: config.use_demo_mode ? "Episode summary." : episode.summary ?? undefined,
		last_stream_date: streams.pop()?.timestamp_ms,
		media: {
			...video_file,
			file_id: hexid(video_file.file_id)
		},
		subtitles: await Promise.all(subtitle_files.map(async (subtitle_file) => ({
			file_id: hexid(subtitle_file.file_id),
			mime: subtitle_file.mime,
			duration_ms: subtitle_file.duration_ms,
			language: await getLanguageFromSubtitleFile(queue, subtitle_file, api_user_id)
		}))),
		copyright: episode.copyright ?? undefined,
		imdb: episode.imdb ?? undefined,
		affinity: atlas.adjustAffinity(episode.affinity),
		duration_ms: episode.duration_ms
	};
};

export async function lookupEpisodeContext(queue: ReadableQueue, episode_id: string, api_user_id: string, season?: schema.objects.SeasonBase): Promise<schema.objects.EpisodeContext> {
	return lookupEpisode(queue, episode_id, api_user_id, season);
};

export async function lookupGenreBase(queue: ReadableQueue, genre_id: string, api_user_id: string): Promise<schema.objects.GenreBase> {
	let genre = await atlas.stores.genres.lookup(queue, { genre_id: binid(genre_id) });
	return {
		genre_id: hexid(genre.genre_id),
		title: genre.name
	};
};

export async function lookupGenre(queue: ReadableQueue, genre_id: string, api_user_id: string): Promise<schema.objects.Genre> {
	let genre_base = await lookupGenreBase(queue, genre_id, api_user_id);
	let genre = await atlas.stores.genres.lookup(queue, { genre_id: binid(genre_id) });
	return {
		...genre_base,
		affinity: atlas.adjustAffinity(genre.affinity)
	};
};

export async function lookupMovieBase(queue: ReadableQueue, movie_id: string, api_user_id: string): Promise<schema.objects.MovieBase> {
	let movie = await atlas.stores.movies.lookup(queue, { movie_id: binid(movie_id) });
	let movie_files = await atlas.links.movie_movie_files.filter(queue, movie);
	let artwork = [] as Array<ImageFile>;
	for (let movie_file of movie_files) {
		try {
			let image_file = await atlas.stores.image_files.lookup(queue, movie_file);
			artwork.push({
				...image_file,
				file_id: hexid(image_file.file_id)
			});
		} catch (error) {}
	}
	return {
		movie_id: hexid(movie.movie_id),
		title: config.use_demo_mode ? "Movie title" : movie.title,
		artwork: artwork
	};
};

export async function lookupMovie(queue: ReadableQueue, movie_id: string, api_user_id: string): Promise<schema.objects.Movie> {
	let movie_base = await lookupMovieBase(queue, movie_id, api_user_id);
	let movie = await atlas.stores.movies.lookup(queue, { movie_id: binid(movie_id) });
	let video_files = [] as Array<atlas.VideoFile>;
	let movie_files = await atlas.links.movie_movie_files.filter(queue, movie)
	for (let movie_file of movie_files) {
		try {
			video_files.push(await atlas.stores.video_files.lookup(queue, movie_file));
		} catch (error) {}
	}
	video_files.sort(jsondb.NumericSort.increasing((record) => record.height));
	let video_file = video_files.pop();
	if (is.absent(video_file)) {
		throw `Expected a valid video file!`;
	}
	let subtitle_files = [] as Array<atlas.SubtitleFile>
	let video_file_video_subtitles = (await atlas.links.video_file_video_subtitles.filter(queue, video_file));
	for (let video_file_video_subtitle of video_file_video_subtitles) {
		subtitle_files.push(await atlas.stores.subtitle_files.lookup(queue, { file_id: video_file_video_subtitle.subtitle_file_id }));
	}
	let streams = await atlas.queries.getStreamsFromUserIdAndFileId.filter(queue, {
		user_id: binid(api_user_id),
		file_id: video_file.file_id
	}, undefined, 1);
	return {
		...movie_base,
		year: movie.year_id != null ? await lookupYearBase(queue, hexid(movie.year_id), api_user_id) : undefined,
		summary: config.use_demo_mode ? "Movie summary." : movie.summary ?? undefined,
		genres: await Promise.all((await atlas.links.movie_movie_genres.filter(queue, movie))
			.map((record) => lookupGenreBase(queue, hexid(record.genre_id), api_user_id))),
		last_stream_date: streams.pop()?.timestamp_ms,
		media: {
			...video_file,
			file_id: hexid(video_file.file_id)
		},
		subtitles: await Promise.all(subtitle_files.map(async (subtitle_file) => ({
			file_id: hexid(subtitle_file.file_id),
			mime: subtitle_file.mime,
			duration_ms: subtitle_file.duration_ms,
			language: await getLanguageFromSubtitleFile(queue, subtitle_file, api_user_id)
		}))),
		copyright: movie.copyright ?? undefined,
		imdb: movie.imdb ?? undefined,
		affinity: atlas.adjustAffinity(movie.affinity),
		duration_ms: movie.duration_ms
	};
};

export async function lookupMovieContext(queue: ReadableQueue, movie_id: string, api_user_id: string): Promise<schema.objects.MovieContext> {
	return lookupMovie(queue, movie_id, api_user_id);
};

export async function lookupMovieActors(queue: ReadableQueue, movie_id: string, api_user_id: string, anchor: string | undefined, limit: number | undefined): Promise<Array<schema.objects.Actor>> {
	let actors = await Promise.all((await atlas.links.movie_movie_actors.filter(queue, { movie_id: binid(movie_id) }, anchor != null ? { movie_id: binid(movie_id), actor_id: binid(anchor) } : undefined, limit))
		.map((record) => lookupActor(queue, hexid(record.actor_id), api_user_id)));
	return actors;
};

export async function lookupActorBase(queue: ReadableQueue, actor_id: string, api_user_id: string): Promise<schema.objects.ActorBase> {
	let actor = await atlas.stores.actors.lookup(queue, { actor_id: binid(actor_id) });
	return {
		actor_id: hexid(actor.actor_id),
		name: config.use_demo_mode ? "Actor name" : actor.name
	};
};

export async function lookupActor(queue: ReadableQueue, actor_id: string, api_user_id: string): Promise<schema.objects.Actor> {
	let actor_base = await lookupActorBase(queue, actor_id, api_user_id);
	let actor = await atlas.stores.actors.lookup(queue, { actor_id: binid(actor_id) });
	return {
		...actor_base,
		affinity: atlas.adjustAffinity(actor.affinity)
	};
};

export async function lookupPlaylistBase(queue: ReadableQueue, playlist_id: string, api_user_id: string, user?: schema.objects.UserBase): Promise<schema.objects.PlaylistBase> {
	let playlist = await atlas.stores.playlists.lookup(queue, { playlist_id: binid(playlist_id) });
	return {
		playlist_id: hexid(playlist.playlist_id),
		title: playlist.title,
		description: playlist.description,
		user: is.present(user) ? user : await lookupUserBase(queue, hexid(playlist.user_id), api_user_id)
	};
};

export async function lookupPlaylist(queue: ReadableQueue, playlist_id: string, api_user_id: string, user?: schema.objects.UserBase): Promise<schema.objects.Playlist> {
	let playlist_base = await lookupPlaylistBase(queue, playlist_id, api_user_id, user);
	let playlist = await atlas.stores.playlists.lookup(queue, { playlist_id: binid(playlist_id) });
	let artwork = [] as Array<ImageFile>;
	for (let playlist_item of await atlas.links.playlist_playlist_items.filter(queue, { playlist_id: binid(playlist_id) }, undefined, 4)) {
		let track = await atlas.stores.tracks.lookup(queue, playlist_item);
		let disc = await atlas.stores.discs.lookup(queue, track);
		let album = await atlas.stores.albums.lookup(queue, disc);
		for (let album_file of await atlas.links.album_album_files.filter(queue, album, undefined, 1)) {
			try {
				let image_file = await atlas.stores.image_files.lookup(queue, album_file);
				artwork.push({
					...image_file,
					file_id: hexid(image_file.file_id)
				});
			} catch (error) {}
		}
	}
	return {
		...playlist_base,
		affinity: atlas.adjustAffinity(playlist.affinity),
		duration_ms: playlist.duration_ms,
		artwork: artwork
	};
};

export async function lookupPlaylistItems(queue: ReadableQueue, playlist_id: string, api_user_id: string, playlist: schema.objects.PlaylistBase): Promise<Array<schema.objects.PlaylistItem>> {
	let items = await Promise.all((await atlas.links.playlist_playlist_items.filter(queue, { playlist_id: binid(playlist_id) }))
		.map((record) => lookupPlaylistItem(queue, hexid(record.playlist_item_id), api_user_id, playlist)));
	return items;
};

export async function lookupPlaylistContext(queue: ReadableQueue, playlist_id: string, api_user_id: string): Promise<schema.objects.PlaylistContext> {
	let playlist = await lookupPlaylist(queue, playlist_id, api_user_id);
	let items = await Promise.all((await atlas.links.playlist_playlist_items.filter(queue, { playlist_id: binid(playlist_id) }))
		.map((record) => lookupPlaylistItemContext(queue, hexid(record.playlist_item_id), api_user_id, playlist)));
	return {
		...playlist,
		items
	};
};

export async function lookupPlaylistItemBase(queue: ReadableQueue, playlist_item_id: string, api_user_id: string, playlist?: schema.objects.PlaylistBase): Promise<schema.objects.PlaylistItemBase> {
	let playlist_item = await atlas.stores.playlist_items.lookup(queue, { playlist_item_id: binid(playlist_item_id) });
	return {
		playlist_item_id: hexid(playlist_item.playlist_item_id),
		number: playlist_item.number,
		playlist: is.present(playlist) ? playlist : await lookupPlaylistBase(queue, hexid(playlist_item.playlist_id), api_user_id),
		track: await lookupTrack(queue, hexid(playlist_item.track_id), api_user_id),
		duration_ms: 0 // TODO
	};
};

export async function lookupPlaylistItem(queue: ReadableQueue, playlist_item_id: string, api_user_id: string, playlist?: schema.objects.PlaylistBase): Promise<schema.objects.PlaylistItem> {
	let playlist_item = await lookupPlaylistItemBase(queue, playlist_item_id, api_user_id, playlist);
	return {
		...playlist_item
	};
};

export async function lookupPlaylistItemContext(queue: ReadableQueue, playlist_item_id: string, api_user_id: string, playlist?: schema.objects.PlaylistBase): Promise<schema.objects.PlaylistItemContext> {
	return lookupPlaylistItem(queue, playlist_item_id, api_user_id, playlist);
};

export async function lookupSeasonBase(queue: ReadableQueue, season_id: string, api_user_id: string, show?: schema.objects.ShowBase): Promise<schema.objects.SeasonBase> {
	let season = await atlas.stores.seasons.lookup(queue, { season_id: binid(season_id) });
	return {
		season_id: hexid(season.season_id),
		number: season.number,
		show: is.present(show) ? show : await lookupShowBase(queue, hexid(season.show_id), api_user_id)
	};
};

export async function lookupSeason(queue: ReadableQueue, season_id: string, api_user_id: string, show?: schema.objects.ShowBase): Promise<schema.objects.Season> {
	let season_base = await lookupSeasonBase(queue, season_id, api_user_id, show);
	let season = await atlas.stores.seasons.lookup(queue, { season_id: binid(season_id) });
	return {
		...season_base,
		affinity: atlas.adjustAffinity(season.affinity),
		duration_ms: season.duration_ms
	};
};

export async function lookupSeasonEpisodes(queue: ReadableQueue, season_id: string, api_user_id: string, season: schema.objects.SeasonBase): Promise<Array<schema.objects.Episode>> {
	let episodes = await Promise.all((await atlas.links.season_episodes.filter(queue, { season_id: binid(season_id) }))
		.map((record) => lookupEpisode(queue, hexid(record.episode_id), api_user_id, season)));
	return episodes;
};

export async function lookupSeasonContext(queue: ReadableQueue, season_id: string, api_user_id: string, show?: schema.objects.ShowBase): Promise<schema.objects.SeasonContext> {
	let season = await lookupSeason(queue, season_id, api_user_id, show);
	let episodes = await Promise.all((await atlas.links.season_episodes.filter(queue, { season_id: binid(season_id) }))
		.map((record) => lookupEpisodeContext(queue, hexid(record.episode_id), api_user_id, season)));
	return {
		...season,
		episodes
	};
};

export async function lookupShowBase(queue: ReadableQueue, show_id: string, api_user_id: string): Promise<schema.objects.ShowBase> {
	let show = await atlas.stores.shows.lookup(queue, { show_id: binid(show_id) });
	let show_files = await atlas.links.show_show_files.filter(queue, show);
	let artwork: atlas.ImageFile | undefined;
	for (let show_file of show_files) {
		try {
			artwork = await atlas.stores.image_files.lookup(queue, show_file);
			break;
		} catch (error) {}
	}
	return {
		show_id: hexid(show.show_id),
		title: config.use_demo_mode ? "Show title" : show.name,
		artwork: artwork != null ? [
			{
				...artwork,
				file_id: hexid(artwork.file_id)
			}
		] : []
	};
};

export async function lookupShow(queue: ReadableQueue, show_id: string, api_user_id: string): Promise<schema.objects.Show> {
	let show_base = await lookupShowBase(queue, show_id, api_user_id);
	let show = await atlas.stores.shows.lookup(queue, { show_id: binid(show_id) });
	return {
		...show_base,
		summary: config.use_demo_mode ? "Show summary." : show.summary ?? undefined,
		genres: await Promise.all((await atlas.links.show_show_genres.filter(queue, show))
			.map((show_genre) => lookupGenreBase(queue, hexid(show_genre.genre_id), api_user_id))),
		imdb: show.imdb ?? undefined,
		affinity: atlas.adjustAffinity(show.affinity),
		duration_ms: show.duration_ms
	};
};

export async function lookupShowSeasons(queue: ReadableQueue, show_id: string, api_user_id: string, show: schema.objects.ShowBase): Promise<Array<schema.objects.Season>> {
	let seasons = await Promise.all((await atlas.links.show_seasons.filter(queue, { show_id: binid(show_id) }))
		.map((season) => lookupSeason(queue, hexid(season.season_id), api_user_id, show)));
	return seasons;
};

export async function lookupShowContext(queue: ReadableQueue, show_id: string, api_user_id: string): Promise<schema.objects.ShowContext> {
	let show = await lookupShow(queue, show_id, api_user_id);
	let seasons = await Promise.all((await atlas.links.show_seasons.filter(queue, { show_id: binid(show_id) }))
		.map((record) => lookupSeasonContext(queue, hexid(record.season_id), api_user_id, show)));
	return {
		...show,
		seasons
	};
};

export async function lookupShowActors(queue: ReadableQueue, show_id: string, api_user_id: string, anchor: string | undefined, limit: number | undefined): Promise<Array<schema.objects.Actor>> {
	let actors = await Promise.all((await atlas.links.show_show_actors.filter(queue, { show_id: binid(show_id) }, anchor != null ? { show_id: binid(show_id), actor_id: binid(anchor) } : undefined, limit))
		.map((record) => lookupActor(queue, hexid(record.actor_id), api_user_id)));
	return actors;
};

export async function lookupSubtitleBase(queue: ReadableQueue, subtitle_id: string, user_id: string): Promise<schema.objects.SubtitleBase> {
	let subtitle = await atlas.stores.subtitles.lookup(queue, { subtitle_id: binid(subtitle_id) });
	let subtitle_file = await atlas.stores.subtitle_files.lookup(queue, subtitle);
	return {
		subtitle_id: hexid(subtitle.subtitle_id),
		subtitle: {
			...subtitle_file,
			file_id: hexid(subtitle_file.file_id),
			language: subtitle_file.language ?? undefined
		}
	};
};

export async function lookupSubtitle(queue: ReadableQueue, subtitle_id: string, user_id: string): Promise<schema.objects.Subtitle> {
	let subtitle = await lookupSubtitleBase(queue, subtitle_id, user_id);
	let subtitle_cues = await atlas.links.subtitle_cues.filter(queue, { subtitle_id: binid(subtitle.subtitle_id) });
	let cues = [] as Array<schema.objects.Cue>;
	for (let subtitle_cue of subtitle_cues) {
		cues.push(await lookupCue(queue, hexid(subtitle_cue.cue_id), user_id));
	}
	return {
		...subtitle,
		cues: cues
	};
};

export async function lookupTrackBase(queue: ReadableQueue, track_id: string, user_id: string, disc?: schema.objects.DiscBase): Promise<schema.objects.TrackBase> {
	let record = await atlas.stores.tracks.lookup(queue, { track_id: binid(track_id) });
	return {
		track_id: hexid(record.track_id),
		title: config.use_demo_mode ? "Track title" : record.title,
		disc: is.present(disc) ? disc : await lookupDiscBase(queue, hexid(record.disc_id), user_id),
		number: record.number
	};
};

export async function lookupTrack(queue: ReadableQueue, track_id: string, user_id: string, disc?: schema.objects.DiscBase): Promise<schema.objects.Track> {
	let track = await lookupTrackBase(queue, track_id, user_id, disc);
	let record = await atlas.stores.tracks.lookup(queue, { track_id: binid(track_id) });
	let track_files = await atlas.links.track_track_files.filter(queue, record);
	let media: atlas.AudioFile | undefined;
	for (let track_file of track_files) {
		try {
			media = await atlas.stores.audio_files.lookup(queue, track_file);
			break;
		} catch (error) {}
	}
	if (media == null) {
		throw `Expected a valid audio file!`;
	}
	let artists = [] as Array<schema.objects.ArtistBase>;
	let track_artists = await atlas.links.track_track_artists.filter(queue, record);
	for (let track_artist of track_artists) {
		artists.push(await lookupArtistBase(queue, hexid(track_artist.artist_id), user_id));
	}
	let streams = await atlas.queries.getStreamsFromUserIdAndFileId.filter(queue, {
		user_id: binid(user_id),
		file_id: media.file_id
	}, undefined, 1);
	return {
		...track,
		artists: artists,
		last_stream_date: streams.pop()?.timestamp_ms,
		media: {
			...media,
			file_id: hexid(media.file_id)
		},
		copyright: record.copyright ?? undefined,
		affinity: atlas.adjustAffinity(record.affinity),
		duration_ms: record.duration_ms
	};
};

export async function lookupTrackContext(queue: ReadableQueue, track_id: string, api_user_id: string, disc?: schema.objects.DiscBase): Promise<schema.objects.TrackContext> {
	return lookupTrack(queue, track_id, api_user_id, disc);
};

export async function lookupUserBase(queue: ReadableQueue, user_id: string, api_user_id: string): Promise<schema.objects.UserBase> {
	let record = await atlas.stores.users.lookup(queue, { user_id: binid(user_id) });
	return {
		user_id: hexid(record.user_id),
		name: record.name,
		username: record.username
	};
};

export async function lookupUser(queue: ReadableQueue, user_id: string, api_user_id: string): Promise<schema.objects.User> {
	let user = await lookupUserBase(queue, user_id, api_user_id);
	return {
		...user
	};
};

export async function lookupYearBase(queue: ReadableQueue, year_id: string, user_id: string): Promise<schema.objects.YearBase> {
	let record = await atlas.stores.years.lookup(queue, { year_id: binid(year_id) });
	return {
		year_id: hexid(record.year_id),
		year: record.year
	};
};

export async function lookupYear(queue: ReadableQueue, year_id: string, user_id: string): Promise<schema.objects.Year> {
	let year = await lookupYearBase(queue, year_id, user_id);
	let record = await atlas.stores.years.lookup(queue, { year_id: binid(year_id) });
	let artwork = [] as Array<ImageFile>;
	for (let album of await atlas.links.year_albums.filter(queue, { year_id: binid(year_id) }, undefined, 4)) {
		let album_files = await atlas.links.album_album_files.filter(queue, album, undefined, 1);
		for (let album_file of album_files) {
			try {
				let image_file = await atlas.stores.image_files.lookup(queue, album_file);
				artwork.push({
					...image_file,
					file_id: hexid(image_file.file_id)
				});
			} catch (error) {}
		}
	}
	return {
		...year,
		affinity: atlas.adjustAffinity(record.affinity),
		artwork: artwork
	};
};

export async function lookupYearContext(queue: ReadableQueue, year_id: string, api_user_id: string): Promise<schema.objects.YearContext> {
	let year = await lookupYear(queue, year_id, api_user_id);
	let albums = await Promise.all((await atlas.links.year_albums.filter(queue, { year_id: binid(year_id)}))
		.map((record) => lookupAlbumContext(queue, hexid(record.album_id), api_user_id)));
	return {
		...year,
		albums
	};
};

export async function getDirectoryBase(queue: ReadableQueue, directory_id: string, user_id: string): Promise<schema.objects.DirectoryBase> {
	if (directory_id === "0000000000000000") {
		return {
			directory_id: "0000000000000000",
			name: "Media Root"
		};
	}
	let directory = await atlas.stores.directories.lookup(queue, { directory_id: binid(directory_id) });
	return {
		directory_id: hexid(directory.directory_id),
		name: directory.name
	};
};

export async function getDirectory(queue: ReadableQueue, directory_id: string, user_id: string, parent: schema.objects.DirectoryBase | undefined): Promise<schema.objects.Directory> {
	if (directory_id === "0000000000000000") {
		return {
			directory_id: directory_id,
			name: "Media Root"
		};
	}
	let base = await getDirectoryBase(queue, directory_id, user_id);
	let directory = await atlas.stores.directories.lookup(queue, { directory_id: binid(directory_id) });
	parent = parent ?? (directory.parent_directory_id != null ? await getDirectoryBase(queue, hexid(directory.parent_directory_id), user_id) : undefined);
	return {
		...base,
		parent: parent
	};
};

export async function getDirectoryDirectories(queue: ReadableQueue, directory_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Directory[]> {
	let directories = [] as Array<schema.objects.Directory>;
	let parent = await getDirectoryBase(queue, directory_id, user_id);
	for (let directory of await atlas.links.directory_directories.filter(queue, directory_id === "0000000000000000" ? undefined : { directory_id: binid(directory_id) }, anchor != null ? { directory_id: binid(anchor) } : undefined, length)) {
		directories.push(await getDirectory(queue, hexid(directory.directory_id), user_id, parent));
	}
	return directories;
};

export async function getDirectoryFiles(queue: ReadableQueue, directory_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.File[]> {
	let files = [] as Array<schema.objects.File>;
	let parent = await getDirectoryBase(queue, directory_id, user_id);
	for (let file of await atlas.links.directory_files.filter(queue, directory_id === "0000000000000000" ? undefined : { directory_id: binid(directory_id) }, anchor != null ? { file_id: binid(anchor) } : undefined, length)) {
		files.push(await getFile(queue, hexid(file.file_id), user_id, parent));
	}
	return files;
};

export async function getDirectoryContext(queue: ReadableQueue, directory_id: string, api_user_id: string): Promise<schema.objects.DirectoryContext> {
	let directory = await getDirectory(queue, directory_id, api_user_id, undefined);
	let files = [] as Array<FileContext>;
	for (let file of await atlas.links.directory_files.filter(queue, { directory_id: binid(directory_id) })) {
		try {
			files.push(await getFileContext(queue, hexid(file.file_id), api_user_id, directory));
		} catch (error) {}
	}
	return {
		...directory,
		files
	};
};

export async function getFileBase(queue: ReadableQueue, file_id: string, user_id: string): Promise<schema.objects.FileBase> {
	let file = await atlas.stores.files.lookup(queue, { file_id: binid(file_id) });
	return {
		file_id: hexid(file.file_id),
		name: file.name
	};
};

async function getFileDetail(queue: ReadableQueue, file: atlas.File) {
	try {
		let audio_file = await atlas.stores.audio_files.lookup(queue, file);
		return {
			type: "audio" as const,
			...audio_file,
			file_id: hexid(audio_file.file_id)
		};
	} catch (error) {}
	try {
		let video_file = await atlas.stores.video_files.lookup(queue, file);
		return {
			type: "video" as const,
			...video_file,
			file_id: hexid(video_file.file_id)
		};
	} catch (error) {}
};

export async function getFile(queue: ReadableQueue, file_id: string, user_id: string, parent: schema.objects.DirectoryBase | undefined): Promise<schema.objects.File> {
	let base = await getFileBase(queue, file_id, user_id);
	let file = await atlas.stores.files.lookup(queue, { file_id: binid(file_id) });
	parent = parent ?? (file.parent_directory_id != null ? await getDirectoryBase(queue, hexid(file.parent_directory_id), user_id) : undefined);
	let mime = (await getFileDetail(queue, file))?.mime ?? "application/octet-stream";
	return {
		...base,
		size: file.size,
		parent: parent,
		mime: mime
	};
};

export async function getFileContext(queue: ReadableQueue, file_id: string, api_user_id: string, parent: schema.objects.DirectoryBase | undefined): Promise<schema.objects.FileContext> {
	let file = await getFile(queue, file_id, api_user_id, parent);
	let media: AudioFile | VideoFile | undefined;
	try {
		let audio_file = await atlas.stores.audio_files.lookup(queue, { file_id: binid(file_id) });
		media = {
			...audio_file,
			file_id: hexid(audio_file.file_id)
		};
	} catch (error) {}
	try {
		let video_file = await atlas.stores.video_files.lookup(queue, { file_id: binid(file_id) });
		media = {
			...video_file,
			file_id: hexid(video_file.file_id)
		};
	} catch (error) {}
	if (media == null) {
		throw `Expected a valid audio or video file!`;
	}
	return {
		...file,
		media
	};
};

export async function getNewAlbums(queue: ReadableQueue, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Album[]> {
	let albums = [] as Array<schema.objects.Album>;
	for (let entry of await atlas.queries.getRecentlyUpdatedAlbums.filter(queue, {}, anchor != null ? { album_id: binid(anchor) } : undefined, length)) {
		albums.push(await lookupAlbum(queue, hexid(entry.album_id), user_id));
	}
	return albums;
};

export async function getNewMovies(queue: ReadableQueue, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let movies = [] as Array<schema.objects.Movie>;
	for (let entry of await atlas.queries.getRecentlyUpdatedMovies.filter(queue, {}, anchor != null ? { movie_id: binid(anchor) } : undefined, length)) {
		movies.push(await lookupMovie(queue, hexid(entry.movie_id), user_id));
	}
	return movies;
};

export async function searchForAlbums(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<AlbumResult[]> {
	return await Promise.all((await atlas.stores.albums.search(queue, query, anchor != null ? { album_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupAlbum(queue, hexid(record.album_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForArtists(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<ArtistResult[]> {
	return await Promise.all((await atlas.stores.artists.search(queue, query, anchor != null ? { artist_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupArtist(queue, hexid(record.artist_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForCues(queue: ReadableQueue, query: string, offset: number, limit: number, user_id: string): Promise<(schema.objects.Cue & { media: schema.objects.Episode | schema.objects.Movie })[]> {
	return [];
};

export async function searchForDiscs(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<DiscResult[]> {
	return await Promise.all((await atlas.stores.discs.search(queue, query, anchor != null ? { disc_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupDisc(queue, hexid(record.disc_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForEpisodes(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<EpisodeResult[]> {
	return await Promise.all((await atlas.stores.episodes.search(queue, query, anchor != null ? { episode_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupEpisode(queue, hexid(record.episode_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForGenres(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<GenreResult[]> {
	return await Promise.all((await atlas.stores.genres.search(queue, query, anchor != null ? { genre_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupGenre(queue, hexid(record.genre_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForMovies(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<MovieResult[]> {
	return await Promise.all((await atlas.stores.movies.search(queue, query, anchor != null ? { movie_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupMovie(queue, hexid(record.movie_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForActors(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<ActorResult[]> {
	return await Promise.all((await atlas.stores.actors.search(queue, query, anchor != null ? { actor_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupActor(queue, hexid(record.actor_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForPlaylists(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<PlaylistResult[]> {
	return await Promise.all((await atlas.stores.playlists.search(queue, query, anchor != null ? { playlist_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupPlaylist(queue, hexid(record.playlist_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForSeasons(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<SeasonResult[]> {
	return await Promise.all((await atlas.stores.seasons.search(queue, query, anchor != null ? { season_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupSeason(queue, hexid(record.season_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForShows(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<ShowResult[]> {
	return await Promise.all((await atlas.stores.shows.search(queue, query, anchor != null ? { show_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupShow(queue, hexid(record.show_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForTracks(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<TrackResult[]> {
	return await Promise.all((await atlas.stores.tracks.search(queue, query, anchor != null ? { track_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupTrack(queue, hexid(record.track_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForUsers(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<UserResult[]> {
	return await Promise.all((await atlas.stores.users.search(queue, query, anchor != null ? { user_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupUser(queue, hexid(record.user_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForYears(queue: ReadableQueue, query: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<YearResult[]> {
	return await Promise.all((await atlas.stores.years.search(queue, query, anchor != null ? { year_id: binid(anchor) } : undefined, length))
		.map(async (result) => {
			let { record, rank } = { ...result };
			let entity = await lookupYear(queue, hexid(record.year_id), user_id)
			return {
				entity,
				rank
			};
		}));
};

export async function searchForEntities(queue: ReadableQueue, query: string, user_id: string, offset: number, limit: number, options?: Partial<{ cues: boolean }>): Promise<schema.objects.Entity[]> {
	let tracks = await atlas.stores.tracks.search(queue, query);
	return await Promise.all(tracks.slice(offset, offset + limit)
		.map((record) => lookupTrack(queue, hexid(record.record.track_id), user_id)));

/* 	let results = [
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
	return entities; */
};

// TODO: Optimize.
export async function getArtistAppearances(queue: ReadableQueue, artist_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Album[]> {
	let artist = await atlas.stores.artists.lookup(queue, { artist_id: binid(artist_id) });
	let map = new Map<string, number>();
	let track_artists = await atlas.links.artist_track_artists.filter(queue, artist);
	for (let track_artist of track_artists) {
		let track = await atlas.stores.tracks.lookup(queue, track_artist);
		let disc = await atlas.stores.discs.lookup(queue, track);
		let key = hexid(disc.album_id);
		let value = map.get(key) ?? 0;
		value += 1;
		map.set(key, value);
	}
	for (let entry of map.entries()) {
		let album = await atlas.stores.albums.lookup(queue, { album_id: binid(entry[0]) });
		let album_artists = await atlas.links.album_album_artists.filter(queue, album);
		for (let album_artist of album_artists) {
			if (hexid(album_artist.artist_id) === artist_id) {
				map.delete(entry[0]);
			}
		}
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((album_id) => lookupAlbum(queue, album_id, user_id)));
};

export async function getArtistTracks(queue: ReadableQueue, artist_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Track[]> {
	let artist = await atlas.stores.artists.lookup(queue, { artist_id: binid(artist_id) });
	let map = new Map<string, number>();
	let track_artists = await atlas.links.artist_track_artists.filter(queue, artist);
	for (let track_artist of track_artists) {
		let track = await atlas.stores.tracks.lookup(queue, track_artist);
		if (track.affinity > 0) {
			map.set(hexid(track_artist.track_id), track.affinity);
		}
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((track_id) => lookupTrack(queue, track_id, user_id)));
}

// TODO: Optimize.
export async function getPlaylistAppearances(queue: ReadableQueue, track_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Playlist[]> {
	let track = await atlas.stores.tracks.lookup(queue, { track_id: binid(track_id) });
	let map = new Map<string, number>();
	let playlist_items = await atlas.links.track_playlist_items.filter(queue, track);
	for (let playlist_item of playlist_items) {
		let key = hexid(playlist_item.playlist_id);
		let value = map.get(key) ?? 0;
		map.set(key, value + 2);
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((playlist_id) => lookupPlaylist(queue, playlist_id, user_id)));
};

export async function getMovieSuggestions(queue: ReadableQueue, movie_id: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<schema.objects.Movie[]> {
	let movies = [] as Array<schema.objects.Movie>;
	for (let entry of await atlas.links.movie_movie_suggestions.filter(queue, { movie_id: binid(movie_id) }, anchor != null ? { movie_id: binid(movie_id), suggested_movie_id: binid(anchor) } : undefined, length)) {
		movies.push(await lookupMovie(queue, hexid(entry.suggested_movie_id), user_id));
	}
	return movies;
};

export async function getMoviesFromGenre(queue: ReadableQueue, genre_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let movies = [] as Array<schema.objects.Movie>;
	for (let entry of await atlas.links.genre_movie_genres.filter(queue, { genre_id: binid(genre_id) }, anchor != null ? { genre_id: binid(genre_id), movie_id: binid(anchor) } : undefined, length)) {
		movies.push(await lookupMovie(queue, hexid(entry.movie_id), user_id));
	}
	return movies;
};

export async function getMoviesFromActor(queue: ReadableQueue, actor_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let movies = [] as Array<schema.objects.Movie>;
	for (let entry of await atlas.links.actor_movie_actors.filter(queue, { actor_id: binid(actor_id) }, anchor != null ? { actor_id: binid(actor_id), movie_id: binid(anchor) } : undefined, length)) {
		movies.push(await lookupMovie(queue, hexid(entry.movie_id), user_id));
	}
	return movies;
};

export async function getShowsFromGenre(queue: ReadableQueue, genre_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Show[]> {
	let shows = [] as Array<schema.objects.Show>;
	for (let entry of await atlas.links.genre_show_genres.filter(queue, { genre_id: binid(genre_id) }, anchor != null ? { genre_id: binid(genre_id), show_id: binid(anchor) } : undefined, length)) {
		shows.push(await lookupShow(queue, hexid(entry.show_id), user_id));
	}
	return shows;
};

export async function getShowsFromActor(queue: ReadableQueue, actor_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Show[]> {
	let shows = [] as Array<schema.objects.Show>;
	for (let entry of await atlas.links.actor_show_actors.filter(queue, { actor_id: binid(actor_id) }, anchor != null ? { actor_id: binid(actor_id), show_id: binid(anchor) } : undefined, length)) {
		shows.push(await lookupShow(queue, hexid(entry.show_id), user_id));
	}
	return shows;
};

export async function getUserPlaylists(queue: ReadableQueue, subject_user_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Playlist[]> {
	let playlists = [] as Array<schema.objects.Playlist>;
	for (let entry of await atlas.links.user_playlists.filter(queue, { user_id: binid(subject_user_id) }, anchor != null ? { playlist_id: binid(anchor) } : undefined, length)) {
		playlists.push(await lookupPlaylist(queue, hexid(entry.playlist_id), user_id));
	}
	return playlists;
};

export async function getUserArtists(queue: ReadableQueue, subject_user_id: string, anchor: string | undefined, length: number, user_id: string): Promise<schema.objects.Artist[]> {
	let artists = [] as Array<schema.objects.Artist>;
	for (let artist_affinity of await atlas.links.user_artist_affinities.filter(queue, { user_id: binid(subject_user_id) }, anchor != null ? { artist_id: binid(anchor), user_id: binid(subject_user_id) } : undefined, length)) {
		artists.push(await lookupArtist(queue, hexid(artist_affinity.artist_id), user_id));
	}
	return artists;
};

export async function getUserAlbums(queue: ReadableQueue, subject_user_id: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<schema.objects.Album[]> {
	let albums = [] as Array<schema.objects.Album>;
	for (let album_affinity of await atlas.links.user_album_affinities.filter(queue, { user_id: binid(subject_user_id) }, anchor != null ? { album_id: binid(anchor), user_id: binid(subject_user_id) } : undefined, length)) {
		albums.push(await lookupAlbum(queue, hexid(album_affinity.album_id), user_id));
	}
	return albums;
};

export async function getUserShows(queue: ReadableQueue, subject_user_id: string, anchor: string | undefined, offset: number, length: number, user_id: string): Promise<schema.objects.Show[]> {
	let shows = [] as Array<schema.objects.Show>;
	for (let show_affinity of await atlas.links.user_show_affinities.filter(queue, { user_id: binid(subject_user_id) }, anchor != null ? { show_id: binid(anchor), user_id: binid(subject_user_id) } : undefined, length)) {
		shows.push(await lookupShow(queue, hexid(show_affinity.show_id), user_id));
	}
	return shows;
};

export async function getMoviesFromYear(queue: ReadableQueue, year_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let movies = [] as Array<schema.objects.Movie>;
	for (let movie of await atlas.links.year_movies.filter(queue, { year_id: binid(year_id) }, anchor != null ? { movie_id: binid(anchor) } : undefined, length)) {
		movies.push(await lookupMovie(queue, hexid(movie.movie_id), user_id));
	}
	return movies;
};

export async function getAlbumsFromYear(queue: ReadableQueue, year_id: string, user_id: string, anchor: string | undefined, offset: number, length: number): Promise<schema.objects.Album[]> {
	let albums = [] as Array<schema.objects.Album>;
	for (let album of await atlas.links.year_albums.filter(queue, { year_id: binid(year_id) }, anchor != null ? { album_id: binid(anchor) } : undefined, length)) {
		albums.push(await lookupAlbum(queue, hexid(album.album_id), user_id));
	}
	return albums;
};
