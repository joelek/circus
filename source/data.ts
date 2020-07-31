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

for (let subtitle of media.video.subtitles) {
	for (let cue of subtitle.cues) {
		let hash = libcrypto.createHash("md5");
		hash.update(subtitle.file_id);
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

export function addStream(username: string, file_id: string): void {
	let set = streams_index[username];
	if (set == null) {
		set = new Set<string>();
		streams_index[username] = set;
	}
	if (!set.has(file_id)) {
		set.add(file_id);
		let timestamp_ms = Date.now();
		streams.streams.push({
			username,
			file_id,
			timestamp_ms
		});
	}
	libfs.writeFileSync("./private/db/streams.json", JSON.stringify(streams, null, "\t"));
}

export function hasStreamed(username: string, file_id: string): boolean {
	let set = streams_index[username];
	if (set == null) {
		return false;
	}
	return set.has(file_id);
}

export function getMostRecentlyStreamedEpisode(show_id: string, username: string): libdb.EpisodeEntry {
	const show = shows_index[show_id];
	if (show == null) {
		throw "";
	}
	const seasons = media.video.seasons
		.filter((season) => {
			return season.show_id === show.show_id;
		})
		.sort((one, two) => {
			return two.number - one.number;
		});
	const episodes = media.video.episodes
		.filter((episode) => {
			return null != seasons
				.find((season) => {
					return season.season_id === episode.season_id;
				});
		});
	const files = media.files
		.filter((file) => {
			return null != episodes
				.find((episode) => {
					return episode.file_id === file.file_id;
				});
		});
	const show_streams = streams.streams
		.filter((stream) => {
			return stream.username === username;
		})
		.filter((stream) => {
			return null != files
				.find((file) => {
					return file.file_id === stream.file_id;
				});
		})
		.sort((one, two) => {
			return one.timestamp_ms - two.timestamp_ms;
		});
	const stream = show_streams.pop();
	if (stream == null) {
		throw "";
	}
	console.log(stream);
	const file = files.find((file) => {
		return file.file_id === stream.file_id;
	});
	if (file == null) {
		throw "";
	}
	const episode = episodes.find((episode) => {
		return episode.file_id === file.file_id;
	});
	if (episode == null) {
		throw "";
	}
	return episode;
}

export function getEpisodesInShow(show_id: string): libdb.EpisodeEntry[] {
	return media.video.seasons
		.filter((season) => {
			return season.show_id === show_id;
		})
		.sort((one, two) => {
			return one.number - two.number;
		})
		.map((season) => {
			return media.video.episodes
				.filter((episode) => {
					return episode.season_id === season.season_id;
				}).sort((one, two) => {
					return one.number - two.number;
				});
		})
		.reduce((array, episodes) => {
			return array.concat(episodes);
		}, new Array<libdb.EpisodeEntry>());
}

export function getNextEpisode(episode_id: string): libdb.EpisodeEntry {
	const episode = episodes_index[episode_id];
	if (episode == null) {
		throw "";
	}
	const season = seasons_index[episode.season_id];
	if (season == null) {
		throw "";
	}
	const show = shows_index[season.show_id];
	if (show == null) {
		throw "";
	}
	const episodes = getEpisodesInShow(show.show_id);
	const index = episodes.indexOf(episode);
	if (index < 0) {
		throw "";
	}
	return episodes[(index + 1) % episodes.length];
}








function lookup<A>(index: utils.Index<A>, id: string): A {
	let record = index[id];
	if (record == null) {
		throw `Expected "${id}" to match a record!`;
	}
	return record;
}

export function lookupMovie(id: string): libdb.MovieEntry & {} {
	let movie = lookup(movies_index, id);
	return movie;
}

export function lookupEpisode(id: string): libdb.EpisodeEntry & { season: libdb.SeasonEntry & { show: libdb.ShowEntry } } {
	let episode = lookup(episodes_index, id);
	let season = lookup(seasons_index, episode.season_id);
	let show = lookup(shows_index, season.show_id);
	return {
		...episode,
		season: {
			...season,
			show: {
				...show
			}
		}
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

	static from<A extends { [key: string]: any }>(idField: keyof A, valueField: keyof A, collection: Iterable<A>, minlength?: number): SearchIndex {
		let searchIndex = new SearchIndex();
		for (let record of collection) {
			let terms = utils.getSearchTerms(record[valueField], minlength);
			for (let term of terms) {
				searchIndex.insert(term, record[idField]);
			}
		}
		return searchIndex;
	}
}

let movieTitleSearchIndex = SearchIndex.from("movie_id", "title", media.video.movies);
let episodeTitleSearchIndex = SearchIndex.from("episode_id", "title", media.video.episodes);

export type SearchResults = {
	movieIds: Array<string>,
	episodeIds: Array<string>
};

export function search(query: string, limit?: number): SearchResults {
	return {
		movieIds: movieTitleSearchIndex.search(query, limit),
		episodeIds: episodeTitleSearchIndex.search(query, limit)
	};
}
