import * as api from "../api/schema/objects";
import * as observables from "../observers/";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as is from "../is";
import * as context from "../player";
import * as utils from "../utils";
import { IconFactory } from "./Icon";
import { Client } from "../api/schema/api/client";
import { ContextAlbum, ContextArtist, ContextDisc, ContextEpisode, ContextMovie, ContextPlaylist, ContextSeason, ContextShow, ContextTrack } from "../player/schema/objects";

const CSS = `
	.playback-button {
		background-color: ${theme.TEXT_0};
		border-radius: 50%;
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		fill: ${theme.BACKGROUND_2};
		padding: 8px;
		transition: transform 0.125s;
	}

	@media (hover: hover) and (pointer: fine) {
		.playback-button:not([data-enabled="false"]):hover {
			transform: scale(1.50);
		}

		.playback-button:active {
			transform: none;
		}
	}
`;

type Controller = Partial<{
	pause: () => void,
	play: () => void,
	resume: () => void
}>;

export class PlaybackButtonFactory {
	private rpc: Client;
	private player: context.client.ContextClient;
	private iconFactory: IconFactory;

	private make(isContext: observables.ObservableClass<boolean>, controller: Controller): xnode.XElement {
		let isPlaying = observables.computed((isContext, playback) => {
			return isContext && playback;
		}, isContext, this.player.playback);
		return xnode.element("div.playback-button")
			.add(this.iconFactory.makePlay()
				.bind("data-hide", isPlaying.addObserver((isPlaying) => isPlaying))
			)
			.add(this.iconFactory.makePause()
				.bind("data-hide", isPlaying.addObserver((isPlaying) => !isPlaying))
			)
			.on("click", () => {
				let pause = controller.pause ?? (() => this.player.pause());
				let play = controller.play ?? (() => this.player.play());
				let resume = controller.resume ?? (() => this.player.resume());
				if (isPlaying.getState()) {
					pause();
				} else {
					if (isContext.getState()) {
						resume();
					} else {
						play();
					}
				}
			});
	}

