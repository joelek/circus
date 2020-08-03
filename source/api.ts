import * as liburl from "url";
import * as libhttp from "http";
import * as libcc from "./cc";
import * as libauth from "./auth";
import * as libdb from "./database";
import * as libutils from "./utils";
import * as auth from "./auth";
import * as api_response from "./api_response";
import * as lchannels from "./channels";
import * as data from "./data";

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
		let artist = data.artists_index[artist_id];
		if (artist === undefined) {
			throw new Error();
		}
		let album_artists = data.media.audio.album_artists.filter((album_artist) => {
			return album_artist.artist_id === artist_id;
		});
		let albums = album_artists.map((album_artist) => {
			return data.albums_index[album_artist.album_id];
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
			artists: data.media.audio.artists
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
		let album = data.albums_index[album_id];
		if (album === undefined) {
			throw new Error();
		}
		let discs = data.media.audio.discs.filter((disc) => {
			return disc.album_id === album_id;
		}).map((disc) => {
			let tracks = data.media.audio.tracks.filter((track) => {
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
			albums: data.media.audio.albums
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

class EpisodeRoute implements Route<api_response.ApiRequest, api_response.EpisodeResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]video[/]episodes[/]([0-9a-f]{32})[/]/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let episode_id = parts[1];
		let episode = data.episodes_index[episode_id];
		if (episode === undefined) {
			throw new Error();
		}
		let subtitles = data.lookupSubtitles(episode.file_id);
		let streamed = data.hasStreamed(username, episode.file_id);
		let payload: api_response.EpisodeResponse = {
			...episode,
			streamed,
			subtitles
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]episodes[/]([0-9a-f]{32})[/]/.test(request.url);
	}
}

class ShowRoute implements Route<api_response.ApiRequest, api_response.ShowResponse> {
	constructor() {

	}

	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let username = getUsername(request);
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]video[/]shows[/]([0-9a-f]{32})[/]/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let show_id = parts[1];
		let show = data.shows_index[show_id];
		if (show === undefined) {
			throw new Error();
		}
		let seasons = data.media.video.seasons
			.filter((season) => {
				return season.show_id === show_id
			})
			.map((season) => {
				let episodes = data.media.video.episodes
					.filter((episode) => {
						return episode.season_id === season.season_id
					})
					.map((episode) => {
						let subtitles = data.lookupSubtitles(episode.file_id);
						let streamed = data.hasStreamed(username, episode.file_id);
						let payload: api_response.EpisodeResponse = {
							...episode,
							streamed,
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
			shows: data.media.video.shows
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
		let username = getUsername(request);
		if (request.url === undefined) {
			throw new Error();
		}
		let parts = /^[/]api[/]video[/]movies[/]([0-9a-f]{32})[/]/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let movie_id = parts[1];
		let movie = data.movies_index[movie_id];
		if (movie === undefined) {
			throw new Error();
		}
		let movie_parts = data.media.video.movie_parts.filter((movie_part) => {
			return movie_part.movie_id === movie_id;
		}).map((movie_part) => {
			let subtitles = data.lookupSubtitles(movie_part.file_id);
			let streamed = data.hasStreamed(username, movie_part.file_id);
			return {
				...movie_part,
				streamed,
				subtitles
			};
		});
		let payload: api_response.MovieResponse = {
			...movie,
			movie_parts
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
			movies: data.media.video.movies
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
		let audiolist = data.audiolists_index[audiolist_id];
		if (audiolist === undefined) {
			throw new Error();
		}
		let items = data.lists.audiolist_items
			.filter((audiolist_item) => {
				return audiolist_item.audiolist_id === audiolist_id
			})
			.map((audiolist_item) => {
				let track = data.tracks_index[audiolist_item.track_id];
				if (track !== undefined) {
					let artists = data.media.audio.track_artists
						.filter((track_artist) => {
							return track_artist.track_id === (track as libdb.TrackEntry).track_id;
						}).map((track_artist) => {
							return data.artists_index[track_artist.artist_id];
						}).filter((artist) => {
							return artist !== undefined;
						}) as Array<libdb.ArtistEntry>;
					let disc = data.discs_index[track.disc_id];
					if (disc !== undefined) {
						let album = data.albums_index[disc.album_id];
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
			audiolists: data.lists.audiolists
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
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]video[/]cues[/]/.test(request.url);
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

class GenresRoute implements Route<api_response.GenresRequest, api_response.GenresResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let genres = data.media.video.genres;
		let payload: api_response.GenresResponse = {
			genres
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === "POST" && /^[/]api[/]video[/]genres[/]/.test(request.url || "/");
	}
}

class GenreRoute implements Route<api_response.GenreRequest, api_response.GenreResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let parts = /^[/]api[/]video[/]genres[/]([0-9a-f]{32})[/]/.exec(request.url || "/");
		if (parts == null) {
			throw "";
		}
		let video_genre_id = parts[1];
		let movies = data.media.video.movie_genres.filter((movie_genre) => {
			return movie_genre.video_genre_id === video_genre_id;
		}).map((movie_genre) => {
			return data.movies_index[movie_genre.movie_id] as libdb.MovieEntry;
		});
		let shows = data.media.video.show_genres.filter((show_genre) => {
			return show_genre.video_genre_id === video_genre_id;
		}).map((show_genre) => {
			return data.shows_index[show_genre.show_id] as libdb.ShowEntry;
		});
		let payload: api_response.GenreResponse = {
			movies,
			shows
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === "POST" && /^[/]api[/]video[/]genres[/]([0-9a-f]{32})[/]/.test(request.url || "/");
	}
}

class SearchRoute implements Route<api_response.SearchRequest, api_response.SearchResponse> {
	handleRequest(request: libhttp.IncomingMessage, response: libhttp.ServerResponse): void {
		let parts = /^[/]api[/]search[/](.*)/.exec(request.url || "/");
		if (parts == null) {
			throw "";
		}
		let query = decodeURIComponent(parts[1]);
		let results = data.search(query, 10);
		let payload: api_response.SearchResponse = {
			artists: results.artistIds.map(data.lookupArtist),
			albums: results.albumIds.map(data.lookupAlbum),
			tracks: results.trackIds.map(data.lookupTrack),
			shows: results.showIds.map(data.lookupShow),
			movies: results.movieIds.map(data.lookupMovie),
			episodes: results.episodeIds.map(data.lookupEpisode)
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === "POST" && /^[/]api[/]search[/]/.test(request.url || "/");
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
	.registerRoute(new CCRoute())
	.registerRoute(new MovieRoute())
	.registerRoute(new MoviesRoute())
	.registerRoute(new ArtistRoute())
	.registerRoute(new ArtistsRoute())
	.registerRoute(new AlbumRoute())
	.registerRoute(new AlbumsRoute())
	.registerRoute(new EpisodeRoute())
	.registerRoute(new ShowRoute())
	.registerRoute(new ShowsRoute())
	.registerRoute(new AudiolistRoute())
	.registerRoute(new AudiolistsRoute())
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
