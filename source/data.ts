import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libdb from "./database";
import * as passwords from "./passwords";
import { CombinedSort, LexicalSort, NumericSort } from "./shared";
import * as is from "./is";
import { Album, AlbumBase, Artist, ArtistBase, Cue, CueBase, Disc, DiscBase, Entity, Episode, EpisodeBase, Genre, GenreBase, Movie, MovieBase, Person, PersonBase, Playlist, PlaylistBase, Season, SeasonBase, Segment, Show, ShowBase, Subtitle, SubtitleBase, Track, TrackBase, User, UserBase } from "./api/schema/objects";
import { CollectionIndex, RecordIndex, SearchIndex } from "./indices";

libfs.mkdirSync("./private/db/", { recursive: true });

if (!libfs.existsSync("./private/db/streams.json")) {
	let db: libdb.StreamDatabase = {
		streams: []
	};
	libfs.writeFileSync("./private/db/streams.json", JSON.stringify(db, null, "\t"));
}

if (!libfs.existsSync("./private/db/lists.json")) {
	let db: libdb.ListDatabase = {
		audiolists: [],
		audiolist_items: []
	};
	libfs.writeFileSync("./private/db/lists.json", JSON.stringify(db, null, "\t"));
}

if (!libfs.existsSync("./private/db/users.json")) {
	let db: libdb.UserDatabase = {
		users: [
			{
				user_id: libcrypto.randomBytes(16).toString("hex"),
				name: "Test User",
				username: "test",
				password: passwords.generate("test")
			}
		],
		tokens: []
	};
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(db, null, "\t"));
}

if (!libfs.existsSync("./private/db/media.json")) {
	process.stderr.write("Media database not found! Please run the indexer.\n");
	process.exit(1);
}

export let streams = libdb.StreamDatabase.as(JSON.parse(libfs.readFileSync('./private/db/streams.json', "utf8")));
export let lists = libdb.ListDatabase.as(JSON.parse(libfs.readFileSync('./private/db/lists.json', "utf8")));
export let users = libdb.UserDatabase.as(JSON.parse(libfs.readFileSync('./private/db/users.json', "utf8")));
export let media = libdb.MediaDatabase.as(JSON.parse(libfs.readFileSync('./private/db/media.json', "utf8")));

users.tokens = users.tokens.filter((token) => {
	return token.expires_ms > Date.now();
});
libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));

// Re-create cues from compact notation.
for (let subtitle of media.video.subtitle_contents) {
	let subtitle_id = subtitle.subtitle_id;
	for (let cue of subtitle.cues) {
		let start_ms = cue[0];
		let duration_ms = cue[1];
		let lines = cue[2].split("\n");
		let cue_id = libcrypto.createHash("md5")
			.update(subtitle_id)
			.update(`${start_ms}`)
			.digest("hex");
		media.video.cues.push({
			cue_id,
			subtitle_id,
			start_ms,
			duration_ms,
			lines
		});
	}
}

const getShowPersonsFromShowId = CollectionIndex.from(media.video.show_persons, (record) => record.show_id);
const getShowPersonsFromPersonId = CollectionIndex.from(media.video.show_persons, (record) => record.person_id);
const getMoviePersonsFromMovieId = CollectionIndex.from(media.video.movie_persons, (record) => record.movie_id);
const getMoviePersonsFromPersonId = CollectionIndex.from(media.video.movie_persons, (record) => record.person_id);
const getPersonFromPersonId = RecordIndex.from(media.persons, (record) => record.person_id);

export function getMoviesFromPersonId(person_id: string, user_id: string, offset: number, length: number): Movie[] {
	return getMoviePersonsFromPersonId.lookup(person_id)
		.map((entry) => {
			return getMovieFromMovieId.lookup(entry.movie_id);
		})
		.sort(LexicalSort.increasing((movie) => movie.title))
		.slice(offset, offset + length)
		.map((entry) => {
			return api_lookupMovie(entry.movie_id, user_id);
		});
}

export function getShowsFromPersonId(person_id: string, user_id: string, offset: number, length: number): Show[] {
	return getShowPersonsFromPersonId.lookup(person_id)
		.map((entry) => {
			return getShowFromShowId.lookup(entry.show_id);
		})
		.sort(LexicalSort.increasing((entry) => entry.title))
		.slice(offset, offset + length)
		.map((entry) => {
			return api_lookupShow(entry.show_id, user_id);
		});
}

