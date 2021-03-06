import * as liburl from "url";
import * as libhttp from "http";
import * as libauth from "../server/auth";
import * as auth from "../server/auth";
import * as response from "./api_response";
import * as handler from "./handler";
import * as schema from "./schema";
import * as is from "../is";

function readBody(request: libhttp.IncomingMessage): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		let chunks = new Array<Buffer>();
		request.on("data", (chunk) => {
			chunks.push(chunk);
		});
		request.on("end", () => {
			let buffer = Buffer.concat(chunks);
			resolve(buffer);
		});
		request.on("error", (error) => {
			reject(error);
		});
	});
}

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

function getUserId(request: libhttp.IncomingMessage): string {
	var url = liburl.parse(request.url || "/", true);
	return auth.getUserId(url.query.token as string);
}

interface Route<T extends response.ApiRequest, U extends response.ApiResponse> {
	handlesRequest(request: libhttp.IncomingMessage): boolean;
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void;
}

class Router {
	private routes: Array<Route<response.ApiRequest, response.ApiResponse>>;

	constructor() {
		this.routes = new Array<Route<response.ApiRequest, response.ApiResponse>>();
	}

	registerRoute(route: Route<response.ApiRequest, response.ApiResponse>): this {
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

class ArtistRoute implements Route<{}, response.ArtistResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]artists[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let artist_id = parts[1];
		let artist = handler.lookupArtist(artist_id, user_id);
		let tracks = handler.getArtistTracks(artist_id, 0, 3, user_id);
		let appearances = handler.getArtistAppearances(artist_id, user_id);
		let payload: response.ArtistResponse = {
			artist,
			tracks,
			appearances
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]artists[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class ArtistsRoute implements Route<{}, response.ArtistsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]artists[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let artists = handler.searchForArtists(query, offset, length, user_id);
		let payload: response.ArtistsResponse = {
			artists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]artists[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class AlbumRoute implements Route<{}, response.AlbumResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]albums[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let album_id = parts[1];
		let album = handler.lookupAlbum(album_id, user_id);
		let payload: response.AlbumResponse = {
			album
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]albums[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class AlbumsRoute implements Route<{}, response.AlbumsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]albums[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = parts[1];
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let albums = handler.searchForAlbums(query, offset, length, user_id);
		let payload: response.AlbumsResponse = {
			albums
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]albums[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class EpisodeRoute implements Route<response.ApiRequest, response.EpisodeResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]episodes[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let episode_id = parts[1];
		let episode = handler.lookupEpisode(episode_id, user_id);
		let episodes = handler.lookupSeason(episode.season.season_id, user_id).episodes;
		let index = episodes.findIndex((other_episode) => other_episode.episode_id === episode.episode_id);
		let last = episodes[index - 1];
		let next = episodes[index + 1];
		let payload: response.EpisodeResponse = {
			episode,
			last,
			next
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]episodes[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class EpisodesRoute implements Route<{}, response.EpisodesResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]episodes[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let episodes = handler.searchForEpisodes(query, offset, length, user_id);
		let payload: response.EpisodesResponse = {
			episodes
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]episodes[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class ShowRoute implements Route<{}, response.ShowResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]shows[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let show_id = parts[1];
		let show = handler.lookupShow(show_id, user_id);
		let payload: response.ShowResponse = {
			show
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]shows[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class ShowsRoute implements Route<{}, response.ShowsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]shows[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let shows = handler.searchForShows(query, offset, length, user_id);
		let payload: response.ShowsResponse = {
			shows
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]shows[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class AuthWithTokenRoute implements Route<response.ApiRequest, response.AuthWithTokenReponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]auth[/][?]token[=]([0-9a-f]{32})/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let chunk = parts[1];
		let payload: response.AuthWithTokenReponse = {};
		try {
			libauth.getUserId(chunk);
			response.writeHead(200);
			payload.token = chunk;
			return response.end(JSON.stringify(payload));
		} catch (error) {}
		response.writeHead(401);
		return response.end(JSON.stringify({}));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]auth[/][?]token[=]([0-9a-f]{32})/.test(request.url);
	}
}

class AuthRoute implements Route<response.AuthRequest, response.AuthResponse> {
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
				let body = json as response.AuthRequest;
				let username = body.username;
				let password = body.password;
				let token = libauth.createToken(username, password);
				let payload: response.AuthResponse = {
					token
				};
				response.writeHead(200);
				response.end(JSON.stringify(payload));
			} catch (error) {
				console.log(error);
				response.writeHead(400);
				response.end(JSON.stringify({ error: error.message }));
			}
		});
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]auth[/]/.test(request.url);
	}
}

class RegisterRoute implements Route<{}, {}> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		readBody(request).then((buffer) => {
			let body = schema.messages.RegisterRequest.as(JSON.parse(buffer.toString()));
			this.handleAsyncRequest(body).then((body) => {
				response.writeHead(200);
				response.end(JSON.stringify(body));
			});
		});
	}

	async handleAsyncRequest(body: schema.messages.RegisterRequest): Promise<schema.messages.RegisterResponse | schema.messages.ErrorMessage> {
		return handler.createUser(body);
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]register[/]/.test(request.url ?? "/");
	}
}





















