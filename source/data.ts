import * as libfs from "fs";
import * as libdb from "./database";
import * as utils from "./utils";

export let streams = JSON.parse(libfs.readFileSync('./private/db/streams.json', "utf8")) as libdb.StreamDatabase;
export let media = JSON.parse(libfs.readFileSync('./private/db/media.json', "utf8")) as libdb.MediaDatabase;
export let lists = JSON.parse(libfs.readFileSync('./private/db/lists.json', "utf8")) as libdb.ListDatabase;
export let users = JSON.parse(libfs.readFileSync('./private/db/users.json', "utf8")) as libdb.UserDatabase;

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

for (let i = 0; i < media.video.cues.length; i++) {
	let cue = media.video.cues[i];
	cues_index[cue.cue_id] = cue;
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