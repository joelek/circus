import * as autoguard from "@joelek/ts-autoguard/dist/lib-server";
import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as libauth from "../server/auth";
import * as auth from "../server/auth";
import * as handler from "./handler";
import * as database from "../database/indexer";
import * as apiv2 from "./schema/api/server";
import * as atlas from "../database/atlas";

function getVersion(): {
	major: number,
	minor: number,
	patch: number
} | undefined {
	try {
		let pack = libfs.readFileSync("./package.json", "utf8");
		let json = JSON.parse(pack);
		let parts = /^([0-9]+)[.]([0-9]+)[.]([0-9]+)$/.exec(String(json?.version));
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
		let token = libauth.createToken(headers["x-circus-username"], headers["x-circus-password"]);
		return {
			headers: {
				"x-circus-token": token
			}
		}
	}),
	"POST:/users/": (request) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
		let payload = await handler.createUser(await request.payload());
		return {
			payload
		};
	}),
	"GET:/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let entities = options.cues
			? await handler.searchForCues(options.query, options.offset ?? 0, options.limit ?? 24, user_id)
			: await handler.searchForEntities(options.query, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				entities
			}
		};
	}),
	"GET:/actors/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let actors = await handler.searchForActors(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				actors
			}
		};
	}),
	"GET:/actors/<actor_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let actor = await handler.lookupActor(options.actor_id, user_id);
		return {
			payload: {
				actor
			}
		};
	}),
	"GET:/actors/<actor_id>/movies/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = await handler.getMoviesFromActor(options.actor_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/actors/<actor_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = await handler.getShowsFromActor(options.actor_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/albums/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let albums = await handler.searchForAlbums(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				albums
			}
		};
	}),
	getNewAlbums: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let albums = await handler.getNewAlbums(user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/albums/<album_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let album = await handler.lookupAlbum(options.album_id, user_id);
		return {
			payload: {
				album
			}
		};
	}),
	"GET:/artists/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let artists = await handler.searchForArtists(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				artists
			}
		};
	}),
	"GET:/artists/<artist_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let artist = await handler.lookupArtist(options.artist_id, user_id);
		let tracks = await handler.getArtistTracks(options.artist_id, 0, 3, user_id);
		let appearances = await handler.getArtistAppearances(options.artist_id, user_id);
		return {
			payload: {
				artist,
				tracks,
				appearances
			}
		};
	}),
	"GET:/discs/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let discs = await handler.searchForDiscs(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				discs
			}
		};
	}),
	"GET:/discs/<disc_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let disc = await handler.lookupDisc(options.disc_id, user_id);
		let discs = (await handler.lookupAlbum(disc.album.album_id, user_id)).discs;
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
	"GET:/episodes/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let episodes = await handler.searchForEpisodes(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				episodes
			}
		};
	}),
	"GET:/episodes/<episode_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let episode = await handler.lookupEpisode(options.episode_id, user_id);
		let episodes = (await handler.lookupSeason(episode.season.season_id, user_id)).episodes;
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
	"GET:/genres/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let genres = await handler.searchForGenres(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				genres
			}
		};
	}),
	"GET:/genres/<genre_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let genre = await handler.lookupGenre(options.genre_id, user_id);
		return {
			payload: {
				genre
			}
		};
	}),
	"GET:/genres/<genre_id>/movies/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = await handler.getMoviesFromGenre(options.genre_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/genres/<genre_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = await handler.getShowsFromGenre(options.genre_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/movies/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = await handler.searchForMovies(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				movies
			}
		};
	}),
	getNewMovies: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = await handler.getNewMovies(user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/movies/<movie_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movie = await handler.lookupMovie(options.movie_id, user_id);
		return {
			payload: {
				movie
			}
		};
	}),
	"GET:/movies/<movie_id>/suggestions/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = await handler.getMovieSuggestions(options.movie_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/playlists/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let playlists = await handler.searchForPlaylists(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				playlists
			}
		};
	}),
	"GET:/playlists/<playlist_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let playlist = await handler.lookupPlaylist(options.playlist_id, user_id);
		return {
			payload: {
				playlist
			}
		};
	}),
	"GET:/seasons/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let seasons = await handler.searchForSeasons(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				seasons
			}
		};
	}),
	"GET:/seasons/<season_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let season = await handler.lookupSeason(options.season_id, user_id);
		let seasons = (await handler.lookupShow(season.show.show_id, user_id)).seasons;
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
	"GET:/shows/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = await handler.searchForShows(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/shows/<show_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let show = await handler.lookupShow(options.show_id, user_id);
		return {
			payload: {
				show
			}
		};
	}),
	"GET:/tracks/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let tracks = await handler.searchForTracks(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				tracks
			}
		};
	}),
	"GET:/tracks/<track_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let track = await handler.lookupTrack(options.track_id, user_id);
		let tracks = (await handler.lookupDisc(track.disc.disc_id, user_id)).tracks;
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
		let user_id = auth.getUserId(options.token);
		let playlists = await handler.getPlaylistAppearances(options.track_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				playlists
			}
		};
	}),
	"GET:/users/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let users = await handler.searchForUsers(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				users
			}
		};
	}),
	"GET:/users/<user_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let user = await handler.lookupUser(options.user_id || user_id, user_id);
		return {
			payload: {
				user
			}
		};
	}),
	"GET:/users/<user_id>/albums/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let albums = await handler.getUserAlbums(options.user_id || user_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/users/<user_id>/playlists/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let playlists = await handler.getUserPlaylists(options.user_id || user_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				playlists
			}
		};
	}),
	"GET:/users/<user_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let shows = await handler.getUserShows(options.user_id || user_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/years/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let years = await handler.searchForYears(options.query, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				years
			}
		};
	}),
	"GET:/years/<year_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let year = await handler.lookupYear(options.year_id, user_id);
		return {
			payload: {
				year
			}
		};
	}),
	"GET:/years/<year_id>/albums/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let albums = await handler.getAlbumsFromYear(options.year_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/years/<year_id>/movies/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let movies = await handler.getMoviesFromYear(options.year_id, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/files/<file_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let file = await handler.lookupFile(options.file_id, user_id);
		let path = database.getLegacyPath(file).join("/");
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
	}),
	"GET:/statistics/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = auth.getUserId(options.token);
		let files =  Array.from(database.files);
		let audio_files = Array.from(database.audio_files);
		let image_files = Array.from(database.image_files);
		let metadata_files = Array.from(database.metadata_files);
		let subtitle_files = Array.from(database.subtitle_files);
		let video_files =  Array.from(database.video_files);
		let version = getVersion();
		return {
			payload: {
				statistics: [
					{
						title: "Major version",
						value: version?.major ?? 0
					},
					{
						title: "Minor version",
						value: version?.minor ?? 0
					},
					{
						title: "Patch version",
						value: version?.patch ?? 0
					},
					{
						title: "Library Size",
						value: files.reduce((sum, item) => sum + (item?.size ?? 0), 0),
						unit: "BYTES"
					},
					{
						title: "Audio Content",
						value: audio_files.reduce((sum, item) => sum + item.duration_ms, 0),
						unit: "MILLISECONDS"
					},
					{
						title: "Video Content",
						value: video_files.reduce((sum, item) => sum + item.duration_ms, 0),
						unit: "MILLISECONDS"
					},
					{
						title: "Files",
						value: files.length
					},
					{
						title: "Audio Files",
						value: audio_files.length
					},
					{
						title: "Image Files",
						value: image_files.length
					},
					{
						title: "Metadata Files",
						value: metadata_files.length
					},
					{
						title: "Subtitle Files",
						value: subtitle_files.length
					},
					{
						title: "Video Files",
						value: video_files.length
					}
				]
			}
		};
	})
}, { urlPrefix: "/api" });