export const getFileFromFileId = RecordIndex.from(media.files, (record) => record.file_id);
const getMovieFromMovieId = RecordIndex.from(media.video.movies, (record) => record.movie_id);
export const getEpisodeFromFileId = RecordIndex.from(media.video.episodes, (record) => record.file_id);
export const getMoviePartFromFileId = RecordIndex.from(media.video.movie_parts, (record) => record.file_id);
let getMoviePartsFromMovieIdIndex = CollectionIndex.from(media.video.movie_parts, (record) => record.movie_id);
let getShowGenresFromShowId = CollectionIndex.from(media.video.show_genres, (record) => record.show_id);
let getMovieGenresFromMovieId = CollectionIndex.from(media.video.movie_genres, (record) => record.movie_id);
export const getMoviesFromVideoGenreIdIndex = CollectionIndex.from(media.video.movie_genres, (record) => record.video_genre_id);
let getShowsFromVideoGenreIdIndex = CollectionIndex.from(media.video.show_genres, (record) => record.video_genre_id);
let getVideoGenreFromVideoGenreId = RecordIndex.from(media.video.genres, (record) => record.video_genre_id);
let getSeasonsFromShowIdIndex = CollectionIndex.from(media.video.seasons, (record) => record.show_id);
let getEpisodesFromSeasonIdIndex = CollectionIndex.from(media.video.episodes, (record) => record.season_id);
let getStreamsFromFileIdIndex = CollectionIndex.from(streams.streams, (record) => record.file_id);

export function getMoviesFromVideoGenreId(video_genre_id: string, user_id: string, offset: number, length: number): Movie[] {
	return getMoviesFromVideoGenreIdIndex.lookup(video_genre_id)
		.map((entry) => {
			return getMovieFromMovieId.lookup(entry.movie_id);
		})
		.sort(LexicalSort.increasing((entry) => entry.title))
		.slice(offset, offset + length)
		.map((entry) => {
			return api_lookupMovie(entry.movie_id, user_id);
		});
}

export function getShowsFromVideoGenreId(video_genre_id: string, user_id: string, offset: number, length: number): Show[] {
	return getShowsFromVideoGenreIdIndex.lookup(video_genre_id)
		.map((entry) => {
			return getShowFromShowId.lookup(entry.show_id);
		})
		.sort(LexicalSort.increasing((entry) => entry.title))
		.slice(offset, offset + length)
		.map((entry) => {
			return api_lookupShow(entry.show_id, user_id);
		});
}

export function getTokensFromUserId(user_id: string): Array<libdb.AuthToken> {
	return users.tokens.filter((token) => {
		return token.user_id === user_id;
	});
}

let albumArtistsIndex = CollectionIndex.from(media.audio.album_artists, (record) => record.album_id);
export const getAlbumArtistsFromArtistId = CollectionIndex.from(media.audio.album_artists, (record) => record.artist_id);
let trackArtistsIndex = CollectionIndex.from(media.audio.track_artists, (record) => record.track_id);
let artistTracksIndex = CollectionIndex.from(media.audio.track_artists, (record) => record.artist_id);
let fileSubtitlesIndex = CollectionIndex.from(media.video.subtitles, (record) => record.video_file_id);
export const getDiscsFromAlbumId = CollectionIndex.from(media.audio.discs, (record) => record.album_id);
export const getTracksFromDiscId = CollectionIndex.from(media.audio.tracks, (record) => record.disc_id);
export const getAlbumFromAlbumId = RecordIndex.from(media.audio.albums, (record) => record.album_id);
export const getPlaylistItemsFromPlaylistId = CollectionIndex.from(lists.audiolist_items, (record) => record.audiolist_id);
export const getPlaylistsFromUserId = CollectionIndex.from(lists.audiolists, (record) => record.user_id);
export const getTrackFromTrackId = RecordIndex.from(media.audio.tracks, (record) => record.track_id);
export const getDiscFromDiscId = RecordIndex.from(media.audio.discs, (record) => record.disc_id);
export const getUserFromUserId = RecordIndex.from(users.users, (record) => record.user_id);
export const getUserFromUsername = RecordIndex.from(users.users, (record) => record.username);
export const getPlaylistFromPlaylistId = RecordIndex.from(lists.audiolists, (record) => record.audiolist_id);
export const getShowFromShowId = RecordIndex.from(media.video.shows, (record) => record.show_id);
export const getArtistFromArtistId = RecordIndex.from(media.audio.artists, (record) => record.artist_id);
export const getEpisodeFromEpisodeId = RecordIndex.from(media.video.episodes, (record) => record.episode_id);
export const getSeasonFromSeasonId = RecordIndex.from(media.video.seasons, (record) => record.season_id);
export const getSubtitleFromSubtitleId = RecordIndex.from(media.video.subtitles, (record) => record.subtitle_id);
export const getCueFromCueId = RecordIndex.from(media.video.cues, (record) => record.cue_id);
export const getCuesFromSubtitleId = CollectionIndex.from(media.video.cues, (record) => record.subtitle_id);

