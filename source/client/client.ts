import * as api_response from "../api/api_response";
import * as languages from "../languages";
import * as session from "./browserMediaSession";
import { ArrayObservable, computed, ObservableClass } from "../observers";
import * as client from "../player/client";
import * as is from "../is";
import {  ContextAlbum, ContextArtist, Device } from "../player/schema/objects";
import { Album, Artist, Cue, Disc, Entity, Episode, Movie, Person, Playlist, Season, Show, Track, User } from "../api/schema/objects";
import * as xml from "../xnode";
import { formatDuration as format_duration } from "../ui/metadata";
import * as apischema from "../api/schema";

import { EntityTitleFactory } from "../ui/EntityTitleFactory";
import { GridFactory } from "../ui/Grid";
import { CarouselFactory } from "../ui/CarouselFactory";
import { IconFactory } from "../ui/Icon";
import { ImageBoxFactory } from "../ui/ImageBox";
import { EntityLinkFactory } from "../ui/EntityLink";
import { EntityCardFactory } from "../ui/EntityCard";
import { EntityRowFactory } from "../ui/EntityRow";
import { PlaybackButtonFactory } from "../ui/PlaybackButton";
import { EntityNavLinkFactory } from "../ui/EntityNavLinkFactory";
import { PlaylistsClient } from "../playlists/client";
import { encode } from "../database/vtt/vtt";











function makeUrl(tail: string): string {
	let path = `/sockets/${tail}`;
	let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	let host = window.location.host;
	return `${protocol}//${host}${path}`;
}

let player = new client.ContextClient(makeUrl(`context/?type=browser&name=Orbit`));
let playlists = new PlaylistsClient(makeUrl(`playlists/`));

window.addEventListener("focus", () => {
	if (!player.isOnline.getState()) {
		player.reconnect();
	}
	if (!playlists.isOnline()) {
		playlists.reconnect();
	}
	req<{}, {}>("/discover", {}, () => {});
});

window.addEventListener("keydown", (event) => {
	if (event.code === "Space") {
		if (event.target instanceof HTMLInputElement) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		player.toggle();
	} else if (event.code === "Escape") {
		event.preventDefault();
		event.stopPropagation();
		showDevices.updateState(false);
		showContextMenu.updateState(false);
	}
});

let lastVideo = document.createElement("video");
let currentVideo = document.createElement("video");
let nextVideo = document.createElement("video");
currentVideo.addEventListener("ended", () => {
	player.next();
});
let isLoading = new ObservableClass(true);
currentVideo.addEventListener("loadeddata", () => {
	isLoading.updateState(false);
});
currentVideo.addEventListener("playing", () => {
	player.isCurrentEntryVideo.updateState(currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0);
});
{
	let computer = async () => {
		if (!isLoading.getState()) {
			currentVideo.currentTime = player.progress.getState() ?? 0;
		}
	};
	player.progress.addObserver(computer);
	isLoading.addObserver(computer);
}
{
	let computer = async () => {
		if (!isLoading.getState()) {
			if (player.playback.getState()) {
				try {
					await currentVideo.play();
				} catch (error) {}
			} else {
				currentVideo.pause();
			}
		}
	};
	player.playback.addObserver(computer);
	isLoading.addObserver(computer);
}
{
	let computer = () => {
		let canPlayLast = player.canPlayLast.getState();
		let canPlayCurrent = player.canPlayCurrent.getState();
		let canPlayNext = player.canPlayNext.getState();
		session.setHandlers({
			play: canPlayCurrent ? player.resume.bind(player) : undefined,
			pause: canPlayCurrent ? player.pause.bind(player) : undefined,
			previoustrack: canPlayLast ? player.last.bind(player) : undefined,
			nexttrack: canPlayNext ? player.next.bind(player) : undefined
		});
	};
	player.canPlayLast.addObserver(computer);
	player.canPlayCurrent.addObserver(computer);
	player.canPlayNext.addObserver(computer);
}
let mediaPlayerTitle = new ObservableClass("");
let mediaPlayerSubtitle = new ObservableClass("");
player.currentEntry.addObserver((currentEntry) => {
	if (is.present(currentEntry)) {
		if (Episode.is(currentEntry)) {
			let episode = currentEntry;
			let season = episode.season;
			let show = season.show;
			mediaPlayerTitle.updateState(episode.title);
			mediaPlayerSubtitle.updateState(show.title);
			session.setMetadata({
				title: episode.title
			});
		} else if (Movie.is(currentEntry)) {
			let movie = currentEntry;
			mediaPlayerTitle.updateState(movie.title);
			mediaPlayerSubtitle.updateState("");
			session.setMetadata({
				title: movie.title,
				artwork: movie.artwork.map((image) => ({
					src: `/files/${image.file_id}/?token=${token}`,
					sizes: `${image.width}x${image.height}`,
					type: image.mime
				}))
			});
		} else if (Track.is(currentEntry)) {
			let track = currentEntry;
			let disc = track.disc;
			let album = disc.album;
			mediaPlayerTitle.updateState(track.title);
			mediaPlayerSubtitle.updateState(track.artists.map((artist) => artist.title).join(" \u00b7 "));
			session.setMetadata({
				title: track.title,
				artist: track.artists.map((artist) => artist.title).join(" \u00b7 "),
				album: album.title,
				artwork: album.artwork.map((image) => ({
					src: `/files/${image.file_id}/?token=${token}`,
					sizes: `${image.width}x${image.height}`,
					type: image.mime
				}))
			});
		} else {
			throw `Expected code to be unreachable!`;
		}
	} else {
		mediaPlayerTitle.updateState("");
		mediaPlayerSubtitle.updateState("");
		session.setMetadata({});
	}
});
{
	let computer = () => {
		let lastLocalEntry = player.lastLocalEntry.getState();
		let token = player.token.getState();
		if (is.absent(lastLocalEntry) || is.absent(token)) {
			lastVideo.src = ``;
			return;
		} else {
			lastVideo.src = `/files/${lastLocalEntry.media.file_id}/?token=${token}`;
		}
	};
	player.lastLocalEntry.addObserver(computer);
	player.token.addObserver(computer);
}
{
	let computer = () => {
		isLoading.updateState(true);
		let currentLocalEntry = player.currentLocalEntry.getState();
		let token = player.token.getState();
		if (is.absent(currentLocalEntry) || is.absent(token)) {
			currentVideo.src = ``;
			return;
		} else {
			currentVideo.src = `/files/${currentLocalEntry.media.file_id}/?token=${token}`;
			currentVideo.load();
		}
		while (currentVideo.lastChild != null) {
			currentVideo.removeChild(currentVideo.lastChild);
		}
		if (Movie.is(currentLocalEntry) || Episode.is(currentLocalEntry)) {
			let subtitles = currentLocalEntry.subtitles;
			let defaultSubtitle = subtitles.find((subtitle) => subtitle.language === "swe") ?? subtitles.find((subtitle) => subtitle.language === "eng") ?? subtitles.find((subtitle) => true);
			for (let subtitle of subtitles) {
				let element = document.createElement("track");
				element.src = `/files/${subtitle.file_id}/?token=${token}`;
				if (is.present(subtitle.language)) {
					let language = languages.db[subtitle.language];
					if (is.present(language)) {
						element.label = language.title;
						element.srclang = language.iso639_1;
						element.kind = "subtitles";
					}
				}
				if (subtitle === defaultSubtitle) {
					element.setAttribute("default", "");
				}
				currentVideo.appendChild(element);
			}
		}
	};
	player.currentLocalEntry.addObserver(computer);
	player.token.addObserver(computer);
}
{
	let computer = () => {
		let nextLocalEntry = player.nextLocalEntry.getState();
		let token = player.token.getState();
		if (is.absent(nextLocalEntry) || is.absent(token)) {
			lastVideo.src = ``;
			return;
		} else {
			lastVideo.src = `/files/${nextLocalEntry.media.file_id}/?token=${token}`;
		}
	};
	player.nextLocalEntry.addObserver(computer);
	player.token.addObserver(computer);
}










