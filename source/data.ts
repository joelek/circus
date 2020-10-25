import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libdb from "./database";
import * as utils from "./utils";
import * as passwords from "./passwords";
import { CombinedSort, LexicalSort, NumericSort } from "./shared";
import * as is from "./is";
import { Album, AlbumBase, Artist, ArtistBase, Cue, CueBase, Disc, DiscBase, Entity, Episode, EpisodeBase, Genre, GenreBase, Movie, MovieBase, Playlist, PlaylistBase, Season, SeasonBase, Segment, SegmentBase, Show, ShowBase, Subtitle, SubtitleBase, Track, TrackBase, User, UserBase } from "./api/schema/objects";

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









class RecordIndex<A> {
	private map: Map<string, A>;

	constructor() {
		this.map = new Map<string, A>();
	}

	insert(id: string, record: A): void {
		this.map.set(id, record);
	}

	lookup(id: string): A {
		let record = this.map.get(id);
		if (record == null) {
			throw `Expected "${id}" to match a record!`;
		}
		return record;
	}

	remove(id: string): void {
		this.map.delete(id);
	}

	static from<A extends { [key: string]: any }>(idField: keyof A, collection: Iterable<A>): RecordIndex<A> {
		let index = new RecordIndex<A>();
		for (let record of collection) {
			index.insert(record[idField], record);
		}
		return index;
	}
}

class CollectionIndex<A> {
	private map: Map<string, Set<A>>;

	constructor() {
		this.map = new Map<string, Set<A>>();
	}

	insert(id: string, record: A): void {
		let set = this.map.get(id);
		if (!set) {
			set = new Set<A>();
			this.map.set(id, set);
		}
		set.add(record);
	}

	lookup(id: string): Array<A> {
		let set = this.map.get(id);
		if (set) {
			return Array.from(set);
		}
		return new Array<A>();
	}

	remove(id: string, record: A): void {
		let set = this.map.get(id);
		if (set) {
			set.delete(record);
			if (set.size === 0) {
				this.map.delete(id);
			}
		}
	}

	static from<A extends { [key: string]: any }>(idField: keyof A, collection: Iterable<A>): CollectionIndex<A> {
		let index = new CollectionIndex<A>();
		for (let record of collection) {
			index.insert(record[idField], record);
		}
		return index;
	}
}












export const getFileFromFileId = RecordIndex.from("file_id", media.files);
const getMovieFromMovieId = RecordIndex.from("movie_id", media.video.movies);
export const getEpisodeFromFileId = RecordIndex.from("file_id", media.video.episodes);
export const getMoviePartFromFileId = RecordIndex.from("file_id", media.video.movie_parts);
let getMoviePartsFromMovieIdIndex = CollectionIndex.from("movie_id", media.video.movie_parts);
let getShowGenresFromShowId = CollectionIndex.from("show_id", media.video.show_genres);
let getMovieGenresFromMovieId = CollectionIndex.from("movie_id", media.video.movie_genres);
export const getMoviesFromVideoGenreIdIndex = CollectionIndex.from("video_genre_id", media.video.movie_genres);
let getShowsFromVideoGenreIdIndex = CollectionIndex.from("video_genre_id", media.video.show_genres);
let getVideoGenreFromVideoGenreId = RecordIndex.from("video_genre_id", media.video.genres);
let getSeasonsFromShowIdIndex = CollectionIndex.from("show_id", media.video.seasons);
let getEpisodesFromSeasonIdIndex = CollectionIndex.from("season_id", media.video.episodes);
let getStreamsFromFileIdIndex = CollectionIndex.from("file_id", streams.streams);

export function getMoviesFromVideoGenreId(video_genre_id: string, user_id: string, offset: number, length: number): Movie[] {
	return getMoviesFromVideoGenreIdIndex.lookup(video_genre_id)
		.sort(LexicalSort.increasing((movie) => movie.movie_id))
		.slice(offset, offset + length)
		.map((movie_genre) => {
			return api_lookupMovie(movie_genre.movie_id, user_id);
		});
}

export function getShowsFromVideoGenreId(video_genre_id: string, user_id: string, offset: number, length: number): Show[] {
	return getShowsFromVideoGenreIdIndex.lookup(video_genre_id)
		.sort(LexicalSort.increasing((show) => show.show_id))
		.slice(offset, offset + length)
		.map((show_genre) => {
			return api_lookupShow(show_genre.show_id, user_id);
		});
}

export function getTokensFromUsername(username: string): Array<libdb.AuthToken> {
	return users.tokens.filter((token) => {
		return token.username === username;
	});
}

