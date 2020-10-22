import * as liburl from "url";
import * as libhttp from "http";
import * as libauth from "./auth";
import * as libdb from "./database";
import * as libutils from "./utils";
import * as auth from "./auth";
import * as api_response from "./api_response";
import * as lchannels from "./channels";
import * as data from "./data";
import * as is from "./is";
import { LexicalSort, NumericSort, CombinedSort } from "./shared";

function getParameter(url: liburl.UrlWithParsedQuery, key: string): string[] {
	let values = url.query[key] ?? [];
	if (Array.isArray(values)) {
		return values;
	}
	return [values];
}

function getRequiredString(url: liburl.UrlWithParsedQuery, key: string): string {
	let values = getParameter(url, key);
	let value = values.pop();
	if (is.absent(value)) {
		throw `Expected parameter ${key}!`;
	}
	return value;
}

function getOptionalString(url: liburl.UrlWithParsedQuery, key: string): string | undefined {
	try {
		return getRequiredString(url, key);
	} catch (error) {}
}

function getRequiredInteger(url: liburl.UrlWithParsedQuery, key: string): number {
	let value = Number.parseInt(getRequiredString(url, key), 10);
	if (!Number.isInteger(value)) {
		throw `Expected integer ${key}!`;
	}
	return value;
}

function getOptionalInteger(url: liburl.UrlWithParsedQuery, key: string): number | undefined {
	try {
		return getRequiredInteger(url, key);
	} catch (error) {}
}

function getUsername(request: libhttp.IncomingMessage): string {
	var url = liburl.parse(request.url || "/", true);
	return auth.getUsername(url.query.token as string);
}

function searchForCues(query: string): Array<string> {
	let terms = libutils.getSearchTerms(query);
	let cue_id_sets = terms.map((term) => {
		let cues = data.cue_search_index.get(term);
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

class ArtistRoute implements Route<{}, api_response.ArtistResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]audio[/]artists[/]([0-9a-f]{32})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let artist_id = parts[1];
		let artist = data.api_lookupArtist(artist_id, username);
		let appearances = data.lookupAppearances(artist_id).map((album_id) => {
			return data.api_lookupAlbum(album_id, username);
		});
		let payload: api_response.ArtistResponse = {
			artist,
			appearances
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]artists[/]([0-9a-f]{32})[/]/.test(request.url ?? "/");
	}
}

class ArtistsRoute implements Route<{}, api_response.ArtistsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]audio[/]artists[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let artists = data.media.audio.artists.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => {
				return data.api_lookupArtist(entry.artist_id, username);
			});
		let payload: api_response.ArtistsResponse = {
			artists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]artists[/]/.test(request.url ?? "/");
	}
}

class AlbumRoute implements Route<{}, api_response.AlbumResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]audio[/]albums[/]([0-9a-f]{32})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let album_id = parts[1];
		let album = data.api_lookupAlbum(album_id, username);
		let payload: api_response.AlbumResponse = {
			album
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]albums[/]([0-9a-f]{32})[/]/.test(request.url ?? "/");
	}
}

class AlbumsRoute implements Route<{}, api_response.AlbumsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]audio[/]albums[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let albums = data.media.audio.albums.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => {
				return data.api_lookupAlbum(entry.album_id, username);
			});
		let payload: api_response.AlbumsResponse = {
			albums
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]albums[/]/.test(request.url ?? "/");
	}
}

class EpisodeRoute implements Route<api_response.ApiRequest, api_response.EpisodeResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]episodes[/]([0-9a-f]{32})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let episode_id = parts[1];
		let episode = data.api_lookupEpisode(episode_id, username);
		let payload: api_response.EpisodeResponse = {
			episode
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]episodes[/]([0-9a-f]{32})[/]/.test(request.url ?? "/");
	}
}

class ShowRoute implements Route<{}, api_response.ShowResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let show_id = parts[1];
		let show = data.api_lookupShow(show_id, username);
		let payload: api_response.ShowResponse = {
			show
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.test(request.url ?? "/");
	}
}

