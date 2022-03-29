import * as libcrypto from "crypto";
import * as auth from "../server/auth";
import * as passwords from "../server/passwords";
import * as jsondb from "../jsondb";
import * as is from "../is";
import * as schema from "./schema/";
import { default as config } from "../config";
import { File,  ImageFile, Stream } from "../database/schema";
import { ReadableQueue, WritableQueue } from "@joelek/atlas";
import * as atlas from "../database/atlas";
import { ArtistBase } from "./schema/objects";
import { binid, hexid } from "../utils";
import { getPath } from "../database/indexer";

export function getStreamWeight(timestamp_ms: number): number {
	let ms = Date.now() - timestamp_ms;
	let weeks = ms / (1000 * 60 * 60 * 24 * 7);
	return Math.pow(0.5, weeks);
};

export async function lookupFile(queue: ReadableQueue, file_id: string, user_id: string): Promise<File & { mime: string, path: string }> {
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

export async function createStream(queue: WritableQueue, stream: Stream): Promise<void> {
	await atlas.stores.streams.insert(queue, {
		...stream,
		stream_id: binid(stream.stream_id),
		user_id: binid(stream.user_id),
		file_id: binid(stream.file_id)
	});
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
		year: album.year ?? undefined,
		discs: await Promise.all((await atlas.links.album_discs.filter(queue, album))
			.map((record) => lookupDisc(queue, hexid(record.disc_id), api_user_id, album_base)))
	};
};

export async function lookupArtistBase(queue: ReadableQueue, artist_id: string, api_user_id: string): Promise<schema.objects.ArtistBase> {
	let artist = await atlas.stores.artists.lookup(queue, { artist_id: binid(artist_id) });
	return {
		artist_id: hexid(artist.artist_id),
		title: config.use_demo_mode ? "Artist name" : artist.name
	};
};