export function getStreamsFromFileId(fileId: string): Array<libdb.Stream> {
	return getStreamsFromFileIdIndex.lookup(fileId)
		.sort((one, two) => {
			return one.timestamp_ms - two.timestamp_ms;
		});
}

export function getSeasonsFromShowId(show_id: string): (libdb.SeasonEntry & {
	episodes: libdb.EpisodeEntry[]
})[] {
	return getSeasonsFromShowIdIndex.lookup(show_id).map((season) => {
		let episodes = getEpisodesFromSeasonIdIndex.lookup(season.season_id);
		return {
			...season,
			episodes
		}
	});
}

export function getEpisodesFromShowId(showId: string): Array<libdb.EpisodeEntry> {
	return getSeasonsFromShowIdIndex.lookup(showId)
		.sort((one, two) => {
			return one.number - two.number;
		})
		.map((season) => {
			return getEpisodesFromSeasonIdIndex.lookup(season.season_id)
				.sort((one, two) => {
					return one.number - two.number;
				});
		})
		.reduce((array, episodes) => {
			return array.concat(episodes);
		}, new Array<libdb.EpisodeEntry>());
}

export function getMoviePartsFromMovieId(movieId: string): Array<libdb.MoviePartEntry> {
	return getMoviePartsFromMovieIdIndex.lookup(movieId);
}

export function getVideoGenresFromShowId(showId: string): Array<libdb.VideoGenreEntry> {
	return getShowGenresFromShowId.lookup(showId).map((showGenre) => {
		return getVideoGenreFromVideoGenreId.lookup(showGenre.video_genre_id);
	});
}

export function getVideoGenresFromMovieId(movieId: string): Array<libdb.VideoGenreEntry> {
	return getMovieGenresFromMovieId.lookup(movieId).map((movieGenre) => {
		return getVideoGenreFromVideoGenreId.lookup(movieGenre.video_genre_id);
	});
}

let albumArtistsIndex = CollectionIndex.from("album_id", media.audio.album_artists);
export const getAlbumArtistsFromArtistId = CollectionIndex.from("artist_id", media.audio.album_artists);
let trackArtistsIndex = CollectionIndex.from("track_id", media.audio.track_artists);
let artistTracksIndex = CollectionIndex.from("artist_id", media.audio.track_artists);
let fileSubtitlesIndex = CollectionIndex.from("video_file_id", media.video.subtitles);
export const getDiscsFromAlbumId = CollectionIndex.from("album_id", media.audio.discs);
export const getTracksFromDiscId = CollectionIndex.from("disc_id", media.audio.tracks);
export const getAlbumFromAlbumId = RecordIndex.from("album_id", media.audio.albums);
export const getPlaylistItemsFromPlaylistId = CollectionIndex.from("audiolist_id", lists.audiolist_items);
export const getTrackFromTrackId = RecordIndex.from("track_id", media.audio.tracks);
export const getDiscFromDiscId = RecordIndex.from("disc_id", media.audio.discs);
export const getUserFromUserId = RecordIndex.from("user_id", users.users);
export const getUserFromUsername = RecordIndex.from("username", users.users);
export const getPlaylistFromPlaylistId = RecordIndex.from("audiolist_id", lists.audiolists);
export const getShowFromShowId = RecordIndex.from("show_id", media.video.shows);
export const getArtistFromArtistId = RecordIndex.from("artist_id", media.audio.artists);
export const getEpisodeFromEpisodeId = RecordIndex.from("episode_id", media.video.episodes);
export const getSeasonFromSeasonId = RecordIndex.from("season_id", media.video.seasons);
export const getSubtitleFromSubtitleId = RecordIndex.from("subtitle_id", media.video.subtitles);
export const getCueFromCueId = RecordIndex.from("cue_id", media.video.cues);
export const getCuesFromSubtitleId = CollectionIndex.from("subtitle_id", media.video.cues);

export function lookupAppearances(artist_id: string): Array<string> {
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
	return result;
}

class SearchIndex {
	private map: Map<string, Set<string>>;

	constructor() {
		this.map = new Map<string, Set<string>>();
	}

	insert(key: string, value: string): void {
		let set = this.map.get(key);
		if (!set) {
			set = new Set<string>();
			this.map.set(key, set);
		}
		set.add(value);
	}

	lookup(key: string): Set<string> {
		let set = this.map.get(key);
		if (set) {
			return new Set<string>(set);
		}
		return new Set<string>();
	}