const tokenobs = new ObservableClass(localStorage.getItem("token") ?? undefined);
const contextMenuEntity = new ObservableClass(undefined as apischema.objects.EntityBase | undefined);
const showContextMenu = new ObservableClass(false);
const contextMenuItems = new ArrayObservable(new Array<xml.XElement>());
contextMenuEntity.addObserver((contextMenuEntity) => {
	if (apischema.objects.Track.is(contextMenuEntity)) {
		let title = new ObservableClass("");
		let canCreate = computed((title) => {
			if (title === "") {
				return false;
			}
			return true;
		}, title);
		let doCreate = async () => {
			if (canCreate.getState()) {
				let playlist = await playlists.createPlaylist({
					playlist: {
						title: title.getState(),
						description:  ""
					}
				});
				if (playlist.errors.length > 0) {
					return;
				}
				let playlist_item = await playlists.createPlaylistItem({
					playlist_item: {
						playlist_id: playlist.playlist_id,
						track_id: contextMenuEntity.track_id
					}
				});
				if (playlist_item.errors.length > 0) {
					return;
				}
				showContextMenu.updateState(false);
			}
		};
		contextMenuItems.update([
			xml.element("div")
				.set("style", "align-items: center; display: grid; gap: 16px; grid-template-columns: 1fr min-content;")
				.add(renderTextHeader(xml.text("Add to playlist")))
				.add(makeButton()
					.on("click", () => {
						showContextMenu.updateState(false);
					})
					.add(Icon.makeCross())
				),
			EntityRow.forTrack(contextMenuEntity),
			xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.add(xml.element("div")
					.set("style", "position: relative;")
					.add(xml.element("input")
						.bind2("value", title)
						.set("type", "text")
						.set("spellcheck", "false")
						.set("placeholder", "Playlist title")
						.on("keyup", async (event) => {
							if (event.code === "Enter") {
								await doCreate();
							}
						})
					)
					.add(Icon.makeStar()
						.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
					)
				)
				.add(xml.element("button")
					.bind2("data-enabled", computed((canCreate) => "" + canCreate, canCreate))
					.add(xml.text("New playlist"))
					.on("click", async () => {
						await doCreate();
					})
				),
			xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.bind("data-hide", playlists.playlists.compute((playlists) => playlists.length === 0))
				.repeat(playlists.playlists, (playlist) => xml.element("div")
					.set("style", "align-items: center; cursor: pointer; display: grid; fill: rgb(255, 255, 255); gap: 16px; grid-template-columns: min-content 1fr;")
					.on("click", async () => {
						let playlist_item = await playlists.createPlaylistItem({
							playlist_item: {
								playlist_id: playlist.getState().playlist_id,
								track_id: contextMenuEntity.track_id
							}
						});
						if (playlist_item.errors.length > 0) {
							return;
						}
						showContextMenu.updateState(false);
					})
					.add(Icon.makeChevron())
					.add(renderTextHeader(xml.text(playlist.getState().title)))
				)
		]);
		showContextMenu.updateState(true);
	} else {
		showContextMenu.updateState(false);
	}
});

const Grid = new GridFactory();
document.head.appendChild(GridFactory.makeStyle().render())

const Icon = new IconFactory();
document.head.appendChild(IconFactory.makeStyle().render())

const carouselFactory = new CarouselFactory(Icon);
document.head.appendChild(CarouselFactory.makeStyle().render())

const PlaybackButton = new PlaybackButtonFactory(player, Icon);
document.head.appendChild(PlaybackButtonFactory.makeStyle().render())

const ImageBox = new ImageBoxFactory(tokenobs);
document.head.appendChild(ImageBoxFactory.makeStyle().render())

const EntityLink = new EntityLinkFactory(navigate, contextMenuEntity);
document.head.appendChild(EntityLinkFactory.makeStyle().render())

const entityTitleFactory = new EntityTitleFactory(EntityLink);
document.head.appendChild(EntityTitleFactory.makeStyle().render())

const EntityCard = new EntityCardFactory(entityTitleFactory, EntityLink, ImageBox, PlaybackButton);
document.head.appendChild(EntityCardFactory.makeStyle().render())

const EntityRow = new EntityRowFactory(entityTitleFactory, EntityLink, ImageBox, PlaybackButton);
document.head.appendChild(EntityRowFactory.makeStyle().render())

const entityNavLinkFactory = new EntityNavLinkFactory(Icon, EntityLink);
document.head.appendChild(EntityNavLinkFactory.makeStyle().render())
