export async function lookupArtist(queue: ReadableQueue, artist_id: string, api_user_id: string): Promise<schema.objects.Artist> {
	let artist_base = await lookupArtistBase(queue, artist_id, api_user_id);
	let artist = await atlas.stores.artists.lookup(queue, { artist_id: binid(artist_id) });
	return {
		...artist_base,
		albums: await Promise.all((await atlas.links.artist_album_artists.filter(queue, artist))
			.map((album_artist) => lookupAlbum(queue, hexid(album_artist.album_id), api_user_id)))
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
		tracks: await Promise.all((await atlas.links.disc_tracks.filter(queue, disc))
			.map((record) => lookupTrack(queue, hexid(record.track_id), api_user_id, disc_base)))
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
	let episode_files = await atlas.links.episode_episode_files.filter(queue, episode)
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
	// TODO: Use query.
	let streams = (await atlas.links.file_streams.filter(queue, video_file))
		.filter((stream) => hexid(stream.user_id) === api_user_id)
		.sort((jsondb.NumericSort.increasing((stream) => stream.timestamp_ms)));
	return {
		...episode_base,
		year: episode.year ?? undefined,
		summary: config.use_demo_mode ? "Episode summary." : episode.summary ?? undefined,
		last_stream_date: streams.pop()?.timestamp_ms,
		media: {
			...video_file,
			file_id: hexid(video_file.file_id)
		},
		subtitles: subtitle_files.map((subtitle_file) => ({
			...subtitle_file,
			file_id: hexid(subtitle_file.file_id),
			language: subtitle_file.language ?? undefined
		})),
		copyright: episode.copyright ?? undefined,
		imdb: episode.imdb ?? undefined
	};
};

export async function lookupGenreBase(queue: ReadableQueue, genre_id: string, api_user_id: string): Promise<schema.objects.GenreBase> {
	let genre = await atlas.stores.genres.lookup(queue, { genre_id: binid(genre_id) });
	return {
		genre_id: hexid(genre.genre_id),
		title: genre.name
	};
};

export async function lookupGenre(queue: ReadableQueue, genre_id: string, api_user_id: string): Promise<schema.objects.Genre> {
	let genre = await lookupGenreBase(queue, genre_id, api_user_id);
	return {
		...genre
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
	// TODO: Use query.
	let streams = (await atlas.links.file_streams.filter(queue, video_file))
		.filter((stream) => hexid(stream.user_id) === api_user_id)
		.sort((jsondb.NumericSort.increasing((stream) => stream.timestamp_ms)));
	return {
		...movie_base,
		year: movie.year ?? undefined,
		summary: config.use_demo_mode ? "Movie summary." : movie.summary ?? undefined,
		genres: await Promise.all((await atlas.links.movie_movie_genres.filter(queue, movie))
			.map((record) => lookupGenreBase(queue, hexid(record.genre_id), api_user_id))),
		actors: await Promise.all((await atlas.links.movie_movie_actors.filter(queue, movie))
			.map((record) => lookupActorBase(queue, hexid(record.actor_id), api_user_id))),
		last_stream_date: streams.pop()?.timestamp_ms,
		media: {
			...video_file,
			file_id: hexid(video_file.file_id)
		},
		subtitles: subtitle_files.map((subtitle_file) => ({
			...subtitle_file,
			file_id: hexid(subtitle_file.file_id),
			language: subtitle_file.language ?? undefined
		})),
		copyright: movie.copyright ?? undefined,
		imdb: movie.imdb ?? undefined
	};
};

export async function lookupActorBase(queue: ReadableQueue, actor_id: string, api_user_id: string): Promise<schema.objects.ActorBase> {
	let actor = await atlas.stores.actors.lookup(queue, { actor_id: binid(actor_id) });
	return {
		actor_id: hexid(actor.actor_id),
		name: config.use_demo_mode ? "Actor name" : actor.name
	};
};

export async function lookupActor(queue: ReadableQueue, actor_id: string, api_user_id: string): Promise<schema.objects.Actor> {
	let actor = await lookupActorBase(queue, actor_id, api_user_id);
	return {
		...actor
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
	let playlist = await lookupPlaylistBase(queue, playlist_id, api_user_id, user);
	return {
		...playlist,
		items: await Promise.all((await atlas.links.playlist_playlist_items.filter(queue, { playlist_id: binid(playlist.playlist_id) }))
			.map((record) => lookupPlaylistItem(queue, hexid(record.playlist_item_id), api_user_id, playlist)))
	};
};

export async function lookupPlaylistItemBase(queue: ReadableQueue, playlist_item_id: string, api_user_id: string, playlist?: schema.objects.PlaylistBase): Promise<schema.objects.PlaylistItemBase> {
	let playlist_item = await atlas.stores.playlist_items.lookup(queue, { playlist_item_id: binid(playlist_item_id) });
	return {
		playlist_item_id: hexid(playlist_item.playlist_item_id),
		number: playlist_item.number,
		playlist: is.present(playlist) ? playlist : await lookupPlaylistBase(queue, hexid(playlist_item.playlist_id), api_user_id),
		track: await lookupTrack(queue, hexid(playlist_item.track_id), api_user_id)
	};
};

export async function lookupPlaylistItem(queue: ReadableQueue, playlist_item_id: string, api_user_id: string, playlist?: schema.objects.PlaylistBase): Promise<schema.objects.PlaylistItem> {
	let playlist_item = await lookupPlaylistItemBase(queue, playlist_item_id, api_user_id, playlist);
	return {
		...playlist_item
	};
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
		episodes: await Promise.all((await atlas.links.season_episodes.filter(queue, season))
			.map((record) => lookupEpisode(queue, hexid(record.episode_id), api_user_id, season_base)))
	}
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
		actors: await Promise.all((await atlas.links.show_show_actors.filter(queue, show))
			.map((show_actor) => lookupActorBase(queue, hexid(show_actor.actor_id), api_user_id))),
		seasons: await Promise.all((await atlas.links.show_seasons.filter(queue, show))
			.map((season) => lookupSeason(queue, hexid(season.season_id), api_user_id, show_base))),
		imdb: show.imdb ?? undefined
	};
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
	let artists = [] as Array<ArtistBase>;
	let track_artists = await atlas.links.track_track_artists.filter(queue, record);
	for (let track_artist of track_artists) {
		artists.push(await lookupArtistBase(queue, hexid(track_artist.artist_id), user_id));
	}
	// TODO: Use query.
	let streams = (await atlas.links.file_streams.filter(queue, media))
		.filter((stream) => hexid(stream.user_id) === user_id)
		.sort((jsondb.NumericSort.increasing((stream) => stream.timestamp_ms)));
	return {
		...track,
		artists: artists,
		last_stream_date: streams.pop()?.timestamp_ms,
		media: {
			...media,
			file_id: hexid(media.file_id)
		},
		copyright: record.copyright ?? undefined
	};
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
	return {
		...year
	};
};

export async function getNewAlbums(queue: ReadableQueue, user_id: string, offset: number, length: number): Promise<schema.objects.Album[]> {
	let map = new Map<string, number>();
	let albums = await atlas.stores.albums.filter(queue);
	for (let album of albums) {
		let key = hexid(album.album_id);
		let discs = await atlas.links.album_discs.filter(queue, album);
		for (let disc of discs) {
			let tracks = await atlas.links.disc_tracks.filter(queue, disc);
			for (let track of tracks) {
				let track_files = await atlas.links.track_track_files.filter(queue, track);
				for (let track_file of track_files) {
					let file = await atlas.stores.files.lookup(queue, track_file);
					if (file.index_timestamp == null) {
						continue;
					}
					let value = map.get(key) ?? 0;
					value = Math.max(value, file.index_timestamp);
					map.set(key, value);
				}
			}
		}
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((album_id) => lookupAlbum(queue, album_id, user_id)));
};

export async function getNewMovies(queue: ReadableQueue, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let map = new Map<string, number>();
	let movies = await atlas.stores.movies.filter(queue);
	for (let movie of movies) {
		let key = hexid(movie.movie_id);
		let movie_files = await atlas.links.movie_movie_files.filter(queue, movie);
		for (let movie_file of movie_files) {
			let file = await atlas.stores.files.lookup(queue, movie_file);
			if (file.index_timestamp == null) {
				continue;
			}
			let value = map.get(key) ?? 0;
			value = Math.max(value, file.index_timestamp);
			map.set(key, value);
		}
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((movie_id) => lookupMovie(queue, movie_id, user_id)));
};

export async function searchForAlbums(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Album[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.albums.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupAlbum(queue, hexid(record.album_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.album_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().album_id)
			.map((id) => lookupAlbum(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForArtists(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Artist[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.artists.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupArtist(queue, hexid(record.artist_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.artist_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().artist_id)
			.map((id) => lookupArtist(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForCues(queue: ReadableQueue, query: string, offset: number, limit: number, user_id: string): Promise<(schema.objects.Cue & { media: schema.objects.Episode | schema.objects.Movie })[]> {
	return []; /* await Promise.all(database.cue_search.search(query)
		.slice(offset, offset + limit)
		.map((record) => lookupCue(queue, record.lookup().cue_id, user_id))
		.include(is.present)
		.collect()); */
};

export async function searchForDiscs(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Disc[]> {
	return await Promise.all((await atlas.stores.discs.filter(queue))
		.slice(offset, offset + length)
		.map((record) => lookupDisc(queue, hexid(record.disc_id), user_id)));
};

export async function searchForEpisodes(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Episode[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.episodes.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupEpisode(queue, hexid(record.episode_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.episode_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().episode_id)
			.map((id) => lookupEpisode(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForGenres(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Genre[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.genres.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupGenre(queue, hexid(record.genre_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.genre_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().genre_id)
			.map((id) => lookupGenre(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForMovies(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Movie[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.movies.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupMovie(queue, hexid(record.movie_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.movie_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().movie_id)
			.map((id) => lookupMovie(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForActors(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Actor[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.actors.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupActor(queue, hexid(record.actor_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.actor_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().actor_id)
			.map((id) => lookupActor(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForPlaylists(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Playlist[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.playlists.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupPlaylist(queue, hexid(record.playlist_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.playlist_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().playlist_id)
			.map((id) => lookupPlaylist(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForSeasons(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Season[]> {
	return await Promise.all((await atlas.stores.seasons.filter(queue))
		.slice(offset, offset + length)
		.map((record) => lookupSeason(queue, hexid(record.season_id), user_id)));
};

export async function searchForShows(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Show[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.shows.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupShow(queue, hexid(record.show_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.shows_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().show_id)
			.map((id) => lookupShow(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForTracks(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Track[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.tracks.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupTrack(queue, hexid(record.track_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.track_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().track_id)
			.map((id) => lookupTrack(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForUsers(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.User[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.users.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupUser(queue, hexid(record.user_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.user_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().user_id)
			.map((id) => lookupUser(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForYears(queue: ReadableQueue, query: string, offset: number, length: number, user_id: string): Promise<schema.objects.Year[]> {
	if (query === "") {
		return await Promise.all((await atlas.stores.years.filter(queue))
			.slice(offset, offset + length)
			.map((record) => lookupYear(queue, hexid(record.year_id), user_id)));
	} else {
		return [];
/* 		return await Promise.all(database.year_search.search(query)
			.slice(offset, offset + length)
			.map((record) => record.lookup().year_id)
			.map((id) => lookupYear(queue, id, user_id))
			.collect()); */
	}
};

export async function searchForEntities(queue: ReadableQueue, query: string, user_id: string, offset: number, limit: number, options?: Partial<{ cues: boolean }>): Promise<schema.objects.Entity[]> {
	return [];
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
			if (hexid(album_artist.album_id) === entry[0]) {
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
		let track_files = await atlas.links.track_track_files.filter(queue, track_artist);
		for (let track_file of track_files) {
			let streams = await atlas.links.file_streams.filter(queue, track_file);
			for (let stream of streams) {
				let key = hexid(track_file.track_id);
				let value = map.get(key) ?? 0;
				value += getStreamWeight(stream.timestamp_ms);
				map.set(key, value);
			}
		}
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((track_id) => lookupTrack(queue, track_id, user_id)));
}

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

export async function getMovieSuggestions(queue: ReadableQueue, movie_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Movie[]> {
	let movie = await atlas.stores.movies.lookup(queue, { movie_id: binid(movie_id) });
	let map = new Map<string, number>();
	let movie_genres = await atlas.links.movie_movie_genres.filter(queue, movie);
	for (let movie_genre of movie_genres) {
		let movie_genres = await atlas.links.genre_movie_genres.filter(queue, movie_genre);
		for (let movie_genre of movie_genres) {
			let key = hexid(movie_genre.movie_id);
			let value = map.get(key) ?? 0;
			value += 2;
			map.set(key, value);
		}
	}
	for (let entry of map) {
		let movie_genres = await atlas.links.movie_movie_genres.filter(queue, { movie_id: binid(entry[0]) });
		map.set(entry[0], entry[1] - movie_genres.length);
	}
	map.delete(movie_id);
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((movie_id) => lookupMovie(queue, movie_id, user_id)));
};

export async function getMoviesFromGenre(queue: ReadableQueue, genre_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let genre = await atlas.stores.genres.lookup(queue, { genre_id: binid(genre_id) });
	let movies = [] as Array<schema.objects.Movie>;
	for (let entry of await atlas.links.genre_movie_genres.filter(queue, genre)) {
		movies.push(await lookupMovie(queue, hexid(entry.movie_id), user_id));
	}
	return movies.slice(offset, offset + length);
};

export async function getMoviesFromActor(queue: ReadableQueue, actor_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let actor = await atlas.stores.actors.lookup(queue, { actor_id: binid(actor_id) });
	let movies = [] as Array<schema.objects.Movie>;
	for (let entry of await atlas.links.actor_movie_actors.filter(queue, actor)) {
		movies.push(await lookupMovie(queue, hexid(entry.movie_id), user_id));
	}
	return movies.slice(offset, offset + length);
};

export async function getShowsFromGenre(queue: ReadableQueue, genre_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Show[]> {
	let genre = await atlas.stores.genres.lookup(queue, { genre_id: binid(genre_id) });
	let shows = [] as Array<schema.objects.Show>;
	for (let entry of await atlas.links.genre_show_genres.filter(queue, genre)) {
		shows.push(await lookupShow(queue, hexid(entry.show_id), user_id));
	}
	return shows.slice(offset, offset + length);
};

export async function getShowsFromActor(queue: ReadableQueue, actor_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Show[]> {
	let actor = await atlas.stores.actors.lookup(queue, { actor_id: binid(actor_id) });
	let shows = [] as Array<schema.objects.Show>;
	for (let entry of await atlas.links.actor_show_actors.filter(queue, actor)) {
		shows.push(await lookupShow(queue, hexid(entry.show_id), user_id));
	}
	return shows.slice(offset, offset + length);
};

export async function getUserPlaylists(queue: ReadableQueue, subject_user_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Playlist[]> {
	let user = await atlas.stores.users.lookup(queue, { user_id: binid(subject_user_id) });
	let playlists = [] as Array<schema.objects.Playlist>;
	for (let entry of await atlas.links.user_playlists.filter(queue, user)) {
		playlists.push(await lookupPlaylist(queue, hexid(entry.playlist_id), user_id));
	}
	return playlists.slice(offset, offset + length);
};

export async function getUserAlbums(queue: ReadableQueue, subject_user_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Album[]> {
	let user = await atlas.stores.users.lookup(queue, { user_id: binid(subject_user_id) });
	let map = new Map<string, number>();
	let streams = await atlas.links.user_streams.filter(queue, user);
	for (let stream of streams) {
		let track_files = await atlas.links.file_track_files.filter(queue, stream);
		for (let track_file of track_files) {
			let track = await atlas.stores.tracks.lookup(queue, track_file);
			let disc = await atlas.stores.discs.lookup(queue, track);
			let album = await atlas.stores.albums.lookup(queue, disc);
			let key = hexid(album.album_id);
			let value = map.get(key) ?? 0;
			value += getStreamWeight(stream.timestamp_ms);
			map.set(key, value);
		}
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((album_id) => lookupAlbum(queue, album_id, user_id)));
};

export async function getUserShows(queue: ReadableQueue, subject_user_id: string, offset: number, length: number, user_id: string): Promise<schema.objects.Show[]> {
	let user = await atlas.stores.users.lookup(queue, { user_id: binid(subject_user_id) });
	let map = new Map<string, number>();
	let streams = await atlas.links.user_streams.filter(queue, user);
	for (let stream of streams) {
		let episode_files = await atlas.links.file_episode_files.filter(queue, stream);
		for (let episode_file of episode_files) {
			let episode = await atlas.stores.episodes.lookup(queue, episode_file);
			let season = await atlas.stores.seasons.lookup(queue, episode);
			let show = await atlas.stores.shows.lookup(queue, season);
			let key = hexid(show.show_id);
			let value = map.get(key) ?? 0;
			value += getStreamWeight(stream.timestamp_ms);
			map.set(key, value);
		}
	}
	return await Promise.all(Array.from(map.entries())
		.sort(jsondb.NumericSort.decreasing((entry) => entry[1]))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((show_id) => lookupShow(queue, show_id, user_id)));
};

export async function getMoviesFromYear(queue: ReadableQueue, year_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Movie[]> {
	let year = await lookupYearBase(queue, year_id, user_id);
	let movies = [] as Array<schema.objects.Movie>;
	for (let entry of await atlas.queries.getMoviesFromYear.filter(queue, { year: year.year })) {
		movies.push(await lookupMovie(queue, hexid(entry.movie_id), user_id));
	}
	return movies.slice(offset, offset + length);
};

export async function getAlbumsFromYear(queue: ReadableQueue, year_id: string, user_id: string, offset: number, length: number): Promise<schema.objects.Album[]> {
	let year = await lookupYearBase(queue, year_id, user_id);
	let albums = [] as Array<schema.objects.Album>;
	for (let entry of await atlas.queries.getAlbumsFromYear.filter(queue, { year: year.year })) {
		albums.push(await lookupAlbum(queue, hexid(entry.album_id), user_id));
	}
	return albums.slice(offset, offset + length);
};