	remove(key: string, value: string): void {
		let set = this.map.get(key);
		if (set) {
			set.delete(value);
			if (set.size === 0) {
				this.map.delete(key);
			}
		}
	}

	search(query: string): Array<{ id: string, rank: number }> {
		let terms = utils.getSearchTerms(query);
		let sets = terms.map((term) => {
			return this.map.get(term);
		}).filter(is.present);
		let map = new Map<string, number>();
		for (let set of sets) {
			for (let id of set) {
				let rank = map.get(id) ?? (0 - terms.length);
				map.set(id, rank + 2);
			}
		}
		return Array.from(map.entries())
			.filter((entry) => entry[1] >= 0)
			.sort(NumericSort.increasing((entry) => entry[1]))
			.map((entry) => ({
				id: entry[0],
				rank: entry[1]
			}));
	}

	static from<A>(collection: Iterable<A>, getKey: (record: A) => string, getValues: (record: A) => string[]): SearchIndex {
		let searchIndex = new SearchIndex();
		for (let record of collection) {
			let key = getKey(record);
			for (let values of getValues(record)) {
				let terms = utils.getSearchTerms(values);
				for (let term of terms) {
					searchIndex.insert(term, key);
				}
			}
		}
		return searchIndex;
	}
}

export const artistTitleSearchIndex = SearchIndex.from(media.audio.artists, (entry) => entry.artist_id, (entry) => [entry.title]);
export const albumTitleSearchIndex = SearchIndex.from(media.audio.albums, (entry) => entry.album_id, (entry) => [entry.title]);
export const trackTitleSearchIndex = SearchIndex.from(media.audio.tracks, (entry) => entry.track_id, (entry) => [entry.title]);
export const showTitleSearchIndex = SearchIndex.from(media.video.shows, (entry) => entry.show_id, (entry) => [entry.title]);
export const movieTitleSearchIndex = SearchIndex.from(media.video.movies, (entry) => entry.movie_id, (entry) => [entry.title]);
export const episodeTitleSearchIndex = SearchIndex.from(media.video.episodes, (entry) => entry.episode_id, (entry) => [entry.title]);
export const playlistTitleSearchIndex = SearchIndex.from(lists.audiolists, (entry) => entry.audiolist_id, (entry) => [entry.title]);
export const userUsernameSearchIndex = SearchIndex.from(users.users, (entry) => entry.user_id, (entry) => [entry.name, entry.username]);
export const cueSearchIndex = SearchIndex.from(media.video.cues, (entry) => entry.cue_id, (entry) => entry.lines);

export function searchForCues(query: string, user_id: string, offset: number, limit: number): Cue[] {
	let entries = cueSearchIndex.search(query)
		.sort(NumericSort.decreasing((value) => value.rank))
		.slice(offset, offset + limit);
	let entities = entries.map((entry) => {
		return api_lookupCue(entry.id, user_id);
	});
	return entities;
}

export function search(query: string, user_id: string, offset: number, limit: number): Entity[] {
	let entries = [
		...albumTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "ALBUM", type_rank: 5 })),
		...artistTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "ARTIST", type_rank: 7 })),
		...episodeTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "EPISODE", type_rank: 2 })),
		...movieTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "MOVIE", type_rank: 6 })),
		...showTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "SHOW", type_rank: 3 })),
		...trackTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "TRACK", type_rank: 1 })),
		...playlistTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "PLAYLIST", type_rank: 4 })),
		...userUsernameSearchIndex.search(query).map((entry) => ({ ...entry, type: "USER", type_rank: 0 }))
	].sort(CombinedSort.of(
		NumericSort.decreasing((value) => value.rank),
		NumericSort.decreasing((value) => value.type_rank)
	)).slice(offset, offset + limit);
	let entities = entries.map((entry) => {
		if (entry.type === "ALBUM") {
			return api_lookupAlbum(entry.id, user_id);
		} else if (entry.type === "ARTIST") {
			return api_lookupArtist(entry.id, user_id);
		} else if (entry.type === "EPISODE") {
			return api_lookupEpisode(entry.id, user_id);
		} else if (entry.type === "MOVIE") {
			return api_lookupMovie(entry.id, user_id);
		} else if (entry.type === "SHOW") {
			return api_lookupShow(entry.id, user_id);
		} else if (entry.type === "TRACK") {
			return api_lookupTrack(entry.id, user_id);
		} else if (entry.type === "PLAYLIST") {
			return api_lookupPlaylist(entry.id, user_id);
		} else if (entry.type === "USER") {
			return api_lookupUser(entry.id);
		}
		throw `Expected code to be unreachable!`;
	});
	return entities;
}

