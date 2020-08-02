import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libdb from "./database";
import * as utils from "./utils";
import * as auth from "./auth";

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
				user_id: "",
				username: "test",
				password: auth.password_generate("test")
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

export let streams = JSON.parse(libfs.readFileSync('./private/db/streams.json', "utf8")) as libdb.StreamDatabase;
export let lists = JSON.parse(libfs.readFileSync('./private/db/lists.json', "utf8")) as libdb.ListDatabase;
export let users = JSON.parse(libfs.readFileSync('./private/db/users.json', "utf8")) as libdb.UserDatabase;
export let media = JSON.parse(libfs.readFileSync('./private/db/media.json', "utf8")) as libdb.MediaDatabase;

export let users_index: utils.Index<libdb.UserEntry> = {};

for (let i = 0; i < users.users.length; i++) {
	let user = users.users[i];
	users_index[user.username] = user;
}

export let tokens_index: utils.Index<libdb.AuthToken> = {};

for (let i = 0; i < users.tokens.length; i++) {
	let token = users.tokens[i];
	tokens_index[token.selector] = token;
}

export let tracks_index: utils.Index<libdb.TrackEntry> = {};

for (let i = 0; i < media.audio.tracks.length; i++) {
	let track = media.audio.tracks[i];
	tracks_index[track.track_id] = track;
}

export let discs_index: utils.Index<libdb.DiscEntry> = {};

for (let i = 0; i < media.audio.discs.length; i++) {
	let disc = media.audio.discs[i];
	discs_index[disc.disc_id] = disc;
}

export let albums_index: utils.Index<libdb.AlbumEntry> = {};

for (let i = 0; i < media.audio.albums.length; i++) {
	let album = media.audio.albums[i];
	albums_index[album.album_id] = album;
}

export let artists_index: utils.Index<libdb.ArtistEntry> = {};

for (let i = 0; i < media.audio.artists.length; i++) {
	let artist = media.audio.artists[i];
	artists_index[artist.artist_id] = artist;
}

export let shows_index: utils.Index<libdb.ShowEntry> = {};

for (let i = 0; i < media.video.shows.length; i++) {
	let show = media.video.shows[i];
	shows_index[show.show_id] = show;
}

export let episodes_index: utils.Index<libdb.EpisodeEntry> = {};

for (let i = 0; i < media.video.episodes.length; i++) {
	let episode = media.video.episodes[i];
	episodes_index[episode.episode_id] = episode;
}

export let seasons_index: utils.Index<libdb.SeasonEntry> = {};

for (let i = 0; i < media.video.seasons.length; i++) {
	let season = media.video.seasons[i];
	seasons_index[season.season_id] = season;
}

export let movie_parts_index: utils.Index<libdb.MoviePartEntry> = {};

for (let i = 0; i < media.video.movie_parts.length; i++) {
	let movie_part = media.video.movie_parts[i];
	movie_parts_index[movie_part.movie_part_id] = movie_part;
}

export let movies_index: utils.Index<libdb.MovieEntry> = {};

for (let i = 0; i < media.video.movies.length; i++) {
	let movie = media.video.movies[i];
	movies_index[movie.movie_id] = movie;
}

export let video_genres_index: utils.Index<libdb.VideoGenreEntry> = {};

for (let i = 0; i < media.video.genres.length; i++) {
	let video_genre = media.video.genres[i];
	video_genres_index[video_genre.video_genre_id] = video_genre;
}

export let subtitles_index: utils.Index<libdb.SubtitleEntry> = {};

for (let i = 0; i < media.video.subtitles.length; i++) {
	let subtitle = media.video.subtitles[i];
	subtitles_index[subtitle.subtitle_id] = subtitle;
}

export let cues_index: utils.Index<libdb.CueEntry> = {};

for (let subtitle of media.video.subtitle_contents) {
	for (let cue of subtitle.cues) {
		let hash = libcrypto.createHash("md5");
		hash.update(subtitle.subtitle_id);
		hash.update("" + cue[0]);
		let cue_id = hash.digest("hex");
		let subtitle_id = subtitle.subtitle_id;
		let start_ms = cue[0];
		let duration_ms = cue[1];
		let lines = cue[2].split("\n");
		cues_index[cue_id] = {
			cue_id,
			subtitle_id,
			start_ms,
			duration_ms,
			lines
		};
	}
}

export let files_index: utils.Index<libdb.FileEntry> = {};

for (let i = 0; i < media.files.length; i++) {
	let file = media.files[i];
	files_index[file.file_id] = file;
}

export let audiolists_index: utils.Index<libdb.AudiolistEntry> = {};