export function getArtistAppearances(artist_id: string, user_id: string): Album[] {
	let track_artists = artistTracksIndex.lookup(artist_id);
	let tracks = track_artists.map((track_artist) => {
		return getTrackFromTrackId.lookup(track_artist.track_id);
	});
	let disc_ids = tracks.map((track) => {
		return track.disc_id;
	});
	disc_ids = Array.from(new Set<string>(disc_ids));
	let discs = disc_ids.map((disc_id) => {
		return getDiscFromDiscId.lookup(disc_id);
	});
	let album_ids = discs.map((disc) => {
		return disc.album_id;
	});
	album_ids = Array.from(new Set<string>(album_ids));
	let result = new Array<string>();
	for (let album_id of album_ids) {
		let album_artists = albumArtistsIndex.lookup(album_id);
		if (album_artists.find((album_artist) => album_artist.artist_id === artist_id) == null) {
			result.push(album_id);
		}
	}
	return result
		.map((entry) => getAlbumFromAlbumId.lookup(entry))
		.sort(LexicalSort.increasing((entry) => entry.title))
		.map((entry) => {
			return api_lookupAlbum(entry.album_id, user_id);
		});
};

export function getUserPlaylists(subject_user_id: string, user_id: string): Playlist[] {
	return getPlaylistsFromUserId.lookup(subject_user_id)
		.sort(LexicalSort.increasing((entry) => entry.title))
		.map((entry) => {
			return api_lookupPlaylist(entry.audiolist_id, user_id);
		});
};

export const artistTitleSearchIndex = SearchIndex.from(media.audio.artists, (entry) => [entry.title]);
export const albumTitleSearchIndex = SearchIndex.from(media.audio.albums, (entry) => [entry.title]);
export const trackTitleSearchIndex = SearchIndex.from(media.audio.tracks, (entry) => [entry.title]);
export const showTitleSearchIndex = SearchIndex.from(media.video.shows, (entry) => [entry.title]);
export const movieTitleSearchIndex = SearchIndex.from(media.video.movies, (entry) => [entry.title]);
export const episodeTitleSearchIndex = SearchIndex.from(media.video.episodes, (entry) => [entry.title]);
export const playlistTitleSearchIndex = SearchIndex.from(lists.audiolists, (entry) => [entry.title]);
export const userUsernameSearchIndex = SearchIndex.from(users.users, (entry) => [entry.name, entry.username]);
export const cueSearchIndex = SearchIndex.from(media.video.cues, (entry) => entry.lines);
export const personSearchIndex = SearchIndex.from(media.persons, (entry) => [entry.name]);
export const genreSearchIndex = SearchIndex.from(media.video.genres, (entry) => [entry.title]);