const ACCENT_COLOR = "rgb(223, 79, 127)";
let style = document.createElement('style');
style.innerText = `
	::-webkit-scrollbar {
		background-color: transparent;
		height: 8px;
		width: 8px;
	}

	::-webkit-scrollbar-corner {
		background-color: transparent;
	}

	::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.125);
		border-radius: 4px;
	}

	* {
		border: none;
		font-size: 0px;
		margin: 0px;
		line-height: 1;
		outline: none;
		padding: 0px;
	}

	a,
	span {
		color: inherit;
		font-size: inherit;
	}

	a {
		text-decoration: none;
		transition: color 0.125s;
	}

	@media (hover: hover) and (pointer: fine) {
		a:hover {
			color: rgb(255, 255, 255);
		}
	}

	html {
		height: 100%;
	}

	body {
		height: 100%;
	}

	.page-header {
		background-color: ${ACCENT_COLOR};
	}

	.page-header__title {
		color: rgb(255, 255, 255);
		cursor: pointer;
		font-family: "Pacifico", cursive;
		font-size: 32px;
		transform-origin: left;
		transition: transform 0.125s;
		white-space: nowrap;
	}

	@media (hover: hover) and (pointer: fine) {
		.page-header__title:hover {
			transform: scale(1.25);
		}
	}

	[data-hide="true"] {
		display: none !important;
	}

	body {
		background-color: ${ACCENT_COLOR};
		color: rgb(255, 255, 255);
		font-family: "Nunito", sans-serif;
		overflow: hidden;
		touch-callout: none;
			-webkit-touch-callout: none;
			-moz-touch-callout: none;
			-ms-touch-callout: none;
			-o-touch-callout: none;
		user-select: none;
			-webkit-user-select: none;
			-moz-user-select: none;
			-ms-user-select: none;
			-o-user-select: none;
	}

	body ::selection {
		background-color: ${ACCENT_COLOR};
		color: rgb(255, 255, 255);
	}

	button {
		background-color: ${ACCENT_COLOR};
		border-radius: 64px;
		color: rgb(255, 255, 255);
		cursor: pointer;
		font-size: 16px;
		padding: 8px 16px;
		transition: background-color 0.125s, color 0.125s;
	}

	button[data-enabled="false"] {
		background-color: rgb(79, 79, 79);
		color: rgb(159, 159, 159);
		cursor: default;
	}

	@media (hover: hover) and (pointer: fine) {
		button:not([data-enabled="false"]):hover {
			background-color: rgb(255, 255, 255);
			color: rgb(31, 31, 31);
		}

		button:active {
			transform: none;
		}
	}

	input {
		background-color: rgb(47, 47, 47);
		border-radius: 64px;
		box-sizing: border-box;
		color: rgb(255, 255, 255);
		font-size: 16px;
		padding: 8px 16px 8px 32px;
		width: 100%;
	}















	.slider-widget {
		padding: 4px;
	}

	.slider-widget__indicator {
		padding: 4px;
		border-radius: 4px;
		background-color: rgb(31, 31, 31);
	}

	.slider-widget__knob-wrapper {
		position: relative;
	}

	.slider-widget__knob {
		box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.5);
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: rgb(255, 255, 255);
		position: absolute;
		top: 0%;
		left: 0%;
		margin-top: -8px;
		margin-left: -8px;
	}



























	.content {
		box-sizing: border-box;
		display: grid;
		gap: 48px;
		margin: 0px auto;
		max-width: 960px;
		padding: 24px;
	}

	.content--narrow {
		max-width: 480px;
	}












	.text-header {
		color: rgb(255, 255, 255);
		font-size: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.text-paragraph {
		color: rgb(159, 159, 159);
		font-size: 16px;
		line-height: 1.25;
		word-break: break-word;
	}












































	.login-modal {
		display: grid;
		gap: 64px;
	}

	.login-modal__form {
		display: grid;
		gap: 16px;
	}








	.modal-container {
		background-color: rgb(31, 31, 31);
		height: 100%;
		position: absolute;
		width: 100%;
		z-index: 1;
	}

	.modal-container[data-hide] {
		display: initial!important;
	}

	.modal-container[data-hide=false] {
		transform: translate(0%, -100%);
		transition: transform 0.5s;
	}

	.modal-container[data-hide=true] {
		transform: none;
		transition: none;
	}









	.device-selector {
		display: grid;
		gap: 64px;
	}

	.device-selector__devices {
		display: grid;
		gap: 16px;
	}

	.device-selector__device {
		align-items: center;
		cursor: pointer;
		display: grid;
		gap: 16px;
		grid-template-columns: min-content 1fr;
	}

	.device-selector__device-info {
		display: grid;
		gap: 8px;
	}

	.device-selector__device-name {
		color: rgb(255, 255, 255);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.device-selector__device-type {
		color: rgb(159, 159, 159);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}














	.media-player {
		display: grid;
		gap: 16px;
	}

	.media-player__top {
		align-items: center;
		display: grid;
		gap: 16px;
		grid-template-columns: 1fr min-content;
	}

	.media-player__metadata {
		cursor: pointer;
		display: grid;
		gap: 8px;
	}

	.media-player__title {
		color: rgb(255, 255, 255);
		font-size: 16px;
		height: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-player__subtitle {
		color: rgb(159, 159, 159);
		font-size: 16px;
		height: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-player__controls {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, min-content);
		grid-auto-flow: column;
	}

	.media-player__bottom {

	}

	.media-player__progress {
		cursor: pointer;
		padding: 8px 0px;
	}

	.media-player__progress-container {
		background-color: rgb(31, 31, 31);
		border-radius: 4px;
		height: 8px;
		overflow: hidden;
		position: relative;
		z-index: 1;
	}

	@keyframes progress {
		0% {
			transform: translate(-100%, 0%);
		}
		100% {
			transform: translate(0%, 0%);
		}
	}

	.media-player__progress-track {
		animation-delay: 0s;
		animation-duration: 0s;
		animation-name: progress;
		animation-play-state: paused;
		animation-timing-function: linear;
		background-color: ${ACCENT_COLOR};
		height: 100%;
		width: 100%;
		transform: translate(-100%, 0%);
		position: absolute;
		z-index: 0;
	}






	.icon-button {
		background-color: rgb(255, 255, 255);
		border-radius: 50%;
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		fill: rgb(31, 31, 31);
		max-width: fit-content;
		padding: 8px;
		transition: background-color 0.125s, transform 0.125s;
	}

	.icon-button[data-enabled="false"] {
		background-color: rgb(79, 79, 79);
		cursor: default;
	}

	.icon-button[data-active="true"] {
		background-color: ${ACCENT_COLOR};
		fill: rgb(255, 255, 255);
	}

	@media (hover: hover) and (pointer: fine) {
		.icon-button:not([data-enabled="false"]):hover {
			transform: scale(1.25);
		}

		.icon-button:active {
			transform: none;
		}
	}











	.app {
		display: grid;
		height: 100%;
		position: relative;
	}

	.app__header {
		background-color: ${ACCENT_COLOR};
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		position: absolute;
			top: 0px;
			left: 0px;
			right: 0px;
		transition: transform 0.25s;
		z-index: 1;
	}

	.app__header[data-hide=true] {
		display: initial!important;
		transform: translate(0%, -100%);
	}

	.app__content {
		background-color: rgb(31, 31, 31);
		overflow: hidden;
		padding: 64px 0px 112px 0px;
		position: relative;
		z-index: 0;
	}

	.app__navigation {
		background-color: rgb(47, 47, 47);
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		position: absolute;
			bottom: 0px;
			left: 0px;
			right: 0px;
		transition: transform 0.25s;
		z-index: 1;
	}

	.app__navigation[data-hide=true] {
		display: initial!important;
		transform: translate(0%, 100%);
	}

	.app__message-bar {
		background-color: ${ACCENT_COLOR};
	}

	.app__video {
		background-color: rgb(0, 0, 0);
		height: 100%;
		position: absolute;
		width: 100%;
	}

	.offline-indicator {
		margin: 0px auto;
		max-width: 960px;
		padding: 8px;
	}

	.offline-indicator__content {
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}





	.scroll-container {
		height: 100%;
		overflow-y: scroll;
		overflow-x: auto;
		width: 100%;
	}








	.access-token {
		display: grid;
		gap: 8px;
	}

	.access-token__title {
		color: rgb(255, 255, 255);
		font-family: "Space Mono", monospace;
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.access-token__subtitle {
		color: rgb(159, 159, 159);
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}







	.icon-link {
		background-color: rgb(47, 47, 47);
		border-radius: 2px;
		cursor: pointer;
		padding-bottom: 100%;
		position: relative;
	}

	.icon-link__content {
		height: 100%;
		position: absolute;
			top: 0%;
			left: 0%;
		width: 100%;
		display: grid;
		gap: 12px;
		align-items: center;
		justify-content: center;
		justify-items: center;
		align-content: center;
	}

	.icon-link__icon {
		fill: rgb(255, 255, 255);
		transition: fill 0.125s;
	}

	.icon-link__title {
		color: rgb(159, 159, 159);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.125s;
		white-space: nowrap;
	}

	@media (hover: hover) and (pointer: fine) {
		.icon-link:hover .icon-link__title {
			color: rgb(255, 255, 255)
		}
	}
`;
document.head.appendChild(style);


function makeIconLink(icon: xml.XElement, title: string, url: string): xml.XElement {
	return xml.element("div.icon-link")
		.add(xml.element("div.icon-link__content")
			.add(icon
				.set("class", "icon-link__icon")
				.set("width", "24px")
				.set("height", "24px")
			)
			.add(xml.element("div.icon-link__title")
				.add(xml.text(title))
			)
		)
		.on("click", () => navigate(url));
}

const makeButton = () => xml.element("div.icon-button");

interface ReqCallback<T extends api_response.ApiResponse> {
	(status: number, value: T): void;
}

let req = <T extends api_response.ApiRequest, U extends api_response.ApiResponse>(uri: string, body: T, cb: ReqCallback<U>): void => {
	let xhr = new XMLHttpRequest();
	xhr.addEventListener('readystatechange', () => {
		if (xhr.readyState === XMLHttpRequest.DONE) {
			cb(xhr.status, JSON.parse(xhr.responseText) as U);
		}
	});
	xhr.open('POST', uri, true);
	xhr.send(JSON.stringify(body));
};

function preq<T extends api_response.ApiRequest, U extends api_response.ApiResponse>(uri: string, body: T): Promise<U> {
	return new Promise((resolve, reject) => {
		req<T, U>(uri, body, (status, response) => {
			if (status >= 200 && status < 300) {
				return resolve(response);
			}
			return reject();
		});
	});
}

const showDevices = new ObservableClass(false);
player.devices.addObserver({
	onappend: () => {
		if (player.devices.getState().length < 2) {
			showDevices.updateState(false);
		}
	},
	onsplice: () => {
		if (player.devices.getState().length < 2) {
			showDevices.updateState(false);
		}
	}
});
const showVideo = new ObservableClass(false);
{
	let computer = () => {
		let isDeviceLocal = player.isDeviceLocal.getState();
		let isCurrentEntryVideo = player.isCurrentEntryVideo.getState();
		let localPlayback = player.localPlayback.getState();
		showVideo.updateState(isDeviceLocal && isCurrentEntryVideo && localPlayback);
	};
	player.isDeviceLocal.addObserver(computer);
	player.isCurrentEntryVideo.addObserver(computer);
	player.localPlayback.addObserver(computer);
}
const showModal = computed((token, showContextMenu, showDevices) => {
	if (is.absent(token)) {
		return "login";
	}
	if (showContextMenu) {
		return "context";
	}
	if (showDevices) {
		return "devices";
	}
},
tokenobs,
showContextMenu,
showDevices);

let token: string | undefined;
tokenobs.addObserver((token2) => {
	if (is.present(token2)) {
		localStorage.setItem("token", token2);
	} else {
		localStorage.removeItem("token");
	}
	token = token2;
	player.authenticate(token);
	playlists.authenticate(token);
});
async function getToken(): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		req<api_response.ApiRequest, api_response.AuthWithTokenReponse>(`/api/auth/?token=${token}`, {}, (status, response) => {
			tokenobs.updateState(response.token);
			resolve(token);
		});
	});
}
getToken().catch(() => {});

async function getNewToken(username: string, password: string): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		req<api_response.AuthRequest, api_response.AuthResponse>(`/api/auth/`, { username, password }, (status, response) => {
			tokenobs.updateState(response.token);
			resolve(token);
		});
	});
}

let mountwrapper = document.createElement('div');

let showUserInterface = new ObservableClass(true);
let appcontainer = xml.element("div.app")
	.render();
document.body.appendChild(appcontainer);

