import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libdb from "./database";
import * as utils from "./utils";
import * as passwords from "./passwords";
import { CombinedSort, LexicalSort, NumericSort } from "./shared";
import * as is from "./is";
import { Album, AlbumBase, Artist, ArtistBase, Disc, DiscBase, Episode, EpisodeBase, Genre, GenreBase, Movie, MovieBase, Playlist, PlaylistBase, Season, SeasonBase, Segment, SegmentBase, Show, ShowBase, Track, TrackBase, User, UserBase } from "./api/schema/objects";

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

if (!libfs.existsSync("./private/db/channels.json")) {
	let db: libdb.ChannelDatabase = {
		channels: [],
		programs: []
	};
	libfs.writeFileSync("./private/db/channels.json", JSON.stringify(db, null, "\t"));
}

export let streams = libdb.StreamDatabase.as(JSON.parse(libfs.readFileSync('./private/db/streams.json', "utf8")));
export let lists = libdb.ListDatabase.as(JSON.parse(libfs.readFileSync('./private/db/lists.json', "utf8")));
export let users = libdb.UserDatabase.as(JSON.parse(libfs.readFileSync('./private/db/users.json', "utf8")));
export let media = libdb.MediaDatabase.as(JSON.parse(libfs.readFileSync('./private/db/media.json', "utf8")));
export let channels = libdb.ChannelDatabase.as(JSON.parse(libfs.readFileSync('./private/db/channels.json', "utf8")));

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
		let cue_id = getCueId(subtitle.subtitle_id, cue);
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

function getCueId(subtitle_id: string, cue: [ number, number, string ]): string {
	let hash = libcrypto.createHash("md5");
	hash.update(subtitle_id);
	hash.update("" + cue[0]);
	let cue_id = hash.digest("hex");
	return cue_id;
}

export const cue_search_index = new Map<string, Set<string>>();
for (let subtitle of media.video.subtitle_contents) {
	for (let cue of subtitle.cues) {
		let cue_id = getCueId(subtitle.subtitle_id, cue);
		for (let line of cue[2].split("\n")) {
			let terms = utils.getSearchTerms(line).filter((term) => term.length >= 4);
			for (let term of terms) {
				let cues = cue_search_index.get(term);
				if (cues === undefined) {
					cues = new Set<string>();
					cue_search_index.set(term, cues);
				}
				cues.add(cue_id);
			}
		}
	}
}

export function addToken(token: libdb.AuthToken): void {
	users.tokens.push(token);
	tokens_index[token.selector] = token;
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}

export function updateToken(token: libdb.AuthToken): void {
	let that = tokens_index[token.selector];
	if (that) {
		that.expires_ms = token.expires_ms;
	}
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}

export function deleteToken(token: libdb.AuthToken): void {
	delete tokens_index[token.selector];
	// TODO: Fix linear complexity.
	for (let i = 0; i < users.tokens.length; i++) {
		if (users.tokens[i].selector === token.selector) {
			users.tokens = users.tokens.splice(i, 1);
			break;
		}
	}
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}

setInterval(() => {
	users.tokens = users.tokens.filter((token) => {
		return token.expires_ms > Date.now();
	});
	tokens_index = {};
	for (let token of users.tokens) {
		tokens_index[token.selector] = token;
	}
	libfs.writeFileSync("./private/db/users.json", JSON.stringify(users, null, "\t"));
}, 60 * 60 * 1000);









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
export const getMoviesFromVideoGenreIdIndex = CollectionIndex.from("video_genre_id", media.video.movie_genres);
let getShowsFromVideoGenreIdIndex = CollectionIndex.from("video_genre_id", media.video.show_genres);
let getVideoGenreFromVideoGenreId = RecordIndex.from("video_genre_id", media.video.genres);
let getSeasonsFromShowIdIndex = CollectionIndex.from("show_id", media.video.seasons);
let getEpisodesFromSeasonIdIndex = CollectionIndex.from("season_id", media.video.episodes);
let getStreamsFromFileIdIndex = CollectionIndex.from("file_id", streams.streams);
let getChannelFromChannelIdIndex = RecordIndex.from("channel_id", channels.channels);
let getProgramsFromChannelIdIndex = CollectionIndex.from("channel_id", channels.programs);

export function getMoviesFromVideoGenreId(video_genre_id: string): libdb.MovieEntry[] {
	return getMoviesFromVideoGenreIdIndex.lookup(video_genre_id).map((movie_genre) => {
		return lookupMovie(movie_genre.movie_id);
	});
}

export function getShowsFromVideoGenreId(video_genre_id: string): libdb.ShowEntry[] {
	return getShowsFromVideoGenreIdIndex.lookup(video_genre_id).map((show_genre) => {
		return lookupShow(show_genre.show_id);
	});
}

export function getChannelFromChannelId(channelId: string): libdb.ChannelEntry {
	return getChannelFromChannelIdIndex.lookup(channelId);
}

export function createChannel(channel: libdb.ChannelEntry): libdb.ChannelEntry {
	channels.channels.push(channel);
	libfs.writeFileSync("./private/db/channels.json", JSON.stringify(channels, null, "\t"));
	getChannelFromChannelIdIndex.insert(channel.channel_id, channel);
	return channel;
}