export function search(query: string, user_id: string, offset: number, limit: number): Entity[] {
	let results = [
		...albumTitleSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 9 })),
		...artistTitleSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 6 })),
		...episodeTitleSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 4 })),
		...genreSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 2 })),
		...movieTitleSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 8 })),
		...personSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 1 })),
		...playlistTitleSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 3 })),
		...showTitleSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 7 })),
		...trackTitleSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 5 })),
		...userUsernameSearchIndex.lookup(query).map((result) => ({ ...result, type_rank: 0 }))
	].sort(CombinedSort.of(
		NumericSort.decreasing((value) => value.rank),
		NumericSort.decreasing((value) => value.type_rank)
	)).slice(offset, offset + limit);
	let entities = results.map((result) => {
		let entry = result.record;
		if (libdb.AlbumEntry.is(entry)) {
			return api_lookupAlbum(entry.album_id, user_id);
		} else if (libdb.ArtistEntry.is(entry)) {
			return api_lookupArtist(entry.artist_id, user_id);
		} else if (libdb.EpisodeEntry.is(entry)) {
			return api_lookupEpisode(entry.episode_id, user_id);
		} else if (libdb.VideoGenreEntry.is(entry)) {
			return api_lookupGenre(entry.video_genre_id, user_id);
		} else if (libdb.MovieEntry.is(entry)) {
			return api_lookupMovie(entry.movie_id, user_id);
		} else if (libdb.PersonEntry.is(entry)) {
			return api_lookupPerson(entry.person_id, user_id);
		} else if (libdb.AudiolistEntry.is(entry)) {
			return api_lookupPlaylist(entry.audiolist_id, user_id);
		} else if (libdb.ShowEntry.is(entry)) {
			return api_lookupShow(entry.show_id, user_id);
		} else if (libdb.TrackEntry.is(entry)) {
			return api_lookupTrack(entry.track_id, user_id);
		} else if (libdb.UserEntry.is(entry)) {
			return api_lookupUser(entry.user_id);
		}
		throw `Expected code to be unreachable!`;
	});
	return entities;
}

// TODO: Create and use index class that supports multiple keys.
export function getStreams(user_id: string, file_id: string): Array<libdb.Stream> {
	return getStreamsFromFileIdIndex.lookup(file_id)
		.filter((stream) => {
			return stream.user_id === user_id;
		})
		.sort(NumericSort.increasing((value) => value.timestamp_ms));
}

export function getLatestStream(user_id: string, file_id: string): number | null {
	let streams = getStreams(user_id, file_id);
	return streams.pop()?.timestamp_ms || null;
}

export function addStream(user_id: string, file_id: string): void {
	let timestamp_ms = Date.now();
	let stream = {
		user_id,
		file_id,
		timestamp_ms
	};
	streams.streams.push(stream);
	getStreamsFromFileIdIndex.insert(stream);
	libfs.writeFileSync("./private/db/streams.json", JSON.stringify(streams, null, "\t"));
}
















export const getTokenFromTokenId = RecordIndex.from(users.tokens, (record) => record.selector);

export function createToken(token: libdb.AuthToken): void {
	users.tokens.push(token);
	getTokenFromTokenId.insert(token);
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}

export function updateToken(token: libdb.AuthToken): void {
	try {
		let other = getTokenFromTokenId.lookup(token.selector);
		other.expires_ms = token.expires_ms;
		libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
	} catch (error) {}
}

export function deleteToken(token: libdb.AuthToken): void {
	getTokenFromTokenId.remove(token);
	// TODO: Fix linear complexity.
	for (let i = 0; i < users.tokens.length; i++) {
		if (users.tokens[i].selector === token.selector) {
			users.tokens = users.tokens.splice(i, 1);
			break;
		}
	}
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}










export function getMovieSuggestions(movie_id: string, offset: number, length: number, user_id: string): Movie[] {
	let genres = getMovieGenresFromMovieId.lookup(movie_id);
	let map = new Map<string, number>();
	for (let genre of genres) {
		let movie_genres = getMoviesFromVideoGenreIdIndex.lookup(genre.video_genre_id);
		for (let movie_genre of movie_genres) {
			let value = map.get(movie_genre.movie_id) ?? 0;
			map.set(movie_genre.movie_id, value + 2);
		}
	}
	for (let entry of map) {
		let video_genres = getMovieGenresFromMovieId.lookup(entry[0]);
		map.set(entry[0], entry[1] - video_genres.length);
	}
	map.delete(movie_id);
	return Array.from(map.entries())
		.sort(CombinedSort.of(
			NumericSort.decreasing((entry) => entry[1])
		))
		.slice(offset, offset + length)
		.map((entry) => entry[0])
		.map((movie_id) => api_lookupMovie(movie_id, user_id))
};
























export function api_lookupAlbumBase(album_id: string, user_id: string): AlbumBase {
	let entry = getAlbumFromAlbumId.lookup(album_id);
	return {
		album_id: entry.album_id,
		title: entry.title,
		year: entry.year,
		artists: albumArtistsIndex.lookup(entry.album_id)
			.sort(NumericSort.increasing((entry) => entry.order))
			.map((entry) => {
				return getArtistFromArtistId.lookup(entry.artist_id);
			}),
		artwork: is.absent(entry.cover_file_id) ? undefined : {
			file_id: entry.cover_file_id,
			mime: "image/jpeg",
			height: 1080,
			width: 1080
		}
	};
};

