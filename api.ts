import * as libhttp from "http";
import * as libfs from "fs";
import * as libcc from "./cc";
import * as libauth from "./auth";
import * as libdb from "./database";
import * as libutils from "./utils";
import * as api_response from "./api_response";

let media = require('./private/db/media.json') as libdb.MediaDatabase;
let lists = require('./private/db/lists.json') as libdb.ListDatabase;

let tracks_index: libdb.Index<libdb.TrackEntry> = {};

for (let i = 0; i < media.audio.tracks.length; i++) {
	let track = media.audio.tracks[i];
	tracks_index[track.track_id] = track;
}

let discs_index: libdb.Index<libdb.DiscEntry> = {};

for (let i = 0; i < media.audio.discs.length; i++) {
	let disc = media.audio.discs[i];
	discs_index[disc.disc_id] = disc;
}

let albums_index: libdb.Index<libdb.AlbumEntry> = {};

for (let i = 0; i < media.audio.albums.length; i++) {
	let album = media.audio.albums[i];
	albums_index[album.album_id] = album;
}

let artists_index: libdb.Index<libdb.ArtistEntry> = {};

for (let i = 0; i < media.audio.artists.length; i++) {
	let artist = media.audio.artists[i];
	artists_index[artist.artist_id] = artist;
}

let shows_index: libdb.Index<libdb.ShowEntry> = {};

for (let i = 0; i < media.video.shows.length; i++) {
	let show = media.video.shows[i];
	shows_index[show.show_id] = show;
}

let episodes_index: libdb.Index<libdb.EpisodeEntry> = {};

for (let i = 0; i < media.video.episodes.length; i++) {
	let episode = media.video.episodes[i];
	episodes_index[episode.episode_id] = episode;
}

let seasons_index: libdb.Index<libdb.SeasonEntry> = {};

for (let i = 0; i < media.video.seasons.length; i++) {
	let season = media.video.seasons[i];
	seasons_index[season.season_id] = season;
}

let movies_index: libdb.Index<libdb.MovieEntry> = {};

for (let i = 0; i < media.video.movies.length; i++) {
	let movie = media.video.movies[i];
	movies_index[movie.movie_id] = movie;
}

let subtitles_index: libdb.Index<libdb.SubtitleEntry> = {};

for (let i = 0; i < media.video.subtitles.length; i++) {
	let subtitle = media.video.subtitles[i];
	subtitles_index[subtitle.subtitle_id] = subtitle;
}

let cues_index: libdb.Index<libdb.CueEntry> = {};

for (let i = 0; i < media.video.cues.length; i++) {
	let cue = media.video.cues[i];
	cues_index[cue.cue_id] = cue;
}

let audiolists_index: libdb.Index<libdb.AudiolistEntry> = {};

for (let i = 0; i < lists.audiolists.length; i++) {
	let audiolist = lists.audiolists[i];
	audiolists_index[audiolist.audiolist_id] = audiolist;
}

let cue_search_index = JSON.parse(libfs.readFileSync("./private/db/subtitles.json", "utf8"), (key, value) => {
	if (value instanceof Array) {
		return new Set<string>(value);
	}
	if (value instanceof Object) {
		return new Map<string, Set<string>>(Object.keys(value).map(k => [k, value[k]]));
	}
	return value;
}) as libdb.SubtitlesDatabase;

function searchForCues(query: string): Array<string> {
	let terms = libutils.getSearchTerms(query);
	let cue_id_sets = terms.map((term) => {
		let cues = cue_search_index.get(term);
		if (cues !== undefined) {
			return cues;
		} else {
			return new Set<string>();
		}
	}).filter((cues) => cues.size > 0);
	let cue_ids = new Array<string>();
	if (cue_id_sets.length > 0) {
		outer: for (let cue_id of cue_id_sets[0]) {
			inner: for (let i = 1; i < cue_id_sets.length; i++) {
				if (!cue_id_sets[i].has(cue_id)) {
					continue outer;
				}
			}
			if (cue_ids.length < 10) {
				cue_ids.push(cue_id);
			} else {
				break outer;
			}
		}
	}
	return cue_ids;
}

interface Route<T extends api_response.ApiRequest, U extends api_response.ApiResponse> {
	handlesRequest(request: libhttp.IncomingMessage): boolean;
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void;
}

class Router {
	private routes: Array<Route<api_response.ApiRequest, api_response.ApiResponse>>;

	constructor() {
		this.routes = new Array<Route<api_response.ApiRequest, api_response.ApiResponse>>();
	}

	registerRoute(route: Route<api_response.ApiRequest, api_response.ApiResponse>): this {
		this.routes.push(route);
		return this;
	}

	route(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		for (let route of this.routes) {
			if (route.handlesRequest(request)) {
				return route.handleRequest(request, response);
			}
		}
		response.writeHead(400);
		response.end('{}');
	}
}