class ShowsRoute implements Route<{}, api_response.ShowsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]shows[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let shows = data.media.video.shows.map((entry)  => {
			return data.api_lookupShow(entry.show_id, username);
		});
		let payload: api_response.ShowsResponse = {
			shows
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]shows[/]/.test(request.url ?? "/");
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

























class MovieRoute implements Route<{}, api_response.MovieResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let movie_id = parts[1];
		let movie = data.api_lookupMovie(movie_id, username);
		let map = new Map<string, number>();
		for (let genre of movie.genres) {
			let movie_genres = data.getMoviesFromVideoGenreIdIndex.lookup(genre.genre_id);
			for (let movie_genre of movie_genres) {
				let value = map.get(movie_genre.movie_id) ?? 0;
				map.set(movie_genre.movie_id, value + 2);
			}
		}
		for (let entry of map) {
			let video_genres = data.getVideoGenresFromMovieId(entry[0]);
			map.set(entry[0], entry[1] - video_genres.length);
		}
		map.delete(movie.movie_id);
		let suggestions = Array.from(map.entries())
			.sort(CombinedSort.of(
				NumericSort.decreasing((entry) => entry[1])
			))
			.slice(0, 6)
			.map((entry) => entry[0])
			.map((movie_id) => data.api_lookupMovie(movie_id, username))
		let payload: api_response.MovieResponse = {
			movie,
			suggestions
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.test(request.url ?? "/");
	}
}

class MoviesRoute implements Route<{}, api_response.MoviesResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]movies[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let movies = data.media.video.movies.slice()
			.sort(LexicalSort.increasing((entry) => entry.title))
			.slice(offset, offset + length)
			.map((entry) => {
				return data.api_lookupMovie(entry.movie_id, username);
			});
		let payload: api_response.MoviesResponse = {
			movies
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]movies[/]/.test(request.url ?? "/");
	}
}

class PlaylistRoute implements Route<{}, api_response.PlaylistResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]audio[/]playlists[/]([0-9a-f]{32})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let playlist_id = parts[1];
		let playlist = data.api_lookupPlaylist(playlist_id, username);
		let payload: api_response.PlaylistResponse = {
			playlist
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]playlists[/]([0-9a-f]{32})[/]/.test(request.url ?? "/");
	}
}

class PlaylistsRoute implements Route<{}, api_response.PlaylistsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]audio[/]playlists[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let playlists = data.lists.audiolists.map((playlist) => data.api_lookupPlaylist(playlist.audiolist_id, username));
		let payload: api_response.PlaylistsResponse = {
			playlists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]playlists[/]/.test(request.url ?? "/");
	}
}













class CuesRoute implements Route<api_response.CuesRequest, api_response.CuesResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let reqpayload = '';
		request.on('data', (chunk) => {
			reqpayload += chunk;
		}).on('end', () => {
			try {
				let json = JSON.parse(reqpayload);
				if (json == null || json.constructor !== Object) {
					throw new Error();
				}
				let query = json.query;
				if (query == null || query.constructor !== String) {
					throw new Error();
				}
				let cues = searchForCues(query as string)
					.map((cue_id) => {
						return data.cues_index[cue_id] as libdb.CueEntry;
					})
					.map((cue) => {
						let subtitle = data.subtitles_index[cue.subtitle_id] as libdb.SubtitleEntry;
						let metadata = data.lookupMetadata(subtitle.video_file_id);
						if (libdb.MoviePartEntry.is(metadata)) {
							let movie_part = metadata;
							let movie = data.movies_index[movie_part.movie_id] as libdb.MovieEntry;
							return {
								...cue,
								subtitle: {
									...subtitle,
									episode: undefined,
									movie_part: {
										...movie_part,
										movie
									}
								}
							};
						}
						if (libdb.EpisodeEntry.is(metadata)) {
							let episode = metadata;
							let season = data.seasons_index[episode.season_id] as libdb.SeasonEntry;
							let show = data.shows_index[season.show_id] as libdb.ShowEntry;
							return {
								...cue,
								subtitle: {
									...subtitle,
									episode: {
										...episode,
										season: {
											...season,
											show
										}
									},
									movie_part: undefined
								}
							};
						}
						throw "";
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
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]cues[/]/.test(request.url);
	}
}

class ChannelsRoute implements Route<api_response.ChannelsRequest, api_response.ChannelsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let channels = new Array<api_response.ChannelEntry>();
		for (let i = 0; i < 100; i++) {
			channels.push(lchannels.getChannel(i));
		}
		let payload: api_response.ChannelsResponse = {
			channels: channels
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === "POST" && /^[/]api[/]video[/]channels[/]/.test(request.url || "/");
	}
}

class ChannelRoute implements Route<api_response.ChannelRequest, api_response.ChannelResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let parts = /^[/]api[/]video[/]channels[/]([0-9]+)[/]/.exec(request.url || "/");
		if (parts == null) {
			throw "";
		}
		let username = getUsername(request);
		let channel_id = Number.parseInt(parts[1]);
		let segments = lchannels.generateProgramming(channel_id, username);
		let payload: api_response.ChannelResponse = {
			segments
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === "POST" && /^[/]api[/]video[/]channels[/]([0-9]+)[/]/.test(request.url || "/");
	}
}

