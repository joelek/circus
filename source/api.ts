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
import { PlaylistBase } from "./media/schema/objects";

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
		// TODO: Reuse functionality for looking up playable albums.
		let albums = album_artists.map((album_artist) => {
			let album = data.albums_index[album_artist.album_id] as libdb.AlbumEntry;
			let discs = data.media.audio.discs.filter((disc) => disc.album_id === album.album_id).map((disc) => {
				let tracks = data.media.audio.tracks.filter((track) => track.disc_id === disc.disc_id).map((track) => {
					let artists = data.lookupTrackArtists(track.track_id);
					return {
						...track,
						artists
					};
				});
				return {
					...disc,
					tracks
				}
			});
			let artists = data.lookupAlbumArtists(album_artist.album_id);
			return {
				...album,
				artists,
				discs
			};
		});
		let appearances = data.lookupAppearances(artist_id)
			.map((album_id) => {
				let album = data.lookupAlbum(album_id);
				let discs = data.media.audio.discs.filter((disc) => disc.album_id === album.album_id).map((disc) => {
					let tracks = data.media.audio.tracks.filter((track) => track.disc_id === disc.disc_id).map((track) => {
						let artists = data.lookupTrackArtists(track.track_id);
						return {
							...track,
							artists
						};
					});
					return {
						...disc,
						tracks
					}
				});
				let artists = data.lookupAlbumArtists(album_id);
				return {
					...album,
					artists,
					discs
				};
			});
		let payload: api_response.ArtistResponse = {
			...artist,
			albums,
			appearances
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
		let artists = data.media.audio.artists.map((artist) => {
			let albums = data.getAlbumArtistsFromArtistId.lookup(artist.artist_id).map((album_artist) => {
				let album = data.getAlbumFromAlbumId.lookup(album_artist.album_id);
				let artists = data.lookupAlbumArtists(album.album_id);
				let discs = data.getDiscsFromAlbumId.lookup(album.album_id).map((disc) => {
					let tracks = data.getTracksFromDiscId.lookup(disc.disc_id).map((track) => {
						let artists = data.lookupTrackArtists(track.track_id);
						return {
							...track,
							artists
						};
					});
					return {
						...disc,
						tracks
					};
				});
				return {
					...album,
					artists,
					discs
				};
			});
			let appearances = [] as api_response.AlbumResponse[]
			return {
				...artist,
				albums,
				appearances
			};
		});
		let payload: api_response.ArtistsResponse = {
			artists
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
			}).map((track) => {
				let artists = data.lookupTrackArtists(track.track_id);
				return {
					...track,
					artists
				};
			});
			let payload: api_response.DiscResponse = {
				...disc,
				tracks
			};
			return payload;
		});
		let artists = data.lookupAlbumArtists(album_id);
		let payload: api_response.AlbumResponse = {
			...album,
			artists,
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
		let albums = data.media.audio.albums.map((album) => {
			let artists = data.lookupAlbumArtists(album.album_id);
			let discs = data.getDiscsFromAlbumId.lookup(album.album_id).map((disc) => {
				let tracks = data.getTracksFromDiscId.lookup(disc.disc_id).map((track) => {
					let artists = data.lookupTrackArtists(track.track_id);
					return {
						...track,
						artists
					};
				});
				return {
					...disc,
					tracks
				};
			});
			return {
				...album,
				artists,
				discs
			};
		});
		let payload: api_response.AlbumsResponse = {
			albums
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^\/api\/audio\/albums\//.test(request.url);
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
		let streamed = data.getLatestStream(username, episode.file_id);
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
		let seasons = data.getSeasonsFromShowId(show_id).map((season) => {
			let episodes = season.episodes.map((episode) => {
				let subtitles = data.lookupSubtitles(episode.file_id);
				let streamed = data.getLatestStream(username, episode.file_id);
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
		let username = getUsername(request);
		if (request.url === undefined) {
			throw new Error();
		}
		let shows = data.media.video.shows.map((show) => {
			let seasons = data.getSeasonsFromShowId(show.show_id)
				.map((season) => {
					let episodes = season.episodes
						.map((episode) => {
							let subtitles = data.lookupSubtitles(episode.file_id);
							let streamed = null;
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
			return {
				...show,
				seasons
			};
		}).map((show) => {
			let genres = data.getVideoGenresFromShowId(show.show_id);
			return {
				...show,
				genres
			};
		});
		let payload: api_response.ShowsResponse = {
			shows
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
		let movie_parts = data.getMoviePartsFromMovieId(movie_id).map((movie_part) => {
			let streamed = data.getLatestStream(username, movie_part.file_id);
			return {
				...movie_part,
				streamed
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
		let sum0 = Date.now();
		let sum: number = 0;
		let username = getUsername(request);
		let movies = data.media.video.movies.map((movie) => {
			sum -= Date.now();
			let movie_parts = data.getMoviePartsFromMovieId(movie.movie_id).map((movie_part) => {
				let streamed = null;
				return {
					...movie_part,
					streamed
				};
			});
			sum += Date.now();
			return {
				...movie,
				movie_parts
			}
		});
		let payload: api_response.MoviesResponse = {
			movies
		};
		console.log(sum, Date.now() - sum0);
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
		let parts = /^[/]api[/]audio[/]playlists[/]([0-9a-f]{32})[/]/.exec(request.url);
		if (parts === null) {
			throw new Error();
		}
		let audiolist_id = parts[1];
		let audiolist = data.audiolists_index[audiolist_id];
		if (audiolist === undefined) {
			throw new Error();
		}
		let playlist: PlaylistBase = {
			playlist_id: audiolist.audiolist_id,
			title: audiolist.title
		};
		let items = data.getPlaylistItemsFromPlaylistId.lookup(playlist.playlist_id).map((audiolist_item) => {
			let track = data.getTrackFromTrackId.lookup(audiolist_item.track_id);
			let disc = data.getDiscFromDiscId.lookup(track.disc_id);
			let album = data.getAlbumFromAlbumId.lookup(disc.album_id);
			return {
				playlist,
				number: audiolist_item.number,
				track: {
					track_id: track.track_id,
					title: track.title,
					disc: {
						disc_id: disc.disc_id,
						album: {
							album_id: album.album_id,
							title: album.title,
							year: album.year,
							artists: data.lookupAlbumArtists(album.album_id),
							artwork: is.absent(album.cover_file_id) ? undefined : {
								file_id: album.cover_file_id,
								mime: "image/jpeg",
								height: 1080,
								width: 1080
							}
						},
						number: disc.number
					},
					artists: data.lookupTrackArtists(track.track_id),
					file: {
						file_id: track.file_id,
						mime: "audio/mp4",
						duration_ms: track.duration
					},
					number: track.number
				}
			};
		});
		let payload: api_response.AudiolistResponse = {
			...playlist,
			items
		};
		response.writeHead(200);
		response.end(JSON.stringify(payload));
	}

	handlesRequest(request: libhttp.IncomingMessage): boolean {
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]audio[/]playlists[/]([0-9a-f]{32})[/]/.test(request.url);
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
		return request.method === 'POST' && request.url !== undefined && /^[/]api[/]audio[/]playlists[/]/.test(request.url);
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
		let genres = data.media.video.genres.map((genre) => {
			return {
				...genre
			}
		});
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
		let username = getUsername(request);
		let parts = /^[/]api[/]video[/]genres[/]([0-9a-f]{32})[/]/.exec(request.url || "/");
		if (parts == null) {
			throw "";
		}
		let video_genre_id = parts[1];
		let genre = data.video_genres_index[video_genre_id] as libdb.VideoGenreEntry;
		let movies = data.getMoviesFromVideoGenreId(video_genre_id).map((movie) => {
			let movie_parts = data.getMoviePartsFromMovieId(movie.movie_id).map((movie_part) => {
				let subtitles = data.lookupSubtitles(movie_part.file_id);
				let streamed = null;
				return {
					...movie_part,
					streamed,
					subtitles
				};
			});
			return {
				...movie,
				movie_parts
			}
		});
		let shows = data.getShowsFromVideoGenreId(video_genre_id).map((show) => {
			let seasons = data.getSeasonsFromShowId(show.show_id).map((season) => {
					let episodes = season.episodes.map((episode) => {
						let subtitles = data.lookupSubtitles(episode.file_id);
						let streamed = null;
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
			return {
				...show,
				seasons
			};
		});
		let payload: api_response.GenreResponse = {
			genre: {
				...genre,
				movies,
				shows
			}
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