for (let i = 0; i < lists.audiolists.length; i++) {
	let audiolist = lists.audiolists[i];
	audiolists_index[audiolist.audiolist_id] = audiolist;
}

if (!libfs.existsSync("./private/db/subtitles.json")) {
	let db: libdb.SubtitlesDatabase = {};
	libfs.writeFileSync("./private/db/subtitles.json", JSON.stringify(db, null, "\t"));
}

export let cue_search_index = JSON.parse(libfs.readFileSync("./private/db/subtitles.json", "utf8"), (key, value) => {
	if (value instanceof Array) {
		return new Set<string>(value);
	}
	if (value instanceof Object) {
		return new Map<string, Set<string>>(Object.keys(value).map(k => [k, value[k]]));
	}
	return value;
}) as Map<string, Set<string>>;

export function addToken(token: libdb.AuthToken): void {
	users.tokens.push(token);
	tokens_index[token.selector] = token;
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}

export let streams_index: utils.Index<Set<string>> = {};

for (let stream of streams.streams) {
	let set = streams_index[stream.username];
	if (set == null) {
		set = new Set<string>();
		streams_index[stream.username] = set;
	}
	set.add(stream.file_id);
}

export function hasStreamed(username: string, file_id: string): boolean {
	let set = streams_index[username];
	if (set == null) {
		return false;
	}
	return set.has(file_id);
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












function lookup<A>(index: utils.Index<A>, id: string): A {
	let record = index[id];
	if (record == null) {
		throw `Expected "${id}" to match a record!`;
	}
	return record;
}

let getEpisodeFromFileId = RecordIndex.from("file_id", media.video.episodes);
let getMoviePartFromFileId = RecordIndex.from("file_id", media.video.movie_parts);
let getMoviePartsFromMovieIdIndex = CollectionIndex.from("movie_id", media.video.movie_parts);
let getShowGenresFromShowId = CollectionIndex.from("show_id", media.video.show_genres);
let getMovieGenresFromMovieId = CollectionIndex.from("movie_id", media.video.movie_genres);
let getVideoGenreFromVideoGenreId = RecordIndex.from("video_genre_id", media.video.genres);
let getSeasonsFromShowIdIndex = CollectionIndex.from("show_id", media.video.seasons);
let getEpisodesFromSeasonIdIndex = CollectionIndex.from("season_id", media.video.episodes);
let getStreamsFromFileIdIndex = CollectionIndex.from("file_id", streams.streams);

export function getStreamsFromFileId(fileId: string): Array<libdb.Stream> {
	return getStreamsFromFileIdIndex.lookup(fileId)
		.sort((one, two) => {
			return one.timestamp_ms - two.timestamp_ms;
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

export function getMoviePartsFromMovieId(movieId: string): Array<libdb.MoviePartEntry & { subtitles: Array<libdb.SubtitleEntry> }> {
	return getMoviePartsFromMovieIdIndex.lookup(movieId).map((moviePart) => {
		let subtitles = fileSubtitlesIndex.lookup(moviePart.file_id);
		return {
			...moviePart,
			subtitles
		};
	});
}

export function getMovieFromMovieId(movieId: string): libdb.MovieEntry & { parts: ReturnType<typeof getMoviePartsFromMovieId> } {
	let movie = lookup(movies_index, movieId);
	let parts = getMoviePartsFromMovieId(movieId);
	return {
		...movie,
		parts
	};
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

export function lookupMetadata(fileId: string): libdb.EpisodeEntry | libdb.MoviePartEntry {
	try {
		return getEpisodeFromFileId.lookup(fileId);
	} catch (error) {}
	try {
		return getMoviePartFromFileId.lookup(fileId);
	} catch (error) {}
	throw `Expected "${fileId}" to match a metadata record!`;
}

let albumArtistsIndex = CollectionIndex.from("album_id", media.audio.album_artists);
let artistAlbumsIndex = CollectionIndex.from("artist_id", media.audio.album_artists);
let trackArtistsIndex = CollectionIndex.from("track_id", media.audio.track_artists);
let artistTracksIndex = CollectionIndex.from("artist_id", media.audio.track_artists);
let fileSubtitlesIndex = CollectionIndex.from("video_file_id", media.video.subtitles);

export function lookupSubtitles(id: string): Array<libdb.SubtitleEntry & {}> {
	return fileSubtitlesIndex.lookup(id).map((entry) => {
		return {
			...entry
		};
	});
}

export function lookupArtist(id: string): libdb.ArtistEntry & {} {
	let artist = lookup(artists_index, id);
	return {
		...artist
	};
}

export function lookupAlbumArtists(id: string): Array<libdb.ArtistEntry> {
	return albumArtistsIndex.lookup(id).map((entry) => {
		return lookupArtist(entry.artist_id);
	});
}

export function lookupAlbum(id: string): libdb.AlbumEntry & { artists: Array<libdb.ArtistEntry> } {
	let album = lookup(albums_index, id);
	let artists = lookupAlbumArtists(album.album_id);
	return {
		...album,
		artists
	};
}

export function lookupDisc(id: string): libdb.DiscEntry & { album: libdb.AlbumEntry & { artists: Array<libdb.ArtistEntry> } } {
	let disc = lookup(discs_index, id);
	let album = lookupAlbum(disc.album_id);
	return {
		...disc,
		album
	};
}

export function lookupTrackArtists(id: string): Array<libdb.ArtistEntry> {
	return trackArtistsIndex.lookup(id).map((entry) => {
		return lookupArtist(entry.artist_id);
	});
}

export function lookupTrack(id: string): libdb.TrackEntry & { disc: libdb.DiscEntry & { album: libdb.AlbumEntry & { artists: Array<libdb.ArtistEntry> } }, artists: Array<libdb.ArtistEntry> } {
	let track = lookup(tracks_index, id);
	let disc = lookupDisc(track.disc_id);
	let artists = lookupTrackArtists(track.track_id);
	return {
		...track,
		disc,
		artists
	};
}

export function lookupMovie(id: string): libdb.MovieEntry & {} {
	let movie = lookup(movies_index, id);
	return {
		...movie
	};
}

export function lookupShow(id: string): libdb.ShowEntry & {} {
	let show = lookup(shows_index, id);
	return {
		...show
	};
}

export function lookupSeason(id: string): libdb.SeasonEntry & { show: libdb.ShowEntry } {
	let season = lookup(seasons_index, id);
	let show = lookupShow(season.show_id);
	return {
		...season,
		show
	};
}

export function lookupEpisode(id: string): libdb.EpisodeEntry & { season: libdb.SeasonEntry & { show: libdb.ShowEntry } } {
	let episode = lookup(episodes_index, id);
	let season = lookupSeason(episode.season_id);
	return {
		...episode,
		season
	};
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

	search(query: string, limit?: number): Array<string> {
		let terms = utils.getSearchTerms(query);
		let sets = terms.map((term) => {
			let set = this.map.get(term);
			if (set) {
				return set;
			}
			return new Set<string>();
		});
		sets = sets.filter((set) => {
			return set.size > 0;
		})
		sets = sets.sort((one, two) => {
			return one.size - two.size;
		});
		let values = new Array<string>();
		if (sets.length > 0) {
			outer: for (let value of sets[0]) {
				inner: for (let i = 1; i < sets.length; i++) {
					if (!sets[i].has(value)) {
						continue outer;
					}
				}
				values.push(value);
				if (limit != null && values.length >= limit) {
					break outer;
				}
			}
		}
		return values;
	}

	static from<A extends { [key: string]: any }>(idField: keyof A, valueField: keyof A, collection: Iterable<A>): SearchIndex {
		let searchIndex = new SearchIndex();
		for (let record of collection) {
			let terms = utils.getSearchTerms(record[valueField]);
			for (let term of terms) {
				searchIndex.insert(term, record[idField]);
			}
		}
		return searchIndex;
	}
}

let artistTitleSearchIndex = SearchIndex.from("artist_id", "title", media.audio.artists);
let albumTitleSearchIndex = SearchIndex.from("album_id", "title", media.audio.albums);
let trackTitleSearchIndex = SearchIndex.from("track_id", "title", media.audio.tracks);
let showTitleSearchIndex = SearchIndex.from("show_id", "title", media.video.shows);
let movieTitleSearchIndex = SearchIndex.from("movie_id", "title", media.video.movies);
let episodeTitleSearchIndex = SearchIndex.from("episode_id", "title", media.video.episodes);

export type SearchResults = {
	artistIds: Array<string>,
	albumIds: Array<string>,
	trackIds: Array<string>,
	showIds: Array<string>,
	movieIds: Array<string>,
	episodeIds: Array<string>
};

export function search(query: string, limit?: number): SearchResults {
	return {
		artistIds: artistTitleSearchIndex.search(query, limit),
		albumIds: albumTitleSearchIndex.search(query, limit),
		trackIds: trackTitleSearchIndex.search(query, limit),
		showIds: showTitleSearchIndex.search(query, limit),
		movieIds: movieTitleSearchIndex.search(query, limit),
		episodeIds: episodeTitleSearchIndex.search(query, limit)
	};
}


export function addStream(username: string, file_id: string): void {
	let set = streams_index[username];
	if (set == null) {
		set = new Set<string>();
		streams_index[username] = set;
	}
	set.add(file_id);
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