export function getProgramsFromChannelId(channelId: string): Array<libdb.ProgramEntry> {
	return getProgramsFromChannelIdIndex.lookup(channelId)
		.sort(NumericSort.increasing((value) => value.start_time_ms));
}

export function createProgram(program: libdb.ProgramEntry): libdb.ProgramEntry {
	channels.programs.push(program);
	libfs.writeFileSync("./private/db/channels.json", JSON.stringify(channels, null, "\t"));
	getProgramsFromChannelIdIndex.insert(program.channel_id, program);
	return program;
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
export const getPlaylistFromPlaylistId = RecordIndex.from("audiolist_id", lists.audiolists);
export const getShowFromShowId = RecordIndex.from("show_id", media.video.shows);
export const getArtistFromArtistId = RecordIndex.from("artist_id", media.audio.artists);
export const getEpisodeFromEpisodeId = RecordIndex.from("episode_id", media.video.episodes);
export const getSeasonFromSeasonId = RecordIndex.from("season_id", media.video.seasons);

export function lookupFile(file_id: string): libdb.FileEntry {
	let file = files_index[file_id];
	if (is.absent(file)) {
		throw `Expected a file!`;
	}
	return file;
}

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

export function lookupAppearances(artist_id: string): Array<string> {
	let track_artists = artistTracksIndex.lookup(artist_id);
	let tracks = track_artists.map((track_artist) => {
		return lookup(tracks_index, track_artist.track_id);
	});
	let disc_ids = tracks.map((track) => {
		return track.disc_id;
	});
	disc_ids = Array.from(new Set<string>(disc_ids));
	let discs = disc_ids.map((disc_id) => {
		return lookup(discs_index, disc_id);
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

	search(query: string): Array<{ id: string, rank: number }> {
		let terms = utils.getSearchTerms(query);
		let sets = terms.map((term) => {
			return this.map.get(term);
		}).filter(is.present);
		let map = new Map<string, number>();
		for (let set of sets) {
			for (let id of set) {
				let rank = map.get(id) ?? 0 - terms.length;
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

export const artistTitleSearchIndex = SearchIndex.from("artist_id", "title", media.audio.artists);
export const albumTitleSearchIndex = SearchIndex.from("album_id", "title", media.audio.albums);
export const trackTitleSearchIndex = SearchIndex.from("track_id", "title", media.audio.tracks);
export const showTitleSearchIndex = SearchIndex.from("show_id", "title", media.video.shows);
export const movieTitleSearchIndex = SearchIndex.from("movie_id", "title", media.video.movies);
export const episodeTitleSearchIndex = SearchIndex.from("episode_id", "title", media.video.episodes);
export const playlistTitleSearchIndex = SearchIndex.from("audiolist_id", "title", lists.audiolists);
export const userUsernameSearchIndex = SearchIndex.from("user_id", "username", users.users);

export function search(query: string, user_id: string, limit?: number): (Album | Artist | Episode | Movie | Show | Track | Playlist)[] {
	let entries = [
		...albumTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "ALBUM", type_rank: 5 })),
		...artistTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "ARTIST", type_rank: 7 })),
		...episodeTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "EPISODE", type_rank: 2 })),
		...movieTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "MOVIE", type_rank: 6 })),
		...showTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "SHOW", type_rank: 3 })),
		...trackTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "TRACK", type_rank: 1 })),
		...playlistTitleSearchIndex.search(query).map((entry) => ({ ...entry, type: "PLAYLIST", type_rank: 4 }))
	].sort(CombinedSort.of(
		NumericSort.increasing((value) => value.rank),
		NumericSort.increasing((value) => value.type_rank)
	));
	let entities = new Array<Album | Artist | Episode | Movie | Show | Track | Playlist>();
	while (true) {
		let entry = entries.pop();
		if (is.absent(entry)) {
			break;
		}
		if (entry.type === "ALBUM") {
			entities.push(api_lookupAlbum(entry.id, user_id));
		} else if (entry.type === "ARTIST") {
			entities.push(api_lookupArtist(entry.id, user_id));
		} else if (entry.type === "EPISODE") {
			entities.push(api_lookupEpisode(entry.id, user_id));
		} else if (entry.type === "MOVIE") {
			entities.push(api_lookupMovie(entry.id, user_id));
		} else if (entry.type === "SHOW") {
			entities.push(api_lookupShow(entry.id, user_id));
		} else if (entry.type === "TRACK") {
			entities.push(api_lookupTrack(entry.id, user_id));
		} else if (entry.type === "PLAYLIST") {
			entities.push(api_lookupPlaylist(entry.id, user_id));
		}
		if (is.present(limit) && entities.length >= limit) {
			break;
		}
	}
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
		last_stream_date: undefined
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
		subtitles: lookupSubtitles(entry.file_id).map((entry) => ({
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
	let entry = lookup(movies_index, movie_id);
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
	let parts = getMoviePartsFromMovieId(movie_id);
	let movie = api_lookupMovieBase(movie_id, user_id);
	let segment: Segment = {
		file: {
			file_id: parts[0].file_id,
			mime: "video/mp4",
			duration_ms: parts[0].duration,
			height: 0,
			width: 0
		},
		subtitles: parts[0].subtitles.map((subtitle) => ({
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