class ArtistRoute implements Route<api_response.ApiRequest, api_response.ArtistResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^\/api\/audio\/artists\/([0-9a-f]{32})\//.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let artist_id = parts[1];
		let artist = artists_index[artist_id];
		if (artist === undefined) {
			throw new Error();
		}
		// CREATE INDEX
		let album_artists = media.audio.album_artists.filter((album_artist) => {
			return album_artist.artist_id === artist_id;
		});
		let albums = album_artists.map((album_artist) => {
			return albums_index[album_artist.album_id];
		}).filter((album) => album !== undefined) as Array<libdb.AlbumEntry>;
		let payload: api_response.ArtistResponse = {
			...artist,
			albums
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/artists\/([0-9a-f]{32})\//.test(request.url);
	}
}

class ArtistsRoute implements Route<api_response.ApiRequest, api_response.ArtistsResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let payload: api_response.ArtistsResponse = {
			artists: media.audio.artists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/artists\//.test(request.url);
	}
}

class AlbumRoute implements Route<api_response.ApiRequest, api_response.AlbumResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^\/api\/audio\/albums\/([0-9a-f]{32})\//.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let album_id = parts[1];
		let album = albums_index[album_id];
		if (album === undefined) {
			throw new Error();
		}
		let discs = media.audio.discs.filter((disc) => {
			return disc.album_id === album_id;
		}).map((disc) => {
			let tracks = media.audio.tracks.filter((track) => {
				return track.disc_id === disc.disc_id;
			});
			let payload: api_response.DiscResponse = {
				...disc,
				tracks
			};
			return payload;
		});
		let payload: api_response.AlbumResponse = {
			...album,
			discs
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/albums\/([0-9a-f]{32})\//.test(request.url);
	}
}

class AlbumsRoute implements Route<api_response.ApiRequest, api_response.AlbumsResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let payload: api_response.AlbumsResponse = {
			albums: media.audio.albums
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/albums\//.test(request.url);
	}
}

class CCRoute implements Route<api_response.ApiRequest, api_response.ChromeCastResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let rurl = request.url;
		let rbody = '';
		request.on('data', (chunk) => {
			rbody += chunk;
		}).on('end', () => {
			try {
				let body = JSON.parse(rbody);
				if (/^[/]api[/]cc[/]seek[/]/.test(rurl)) {
					return libcc.seek(body, () => {
						let payload: api_response.ChromeCastResponse = {};
						response.writeHead(200);
						response.end(JSON.stringify(payload));
					});
				}
				if (/^[/]api[/]cc[/]pause[/]/.test(rurl)) {
					return libcc.pause(body, () => {
						let payload: api_response.ChromeCastResponse = {};
						response.writeHead(200);
						response.end(JSON.stringify(payload));
					});
				}
				if (/^[/]api[/]cc[/]resume[/]/.test(rurl)) {
					return libcc.resume(body, () => {
						let payload: api_response.ChromeCastResponse = {};
						response.writeHead(200);
						response.end(JSON.stringify(payload));
					});
				}
				if (/^[/]api[/]cc[/]load[/]/.test(rurl)) {
					return libcc.load(body, () => {
						let payload: api_response.ChromeCastResponse = {};
						response.writeHead(200);
						response.end(JSON.stringify(payload));
					});
				}
			} catch (error) { console.log(error); }
			response.writeHead(400);
			response.end(JSON.stringify({}));
		});
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^\/api\/cc\//.test(request.url);
	}
}

class ShowRoute implements Route<api_response.ApiRequest, api_response.ShowResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let show_id = parts[1];
		let show = shows_index[show_id];
		if (show === undefined) {
			throw new Error();
		}
		let seasons = media.video.seasons
			.filter((season) => {
				return season.show_id === show_id
			})
			.map((season) => {
				let episodes = media.video.episodes
					.filter((episode) => {
						return episode.season_id === season.season_id
					})
					.map((episode) => {
						let subtitles = media.video.subtitles
							.filter((subtitle) => {
								return subtitle.episode_id === episode.episode_id
							});
						let payload: api_response.EpisodeResponse = {
							...episode,
							subtitles
						};
						return payload;
					});
				let payload: api_response.SeasonResponse = {
					...season,
					episodes
				};
				return payload;
			});
		let payload: api_response.ShowResponse = {
			...show,
			seasons
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.test(request.url);
	}
}

class ShowsRoute implements Route<api_response.ApiRequest, api_response.ShowsResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let payload: api_response.ShowsResponse = {
			shows: media.video.shows
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]shows[/]/.test(request.url);
	}
}

class AuthWithTokenRoute implements Route<api_response.ApiRequest, api_response.AuthWithTokenReponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]auth[/][?]token[=]([0-9a-f]{64})/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let chunk = parts[1];
		let payload: api_response.AuthWithTokenReponse = {};
		try {
			libauth.getUsername(chunk);
			response.writeHead(200);
			return response.end(JSON.stringify(payload));
		} catch (error) {}
		response.writeHead(401);
		return response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]auth[/][?]token[=]([0-9a-f]{64})/.test(request.url);
	}
}