class MovieMovieSuggestionsRoute implements Route<{}, response.MovieMovieSuggestionsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]movies[/]([0-9a-f]{16})[/]suggestions[/]movies[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let movie_id = parts[1];
		let movies = handler.getMovieSuggestions(movie_id, offset, length, user_id);
		let payload: response.MovieMovieSuggestionsResponse = {
			movies
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]movies[/]([0-9a-f]{16})[/]suggestions[/]movies[/]/.test(request.url ?? "/");
	}
}





class MovieRoute implements Route<{}, response.MovieResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]movies[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let movie_id = parts[1];
		let movie = handler.lookupMovie(movie_id, user_id);
		let payload: response.MovieResponse = {
			movie
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]movies[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class MoviesRoute implements Route<{}, response.MoviesResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]movies[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let movies = handler.searchForMovies(query, offset, length, user_id);
		let payload: response.MoviesResponse = {
			movies
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]movies[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class PlaylistRoute implements Route<{}, response.PlaylistResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]playlists[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let playlist_id = parts[1];
		let playlist = handler.lookupPlaylist(playlist_id, user_id);
		let payload: response.PlaylistResponse = {
			playlist
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]playlists[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class PlaylistsRoute implements Route<{}, response.PlaylistsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]playlists[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let playlists = handler.searchForPlaylists(query, offset, length, user_id);
		let payload: response.PlaylistsResponse = {
			playlists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]playlists[/]([^/?]*)/.test(request.url ?? "/");
	}
}













class CuesRoute implements Route<{}, response.CuesResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]cues[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let cues = handler.searchForCues(query, offset, length, user_id);
		let payload: response.CuesResponse = {
			cues
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]cues[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class GenresRoute implements Route<{}, response.GenresResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]genres[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let genres = handler.searchForGenres(query, offset, length, user_id);
		let payload: response.GenresResponse = {
			genres
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]genres[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class GenreShowsRoute implements Route<{}, response.GenreShowsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]genres[/]([0-9a-f]{16})[/]shows[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let genre_id = parts[1];
		let shows = handler.getShowsFromGenre(genre_id, user_id, offset, length);
		let payload: response.GenreShowsResponse = {
			shows
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]genres[/]([0-9a-f]{16})[/]shows[/]/.test(request.url ?? "/");
	}
}

class GenreMoviesRoute implements Route<{}, response.GenreMoviesResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]genres[/]([0-9a-f]{16})[/]movies[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let genre_id = parts[1];
		let movies = handler.getMoviesFromGenre(genre_id, user_id, offset, length);
		let payload: response.GenreMoviesResponse = {
			movies
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]genres[/]([0-9a-f]{16})[/]movies[/]/.test(request.url ?? "/");
	}
}