// TODO: Create and use index class that supports multiple keys.
export function getStreams(username: string, file_id: string): Array<libdb.Stream> {
	return getStreamsFromFileIdIndex.lookup(file_id)
		.filter((stream) => {
			return stream.username === username;
		})
		.sort(NumericSort.increasing((value) => value.timestamp_ms));
}

export function getLatestStream(username: string, file_id: string): number | null {
	let streams = getStreams(username, file_id);
	return streams.pop()?.timestamp_ms || null;
}

export function addStream(username: string, file_id: string): void {
	let timestamp_ms = Date.now();
	streams.streams.push({
		username,
		file_id,
		timestamp_ms
	});
	getStreamsFromFileIdIndex.insert(file_id, {
		file_id,
		username,
		timestamp_ms
	});
	libfs.writeFileSync("./private/db/streams.json", JSON.stringify(streams, null, "\t"));
}
















export const getTokenFromTokenId = RecordIndex.from("selector", users.tokens);

export function createToken(token: libdb.AuthToken): void {
	users.tokens.push(token);
	getTokenFromTokenId.insert(token.selector, token);
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
	getTokenFromTokenId.remove(token.selector);
	// TODO: Fix linear complexity.
	for (let i = 0; i < users.tokens.length; i++) {
		if (users.tokens[i].selector === token.selector) {
			users.tokens = users.tokens.splice(i, 1);
			break;
		}
	}
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}





























export function api_lookupAlbumBase(album_id: string, user_id: string): AlbumBase {
	let entry = getAlbumFromAlbumId.lookup(album_id);
	return {
		album_id: entry.album_id,
		title: entry.title,
		year: entry.year,
		artists: albumArtistsIndex.lookup(entry.album_id).map((entry) => {
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
		discs: getDiscsFromAlbumId.lookup(album_id).map((entry) => {
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
		albums: getAlbumArtistsFromArtistId.lookup(artist_id).map((entry) => {
			return api_lookupAlbum(entry.album_id, user_id);
		})
	};
};

export function api_lookupCueBase(cue_id: string, user_id: string): CueBase {
	let entry = getCueFromCueId.lookup(cue_id);
	return {
		cue_id: entry.cue_id,
		subtitle: api_lookupSubtitleBase(entry.subtitle_id, user_id),
		start_ms: entry.start_ms,
		duration_ms: entry.duration_ms,
		lines: entry.lines
	};
};

export function api_lookupCue(cue_id: string, user_id: string): Cue {
	let cue = api_lookupCueBase(cue_id, user_id);
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
	let tracks = getTracksFromDiscId.lookup(disc_id).map((entry) => {
		let track: TrackBase = {
			track_id: entry.track_id,
			title: entry.title,
			disc: disc,
			artists: trackArtistsIndex.lookup(entry.track_id).map((entry) => {
				return getArtistFromArtistId.lookup(entry.artist_id);
			}),
			number: entry.number,
			last_stream_date: undefined
		};
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
	let parts = getMoviePartsFromMovieId(movie_id);
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
		genres: getMovieGenresFromMovieId.lookup(movie_id).map((movie_genre) => {
			let entry = getVideoGenreFromVideoGenreId.lookup(movie_genre.video_genre_id);
			return {
				genre_id: entry.video_genre_id,
				title: entry.title
			};
		})
	};
};

export function api_lookupMovie(movie_id: string, user_id: string): Movie {
	let movie = api_lookupMovieBase(movie_id, user_id);
	let parts = getMoviePartsFromMovieId(movie_id);
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
	let items = getPlaylistItemsFromPlaylistId.lookup(playlist.playlist_id).map((audiolist_item) => {
		return {
			playlist,
			number: audiolist_item.number,
			track: api_lookupTrack(audiolist_item.track_id, user_id)
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
	let episodes = getEpisodesFromSeasonIdIndex.lookup(season.season_id).map((entry) => {
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
		artwork: undefined,
		genres: getVideoGenresFromShowId(show_id).map((video_genre) => ({
			genre_id: video_genre.video_genre_id,
			title: video_genre.title
		}))
	};
};

export function api_lookupShow(show_id: string, user_id: string): Show {
	let show = api_lookupShowBase(show_id, user_id);
	let seasons = getSeasonsFromShowIdIndex.lookup(show_id).map((entry) => {
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
		artists: trackArtistsIndex.lookup(entry.track_id).map((entry) => {
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