class AuthRoute implements Route<api_response.AuthRequest, api_response.AuthResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let data = '';
		request.on('data', (chunk) => {
			data += chunk;
		}).on('end', () => {
			try {
				let json = JSON.parse(data);
				if (json == null || json.constructor !== Object) {
					throw new Error();
				}
				if (json.username == null || json.username.constructor !== String) {
					throw new Error();
				}
				if (json.password == null || json.password.constructor !== String) {
					throw new Error();
				}
				let body = json as api_response.AuthRequest;
				let username = body.username;
				let password = body.password;
				let token = libauth.getToken(username, password);
				let payload: api_response.AuthResponse = {
					token
				};
				response.writeHead(200);
				response.end(JSON.stringify(payload));
			} catch (error) {
				response.writeHead(400);
				response.end(JSON.stringify({ error: error.message }));
			}
		});
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]auth[/]/.test(request.url);
	}
}

class MovieRoute implements Route<api_response.AuthRequest, api_response.MovieResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let movie_id = parts[1];
		let movie = movies_index[movie_id];
		if (movie === undefined) {
			throw new Error();
		}
		let subtitles = media.video.subtitles
			.filter((subtitle) => {
				return subtitle.movie_id === movie_id
			});
		let payload: api_response.MovieResponse = {
			...movie,
			subtitles
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.test(request.url);
	}
}

class MoviesRoute implements Route<api_response.AuthRequest, api_response.MoviesResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let payload: api_response.MoviesResponse = {
			movies: media.video.movies
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]movies[/]/.test(request.url);
	}
}

class AudiolistRoute implements Route<api_response.AuthRequest, api_response.AudiolistResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]audio[/]lists[/]([0-9a-f]{32})[/]/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let audiolist_id = parts[1];
		let audiolist = audiolists_index[audiolist_id];
		if (audiolist === undefined) {
			throw new Error();
		}
		let items = lists.audiolist_items
			.filter((audiolist_item) => {
				return audiolist_item.audiolist_id === audiolist_id
			})
			.map((audiolist_item) => {
				let track = tracks_index[audiolist_item.track_id];
				if (track !== undefined) {
					let artists = media.audio.track_artists
						.filter((track_artist) => {
							return track_artist.track_id === (track as libdb.TrackEntry).track_id;
						}).map((track_artist) => {
							return artists_index[track_artist.artist_id];
						}).filter((artist) => {
							return artist !== undefined;
						}) as Array<libdb.ArtistEntry>;
					let disc = discs_index[track.disc_id];
					if (disc !== undefined) {
						let album = albums_index[disc.album_id];
						if (album !== undefined) {
							let payload: api_response.AudiolistItemResponse = {
								...audiolist_item,
								track
							};
							return payload;
						}
					}
				}
				return null;
			})
			.filter((audiolist_item) => audiolist_item !== null) as Array<api_response.AudiolistItemResponse>;
		let payload: api_response.AudiolistResponse = {
			...audiolist,
			items
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]audio[/]lists[/]([0-9a-f]{32})[/]/.test(request.url);
	}
}

class AudiolistsRoute implements Route<api_response.AuthRequest, api_response.AudiolistsResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let payload: api_response.AudiolistsResponse = {
			audiolists: lists.audiolists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]audio[/]lists[/]/.test(request.url);
	}
}

class CuesRoute implements Route<api_response.CuesRequest, api_response.CuesResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let data = '';
		request.on('data', (chunk) => {
			data += chunk;
		}).on('end', () => {
			try {
				let json = JSON.parse(data);
				if (json == null || json.constructor !== Object) {
					throw new Error();
				}
				let query = json.query;
				if (query == null || query.constructor !== String) {
					throw new Error();
				}
				let cues = searchForCues(query)
					.map((cue_id) => {
						return cues_index[cue_id] as libdb.CueEntry;
					})
					.map((cue) => {
						let subtitle = subtitles_index[cue.subtitle_id] as libdb.SubtitleEntry;
						return {
							...cue,
							subtitle
						};
					});
				let payload: api_response.CuesResponse = {
					cues
				};
				response.writeHead(200);
				response.end(JSON.stringify(payload));
			} catch (error) {
				response.writeHead(400);
				response.end(JSON.stringify({ error: error.message }));
			}
		});
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]cues[/]/.test(request.url);
	}
}

let router = new Router()
	.registerRoute(new AuthWithTokenRoute())
	.registerRoute(new AuthRoute())
	.registerRoute(new CCRoute())
	.registerRoute(new MovieRoute())
	.registerRoute(new MoviesRoute())
	.registerRoute(new ArtistRoute())
	.registerRoute(new ArtistsRoute())
	.registerRoute(new AlbumRoute())
	.registerRoute(new AlbumsRoute())
	.registerRoute(new ShowRoute())
	.registerRoute(new ShowsRoute())
	.registerRoute(new AudiolistRoute())
	.registerRoute(new AudiolistsRoute())
	.registerRoute(new CuesRoute());

let handleRequest = (request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void => {
	try {
		router.route(request, response);
	} catch (error) {
		response.writeHead(500);
		response.end(JSON.stringify({ error: error.message }));
	}
};

export {
	handleRequest
};