class GenreRoute implements Route<{}, response.GenreResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]genres[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let genre_id = parts[1];
		let genre = handler.lookupGenre(genre_id, user_id);
		let payload: response.GenreResponse = {
			genre
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]genres[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class SearchRoute implements Route<{}, response.SearchResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]search[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let entities = handler.searchForEntities(query, user_id, offset, length);
		let payload: response.SearchResponse = {
			entities
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]search[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class TrackPlaylistsRoute implements Route<{}, response.TrackPlaylistsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]tracks[/]([0-9a-f]{16})[/]playlists[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let track_id = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let playlists = handler.getPlaylistAppearances(track_id, offset, length, user_id);
		let payload: response.TrackPlaylistsResponse = {
			playlists: playlists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]tracks[/]([0-9a-f]{16})[/]playlists[/]/.test(request.url ?? "/");
	}
}

class TrackRoute implements Route<{}, response.TrackResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]tracks[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let track_id = parts[1];
		let track = handler.lookupTrack(track_id, user_id);
		let tracks = handler.lookupDisc(track.disc.disc_id, user_id).tracks;
		let index = tracks.findIndex((other_track) => other_track.track_id === track.track_id);
		let last = tracks[index - 1];
		let next = tracks[index + 1];
		let payload: response.TrackResponse = {
			track,
			last,
			next
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]tracks[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class TracksRoute implements Route<{}, response.TracksResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]tracks[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let tracks = handler.searchForTracks(query, offset, length, user_id);
		let payload: response.TracksResponse = {
			tracks
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]tracks[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class SeasonRoute implements Route<{}, response.SeasonResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]seasons[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let season_id = parts[1];
		let season = handler.lookupSeason(season_id, user_id);
		let seasons = handler.lookupShow(season.show.show_id, user_id).seasons;
		let index = seasons.findIndex((other_season) => other_season.season_id === season.season_id);
		let last = seasons[index - 1];
		let next = seasons[index + 1];
		let payload: response.SeasonResponse = {
			season,
			last,
			next
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]seasons[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class SeasonsRoute implements Route<{}, response.SeasonsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]video[/]seasons[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let seasons = handler.searchForSeasons(query, offset, length, user_id);
		let payload: response.SeasonsResponse = {
			seasons
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]video[/]seasons[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class DiscRoute implements Route<{}, response.DiscResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]discs[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let season_id = parts[1];
		let disc = handler.lookupDisc(season_id, user_id);
		let discs = handler.lookupAlbum(disc.album.album_id, user_id).discs;
		let index = discs.findIndex((other_disc) => other_disc.disc_id === disc.disc_id);
		let last = discs[index - 1];
		let next = discs[index + 1];
		let payload: response.DiscResponse = {
			disc,
			last,
			next
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]discs[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class DiscsRoute implements Route<{}, response.SeasonsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]audio[/]discs[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let discs = handler.searchForDiscs(query, offset, length, user_id);
		let payload: response.DiscsResponse = {
			discs
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]audio[/]discs[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class UserAlbumsRoute implements Route<{}, response.UserAlbumsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]users[/]([0-9a-f]{16})?[/]albums[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let user = handler.lookupUser(parts[1] ?? user_id);
		let albums = handler.getUserAlbums(user.user_id, offset, length, user_id);
		let payload: response.UserAlbumsResponse = {
			albums
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]users[/]([0-9a-f]{16})?[/]albums[/]/.test(request.url ?? "/");
	}
}

class UserShowsRoute implements Route<{}, response.UserShowsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]users[/]([0-9a-f]{16})?[/]shows[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let user = handler.lookupUser(parts[1] ?? user_id);
		let shows = handler.getUserShows(user.user_id, offset, length, user_id);
		let payload: response.UserShowsResponse = {
			shows
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]users[/]([0-9a-f]{16})?[/]shows[/]/.test(request.url ?? "/");
	}
}

class UserRoute implements Route<{}, response.UserResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]users[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let user = handler.lookupUser(parts[1]);
		let playlists = handler.getUserPlaylists(user.user_id, user_id);
		let payload: response.UserResponse = {
			user,
			playlists
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]users[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class UsersRoute implements Route<{}, response.UsersResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]users[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let users = handler.searchForUsers(query, offset, length, user_id);
		let payload: response.UsersResponse = {
			users
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]users[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class ActorShowsRoute implements Route<{}, response.ActorShowsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]actors[/]([0-9a-f]{16})[/]shows[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let actor_id = parts[1];
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let shows = handler.getShowsFromActor(actor_id, user_id, offset, length);
		let payload: response.ActorShowsResponse = {
			shows
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]actors[/]([0-9a-f]{16})[/]shows[/]/.test(request.url ?? "/");
	}
}

class ActorMoviesRoute implements Route<{}, response.ActorMoviesResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]actors[/]([0-9a-f]{16})[/]movies[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let actor_id = parts[1];
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let movies = handler.getMoviesFromActor(actor_id, user_id, offset, length);
		let payload: response.ActorMoviesResponse = {
			movies
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]actors[/]([0-9a-f]{16})[/]movies[/]/.test(request.url ?? "/");
	}
}

class ActorRoute implements Route<{}, response.ActorResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]actors[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let actor_id = parts[1];
		let actor = handler.lookupActor(actor_id, user_id);
		let payload: response.ActorResponse = {
			actor: actor
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]actors[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class ActorsRoute implements Route<{}, response.ActorsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]actors[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let actors = handler.searchForActors(query, offset, length, user_id);
		let payload: response.ActorsResponse = {
			actors
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]actors[/]([^/?]*)/.test(request.url ?? "/");
	}
}

