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

	constructor(player: context.client.ContextClient, iconFactory: IconFactory) {
		this.player = player;
		this.iconFactory = iconFactory;
	}

	forEntity(entity: api.Album | api.Artist | api.Episode | api.Movie | api.Show | api.Track): xnode.XElement {
		if (api.Album.is(entity)) {
			return this.forAlbum(entity);
		}
		return xnode.element("div");
		//throw `Expected code to be unreachable!`;
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

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
