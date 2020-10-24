import * as api from "../api/schema/objects";
import * as observables from "../simpleobs";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as is from "../is";
import * as context from "../context";
import { IconFactory } from "./Icon";

const CSS = `
	.playback-button {
		background-color: ${theme.TEXT_0};
		border-radius: 50%;
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		fill: ${theme.BACKGROUND_2};
		padding: 8px;
		transition: transform 0.1s;
	}

	@media (hover: hover) and (pointer: fine) {
		.playback-button:not([data-enabled="false"]):hover {
			transform: scale(1.25);
		}

		.playback-button:active {
			transform: none;
		}
	}
`;

interface Controller {
	play(): void;
	resume(): void;
};

export class PlaybackButtonFactory {
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
				if (isPlaying.getState()) {
					this.player.pause();
				} else {
					if (isContext.getState()) {
						controller.resume();
					} else {
						controller.play();
					}
				}
			});
	}

	constructor(player: context.client.ContextClient, iconFactory: IconFactory) {
		this.player = player;
		this.iconFactory = iconFactory;
	}

	forEntity(entity: api.Album | api.Artist | api.Disc | api.Episode | api.Movie | api.Playlist | api.Season | api.Show | api.Track): xnode.XElement {
		if (api.Album.is(entity)) {
			return this.forAlbum(entity);
		}
		if (api.Artist.is(entity)) {
			return this.forArtist(entity);
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

	forAlbum(album: api.Album, controller: Controller = {
		play: () => this.player.playAlbum(album),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 3] !== album.album_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forArtist(artist: api.Artist, controller: Controller = {
		play: () => this.player.playArtist(artist),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 4] !== artist.artist_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forDisc(disc: api.Disc, controller: Controller = {
		play: () => this.player.playDisc(disc),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== disc.disc_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forEpisode(episode: api.Episode, controller: Controller = {
		play: () => this.player.playEpisode(episode),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== episode.episode_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forMovie(movie: api.Movie, controller: Controller = {
		play: () => this.player.playMovie(movie),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== movie.movie_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forPlaylist(playlist: api.Playlist, controller: Controller = {
		play: () => this.player.playPlaylist(playlist),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== playlist.playlist_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forSeason(season: api.Season, controller: Controller = {
		play: () => this.player.playSeason(season),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== season.season_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forShow(show: api.Show, controller: Controller = {
		play: () => this.player.playShow(show),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 3] !== show.show_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	forTrack(track: api.Track, controller: Controller = {
		play: () => this.player.playTrack(track),
		resume: () => this.player.resume()
	}): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== track.track_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, controller);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