class YearRoute implements Route<{}, response.YearResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]years[/]([0-9a-f]{16})[/]/.exec(request.url ?? "/") as RegExpExecArray;
		let year_id = parts[1];
		let year = handler.lookupYear(year_id, user_id);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let movies = handler.getMoviesFromYear(year_id, user_id, offset, length);
		let albums = handler.getAlbumsFromYear(year_id, user_id, offset, length);
		let payload: response.YearResponse = {
			year: year,
			movies: movies,
			albums: albums
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]years[/]([0-9a-f]{16})[/]/.test(request.url ?? "/");
	}
}

class YearsRoute implements Route<{}, response.YearsResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let user_id = getUserId(request);
		let parts = /^[/]api[/]years[/]([^/?]*)/.exec(request.url ?? "/") as RegExpExecArray;
		let query = decodeURIComponent(parts[1]);
		let url = liburl.parse(request.url ?? "/", true);
		let offset = getOptionalInteger(url, "offset") ?? 0;
		let length = getOptionalInteger(url, "length") ?? 24;
		let years = handler.searchForYears(query, offset, length, user_id);
		let payload: response.YearsResponse = {
			years
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return /^[/]api[/]years[/]([^/?]*)/.test(request.url ?? "/");
	}
}

let router = new Router()
	.registerRoute(new UserAlbumsRoute())
	.registerRoute(new UserShowsRoute())
	.registerRoute(new AuthWithTokenRoute())
	.registerRoute(new AuthRoute())
	.registerRoute(new RegisterRoute())
	.registerRoute(new MovieMovieSuggestionsRoute())
	.registerRoute(new MovieRoute())
	.registerRoute(new MoviesRoute())
	.registerRoute(new ArtistRoute())
	.registerRoute(new ArtistsRoute())
	.registerRoute(new AlbumRoute())
	.registerRoute(new AlbumsRoute())
	.registerRoute(new EpisodeRoute())
	.registerRoute(new EpisodesRoute())
	.registerRoute(new ShowRoute())
	.registerRoute(new ShowsRoute())
	.registerRoute(new ActorShowsRoute())
	.registerRoute(new ActorMoviesRoute())
	.registerRoute(new ActorRoute())
	.registerRoute(new ActorsRoute())
	.registerRoute(new PlaylistRoute())
	.registerRoute(new PlaylistsRoute())
	.registerRoute(new TrackPlaylistsRoute())
	.registerRoute(new TrackRoute())
	.registerRoute(new TracksRoute())
	.registerRoute(new SeasonRoute())
	.registerRoute(new SeasonsRoute())
	.registerRoute(new DiscRoute())
	.registerRoute(new DiscsRoute())
	.registerRoute(new UserRoute())
	.registerRoute(new UsersRoute())
	.registerRoute(new CuesRoute())
	.registerRoute(new GenreShowsRoute())
	.registerRoute(new GenreMoviesRoute())
	.registerRoute(new GenreRoute())
	.registerRoute(new GenresRoute())
	.registerRoute(new YearRoute())
	.registerRoute(new YearsRoute())
	.registerRoute(new SearchRoute());

let handleRequest = (request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void => {
	try {
		router.route(request, response);
	} catch (error) {
		response.writeHead(500);
		response.end(JSON.stringify({ error: "" + error }));
	}
};

export {
	handleRequest
};