class GenresRoute implements Route<{}, api_response.GenresResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]genres[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let genres = data.media.video.genres.map((genre) => {
			return data.api_lookupGenre(genre.video_genre_id, username);
		});
		let payload: api_response.GenresResponse = {
			genres
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]genres[/]/.test(request.url ?? "/");
	}
}

class GenreRoute implements Route<{}, api_response.GenreResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]genres[/]([0-9a-f]{32})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let genre_id = parts[1];
		let genre = data.api_lookupGenre(genre_id, username);
		let shows = data.getShowsFromVideoGenreId(genre_id).map((entry) => {
			return data.api_lookupShow(entry.show_id, username);
		});
		let movies = data.getMoviesFromVideoGenreId(genre_id).map((entry) => {
			return data.api_lookupMovie(entry.movie_id, username);
		});
		let payload: api_response.GenreResponse = {
			genre,
			shows,
			movies
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]genres[/]([0-9a-f]{32})[/]/.test(request.url ?? "/");
	}
}

class SearchRoute implements Route<{}, api_response.SearchResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let parts = /^[/]api[/]search[/](.*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let results = data.search(query, 10);
		let payload: api_response.SearchResponse = {
			artists: results.artistIds.map((artist_id) => data.api_lookupArtist(artist_id, username)),
			albums: results.albumIds.map((album_id) => data.api_lookupAlbum(album_id, username)),
			tracks: results.trackIds.map((track_id) => data.api_lookupTrack(track_id, username)),
			shows: results.showIds.map((show_id) => data.api_lookupShow(show_id, username)),
			movies: results.movieIds.map((movie_id) => data.api_lookupMovie(movie_id, username)),
			episodes: results.episodeIds.map((episode_id) => data.api_lookupEpisode(episode_id, username))
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]search[/]/.test(request.url ?? "/");
	}
}

class TokensRoute implements Route<api_response.TokensRequest, api_response.TokensResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		let tokens = data.getTokensFromUsername(username);
		let payload: api_response.TokensResponse = {
			tokens
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === "POST" && /^[/]api[/]tokens[/]/.test(request.url || "/");
	}
}

let router = new Router()
	.registerRoute(new AuthWithTokenRoute())
	.registerRoute(new AuthRoute())
	.registerRoute(new MovieRoute())
	.registerRoute(new MoviesRoute())
	.registerRoute(new ArtistRoute())
	.registerRoute(new ArtistsRoute())
	.registerRoute(new AlbumRoute())
	.registerRoute(new AlbumsRoute())
	.registerRoute(new EpisodeRoute())
	.registerRoute(new ShowRoute())
	.registerRoute(new ShowsRoute())
	.registerRoute(new PlaylistRoute())
	.registerRoute(new PlaylistsRoute())
	.registerRoute(new CuesRoute())
	.registerRoute(new ChannelRoute())
	.registerRoute(new ChannelsRoute())
	.registerRoute(new GenreRoute())
	.registerRoute(new GenresRoute())
	.registerRoute(new SearchRoute())
	.registerRoute(new TokensRoute());

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
