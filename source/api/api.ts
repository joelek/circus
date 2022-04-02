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
		let token = await libauth.createToken(queue, headers["x-circus-username"], headers["x-circus-password"]);
		return {
			headers: {
				"x-circus-token": token
			}
		}
	}),
	"POST:/users/": (request) => atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
		let payload = await handler.createUser(queue, await request.payload());
		return {
			payload
		};
	}),
	"GET:/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let entities = options.cues
			? await handler.searchForCues(queue, options.query, options.offset ?? 0, options.limit ?? 24, user_id)
			: await handler.searchForEntities(queue, options.query, user_id, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				entities
			}
		};
	}),
	"GET:/actors/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let actors = await handler.searchForActors(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				actors
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
		let movies = await handler.getMoviesFromActor(queue, options.actor_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/actors/<actor_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let shows = await handler.getShowsFromActor(queue, options.actor_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/albums/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let albums = await handler.searchForAlbums(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				albums
			}
		};
	}),
	getNewAlbums: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let albums = await handler.getNewAlbums(queue, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
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
	"GET:/artists/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let artists = await handler.searchForArtists(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				artists
			}
		};
	}),
	"GET:/artists/<artist_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let artist = await handler.lookupArtist(queue, options.artist_id, user_id);
		let tracks = await handler.getArtistTracks(queue, options.artist_id, 0, 3, user_id);
		let appearances = await handler.getArtistAppearances(queue, options.artist_id, 0, 24, user_id);
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
		let user_id = await auth.getUserId(queue, options.token);
		let discs = await handler.searchForDiscs(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				discs
			}
		};
	}),
	"GET:/discs/<disc_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let disc = await handler.lookupDisc(queue, options.disc_id, user_id);
		let discs = (await handler.lookupAlbum(queue, disc.album.album_id, user_id)).discs;
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
		let user_id = await auth.getUserId(queue, options.token);
		let episodes = await handler.searchForEpisodes(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				episodes
			}
		};
	}),
	"GET:/episodes/<episode_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let episode = await handler.lookupEpisode(queue, options.episode_id, user_id);
		let episodes = (await handler.lookupSeason(queue, episode.season.season_id, user_id)).episodes;
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
		let user_id = await auth.getUserId(queue, options.token);
		let genres = await handler.searchForGenres(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				genres
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
		let movies = await handler.getMoviesFromGenre(queue, options.genre_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/genres/<genre_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let shows = await handler.getShowsFromGenre(queue, options.genre_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/movies/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.searchForMovies(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				movies
			}
		};
	}),
	getNewMovies: (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getNewMovies(queue, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
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
		return {
			payload: {
				movie
			}
		};
	}),
	"GET:/movies/<movie_id>/suggestions/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getMovieSuggestions(queue, options.movie_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/playlists/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let playlists = await handler.searchForPlaylists(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				playlists
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
	"GET:/seasons/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let seasons = await handler.searchForSeasons(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				seasons
			}
		};
	}),
	"GET:/seasons/<season_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let season = await handler.lookupSeason(queue, options.season_id, user_id);
		let seasons = (await handler.lookupShow(queue, season.show.show_id, user_id)).seasons;
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
		let user_id = await auth.getUserId(queue, options.token);
		let shows = await handler.searchForShows(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/shows/<show_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let show = await handler.lookupShow(queue, options.show_id, user_id);
		return {
			payload: {
				show
			}
		};
	}),
	"GET:/tracks/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let tracks = await handler.searchForTracks(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				tracks
			}
		};
	}),
	"GET:/tracks/<track_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let track = await handler.lookupTrack(queue, options.track_id, user_id);
		let tracks = (await handler.lookupDisc(queue, track.disc.disc_id, user_id)).tracks;
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
		let playlists = await handler.getPlaylistAppearances(queue, options.track_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				playlists
			}
		};
	}),
	"GET:/users/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let users = await handler.searchForUsers(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				users
			}
		};
	}),
	"GET:/users/<user_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		if (options.user_id === user_id) {
			atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
				// TODO: Refresh token expiry.
			});
		}
		let user = await handler.lookupUser(queue, options.user_id || user_id, user_id);
		return {
			payload: {
				user
			}
		};
	}),
	"GET:/users/<user_id>/albums/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let albums = await handler.getUserAlbums(queue, options.user_id || user_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/users/<user_id>/playlists/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let playlists = await handler.getUserPlaylists(queue, options.user_id || user_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				playlists
			}
		};
	}),
	"GET:/users/<user_id>/shows/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let shows = await handler.getUserShows(queue, options.user_id || user_id, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				shows
			}
		};
	}),
	"GET:/years/<query>": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let years = await handler.searchForYears(queue, options.query, options.anchor, options.offset ?? 0, options.limit ?? 24, user_id);
		return {
			payload: {
				years
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
		let albums = await handler.getAlbumsFromYear(queue, options.year_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				albums
			}
		};
	}),
	"GET:/years/<year_id>/movies/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let movies = await handler.getMoviesFromYear(queue, options.year_id, user_id, options.anchor, options.offset ?? 0, options.limit ?? 24);
		return {
			payload: {
				movies
			}
		};
	}),
	"GET:/files/<file_id>/": (request) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let file = await handler.lookupFile(queue, options.file_id, user_id);
		let range = autoguard.api.parseRangeHeader(request.headers().range, libfs.statSync(file.path).size);
		let stream = libfs.createReadStream(file.path, {
			start: range.offset,
			end: range.offset + range.length
		});
		if (file.mime.startsWith("audio/") || file.mime.startsWith("video/")) {
			stream.addListener("close", () => {
				if (range.offset + stream.bytesRead === range.size) {
					atlas.transactionManager.enqueueWritableTransaction(async (queue) => {
						handler.createStream(queue, {
							stream_id: libcrypto.randomBytes(8).toString("hex"),
							user_id: user_id,
							file_id: options.file_id,
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
		// TODO: Create statistics table.
		let options = request.options();
		let user_id = await auth.getUserId(queue, options.token);
		let files = await atlas.stores.files.filter(queue);
		let audio_files = await atlas.stores.audio_files.filter(queue);
		let image_files = await atlas.stores.image_files.filter(queue);
		let metadata_files = await atlas.stores.metadata_files.filter(queue);
		let subtitle_files = await atlas.stores.subtitle_files.filter(queue);
		let video_files =  await atlas.stores.video_files.filter(queue);
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