export function api_lookupAlbum(album_id: string, user_id: string): Album {
	let album = api_lookupAlbumBase(album_id, user_id);
	return {
		...album,
		discs: getDiscsFromAlbumId.lookup(album_id)
			.sort(NumericSort.increasing((entry) => entry.number))
			.map((entry) => {
				return api_lookupDisc(entry.disc_id, user_id, album);
			})
	};
};

export function api_lookupArtistBase(artist_id: string, user_id: string): ArtistBase {
	let entry = getArtistFromArtistId.lookup(artist_id);
	return {
		artist_id: entry.artist_id,
		title: entry.title
	};
};

export function api_lookupArtist(artist_id: string, user_id: string): Artist {
	let artist = api_lookupArtistBase(artist_id, user_id);
	return {
		...artist,
		albums: getAlbumArtistsFromArtistId.lookup(artist_id)
			.map((entry) => {
				return getAlbumFromAlbumId.lookup(entry.album_id);
			})
			.sort(NumericSort.decreasing((entry) => entry.year))
			.map((entry) => {
				return api_lookupAlbum(entry.album_id, user_id);
			})
	};
};

export function api_lookupCueBase(cue_id: string, user_id: string, subtitle?: SubtitleBase): CueBase {
	let entry = getCueFromCueId.lookup(cue_id);
	return {
		cue_id: entry.cue_id,
		subtitle: is.present(subtitle) ? subtitle : api_lookupSubtitleBase(entry.subtitle_id, user_id),
		start_ms: entry.start_ms,
		duration_ms: entry.duration_ms,
		lines: entry.lines
	};
};

export function api_lookupCue(cue_id: string, user_id: string, subtitle?: SubtitleBase): Cue {
	let cue = api_lookupCueBase(cue_id, user_id, subtitle);
	return {
		...cue
	};
};

export function api_lookupDiscBase(disc_id: string, user_id: string, album?: AlbumBase): DiscBase {
	let entry = getDiscFromDiscId.lookup(disc_id);
	return {
		disc_id: entry.disc_id,
		album: is.present(album) ? album : api_lookupAlbumBase(entry.album_id, user_id),
		number: entry.number
	};
};

export function api_lookupDisc(disc_id: string, user_id: string, album?: AlbumBase): Disc {
	let disc = api_lookupDiscBase(disc_id, user_id, album);
	let tracks = getTracksFromDiscId.lookup(disc_id)
		.sort(NumericSort.increasing((entry) => entry.number))
		.map((entry) => {
			return api_lookupTrack(entry.track_id, user_id, disc);
		});
	return {
		...disc,
		tracks
	};
};

export function api_lookupEpisodeBase(episode_id: string, user_id: string, season?: SeasonBase): EpisodeBase {
	let entry = getEpisodeFromEpisodeId.lookup(episode_id);
	return {
		episode_id: entry.episode_id,
		title: entry.title,
		summary: entry.summary ?? "",
		number: entry.number,
		season: is.present(season) ? season : api_lookupSeasonBase(entry.season_id, user_id),
		year: entry.year ?? undefined,
		last_stream_date: is.present(user_id) ? getLatestStream(user_id, entry.file_id) ?? undefined : undefined,
	};
};

export function api_lookupEpisode(episode_id: string, user_id: string, season?: SeasonBase): Episode {
	let entry = getEpisodeFromEpisodeId.lookup(episode_id);
	let episode = api_lookupEpisodeBase(episode_id, user_id, season);
	let segment: Segment = {
		file: {
			file_id: entry.file_id,
			mime: "video/mp4",
			duration_ms: entry.duration,
			height: 0,
			width: 0
		},
		subtitles: fileSubtitlesIndex.lookup(entry.file_id).map((entry) => ({
			subtitle_id: entry.subtitle_id,
			file: {
				file_id: entry.file_id,
				mime: "text/vtt"
			},
			language: entry.language ?? undefined,
			cues: []
		}))
	};
	return {
		...episode,
		segment
	};
};

