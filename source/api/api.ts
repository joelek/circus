import * as autoguard from "@joelek/ts-autoguard/dist/lib-server";
import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libauth from "../server/auth";
import * as auth from "../server/auth";
import * as handler from "./handler";
import * as apiv2 from "./schema/api/server";
import * as atlas from "../database/atlas";
import { binid } from "../utils";
import { stats } from "../database/indexer";
import * as app from "../app.json";

function getVersion(): {
	major: number,
	minor: number,
	patch: number
} | undefined {
	try {
		let parts = /^([0-9]+)[.]([0-9]+)[.]([0-9]+)$/.exec(app.version);
		if (parts != null) {
			let major = Number.parseInt(parts[1], 10);
			let minor = Number.parseInt(parts[2], 10);
			let patch = Number.parseInt(parts[3], 10);
			return {
				major,
				minor,
				patch
			};
		}
	} catch (error) {}
}

export const server = apiv2.makeServer({
	"POST:/auth/": (request) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
		let headers = request.headers();
		let token = await libauth.createToken(queue, headers["x-circus-username"], headers["x-circus-password"]);
		return {
			headers: {
				"x-circus-token": token,
				"Cache-Control": "no-store"
			}
		}
	}),
	"POST:/users/": (request) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
		let payload = await handler.createUser(queue, await request.payload());
		return {
			payload,
			headers: {
				"Cache-Control": "no-store"
			}
		};
	}),
	"GET:/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let entities = options.cues
			? await handler.searchForCues(queue, options.query, options.offset ?? 0, options.limit ?? 12, user_id)
			: await handler.searchForEntities(queue, options.query, user_id, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				entities
			}
		};
	}),
	"GET:/actors/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForActors(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/actors/<actor_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let actor = await handler.lookupActor(queue, options.actor_id, user_id);
		return {
			payload: {
				actor
			}
		};
	}),
	"GET:/actors/<actor_id>/movies/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getMoviesFromActor(queue, options.actor_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/actors/<actor_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let shows = await handler.getShowsFromActor(queue, options.actor_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/albums/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForAlbums(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	getNewAlbums: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let albums = await handler.getNewAlbums(queue, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/albums/<album_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let album = await handler.lookupAlbum(queue, options.album_id, user_id);
		return {
			payload: {
				album
			}
		};
	}),
	getAlbumDiscs: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let api_user_id = await auth.getUserId(queue, options.token);
		let album = await handler.lookupAlbum(queue, options.album_id, api_user_id);
		let discs = await handler.lookupAlbumDiscs(queue, options.album_id, api_user_id, album);
		return {
			payload: {
				discs
			}
		};
	}),
	getAlbumContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupAlbumContext(queue, options.album_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	"GET:/artists/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForArtists(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/artists/<artist_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let artist = await handler.lookupArtist(queue, options.artist_id, user_id);
		let tracks = await handler.getArtistTracks(queue, options.artist_id, 0, 5, user_id);
		let appearances = await handler.getArtistAppearances(queue, options.artist_id, 0, 24, user_id);
		return {
			payload: {
				artist,
				tracks,
				appearances
			}
		};
	}),
	getArtistAlbums: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let api_user_id = await auth.getUserId(queue, options.token);
		let artist = await handler.lookupArtist(queue, options.artist_id, api_user_id);
		let albums = await handler.lookupArtistAlbums(queue, options.artist_id, api_user_id, artist);
		return {
			payload: {
				albums
			}
		};
	}),
	getArtistContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupArtistContext(queue, options.artist_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	"GET:/discs/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForDiscs(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/discs/<disc_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let disc = await handler.lookupDisc(queue, options.disc_id, user_id);
		let discs = await handler.lookupAlbumDiscs(queue, disc.album.album_id, user_id, disc.album);
		let index = discs.findIndex((other) => other.disc_id === disc.disc_id);
		let last = discs[index - 1];
		let next = discs[index + 1];
		return {
			payload: {
				disc,
				last,
				next
			}
		};
	}),
	getDiscTracks: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let api_user_id = await auth.getUserId(queue, options.token);
		let disc = await handler.lookupDisc(queue, options.disc_id, api_user_id);
		let tracks = await handler.lookupDiscTracks(queue, options.disc_id, api_user_id, disc);
		return {
			payload: {
				tracks
			}
		};
	}),
	getDiscContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupDiscContext(queue, options.disc_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	"GET:/episodes/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForEpisodes(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/episodes/<episode_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let episode = await handler.lookupEpisode(queue, options.episode_id, user_id);
		let episodes = await handler.lookupSeasonEpisodes(queue, episode.season.season_id, user_id, episode.season);
		let index = episodes.findIndex((other) => other.episode_id === episode.episode_id);
		let last = episodes[index - 1];
		let next = episodes[index + 1];
		return {
			payload: {
				episode,
				last,
				next
			}
		};
	}),
	getEpisodeContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupEpisodeContext(queue, options.episode_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	"GET:/genres/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForGenres(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/genres/<genre_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let genre = await handler.lookupGenre(queue, options.genre_id, user_id);
		return {
			payload: {
				genre
			}
		};
	}),
	"GET:/genres/<genre_id>/movies/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getMoviesFromGenre(queue, options.genre_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/genres/<genre_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let shows = await handler.getShowsFromGenre(queue, options.genre_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/movies/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForMovies(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	getNewMovies: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getNewMovies(queue, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/movies/<movie_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movie = await handler.lookupMovie(queue, options.movie_id, user_id);
		let actors = await handler.lookupMovieActors(queue, options.movie_id, user_id, undefined, 5);
		return {
			payload: {
				movie,
				actors
			}
		};
	}),
	"GET:/movies/<movie_id>/suggestions/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getMovieSuggestions(queue, options.movie_id, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				movies
			}
		};
	}),
	getMovieContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupMovieContext(queue, options.movie_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	getMovieActors: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let actors = await handler.lookupMovieActors(queue, options.movie_id, user_id, options.anchor, options.limit ?? 12);
		return {
			payload: {
				actors
			}
		};
	}),
	"GET:/playlists/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForPlaylists(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/playlists/<playlist_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let playlist = await handler.lookupPlaylist(queue, options.playlist_id, user_id);
		return {
			payload: {
				playlist
			}
		};
	}),
	getPlaylistItems: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let api_user_id = await auth.getUserId(queue, options.token);
		let playlist = await handler.lookupPlaylist(queue, options.playlist_id, api_user_id);
		let items = await handler.lookupPlaylistItems(queue, options.playlist_id, api_user_id, playlist);
		return {
			payload: {
				items
			}
		};
	}),
	getPlaylistContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupPlaylistContext(queue, options.playlist_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	"GET:/seasons/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForSeasons(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/seasons/<season_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let season = await handler.lookupSeason(queue, options.season_id, user_id);
		let seasons = await handler.lookupShowSeasons(queue, season.show.show_id, user_id, season.show);
		let index = seasons.findIndex((other) => other.season_id === season.season_id);
		let last = seasons[index - 1];
		let next = seasons[index + 1];
		return {
			payload: {
				season,
				last,
				next
			}
		};
	}),
	getSeasonEpisodes: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let season = await handler.lookupSeasonBase(queue, options.season_id, user_id);
		let episodes = await handler.lookupSeasonEpisodes(queue, options.season_id, user_id, season);
		return {
			payload: {
				episodes
			}
		};
	}),
	getSeasonContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupSeasonContext(queue, options.season_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	"GET:/shows/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForShows(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/shows/<show_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let show = await handler.lookupShow(queue, options.show_id, user_id);
		let actors = await handler.lookupShowActors(queue, options.show_id, user_id, undefined, 5);
		return {
			payload: {
				show,
				actors
			}
		};
	}),
	getShowSeasons: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let show = await handler.lookupShowBase(queue, options.show_id, user_id);
		let seasons = await handler.lookupShowSeasons(queue, options.show_id, user_id, show);
		return {
			payload: {
				seasons
			}
		};
	}),
	getShowContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupShowContext(queue, options.show_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	getShowActors: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let actors = await handler.lookupShowActors(queue, options.show_id, user_id, options.anchor, options.limit ?? 12);
		return {
			payload: {
				actors
			}
		};
	}),
	"GET:/tracks/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForTracks(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/tracks/<track_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let track = await handler.lookupTrack(queue, options.track_id, user_id);
		let tracks = await handler.lookupDiscTracks(queue, track.disc.disc_id, user_id, track.disc);
		let index = tracks.findIndex((other) => other.track_id === track.track_id);
		let last = tracks[index - 1];
		let next = tracks[index + 1];
		return {
			payload: {
				track,
				last,
				next
			}
		};
	}),
	"GET:/tracks/<track_id>/playlists/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let playlists = await handler.getPlaylistAppearances(queue, options.track_id, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				playlists
			}
		};
	}),
	getTrackContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupTrackContext(queue, options.track_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	"GET:/users/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForUsers(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/users/<user_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let user = await handler.lookupUser(queue, options.user_id || user_id, user_id);
		return {
			payload: {
				user
			}
		};
	}),
	getUserArtists: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let artists = await handler.getUserArtists(queue, options.user_id || user_id, options.anchor, options.limit ?? 12, user_id);
		return {
			payload: {
				artists
			}
		};
	}),
	"GET:/users/<user_id>/albums/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let albums = await handler.getUserAlbums(queue, options.user_id || user_id, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/users/<user_id>/playlists/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let playlists = await handler.getUserPlaylists(queue, options.user_id || user_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				playlists
			}
		};
	}),
	"GET:/users/<user_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let shows = await handler.getUserShows(queue, options.user_id || user_id, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/years/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let results = await handler.searchForYears(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 12, user_id);
		return {
			payload: {
				results
			}
		};
	}),
	"GET:/years/<year_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let year = await handler.lookupYear(queue, options.year_id, user_id);
		return {
			payload: {
				year
			}
		};
	}),
	"GET:/years/<year_id>/albums/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let albums = await handler.getAlbumsFromYear(queue, options.year_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/years/<year_id>/movies/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getMoviesFromYear(queue, options.year_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				movies
			}
		};
	}),
	getYearContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.lookupYearContext(queue, options.year_id, user_id);
		return {
			payload: {
				context
			}
		};
	}),
	getDirectory: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let directory = await handler.getDirectory(queue, options.directory_id, user_id, undefined);
		return {
			payload: {
				directory
			}
		};
	}),
	getDirectoryDirectories: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let directories = await handler.getDirectoryDirectories(queue, options.directory_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				directories
			}
		};
	}),
	getDirectoryFiles: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let files = await handler.getDirectoryFiles(queue, options.directory_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 12);
		return {
			payload: {
				files
			}
		};
	}),
	getDirectoryContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.getDirectoryContext(queue, options.directory_id, user_id, undefined);
		return {
			payload: {
				context
			}
		};
	}),
	getFile: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let file = await handler.getFile(queue, options.file_id, user_id, undefined);
		return {
			payload: {
				file
			}
		};
	}),
	getFileContext: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let context = await handler.getFileContext(queue, options.file_id, user_id, undefined);
		return {
			payload: {
				context
			}
		};
	}),
	getFileContent: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let file = await handler.lookupFileWithPathAndMime(queue, options.file_id, user_id);
		let range = autoguard.api.parseRangeHeader(request.headers().range, libfs.statSync(file.path).size);
		let stream = libfs.createReadStream(file.path, {
			start: range.offset,
			end: range.offset + range.length
		});
		if (file.mime.startsWith("audio/") || file.mime.startsWith("video/")) {
			stream.addListener("close", () => {
				if (range.offset + stream.bytesRead === range.size) {
					atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
						await auth.refreshToken(queue, options.token);
						await atlas.createStream(queue, {
							stream_id: Uint8Array.from(libcrypto.randomBytes(8)),
							user_id: binid(user_id),
							file_id: binid(options.file_id),
							timestamp_ms: Date.now()
						});
					});
				}
			});
		}
		return {
			status: range.status,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Accept-Ranges": "bytes",
				"Cache-Control": "private,max-age=86400",
				"Content-Length": `${range.length}`,
				"Content-Range": range.length > 0 ? `bytes ${range.offset}-${range.offset+range.length-1}/${range.size}` : `bytes */${range.size}`,
				"Content-Type": file.mime
			},
			payload: stream
		};
	}),
	"GET:/statistics/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let version = getVersion();
		return {
			payload: {
				statistics: [
					{
						title: "Major Version",
						value: version?.major ?? 0
					},
					{
						title: "Minor Version",
						value: version?.minor ?? 0
					},
					{
						title: "Patch Version",
						value: version?.patch ?? 0
					},
					{
						title: "Build Date",
						value: new Date(app.timestamp).toISOString().slice(0, 10)
					},
					{
						title: "Build Time",
						value: new Date(app.timestamp).toISOString().slice(11, 19)
					},
					{
						title: "Library Size",
						value: stats.librarySize,
						unit: "BYTES"
					},
					{
						title: "Audio Content",
						value: stats.audioContent,
						unit: "MILLISECONDS"
					},
					{
						title: "Video Content",
						value: stats.videoContent,
						unit: "MILLISECONDS"
					},
					{
						title: "Audio Streamed",
						value: stats.audioStreamed,
						unit: "MILLISECONDS"
					},
					{
						title: "Video Streamed",
						value: stats.videoStreamed,
						unit: "MILLISECONDS"
					},
					{
						title: "Directories",
						value: await atlas.stores.directories.length(queue)
					},
					{
						title: "Files",
						value: await atlas.stores.files.length(queue)
					},
					{
						title: "Audio Files",
						value: await atlas.stores.audio_files.length(queue)
					},
					{
						title: "Image Files",
						value: await atlas.stores.image_files.length(queue)
					},
					{
						title: "Metadata Files",
						value: await atlas.stores.metadata_files.length(queue)
					},
					{
						title: "Subtitle Files",
						value: await atlas.stores.subtitle_files.length(queue)
					},
					{
						title: "Video Files",
						value: await atlas.stores.video_files.length(queue)
					},
					{
						title: "Artists",
						value: await atlas.stores.artists.length(queue)
					},
					{
						title: "Albums",
						value: await atlas.stores.albums.length(queue)
					},
					{
						title: "Discs",
						value: await atlas.stores.discs.length(queue)
					},
					{
						title: "Tracks",
						value: await atlas.stores.tracks.length(queue)
					},
					{
						title: "Shows",
						value: await atlas.stores.shows.length(queue)
					},
					{
						title: "Seasons",
						value: await atlas.stores.seasons.length(queue)
					},
					{
						title: "Episodes",
						value: await atlas.stores.episodes.length(queue)
					},
					{
						title: "Movies",
						value: await atlas.stores.movies.length(queue)
					},
					{
						title: "Genres",
						value: await atlas.stores.genres.length(queue)
					},
					{
						title: "Actors",
						value: await atlas.stores.actors.length(queue)
					},
					{
						title: "Users",
						value: await atlas.stores.users.length(queue)
					},
					{
						title: "Playlists",
						value: await atlas.stores.playlists.length(queue)
					},
					{
						title: "Playlists Items",
						value: await atlas.stores.playlist_items.length(queue)
					},
					{
						title: "Streams",
						value: await atlas.stores.streams.length(queue)
					}
				]
			}
		};
	})
}, {
	urlPrefix: "/api",
	defaultHeaders: [
		["Cache-Control", "private,max-age=86400"]
	]
});