let appheader = xml.element("div.app__header")
	.bind("data-hide", showUserInterface.addObserver((showUserInterface) => !showUserInterface))
	.add(xml.element("div.content")
		.set("style", "padding: 16px")
		.add(xml.element("div.page-header__title")
			.add(xml.text("Orbit"))
			.on("click", () => {
				navigate("/");
			})
		)
	)
	.render();
appcontainer.appendChild(appheader);

mountwrapper.setAttribute("class", "app__content");
appcontainer.appendChild(mountwrapper);

let maincontent = document.createElement('div');
maincontent.setAttribute("style", "position: relative; width: 100%; height: 100%;");
mountwrapper.appendChild(maincontent);

let devicelist = new ArrayObservable<Device & {
	active: boolean,
	local: boolean
}>([]);
{
	let computer = () => {
		let devices = player.devices.getState();
		let activeDevice = player.device.getState();
		let localDevice = player.localDevice.getState();
		devicelist.update(devices.map((device) => {
			return {
				...device,
				active: activeDevice?.id === device.id,
				local: localDevice?.id === device.id
			}
		}));
	};
	player.devices.addObserver({
		onappend: computer,
		onsplice: computer
	});
	player.device.addObserver(computer);
	player.localDevice.addObserver(computer);
}

let username = new ObservableClass("");
let password = new ObservableClass("");
let canLogin = computed((username, password) => {
	if (username === "") {
		return false;
	}
	if (password === "") {
		return false;
	}
	return true;
}, username, password);
let repeat_password = new ObservableClass("");
let display_name = new ObservableClass("");
let registration_key = new ObservableClass("");
let loginErrors = new ArrayObservable(new Array<string>());
let canRegister = computed((username, password, repeat_password, display_name, registration_key) => {
	if (username === "") {
		return false;
	}
	if (password === "") {
		return false;
	}
	if (repeat_password === "") {
		return false;
	}
	if (display_name === "") {
		return false;
	}
	if (registration_key === "") {
		return false;
	}
	if (password !== repeat_password) {
		return false;
	}
	return true;
}, username, password, repeat_password, display_name, registration_key);
async function doLogin(): Promise<void> {
	if (canLogin.getState()) {
		loginErrors.update([]);
		let token = await getNewToken(username.getState(), password.getState());
		if (is.present(token)) {
			loginErrors.update([]);
		} else {
			loginErrors.update(["The login was unsuccessful! Please check your credentials and try again."]);
		}
	}
}
async function doRegister(): Promise<void> {
	if (canRegister.getState()) {
		loginErrors.update([]);
		req<apischema.messages.RegisterRequest, apischema.messages.RegisterResponse | apischema.messages.ErrorMessage>(`/api/register/`, {
			username: username.getState(),
			password: password.getState(),
			name: display_name.getState(),
			key_id: registration_key.getState()
		}, (_, response) => {
			if (apischema.messages.ErrorMessage.is(response)) {
				loginErrors.update(response.errors);
			} else {
				loginErrors.update([]);
				tokenobs.updateState(response.token);
			}
		});
	}
}
let modals = xml.element("div.modal-container")
	.bind("data-hide", showModal.addObserver(is.absent))
	.add(xml.element("div.scroll-container")
		.bind("data-hide", showModal.addObserver((showModal) => showModal !== "devices"))
		.add(xml.element("div.content.content--narrow")
			.add(xml.element("div.device-selector")
				.add(xml.element("div")
					.set("style", "align-items: center; display: grid; gap: 16px; grid-template-columns: 1fr min-content;")
					.add(renderTextHeader(xml.text("Select playback device")))
					.add(makeButton()
						.on("click", () => {
							showDevices.updateState(false);
						})
						.add(Icon.makeCross())
					)
				)
				.add(xml.element("div.device-selector__devices")
					.repeat(devicelist, (device) => xml.element("div.device-selector__device")
						.add(makeButton()
							.set("data-active", "" + device.active)
							.add(Icon.makeBroadcast())
						)
						.add(xml.element("div.device-selector__device-info")
							.add(xml.element("div.device-selector__device-name")
								.add(xml.text(device.name))
							)
							.add(xml.element("div.device-selector__device-type")
								.add(xml.text(device.local ? "Local device" : "Remote device"))
							)
						)
						.on("click", () => {
							player.transfer({
								id: device.id,
								protocol: device.protocol,
								name: device.name,
								type: device.type
							});
							showDevices.updateState(false);
						})
					)
				)
			)
		)
	)
	.add(xml.element("div.scroll-container")
		.bind("data-hide", showModal.addObserver((showModal) => showModal !== "login"))
		.add(xml.element("div.content.content--narrow")
			.add(xml.element("div.login-modal")
				.add(xml.element("div")
					.set("style", "display: grid; gap: 16px;")
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input.login-modal__username")
							.bind2("value", username)
							.set("type", "text")
							.set("spellcheck", "false")
							.set("placeholder", "Username")
						)
						.add(Icon.makePerson()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input.login-modal__password")
							.bind2("value", password)
							.set("type", "password")
							.set("spellcheck", "false")
							.set("placeholder", "Password")
							.on("keyup", async (event) => {
								if (event.code === "Enter") {
									await doLogin();
								}
							})
						)
						.add(Icon.makeLock()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input.login-modal__password")
							.bind2("value", repeat_password)
							.set("type", "password")
							.set("spellcheck", "false")
							.set("placeholder", "Repeat password")
						)
						.add(Icon.makeLock()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input.login-modal__name")
							.bind2("value", display_name)
							.set("type", "text")
							.set("spellcheck", "false")
							.set("placeholder", "Display name")
						)
						.add(Icon.makePerson()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input.login-modal__key")
							.bind2("value", registration_key)
							.set("type", "text")
							.set("spellcheck", "false")
							.set("placeholder", "Registration key")
							.on("keyup", async (event) => {
								if (event.code === "Enter") {
									await doRegister();
								}
							})
						)
						.add(Icon.makeLock()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
				)
				.add(xml.element("div")
					.set("style", "display: grid; gap: 16px;")
					.bind("data-hide", loginErrors.compute((loginErrors) => loginErrors.length === 0))
					.repeat(loginErrors, (loginError) => renderTextParagraph(xml.text(loginError)))
				)
				.add(xml.element("div")
					.set("style", "display: grid; gap: 16px;")
					.add(xml.element("button")
						.bind2("data-enabled", computed((canRegister) => "" + canRegister, canRegister))
						.add(xml.text("Register"))
						.on("click", async () => {
							await doRegister();
						})
					)
					.add(xml.element("button")
						.bind2("data-enabled", computed((canLogin) => "" + canLogin, canLogin))
						.add(xml.text("Login"))
						.on("click", async () => {
							await doLogin();
						})
					)
				)
			)
		)
	)
	.add(xml.element("div.scroll-container")
		.bind("data-hide", showModal.addObserver((showModal) => showModal !== "context"))
		.add(xml.element("div.content.content--narrow")
			.repeat(contextMenuItems, (contextMenuItem) => contextMenuItem)
		)
	);

let mount = xml.element("div.scroll-container")
	.bind("data-hide", showVideo.addObserver((showVideo) => showVideo))
	.render();
maincontent.appendChild(mount);
maincontent.appendChild(modals.render());

let mpw = xml.element("div.app__navigation")
	.bind("data-hide", showUserInterface.addObserver((showUserInterface) => !showUserInterface))
	.add(xml.element("div.app__message-bar")
		.bind("data-hide", player.isOnline.addObserver((isOnline) => isOnline))
		.add(xml.element("div.offline-indicator")
			.add(xml.element("div.offline-indicator__content")
				.add(xml.text("The application is currently offline."))
			)
		)
	)
	.render();