export function api_lookupGenreBase(genre_id: string, user_id: string): GenreBase {
	let entry = getVideoGenreFromVideoGenreId.lookup(genre_id);
	return {
		genre_id: entry.video_genre_id,
		title: entry.title
	};
};

export function api_lookupGenre(genre_id: string, user_id: string): Genre {
	let genre = api_lookupGenreBase(genre_id, user_id);
	return {
		...genre
	};
};

export function api_lookupMovieBase(movie_id: string, user_id: string): MovieBase {
	let entry = getMovieFromMovieId.lookup(movie_id);
	let parts = getMoviePartsFromMovieIdIndex.lookup(movie_id);
	return {
		movie_id: entry.movie_id,
		title: entry.title,
		year: entry.year,
		summary: entry.summary ?? "",
		artwork: is.absent(entry.poster_file_id) ? undefined : {
			file_id: entry.poster_file_id,
			mime: "image/jpeg",
			height: 720,
			width: 1080
		},
		last_stream_date: is.present(user_id) ? getLatestStream(user_id, parts[0].file_id) ?? undefined : undefined,
		genres: getMovieGenresFromMovieId.lookup(movie_id)
			.sort(NumericSort.increasing((entry) => entry.order))
			.map((movie_genre) => {
				let entry = getVideoGenreFromVideoGenreId.lookup(movie_genre.video_genre_id);
				return {
					genre_id: entry.video_genre_id,
					title: entry.title
				};
			}),
		actors: getMoviePersonsFromMovieId.lookup(movie_id)
			.sort(NumericSort.increasing((entry) => entry.order))
			.map((movie_person) => {
				return api_lookupPerson(movie_person.person_id, user_id);
			})
	};
};

export function api_lookupMovie(movie_id: string, user_id: string): Movie {
	let movie = api_lookupMovieBase(movie_id, user_id);
	let parts = getMoviePartsFromMovieIdIndex.lookup(movie_id);
	let subtitles = fileSubtitlesIndex.lookup(parts[0].file_id);
	let segment: Segment = {
		file: {
			file_id: parts[0].file_id,
			mime: "video/mp4",
			duration_ms: parts[0].duration,
			height: 0,
			width: 0
		},
		subtitles: subtitles.map((subtitle) => ({
			subtitle_id: subtitle.subtitle_id,
			file: {
				file_id: subtitle.file_id,
				mime: "text/vtt"
			},
			language: subtitle.language ?? undefined,
			cues: []
		}))
	};
	return {
		...movie,
		segment
	};
};

export function api_lookupPersonBase(person_id: string, user_id: string): PersonBase {
	let entry = getPersonFromPersonId.lookup(person_id);
	return {
		person_id: entry.person_id,
		name: entry.name
	};
};

export function api_lookupPerson(person_id: string, user_id: string): Person {
	let person = api_lookupPersonBase(person_id, user_id);
	return {
		...person
	};
};

export function api_lookupPlaylistBase(playlist_id: string, user_id: string): PlaylistBase {
	let entry = getPlaylistFromPlaylistId.lookup(playlist_id);
	return {
		playlist_id: entry.audiolist_id,
		title: entry.title,
		description: entry.description,
		user: api_lookupUserBase(entry.user_id)
	};
};

export function api_lookupPlaylist(playlist_id: string, user_id: string): Playlist {
	let playlist = api_lookupPlaylistBase(playlist_id, user_id);
	let items = getPlaylistItemsFromPlaylistId.lookup(playlist.playlist_id)
		.sort(NumericSort.increasing((entry) => entry.number))
		.map((entry) => {
			return {
				playlist,
				number: entry.number,
				track: api_lookupTrack(entry.track_id, user_id)
			};
		});
	return {
		...playlist,
		items
	};
};

export function api_lookupSeasonBase(season_id: string, user_id: string, show?: ShowBase): SeasonBase {
	let entry = getSeasonFromSeasonId.lookup(season_id);
	return  {
		season_id: entry.season_id,
		number: entry.number,
		show: is.present(show) ? show : api_lookupShowBase(entry.show_id, user_id)
	};
};

export function api_lookupSeason(season_id: string, user_id: string, show?: ShowBase): Season {
	let season = api_lookupSeasonBase(season_id, user_id, show);
	let episodes = getEpisodesFromSeasonIdIndex.lookup(season.season_id)
		.sort(NumericSort.increasing((entry) => entry.number))
		.map((entry) => {
			return api_lookupEpisode(entry.episode_id, user_id, season);
		});
	return {
		...season,
		episodes
	}
};