	private async getAlbumContext(album: api.Album): Promise<api.AlbumContext> {
		let response = await this.rpc.getAlbumContext({
			options: {
				album_id: album.album_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getArtistContext(artist: api.Artist): Promise<api.ArtistContext> {
		let response = await this.rpc.getArtistContext({
			options: {
				artist_id: artist.artist_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getDiscContext(disc: api.Disc): Promise<api.DiscContext> {
		let response = await this.rpc.getDiscContext({
			options: {
				disc_id: disc.disc_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getEpisodeContext(episode: api.Episode): Promise<api.EpisodeContext> {
		let response = await this.rpc.getEpisodeContext({
			options: {
				episode_id: episode.episode_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getMovieContext(movie: api.Movie): Promise<api.MovieContext> {
		let response = await this.rpc.getMovieContext({
			options: {
				movie_id: movie.movie_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getPlaylistContext(playlist: api.Playlist): Promise<api.PlaylistContext> {
		let response = await this.rpc.getPlaylistContext({
			options: {
				playlist_id: playlist.playlist_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getSeasonContext(season: api.Season): Promise<api.SeasonContext> {
		let response = await this.rpc.getSeasonContext({
			options: {
				season_id: season.season_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getShowContext(show: api.Show): Promise<api.ShowContext> {
		let response = await this.rpc.getShowContext({
			options: {
				show_id: show.show_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	private async getTrackContext(track: api.Track): Promise<api.TrackContext> {
		let response = await this.rpc.getTrackContext({
			options: {
				track_id: track.track_id,
				token: this.player.token.getState() ?? ""
			}
		});
		let payload = await response.payload();
		return payload.context;
	}

	constructor(rpc: Client, player: context.client.ContextClient, iconFactory: IconFactory) {
		this.rpc = rpc;
		this.player = player;
		this.iconFactory = iconFactory;
	}

	forEntity(entity: api.Album | api.Artist | api.Cue | api.Disc | api.Episode | api.Movie | api.Playlist | api.Season | api.Show | api.Track): xnode.XElement {
		if (api.Album.is(entity)) {
			return this.forAlbum(entity);
		}
		if (api.Artist.is(entity)) {
			return this.forArtist(entity);
		}
		if (api.Cue.is(entity)) {
			return this.forCue(entity);
		}
		if (api.Disc.is(entity)) {
			return this.forDisc(entity);
		}
		if (api.Episode.is(entity)) {
			return this.forEpisode(entity);
		}
		if (api.Movie.is(entity)) {
			return this.forMovie(entity);
		}
		if (api.Playlist.is(entity)) {
			return this.forPlaylist(entity);
		}
		if (api.Season.is(entity)) {
			return this.forSeason(entity);
		}
		if (api.Show.is(entity)) {
			return this.forShow(entity);
		}
		if (api.Track.is(entity)) {
			return this.forTrack(entity);
		}
		throw `Expected code to be unreachable!`;
	}

	forAlbum(album: api.Album, discIndex?: number, trackIndex?: number): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextAlbum.is(context) || !ContextTrack.is(currentEntry)) {
				return false;
			}
			if (context.album_id !== album.album_id) {
				return false;
			}
			if (discIndex != null) {
				if (context.discs[discIndex].disc_id !== currentEntry.disc.disc_id) {
					return false;
				}
				if (trackIndex != null) {
					if (context.discs[discIndex].tracks[trackIndex].track_id !== currentEntry.track_id) {
						return false;
					}
				}
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playAlbum(await this.getAlbumContext(album), discIndex, trackIndex)
		});
	}

	forArtist(artist: api.Artist, albumIndex?: number, discIndex?: number, trackIndex?: number): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextArtist.is(context) || !ContextTrack.is(currentEntry)) {
				return false;
			}
			if (context.artist_id !== artist.artist_id) {
				return false;
			}
			if (albumIndex != null) {
				if (context.albums[albumIndex].album_id !== currentEntry.disc.album.album_id) {
					return false;
				}
				if (discIndex != null) {
					if (context.albums[albumIndex].discs[discIndex].disc_id !== currentEntry.disc.disc_id) {
						return false;
					}
					if (trackIndex != null) {
						if (context.albums[albumIndex].discs[discIndex].tracks[trackIndex].track_id !== currentEntry.track_id) {
							return false;
						}
					}
				}
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playArtist(await this.getArtistContext(artist), albumIndex, discIndex, trackIndex)
		});
	}

	forCue(cue: api.Cue): xnode.XElement {
		let start_s = Math.max(0, cue.start_ms / 1000 - 0.25);
		if (false) {
		} else if (api.Episode.is(cue.media)) {
			let episode = cue.media;
			let isContext = observables.computed((context) => {
				return ContextEpisode.is(context) && context.episode_id === episode.episode_id;
			}, this.player.context);
			return this.make(isContext, {
				play: () => {
					this.player.playEpisode(episode);
					this.player.seek(start_s);
				},
				resume: () => {
					this.player.seek(0);
					this.player.seek(start_s);
					this.player.resume();
				}
			});
		} else if (api.Movie.is(cue.media)) {
			let movie = cue.media;
			let isContext = observables.computed((context) => {
				return ContextMovie.is(context) && context.movie_id === movie.movie_id;
			}, this.player.context);
			return this.make(isContext, {
				play: () => {
					this.player.playMovie(movie);
					this.player.seek(start_s);
				},
				resume: () => {
					this.player.seek(0);
					this.player.seek(start_s);
					this.player.resume();
				}
			});
		}
		throw `Expected code to be unreachable!`;
	}

	forDisc(disc: api.Disc, trackIndex?: number): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextDisc.is(context) || !ContextTrack.is(currentEntry)) {
				return false;
			}
			if (context.disc_id !== disc.disc_id) {
				return false;
			}
			if (trackIndex != null) {
				if (context.tracks[trackIndex].track_id !== currentEntry.track_id) {
					return false;
				}
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playDisc(await this.getDiscContext(disc), trackIndex)
		});
	}

	forEpisode(episode: api.Episode): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextEpisode.is(context) || !ContextEpisode.is(currentEntry)) {
				return false;
			}
			if (context.episode_id !== episode.episode_id) {
				return false;
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playEpisode(await this.getEpisodeContext(episode))
		});
	}

	forMovie(movie: api.Movie): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextMovie.is(context) || !ContextMovie.is(currentEntry)) {
				return false;
			}
			if (context.movie_id !== movie.movie_id) {
				return false;
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playMovie(await this.getMovieContext(movie))
		});
	}

	forPlaylist(playlist: api.Playlist, itemIndex?: number): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextPlaylist.is(context) || !ContextTrack.is(currentEntry)) {
				return false;
			}
			if (context.playlist_id !== playlist.playlist_id) {
				return false;
			}
			if (itemIndex != null) {
				if (context.items[itemIndex].track.track_id !== currentEntry.track_id) {
					return false;
				}
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playPlaylist(await this.getPlaylistContext(playlist), itemIndex)
		});
	}

	forSeason(season: api.Season, episodeIndex?: number): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextSeason.is(context) || !ContextEpisode.is(currentEntry)) {
				return false;
			}
			if (context.season_id !== season.season_id) {
				return false;
			}
			if (episodeIndex != null) {
				if (context.episodes[episodeIndex].episode_id !== currentEntry.episode_id) {
					return false;
				}
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playSeason(await this.getSeasonContext(season), episodeIndex)
		});
	}

	forShow(show: api.Show, seasonIndex?: number, episodeIndex?: number): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextShow.is(context) || !ContextEpisode.is(currentEntry)) {
				return false;
			}
			if (context.show_id !== show.show_id) {
				return false;
			}
			if (seasonIndex != null) {
				if (context.seasons[seasonIndex].season_id !== currentEntry.season.season_id) {
					return false;
				}
				if (episodeIndex != null) {
					if (context.seasons[seasonIndex].episodes[episodeIndex].episode_id !== currentEntry.episode_id) {
						return false;
					}
				}
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => {
				let context = await this.getShowContext(show);
				if (is.absent(seasonIndex)) {
					let indices = utils.getNextEpisode(context);
					seasonIndex = indices?.seasonIndex;
					episodeIndex = indices?.episodeIndex;
				}
				this.player.playShow(context, seasonIndex, episodeIndex);
			}
		});
	}

	forTrack(track: api.Track): xnode.XElement {
		let isContext = observables.computed((context, currentEntry) => {
			if (!ContextTrack.is(context) || !ContextTrack.is(currentEntry)) {
				return false;
			}
			if (context.track_id !== track.track_id) {
				return false;
			}
			return true;
		}, this.player.context, this.player.currentEntry);
		return this.make(isContext, {
			play: async () => this.player.playTrack(await this.getTrackContext(track))
		});
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
