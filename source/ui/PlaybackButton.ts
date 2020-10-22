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

export class PlaybackButtonFactory {
	private player: context.client.ContextClient;
	private iconFactory: IconFactory;

	private make(isContext: observables.ObservableClass<boolean>, play: () => void): xnode.XElement {
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
						this.player.resume();
					} else {
						play();
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

	forAlbum(album: api.Album, play: () => void = () => this.player.playAlbum(album)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 3] !== album.album_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forArtist(artist: api.Artist, play: () => void = () => this.player.playArtist(artist)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 4] !== artist.artist_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forDisc(disc: api.Disc, play: () => void = () => this.player.playDisc(disc)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== disc.disc_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forEpisode(episode: api.Episode, play: () => void = () => this.player.playEpisode(episode)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== episode.episode_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forMovie(movie: api.Movie, play: () => void = () => this.player.playMovie(movie)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== movie.movie_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forPlaylist(playlist: api.Playlist, play: () => void = () => this.player.playPlaylist(playlist)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== playlist.playlist_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forSeason(season: api.Season, play: () => void = () => this.player.playSeason(season)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== season.season_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forShow(show: api.Show, play: () => void = () => this.player.playShow(show)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 3] !== show.show_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	forTrack(track: api.Track, play: () => void = () => this.player.playTrack(track)): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== track.track_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, play);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
