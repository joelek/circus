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
		transition: transform 0.125s;
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

type Controller = () => void;

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
						this.player.resume();
					} else {
						controller();
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

	forAlbum(album: api.Album, discIndex?: number, trackIndex?: number): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 3] !== album.album_id) {
				return false;
			}
			if (is.present(discIndex)) {
				let disc = album.discs[discIndex];
				if (contextPath[contextPath.length - 2] !== disc.disc_id) {
					return false;
				}
				if (is.present(trackIndex)) {
					let track = disc.tracks[trackIndex];
					if (contextPath[contextPath.length - 1] !== track.track_id) {
						return false;
					}
				}
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playAlbum(album, discIndex, trackIndex));
	}

	forArtist(artist: api.Artist, albumIndex?: number, discIndex?: number, trackIndex?: number): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 4] !== artist.artist_id) {
				return false;
			}
			if (is.present(albumIndex)) {
				let album = artist.albums[albumIndex];
				if (contextPath[contextPath.length - 3] !== album.album_id) {
					return false;
				}
				if (is.present(discIndex)) {
					let disc = album.discs[discIndex];
					if (contextPath[contextPath.length - 2] !== disc.disc_id) {
						return false;
					}
					if (is.present(trackIndex)) {
						let track = disc.tracks[trackIndex];
						if (contextPath[contextPath.length - 1] !== track.track_id) {
							return false;
						}
					}
				}
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playArtist(artist, albumIndex, discIndex, trackIndex));
	}

	forDisc(disc: api.Disc, trackIndex?: number): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== disc.disc_id) {
				return false;
			}
			if (is.present(trackIndex)) {
				let track = disc.tracks[trackIndex];
				if (contextPath[contextPath.length - 1] !== track.track_id) {
					return false;
				}
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playDisc(disc, trackIndex));
	}

	forEpisode(episode: api.Episode): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== episode.episode_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playEpisode(episode));
	}

	forMovie(movie: api.Movie): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== movie.movie_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playMovie(movie));
	}

	forPlaylist(playlist: api.Playlist, trackIndex?: number): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== playlist.playlist_id) {
				return false;
			}
			if (is.present(trackIndex)) {
				let track = playlist.items[trackIndex].track;
				if (contextPath[contextPath.length - 1] !== track.track_id) {
					return false;
				}
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playPlaylist(playlist, trackIndex));
	}

	forSeason(season: api.Season, episodeIndex?: number): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 2] !== season.season_id) {
				return false;
			}
			if (is.present(episodeIndex)) {
				let episode = season.episodes[episodeIndex];
				if (contextPath[contextPath.length - 1] !== episode.episode_id) {
					return false;
				}
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playSeason(season, episodeIndex));
	}

	forShow(show: api.Show, seasonIndex?: number, episodeIndex?: number): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 3] !== show.show_id) {
				return false;
			}
			if (is.present(seasonIndex)) {
				let season = show.seasons[seasonIndex];
				if (contextPath[contextPath.length - 2] !== season.season_id) {
					return false;
				}
				if (is.present(episodeIndex)) {
					let episode = season.episodes[episodeIndex];
					if (contextPath[contextPath.length - 1] !== episode.episode_id) {
						return false;
					}
				}
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playShow(show, seasonIndex, episodeIndex));
	}

	forTrack(track: api.Track): xnode.XElement {
		let isContext = observables.computed((contextPath) => {
			if (!is.present(contextPath)) {
				return false;
			}
			if (contextPath[contextPath.length - 1] !== track.track_id) {
				return false;
			}
			return true;
		}, this.player.contextPath);
		return this.make(isContext, () => this.player.playTrack(track));
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