let progress = xml.element("div.media-player__progress");
let progresscontainer = xml.element("div.media-player__progress-container");
let progresstrack = xml.element("div.media-player__progress-track");
player.progress.addObserver(async (progress) => {
	let ref = await progresstrack.ref() as HTMLElement;
	ref.style.setProperty("animation-name", "none");
	window.requestAnimationFrame(() => {
		window.requestAnimationFrame(() => {
			ref.style.setProperty("animation-delay", `-${progress ?? 0}s`);
			ref.style.setProperty("animation-name", "progress");
		});
	});
});
player.playback.addObserver(async (playback) => {
	let ref = await progresstrack.ref() as HTMLElement;
	let state = playback ? "running" : "paused";
	ref.style.setProperty("animation-play-state", state);
});
player.currentEntry.addObserver(async (currentEntry) => {
	let ref = await progresstrack.ref() as HTMLElement;
	let duration = currentEntry?.media.duration_ms ?? 1;
	ref.style.setProperty("animation-name", "none");
	window.requestAnimationFrame(() => {
		window.requestAnimationFrame(() => {
			ref.style.setProperty("animation-duration", `${duration}ms`);
			ref.style.setProperty("animation-name", "progress");
		});
	});
});
async function progressupdate(page_x: number): Promise<void> {
	let ref = await progresscontainer.ref() as HTMLElement;
	let x = page_x - ref.offsetLeft;
	let w = ref.offsetWidth;
	let factor = Math.max(0.0, Math.min(x / w, 1.0));
	let currentEntry = player.currentEntry.getState();
	if (is.present(currentEntry)) {
		let progress = factor * currentEntry.media.duration_ms / 1000;
		player.seek(progress);
	}
}
let progressactive = false;
document.body.addEventListener("pointermove", async (event) => {
	if (progressactive) {
		await progressupdate(event.pageX);
	}
});
document.body.addEventListener("pointerup", async (event) => {
	progressactive = false;
});
document.body.addEventListener("pointerleave", async (event) => {
	progressactive = false;
});
progress
	.on("pointerdown", async (event) => {
		progressactive = true;
		await progressupdate(event.pageX);
	})
	.add(progresscontainer
		.add(progresstrack)
	);

let mp = xml.element("div.content")
	.set("style", "padding: 16px;")
	.add(xml.element("div.media-player")
		.add(xml.element("div.media-player__top")
			.add(xml.element("div.media-player__metadata")
				.add(xml.element("div.media-player__title")
					.add(xml.text(mediaPlayerTitle))
				)
				.add(xml.element("div.media-player__subtitle")
					.add(xml.text(mediaPlayerSubtitle))
				)
				.on("click", () => {
					let context = player.context.getState();
					if (is.present(context)) {
						if (Album.is(context)) {
							navigate(`audio/albums/${context.album_id}/`);
						} else if (Artist.is(context)) {
							navigate(`audio/artists/${context.artist_id}/`);
						} else if (Disc.is(context)) {
							navigate(`audio/discs/${context.disc_id}/`);
						} else if (Episode.is(context)) {
							navigate(`video/episodes/${context.episode_id}/`);
						} else if (Movie.is(context)) {
							navigate(`video/movies/${context.movie_id}/`);
						} else if (Playlist.is(context)) {
							navigate(`audio/playlists/${context.playlist_id}/`);
						} else if (Season.is(context)) {
							navigate(`video/seasons/${context.season_id}/`);
						} else if (Show.is(context)) {
							navigate(`video/shows/${context.show_id}/`);
						} else if (Track.is(context)) {
							navigate(`audio/tracks/${context.track_id}/`);
						} else {
							throw `Expected code to be unreachable!`;
						}
					}
				})
			)
			.add(xml.element("div.media-player__controls")
				.add(makeButton()
					.bind("data-hide", player.devices.compute((devices) => {
						return devices.length < 2;
					}))
					.add(Icon.makeBroadcast())
					.on("click", () => {
						showDevices.updateState(!showDevices.getState());
					})
				)
				.add(makeButton()
					.bind("data-enabled", player.canPlayLast.addObserver(a => a))
					.add(Icon.makeLast())
					.on("click", () => {
						player.last();
					})
				)
				.add(makeButton()
					.bind("data-enabled", player.canPlayCurrent.addObserver(a => a))
					.add(Icon.makePlay()
						.bind("data-hide", player.playback.addObserver((playback) => {
							return playback === true;
						}))
					)
					.add(Icon.makePause()
						.bind("data-hide", player.playback.addObserver((playback) => {
							return playback === false;
						}))
					)
					.on("click", () => {
						player.toggle();
					})
				)
				.add(makeButton()
					.bind("data-enabled", player.canPlayNext.addObserver(a => a))
					.add(Icon.makeNext())
					.on("click", () => {
						player.next();
					})
				)
			)
		)
		.add(xml.element("div.media-player__bottom")
			.add(progress)
		)
	)
	.render();
appcontainer.appendChild(mpw);
mpw.appendChild(mp);

currentVideo.setAttribute('playsinline', '');
currentVideo.setAttribute("preload", "auto");
currentVideo.style.setProperty('height', '100%');
currentVideo.style.setProperty('width', '100%');
lastVideo.setAttribute("preload", "auto");
lastVideo.style.setProperty("display", "none");
nextVideo.setAttribute("preload", "auto");
nextVideo.style.setProperty("display", "none");

currentVideo.addEventListener("click", () => {
	player.pause();
});

showVideo.addObserver((showVideo) => {
	if (showVideo) {
		showUserInterface.updateState(false);
	} else {
		showUserInterface.updateState(true);
	}
});

let videowrapper = xml.element("div.app__video")
	.bind("data-hide", showVideo.addObserver((showVideo) => {
		return !showVideo;
	}))
	.render();

appcontainer.appendChild(videowrapper);
videowrapper.appendChild(currentVideo);
videowrapper.appendChild(lastVideo);
videowrapper.appendChild(nextVideo);




/*
let slider_wrapper = document.createElement("div");
slider_wrapper.classList.add("slider-widget");
let slider_indicator = document.createElement("div");
slider_indicator.classList.add("slider-widget__indicator");
let slider_knob_wrapper = document.createElement("div");
slider_knob_wrapper.classList.add("slider-widget__knob-wrapper");
let slider_knob = document.createElement("div");
slider_knob.classList.add("slider-widget__knob");

slider_knob_wrapper.appendChild(slider_knob);
slider_indicator.appendChild(slider_knob_wrapper);
slider_wrapper.appendChild(slider_indicator);
chromecast.appendChild(slider_wrapper);
{
	let percentage = 0.0;
	function update(event: MouseEvent): void {
		let rect = slider_knob_wrapper.getBoundingClientRect();
		let x = event.pageX;
		let factor = Math.max(0.0, Math.min((x - rect.x) / rect.width, 1.0));
		percentage = factor * 100.0;
		slider_knob.style.setProperty("left", `${percentage}%`);
	}
	function detach(event: MouseEvent) {
		window.removeEventListener("mousemove", update);
		window.removeEventListener("mouseup", detach);
		req(`/api/cc/seek/`, { percentage: percentage, token: token }, () => {});
	}
	function attach(event: MouseEvent) {
		window.addEventListener("mousemove", update);
		window.addEventListener("mouseup", detach);
		update(event);
	}
	slider_wrapper.addEventListener("mousedown", attach);
}
*/

function renderTextHeader(content: xml.XNode<any>) {
	return xml.element("div.text-header")
		.add(content);
}
function renderTextParagraph(content: xml.XNode<any>) {
	return xml.element("div.text-paragraph")
		.add(content);
}

function observe(element: xml.XElement, handler: () => Promise<void>): xml.XElement {
	element.ref().then((element) => {
		let observer = new IntersectionObserver(async (entries) => {
			for (let entry of entries) {
				if (entry.target === element && entry.isIntersecting) {
					await handler();
				}
			}
		});
		observer.observe(element);
	});
	return element;
}