export function api_lookupShowBase(show_id: string, user_id: string): ShowBase {
	let entry = getShowFromShowId.lookup(show_id);
	return {
		show_id: entry.show_id,
		title: entry.title,
		summary: entry.summary ?? "",
		artwork: is.absent(entry.poster_file_id) ? undefined : {
			file_id: entry.poster_file_id,
			mime: "image/jpeg",
			height: 1080,
			width: 720
		},
		genres: getShowGenresFromShowId.lookup(show_id)
			.sort(NumericSort.increasing((entry) => entry.order))
			.map((entry) => getVideoGenreFromVideoGenreId.lookup(entry.video_genre_id))
			.map((video_genre) => ({
				genre_id: video_genre.video_genre_id,
				title: video_genre.title
			})),
		actors: getShowPersonsFromShowId.lookup(show_id)
			.sort(NumericSort.increasing((entry) => entry.order))
			.map((show_person) => {
				return api_lookupPerson(show_person.person_id, user_id);
			})
	};
};

export function api_lookupShow(show_id: string, user_id: string): Show {
	let show = api_lookupShowBase(show_id, user_id);
	let seasons = getSeasonsFromShowIdIndex.lookup(show_id)
		.sort(NumericSort.increasing((entry) => entry.number))
		.map((entry) => {
			return api_lookupSeason(entry.season_id, user_id, show);
		});
	return {
		...show,
		seasons
	};
};

export function api_lookupSubtitleBase(subtitle_id: string, user_id: string): SubtitleBase {
	let entry = getSubtitleFromSubtitleId.lookup(subtitle_id);
	return {
		subtitle_id: entry.subtitle_id,
		file: {
			file_id: entry.file_id,
			mime: "text/vtt"
		},
		language: entry.language ?? undefined
	};
};

export function api_lookupSubtitle(subtitle_id: string, user_id: string): Subtitle {
	let subtitle = api_lookupSubtitleBase(subtitle_id, user_id);
	let cues = getCuesFromSubtitleId.lookup(subtitle_id)
		.map((entry) => api_lookupCue(entry.cue_id, user_id))
		.sort(NumericSort.increasing((entry) => entry.start_ms));
	return {
		...subtitle,
		cues
	};
};

export function api_lookupTrackBase(track_id: string, user_id: string, disc?: DiscBase): TrackBase {
	let entry = getTrackFromTrackId.lookup(track_id);
	return {
		track_id: entry.track_id,
		title: entry.title,
		disc: is.present(disc) ? disc : api_lookupDiscBase(entry.disc_id, user_id),
		artists: trackArtistsIndex.lookup(entry.track_id)
			.sort(NumericSort.increasing((entry) => entry.order))
			.map((entry) => {
				return getArtistFromArtistId.lookup(entry.artist_id);
			}),
		number: entry.number,
		last_stream_date: undefined
	};
};

export function api_lookupTrack(track_id: string, user_id: string, disc?: DiscBase): Track {
	let entry = getTrackFromTrackId.lookup(track_id);
	let track = api_lookupTrackBase(track_id, user_id, disc);
	return {
		...track,
		segment: {
			file: {
				file_id: entry.file_id,
				mime: "audio/mp4",
				duration_ms: entry.duration
			}
		}
	};
};

export function api_lookupUserBase(user_id: string): UserBase {
	let entry = getUserFromUserId.lookup(user_id);
	return {
		user_id: entry.user_id,
		name: entry.name,
		username: entry.username
	};
};

export function api_lookupUser(user_id: string): User {
	let user = api_lookupUserBase(user_id);
	return {
		...user
	};
};





export function searchForAlbums(query: string, offset: number, length: number, user_id: string): Album[] {
	if (query === "") {
		return media.audio.albums.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => api_lookupAlbum(entry.album_id, user_id));
	} else {
		return albumTitleSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupAlbum(entry.album_id, user_id));
	}
};

export function searchForArtists(query: string, offset: number, length: number, user_id: string): Artist[] {
	if (query === "") {
		return media.audio.artists.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => api_lookupArtist(entry.artist_id, user_id));
	} else {
		return artistTitleSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupArtist(entry.artist_id, user_id));
	}
};

