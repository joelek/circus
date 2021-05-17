import * as autoguard from "@joelek/ts-autoguard";
import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libauth from "../server/auth";
import * as auth from "../server/auth";
import * as handler from "./handler";
import * as database from "../database/indexer";
import * as apiv2 from "./schema/api/server";

export const server = apiv2.makeServer({
	"POST:/auth/": async (request) => {
		let headers = request.headers();
		let token = libauth.createToken(headers["x-circus-username"], headers["x-circus-password"]);
		return {
			headers: {
				"x-circus-token": token
			}
		}
	},
	"POST:/users/": async (request) => {
		let payload = handler.createUser(await request.payload());
		return {
			payload
		};
	},
	"GET:/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let entities = options.cues
			? handler.searchForCues(options.query, options.offset ?? 0, options.limit ?? 24, user_id)
			: handler.searchForEntities(options.query, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				entities
			}
		};
	},
	"GET:/actors/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let actors = handler.searchForActors(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				actors
			}
		};
	},
	"GET:/actors/<actor_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let actor = handler.lookupActor(options.actor_id, user_id);
		return {
			payload: {
				actor
			}
		};
	},
	"GET:/actors/<actor_id>/movies/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = handler.getMoviesFromActor(options.actor_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	},
	"GET:/actors/<actor_id>/shows/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = handler.getShowsFromActor(options.actor_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				shows
			}
		};
	},
	"GET:/albums/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let albums = handler.searchForAlbums(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				albums
			}
		};
	},
	"GET:/albums/<album_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let album = handler.lookupAlbum(options.album_id, user_id);
		return {
			payload: {
				album
			}
		};
	},
	"GET:/artists/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let artists = handler.searchForArtists(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				artists
			}
		};
	},
	"GET:/artists/<artist_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let artist = handler.lookupArtist(options.artist_id, user_id);
		let tracks = handler.getArtistTracks(options.artist_id, 0, 3, user_id);
		let appearances = handler.getArtistAppearances(options.artist_id, user_id);
		return {
			payload: {
				artist,
				tracks,
				appearances
			}
		};
	},
	"GET:/discs/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let discs = handler.searchForDiscs(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				discs
			}
		};
	},
	"GET:/discs/<disc_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let disc = handler.lookupDisc(options.disc_id, user_id);
		let discs = handler.lookupAlbum(disc.album.album_id, user_id).discs;
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
	},
	"GET:/episodes/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let episodes = handler.searchForEpisodes(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				episodes
			}
		};
	},
	"GET:/episodes/<episode_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let episode = handler.lookupEpisode(options.episode_id, user_id);
		let episodes = handler.lookupSeason(episode.season.season_id, user_id).episodes;
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
	},
	"GET:/genres/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let genres = handler.searchForGenres(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				genres
			}
		};
	},
	"GET:/genres/<genre_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let genre = handler.lookupGenre(options.genre_id, user_id);
		return {
			payload: {
				genre
			}
		};
	},
	"GET:/genres/<genre_id>/movies/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = handler.getMoviesFromGenre(options.genre_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	},
	"GET:/genres/<genre_id>/shows/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = handler.getShowsFromGenre(options.genre_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				shows
			}
		};
	},
	"GET:/movies/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = handler.searchForMovies(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				movies
			}
		};
	},
	"GET:/movies/<movie_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movie = handler.lookupMovie(options.movie_id, user_id);
		return {
			payload: {
				movie
			}
		};
	},
	"GET:/movies/<movie_id>/suggestions/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = handler.getMovieSuggestions(options.movie_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				movies
			}
		};
	},
	"GET:/playlists/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let playlists = handler.searchForPlaylists(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				playlists
			}
		};
	},
	"GET:/playlists/<playlist_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let playlist = handler.lookupPlaylist(options.playlist_id, user_id);
		return {
			payload: {
				playlist
			}
		};
	},
	"GET:/seasons/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let seasons = handler.searchForSeasons(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				seasons
			}
		};
	},
	"GET:/seasons/<season_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let season = handler.lookupSeason(options.season_id, user_id);
		let seasons = handler.lookupShow(season.show.show_id, user_id).seasons;
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
	},
	"GET:/shows/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = handler.searchForShows(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				shows
			}
		};
	},
	"GET:/shows/<show_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let show = handler.lookupShow(options.show_id, user_id);
		return {
			payload: {
				show
			}
		};
	},
	"GET:/tracks/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let tracks = handler.searchForTracks(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				tracks
			}
		};
	},
	"GET:/tracks/<track_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let track = handler.lookupTrack(options.track_id, user_id);
		let tracks = handler.lookupDisc(track.disc.disc_id, user_id).tracks;
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
	},
	"GET:/tracks/<track_id>/playlists/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let playlists = handler.getPlaylistAppearances(options.track_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				playlists
			}
		};
	},
	"GET:/users/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let users = handler.searchForUsers(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				users
			}
		};
	},
	"GET:/users/<user_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let user = handler.lookupUser(options.user_id || user_id, user_id);
		return {
			payload: {
				user
			}
		};
	},
	"GET:/users/<user_id>/albums/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let albums = handler.getUserAlbums(options.user_id || user_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				albums
			}
		};
	},
	"GET:/users/<user_id>/playlists/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let playlists = handler.getUserPlaylists(options.user_id || user_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				playlists
			}
		};
	},
	"GET:/users/<user_id>/shows/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = handler.getUserShows(options.user_id || user_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				shows
			}
		};
	},
	"GET:/years/<query>": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let years = handler.searchForYears(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				years
			}
		};
	},
	"GET:/years/<year_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let year = handler.lookupYear(options.year_id, user_id);
		return {
			payload: {
				year
			}
		};
	},
	"GET:/years/<year_id>/albums/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let albums = handler.getAlbumsFromYear(options.year_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				albums
			}
		};
	},
	"GET:/years/<year_id>/movies/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = handler.getMoviesFromYear(options.year_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	},
	"GET:/files/<file_id>/": async (request) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let file = handler.lookupFile(options.file_id, user_id);
		let path = database.getPath(file).join("/");
		let range = autoguard.api.parseRangeHeader(request.headers().range, libfs.statSync(path).size);
		let stream = libfs.createReadStream(path, {
			start: range.offset,
			end: range.offset + range.length
		});
		stream.addListener("close", () => {
			if (range.offset + stream.bytesRead === range.size) {
				handler.createStream({
					stream_id: libcrypto.randomBytes(8).toString("hex"),
					user_id: user_id,
					file_id: options.file_id,
					timestamp_ms: Date.now()
				});
			}
		});
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
	}
}, { urlPrefix: "/api" });