let updateviewforuri = (uri: string): void => {
	let parts: RegExpExecArray | null;
	if (false) {
	} else if ((parts = /^audio[/]tracks[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let track_id = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let playlists = new ArrayObservable<Playlist>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.TrackPlaylistsResponse>(`/api/audio/tracks/${track_id}/playlists/?offset=${offset}&token=${token}`, {});
				for (let playlist of response.playlists) {
					playlists.append(playlist);
				}
				offset += response.playlists.length;
				if (response.playlists.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		}
		req<{}, api_response.TrackResponse>(`/api/audio/tracks/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let track = response.track;
			let last = response.last;
			let next = response.next;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forTrack(track, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.add(entityNavLinkFactory.forTrack(last, next))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.add(renderTextHeader(xml.text("Appearances")))
					.bind("data-hide", playlists.compute((playlists) => playlists.length === 0))
					.add(Grid.make()
						.repeat(playlists, (playlist) => EntityCard.forPlaylist(playlist))
					)
				)
				.add(observe(xml.element("div").set("style", "height: 1px;"), load))
				.render()
			);
		});
	} else if ((parts = /^audio[/]tracks[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let tracks = new ArrayObservable<Track>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.TracksResponse>(`/api/audio/tracks/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let track of response.tracks) {
					tracks.append(track);
				}
				offset += response.tracks.length;
				if (response.tracks.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Tracks")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(tracks, (track) => EntityCard.forTrack(track))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^video[/]seasons[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		req<{}, api_response.SeasonResponse>(`/api/video/seasons/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let season = response.season;
			let last = response.last;
			let next = response.next;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forSeason(season, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.add(...season.episodes.map((episode, episodeIndex) => {
						return EntityCard.forEpisode(episode, {
							playbackButton: PlaybackButton.forSeason(season, episodeIndex)
						});
					}))
				)
				.add(xml.element("div.content")
					.add(entityNavLinkFactory.forSeason(last, next))
				)
				.render());
		});
	} else if ((parts = /^video[/]seasons[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let seasons = new ArrayObservable<Season>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.SeasonsResponse>(`/api/video/seasons/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let season of response.seasons) {
					seasons.append(season);
				}
				offset += response.seasons.length;
				if (response.seasons.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Seasons")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(seasons, (season) => EntityRow.forSeason(season))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^audio[/]discs[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		req<{}, api_response.DiscResponse>(`/api/audio/discs/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let disc = response.disc;
			let last = response.last;
			let next = response.next;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forDisc(disc, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 16px;")
					.add(...disc.tracks.map((track, trackIndex) => {
						return EntityRow.forTrack(track, PlaybackButton.forDisc(disc, trackIndex));
					}))
				)
				.add(xml.element("div.content")
					.add(entityNavLinkFactory.forDisc(last, next))
				)
				.render());
		});
	} else if ((parts = /^audio[/]discs[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let discs = new ArrayObservable<Disc>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.DiscsResponse>(`/api/audio/discs/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let disc of response.discs) {
					discs.append(disc);
				}
				offset += response.discs.length;
				if (response.discs.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Discs")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(discs, (disc) => EntityRow.forDisc(disc))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^users[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		req<{}, api_response.UserResponse>(`/api/users/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let user = response.user;
			let playlists = response.playlists;
			mount.appendChild(xml.element("div.content")
				.set("style", "display: grid; gap: 64px;")
				.add(renderTextHeader(xml.text(user.name)))
				.add(xml.element("div")
					.set("data-hide", `${playlists.length === 0}`)
					.set("style", "display: grid; gap: 24px;")
					.add(Grid.make()
						.add(...playlists.map((playlist) => EntityCard.forPlaylist(playlist)))
					)
				)
				.render());
		});
	} else if ((parts = /^users[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let users = new ArrayObservable<User>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.UsersResponse>(`/api/users/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let user of response.users) {
					users.append(user);
				}
				offset += response.users.length;
				if (response.users.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Users")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(users, (user) => EntityRow.forUser(user))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^persons[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let person_id = parts[1];
		req<{}, api_response.PersonResponse>(`/api/persons/${person_id}/?token=${token}`, {}, (_, response) => {
			let person = response.person;
			req<{}, api_response.PersonShowsResponse>(`/api/persons/${person_id}/shows/?token=${token}`, {}, (_, response) => {
				let shows = response.shows;
				req<{}, api_response.PersonMoviesResponse>(`/api/persons/${person_id}/movies/?token=${token}`, {}, (_, response) => {
					let movies = response.movies;
					mount.appendChild(xml.element("div.content")
						.set("style", "display: grid; gap: 64px;")
						.add(renderTextHeader(xml.text(person.name)))
						.add(xml.element("div")
							.set("style", "display: grid; gap: 24px;")
							.set("data-hide", `${shows.length === 0}`)
							.add(renderTextHeader(xml.text("Shows")))
							.add(carouselFactory.make(...shows.map((show) => EntityCard.forShow(show))))
						)
						.add(xml.element("div")
							.set("style", "display: grid; gap: 24px;")
							.set("data-hide", `${movies.length === 0}`)
							.add(renderTextHeader(xml.text("Movies")))
							.add(Grid.make()
								.add(...movies.map((movie) => EntityCard.forMovie(movie)))
							)
						)
						.render());
				});
			});
		});
	} else if ((parts = /^persons[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let persons = new ArrayObservable<Person>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.PersonsResponse>(`/api/persons/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let person of response.persons) {
					persons.append(person);
				}
				offset += response.persons.length;
				if (response.persons.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Persons")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(persons, (person) => EntityRow.forPerson(person))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^audio[/]albums[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AlbumResponse>(`/api/audio/albums/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let album = response.album;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forAlbum(album, { compactDescription: false }))
				)
				.add(...album.discs.map((disc, discIndex) => xml.element("div.content")
					.set("style", "display: grid; gap: 16px;")
					.add(renderTextHeader(xml.text(`Disc ${disc.number}`)))
					.add(...disc.tracks.map((track, trackIndex) => {
						return EntityRow.forTrack(track, PlaybackButton.forAlbum(album, discIndex, trackIndex));
					})))
				)
				.render());
		});
	} else if ((parts = /^audio[/]albums[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let albums = new ArrayObservable<Album>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.AlbumsResponse>(`/api/audio/albums/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let album of response.albums) {
					albums.append(album);
				}
				offset += response.albums.length;
				if (response.albums.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Albums")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(albums, (album) => EntityCard.forAlbum(album))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^audio[/]artists[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ArtistResponse>(`/api/audio/artists/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let artist = response.artist;
			let tracks = response.tracks;
			let appearances = response.appearances;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forArtist(artist, { compactDescription: false }))
				)
				.add(tracks.length === 0 ? undefined : xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.add(renderTextHeader(xml.text("Popular tracks")))
					.add(xml.element("div")
						.set("style", "display: grid; gap: 16px;")
						.add(...tracks.map((track) => {
							return EntityRow.forTrack(track);
						}))
					)
				)
				.add(artist.albums.length === 0 ? undefined : xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.add(renderTextHeader(xml.text("Discography")))
					.add(Grid.make()
						.add(...artist.albums.map((album, albumIndex) => {
							return EntityCard.forAlbum(album, {
								playbackButton: PlaybackButton.forArtist(artist, albumIndex)
							});
						}))
					)
				)
				.add(appearances.length === 0 ? undefined : xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.add(renderTextHeader(xml.text("Appearances")))
					.add(Grid.make()
						.add(...appearances.map((album) => {
							return EntityCard.forAlbum(album);
						}))
					)
				)
				.render());
		});
	} else if ((parts = /^audio[/]artists[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let artists = new ArrayObservable<Artist>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<api_response.ApiRequest, api_response.ArtistsResponse>(`/api/audio/artists/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let artist of response.artists) {
					artists.append(artist);
				}
				offset += response.artists.length;
				if (response.artists.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		}
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Artists")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(artists, (artist) => EntityCard.forArtist(artist))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render());
	} else if ((parts = /^audio[/]playlists[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let playlist_id = parts[1];
		req<api_response.ApiRequest, api_response.PlaylistResponse>(`/api/audio/playlists/${playlist_id}/?token=${token}`, {}, async (status, response) => {
			let playlist = response.playlist;
			let canEdit = (await playlists.getPermissions({
				playlist: {
					playlist_id
				}
			})).permissions === "write";
			let title = new ObservableClass(playlist.title);
			let description = new ObservableClass(playlist.description);
			let canModify = computed((title) => {
				if (title === "") {
					return false;
				}
				return true;
			}, title);
			let doUpdate = async () => {
				if (canModify.getState()) {
					let response = await playlists.updatePlaylist({
						playlist: {
							playlist_id: playlist_id,
							title: title.getState(),
							description: description.getState()
						}
					});
					if (response.errors.length > 0) {
						return;
					}
					navigate(uri);
				}
			};
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forPlaylist(playlist, { compactDescription: false }))
				)
				.add(xml.element("div.content.content--compact")
					.set("style", "display: grid; gap: 16px;")
					.set("data-hide", `${!canEdit}`)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input")
							.bind2("value", title)
							.set("type", "text")
							.set("spellcheck", "false")
							.set("placeholder", "Playlist title")
						)
						.add(Icon.makeStar()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input")
							.bind2("value", description)
							.set("type", "text")
							.set("spellcheck", "false")
							.set("placeholder", "Playlist description")
						)
						.add(Icon.makeStar()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("button")
						.bind2("data-enabled", computed((canUpdate) => "" + canUpdate, canModify))
						.add(xml.text("Update playlist"))
						.on("click", async () => {
							await doUpdate();
						})
					)
				)
				.add(playlist.items.length === 0 ? undefined : xml.element("div.content")
					.set("style", "display: grid; gap: 16px;")
					.add(...playlist.items.map((item, itemIndex) => xml.element("div")
						.set("style", "align-items: center; display: grid; grid-template-columns: 1fr min-content; gap: 16px;")
						.add(EntityRow.forTrack(item.track, PlaybackButton.forPlaylist(playlist, itemIndex)))
						.add(makeButton()
							.set("data-hide", `${!canEdit}`)
							.on("click", async () => {
								if (canModify.getState()) {
									let response = await playlists.deletePlaylistItem({
										playlist_item: {
											playlist_item_id: item.playlist_item_id
										}
									});
									if (response.errors.length > 0) {
										return;
									}
									navigate(uri);
								}
							})
							.add(Icon.makeMinus())
						)
					))
				)
				.add(xml.element("div.content.content--compact")
					.set("style", "display: grid; gap: 16px;")
					.set("data-hide", `${!canEdit}`)
					.add(xml.element("button")
						.bind2("data-enabled", computed((canUpdate) => "" + canUpdate, canModify))
						.add(xml.text("Delete playlist"))
						.on("click", async () => {
							if (canModify.getState()) {
								let response = await playlists.deletePlaylist({
									playlist: {
										playlist_id
									}
								});
								if (response.errors.length > 0) {
									return;
								}
								navigate("");
							}
						})
					)
				)
				.render());
		});
	} else if ((parts = /^audio[/]playlists[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		req<api_response.ApiRequest, api_response.PlaylistsResponse>(`/api/audio/playlists/${encodedQuery}?token=${token}`, {}, (status, response) => {
			let playlists = response.playlists;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(renderTextHeader(xml.text("Playlists")))
				)
				.add(xml.element("div.content")
					.add(Grid.make()
						.add(...playlists.map((playlist) => EntityCard.forPlaylist(playlist)))
					)
				)
			.render());

		});
	} else if ((parts = /^audio[/]/.exec(uri)) !== null) {
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(Grid.make({ mini: true })
					.add(makeIconLink(Icon.makeDisc(), "Albums", "audio/albums/"))
					.add(makeIconLink(Icon.makePersonLine(), "Artists", "audio/artists/"))
					.add(makeIconLink(Icon.makeList(), "Playlists", "audio/playlists/"))
				)
			)
		.render());
	} else if ((parts = /^video[/]shows[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		function getNextEpisode(show: Show): undefined | { seasonIndex: number, episodeIndex: number } {
			let indices: undefined | {
				seasonIndex: number,
				episodeIndex: number;
			};
			show.seasons.forEach((season, seasonIndex) => {
				season.episodes.forEach((episode, episodeIndex) => {
					if (is.present(episode.last_stream_date)) {
						if (is.present(indices)) {
							if (episode.last_stream_date < (show.seasons[indices.seasonIndex].episodes[indices.episodeIndex].last_stream_date ?? 0)) {
								return;
							}
						}
						indices = {
							seasonIndex,
							episodeIndex
						};
					}
				});
			});
			if (is.present(indices)) {
				indices.episodeIndex += 1;
				if (indices.episodeIndex === show.seasons[indices.seasonIndex].episodes.length) {
					indices.episodeIndex = 0;
					indices.seasonIndex += 1;
					if (indices.seasonIndex === show.seasons.length) {
						indices.seasonIndex = 0;
					}
				}
			} else {
				if (show.seasons.length > 0 && show.seasons[0].episodes.length > 0) {
					indices = {
						seasonIndex: 0,
						episodeIndex: 0
					};
				}
			}
			return indices;
		}
		let show_id = parts[1];
		req<{}, api_response.ShowResponse>(`/api/video/shows/${show_id}/?token=${token}`, {}, (_, response) => {
			const show = response.show;
			const indices = getNextEpisode(show);
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forShow(show, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("data-hide", `${show.actors.length === 0}`)
					.set("style", "display: grid; gap: 16px;")
					.add(...show.actors.map((actor) => EntityRow.forPerson(actor)))
				)
				.add(is.absent(indices) ? undefined : xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.add(renderTextHeader(xml.text("Suggested episode")))
					.add(EntityCard.forEpisode(show.seasons[indices.seasonIndex].episodes[indices.episodeIndex], {
						playbackButton: PlaybackButton.forShow(show, indices.seasonIndex, indices.episodeIndex)
					}))
				)
				.add(xml.element("div.content")
					.add(Grid.make()
						.add(...show.seasons.map((season, seasonIndex) => EntityCard.forSeason(season, {
							playbackButton: PlaybackButton.forShow(show, seasonIndex)
						})))
					)
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]shows[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		req<api_response.ApiRequest, api_response.ShowsResponse>(`/api/video/shows/${encodedQuery}?token=${token}`, {}, (status, response) => {
			let shows = response.shows;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(renderTextHeader(xml.text("Shows")))
				)
				.add(xml.element("div.content")
					.add(Grid.make()
						.add(...shows.map((show) => EntityCard.forShow(show)))
					)
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]episodes[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let episode_id = parts[1];
		req<api_response.ApiRequest, api_response.EpisodeResponse>(`/api/video/episodes/${episode_id}/?token=${token}`, {}, (status, response) => {
			let episode = response.episode;
			let last = response.last;
			let next = response.next;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forEpisode(episode, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.add(entityNavLinkFactory.forEpisode(last, next))
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]episodes[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let episodes = new ArrayObservable<Episode>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.EpisodesResponse>(`/api/video/episodes/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let episode of response.episodes) {
					episodes.append(episode);
				}
				offset += response.episodes.length;
				if (response.episodes.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Episodes")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(episodes, (episode) => EntityRow.forEpisode(episode))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^video[/]movies[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let movie_id = parts[1];
		req<api_response.ApiRequest, api_response.MovieResponse>(`/api/video/movies/${movie_id}/?token=${token}`, {}, (status, response) => {
			let offset = 0;
			let reachedEnd = new ObservableClass(false);
			let isLoading = new ObservableClass(false);
			let movies = new ArrayObservable<Movie>([]);
			async function load(): Promise<void> {
				if (!reachedEnd.getState() && !isLoading.getState()) {
					isLoading.updateState(true);
					let response = await preq<{}, api_response.MovieMovieSuggestionsResponse>(`/api/video/movies/${movie_id}/suggestions/movies/?offset=${offset}&token=${token}`, {});
					for (let movie of response.movies) {
						movies.append(movie);
					}
					offset += response.movies.length;
					if (response.movies.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
				}
			};
			let movie = response.movie;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forMovie(movie, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("data-hide", `${movie.actors.length === 0}`)
					.set("style", "display: grid; gap: 16px;")
					.add(...movie.actors.map((actor) => EntityRow.forPerson(actor)))
				)
				.add(xml.element("div.content")
					.bind("data-hide", movies.compute((movies) => movies.length === 0))
					.set("style", "display: grid; gap: 16px;")
					.add(renderTextHeader(xml.text("Suggested movies")))
					.add(Grid.make()
						.repeat(movies, (movie) => EntityCard.forMovie(movie))
					)
				)
				.add(observe(xml.element("div").set("style", "height: 1px;"), load))
				.render()
			);
		});
	} else if ((parts = /^video[/]movies[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let movies = new ArrayObservable<Movie>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<api_response.ApiRequest, api_response.MoviesResponse>(`/api/video/movies/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let movie of response.movies) {
					movies.append(movie);
				}
				offset += response.movies.length;
				if (response.movies.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Movies")))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(movies, (movie) => EntityCard.forMovie(movie))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render()
		);
	} else if ((parts = /^video[/]cues[/]([^/?]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let cues = new ArrayObservable<Cue & { media: Episode | Movie }>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.CuesResponse>(`/api/video/cues/${encodedQuery}?offset=${offset}&token=${token}`, {});
				for (let cue of response.cues) {
					cues.append(cue);
				}
				offset += response.cues.length;
				if (response.cues.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		mount.appendChild(xml.element("div.content")
			.add(xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.repeat(cues, (cue) => EntityRow.forCue(cue))
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render());
	} else if ((parts = /^video[/]genres[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let genre_id = parts[1];
		req<{}, api_response.GenreResponse>(`/api/video/genres/${genre_id}/?token=${token}`, {}, (status, response) => {
			let genre = response.genre;
			req<{}, api_response.GenreShowsResponse>(`/api/video/genres/${genre_id}/shows/?token=${token}`, {}, (status, response) => {
				let shows = response.shows;
				let offset = 0;
				let reachedEnd = new ObservableClass(false);
				let isLoading = new ObservableClass(false);
				let movies = new ArrayObservable<Movie>([]);
				async function load(): Promise<void> {
					if (!reachedEnd.getState() && !isLoading.getState()) {
						isLoading.updateState(true);
						let response = await preq<{}, api_response.GenreMoviesResponse>(`/api/video/genres/${genre_id}/movies/?offset=${offset}&token=${token}`, {});
						for (let movie of response.movies) {
							movies.append(movie);
						}
						offset += response.movies.length;
						if (response.movies.length === 0) {
							reachedEnd.updateState(true);
						}
						isLoading.updateState(false);
					}
				};
				mount.appendChild(xml.element("div")
					.add(xml.element("div.content")
						.add(renderTextHeader(xml.text(genre.title)))
					)
					.add(shows.length === 0 ? undefined : xml.element("div.content")
						.set("style", "display: grid; gap: 24px;")
						.add(renderTextHeader(xml.text("Shows")))
						.add(carouselFactory.make(
							...shows.map((show) => EntityCard.forShow(show)))
						)
					)
					.add(xml.element("div.content")
						.bind("data-hide", movies.compute((movies) => movies.length === 0))
						.set("style", "display: grid; gap: 24px;")
						.add(renderTextHeader(xml.text("Movies")))
						.add(Grid.make()
							.repeat(movies, (movie) => EntityCard.forMovie(movie))
						)
					)
					.add(observe(xml.element("div").set("style", "height: 1px;"), load))
					.render()
				);
			});
		});
	} else if ((parts = /^video[/]genres[/]([^/?]*)/.exec(uri)) !== null) {
		req<{}, api_response.GenresResponse>(`/api/video/genres/?token=${token}`, {}, (status, response) => {
			let genres = response.genres;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(Grid.make({ mini: true })
						.add(...genres.map((genre) => makeIconLink(Icon.makePieChart(), genre.title, `video/genres/${genre.genre_id}/`)))
					)
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]/.exec(uri)) !== null) {
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(Grid.make({ mini: true })
					.add(makeIconLink(Icon.makeStarLine(), "Movies", "video/movies/"))
					.add(makeIconLink(Icon.makeMonitor(), "Shows", "video/shows/"))
					.add(makeIconLink(Icon.makePieChart(), "Genres", "video/genres/"))
				)
			)
		.render());
	} else if ((parts = /^search[/]([^/]*)/.exec(uri)) !== null) {
		let query = new ObservableClass(decodeURIComponent(parts[1]));
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let entities = new ArrayObservable<Entity>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await preq<{}, api_response.SearchResponse>(`/api/search/${encodeURIComponent(query.getState())}?offset=${offset}&token=${token}`, {});
				for (let entity of response.entities) {
					entities.append(entity);
				}
				offset += response.entities.length;
				if (response.entities.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		let headEntities = new ArrayObservable<Entity>([]);
		let tailEntities = new ArrayObservable<Entity>([]);
		entities.addObserver({
			onappend(entity) {
				if (headEntities.getState().length === 0) {
					headEntities.append(entity);
				} else {
					tailEntities.append(entity);
				}
			}
		});
		mount.appendChild(xml.element("div.content")
			.add(xml.element("div")
				.set("style", "position: relative;")
				.add(xml.element("input")
					.set("type", "text")
					.set("spellcheck", "false")
					.set("placeholder", "Search...")
					.bind2("value", query)
					.on("keyup", (event) => {
						if (event.code === "Enter") {
							navigate(`search/${encodeURIComponent(query.getState())}`);
						}
					})
				)
				.add(Icon.makeMagnifyingGlassLine()
					.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
				)
			)
			.add(xml.element("div")
				.set("style", "display: grid; gap: 24px;")
				.bind("data-hide", headEntities.compute((v) => v.length === 0))
				.repeat(headEntities, (entity) => EntityCard.forEntity(entity, { compactDescription: false }))
			)
			.add(xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.bind("data-hide", tailEntities.compute((v) => v.length === 0))
				.repeat(tailEntities, (entity) => EntityRow.forEntity(entity))
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render());
	} else if ((parts = /^years[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let year_id = parts[1];
		preq<{}, api_response.YearResponse>(`/api/years/${year_id}/?token=${token}`, {}).then((response) => {
			let year = response.year;
			let movies = response.movies;
			let albums = response.albums;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(renderTextHeader(xml.text(`${year.year}`)))
					.add(xml.element("div")
						.set("style", "display: grid; gap: 24px;")
						.set("data-hide", `${movies.length === 0}`)
						.add(renderTextHeader(xml.text("Movies")))
						.add(carouselFactory.make(...movies.map((movie) => EntityCard.forMovie(movie))))
					)
					.add(xml.element("div")
						.set("style", "display: grid; gap: 24px;")
						.set("data-hide", `${albums.length === 0}`)
						.add(renderTextHeader(xml.text("Albums")))
						.add(Grid.make()
							.add(...albums.map((album) => EntityCard.forAlbum(album)))
						)
					)
				)
			.render());
		});
	} else if ((parts = /^years[/]([^/]*)/.exec(uri)) !== null) {
		let encodedQuery = parts[1];
		preq<{}, api_response.YearsResponse>(`/api/years/${encodedQuery}?length=100&token=${token}`, {}).then((response) => {
			let years = response.years;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(Grid.make({ mini: true })
						.add(...years.map((year) => makeIconLink(Icon.makeCalendar(), `${year.year}`, `years/${year.year_id}/`)))
					)
				)
			.render());
		});
	} else {
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(Grid.make({ mini: true })
					.add(makeIconLink(Icon.makeMonitor(), "Watch", "video/"))
					.add(makeIconLink(Icon.makeSpeaker(), "Listen", "audio/"))
					.add(makeIconLink(Icon.makeMagnifyingGlassLine(), "Search", "search/"))
					.add(makeIconLink(Icon.makeCalendar(), "Revisit", "years/"))
				)
			)
		.render());
	}
};
let get_basehref = (): string => {
	let element = document.head.querySelector('base[href]');
	if (element !== null) {
		let attribute = element.getAttribute('href');
		if (attribute !== null) {
			return attribute;
		}
	}
	return "/";
};
let get_route = (pathname: string = window.location.pathname, basehref: string = get_basehref()): string => {
	let pn = pathname.split('/');
	let bh = basehref.split('/');
	let i = 0;
	while (i < pn.length && i < bh.length && pn[i] === bh[i]) {
		i++;
	}
	let uri = pn.slice(i).join('/');
	//return uri === '' ? './' : uri;
	return uri;
};

type CacheEntry = {
	uri: string,
	element: Element,
	x: number,
	y: number,
};
let mount_cache = new Array<CacheEntry>();
let mounted_uri: string | undefined;
function navigate(uri: string, restore_scroll: boolean = false): void {
	if (is.present(mounted_uri)) {
		let entry = mount_cache.find((entry) => entry.uri === mounted_uri);
		if (is.present(entry)) {
			mount_cache.splice(mount_cache.indexOf(entry), 1);
			entry.x = mount.scrollLeft;
			entry.y = mount.scrollTop;
		} else {
			entry = {
				uri: mounted_uri,
				element: mount.firstChild as Element,
				x: mount.scrollLeft,
				y: mount.scrollTop
			};
		}
		mount_cache.unshift(entry);
	}
	mount_cache = mount_cache.slice(0, 10);
	while (is.present(mount.lastChild)) {
		mount.lastChild.remove();
	}
	let entry = mount_cache.find((entry) => entry.uri === uri);
	if (is.present(entry)) {
		mount.appendChild(entry.element);
		if (restore_scroll) {
			mount.scrollLeft = entry.x;
			mount.scrollTop = entry.y;
		} else {
			mount.scrollLeft = 0;
			mount.scrollTop = 0;
		}
	} else {
		updateviewforuri(uri);
	}
	if (is.absent(window.history.state)) {
		window.history.replaceState({ uri }, "", uri);
	} else {
		if (uri !== window.history.state.uri) {
			window.history.pushState({ uri }, "", uri);
		}
	}
	mounted_uri = uri;
}
function setupRouting(): void {
	window.addEventListener("popstate", (event) => {
		let uri: string = event.state.uri;
		navigate(uri, true);
	});
	navigate(get_route());
}
setupRouting();