export function searchForCues(query: string, offset: number, limit: number, user_id: string): (Cue & { media: Episode | Movie })[] {
	return cueSearchIndex.lookup(query)
		.sort(NumericSort.decreasing((value) => value.rank))
		.slice(offset, offset + limit)
		.map((entry) => {
			return api_lookupCue(entry.record.cue_id, user_id);
		})
		.map((cue) => {
			let entry = getSubtitleFromSubtitleId.lookup(cue.subtitle.subtitle_id);
			try {
				let episode = getEpisodeFromFileId.lookup(entry.video_file_id);
				return {
					...cue,
					media: api_lookupEpisode(episode.episode_id, user_id)
				}
			} catch (error) {}
			try {
				let movie = getMoviePartFromFileId.lookup(entry.video_file_id);
				return {
					...cue,
					media: api_lookupMovie(movie.movie_id, user_id)
				}
			} catch (error) {}
		})
		.filter(is.present);
};

export function searchForDiscs(query: string, offset: number, length: number, user_id: string): Disc[] {
	return media.audio.discs
		.sort(LexicalSort.increasing((entry) => entry.disc_id))
		.slice(offset, offset + length)
		.map((entry) => api_lookupDisc(entry.disc_id, user_id));
};

export function searchForEpisodes(query: string, offset: number, length: number, user_id: string): Episode[] {
	if (query === "") {
		return media.video.episodes.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => api_lookupEpisode(entry.episode_id, user_id));
	} else {
		return episodeTitleSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupEpisode(entry.episode_id, user_id));
	}
};

export function searchForGenres(query: string, offset: number, length: number, user_id: string): Genre[] {
	if (query === "") {
		return media.video.genres.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.map((entry) => {
				return api_lookupGenre(entry.video_genre_id, user_id);
			});
	} else {
		return genreSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupGenre(entry.video_genre_id, user_id));
	}
};

export function searchForMovies(query: string, offset: number, length: number, user_id: string): Movie[] {
	if (query === "") {
		return media.video.movies.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => api_lookupMovie(entry.movie_id, user_id));
	} else {
		return movieTitleSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupMovie(entry.movie_id, user_id));
	}
};

export function searchForPersons(query: string, offset: number, length: number, user_id: string): Person[] {
	if (query === "") {
		return media.persons.slice()
			.sort(LexicalSort.increasing((entry) => entry.name))
			.slice(offset, offset + length)
			.map((entry) => api_lookupPerson(entry.person_id, user_id));
	} else {
		return personSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupPerson(entry.person_id, user_id));
	}
};

export function searchForPlaylists(query: string, offset: number, length: number, user_id: string): Playlist[] {
	if (query === "") {
		return lists.audiolists.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => api_lookupPlaylist(entry.audiolist_id, user_id));
	} else {
		return playlistTitleSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupPlaylist(entry.audiolist_id, user_id));
	}
};

export function searchForSeasons(query: string, offset: number, length: number, user_id: string): Season[] {
	return media.video.seasons
		.sort(LexicalSort.increasing((entry) => entry.season_id))
		.slice(offset, offset + length)
		.map((entry) => api_lookupSeason(entry.season_id, user_id));
};

export function searchForShows(query: string, offset: number, length: number, user_id: string): Show[] {
	if (query === "") {
		return media.video.shows.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => api_lookupShow(entry.show_id, user_id));
	} else {
		return showTitleSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupShow(entry.show_id, user_id));
	}
};

export function searchForTracks(query: string, offset: number, length: number, user_id: string): Track[] {
	if (query === "") {
		return media.audio.tracks.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => api_lookupTrack(entry.track_id, user_id));
	} else {
		return trackTitleSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupTrack(entry.track_id, user_id));
	}
};

export function searchForUsers(query: string, offset: number, length: number, user_id: string): User[] {
	if (query === "") {
		return users.users.slice()
			.sort(LexicalSort.increasing((entry) => entry.name))
			.slice(offset, offset + length)
			.map((entry) => api_lookupUser(entry.user_id));
	} else {
		return userUsernameSearchIndex.lookup(query)
			.map((entry) => entry.record)
			.slice(offset, offset + length)
			.map((entry) => api_lookupUser(entry.user_id));
	}
};
