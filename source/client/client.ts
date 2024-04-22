import * as session from "./browserMediaSession";
import { ArrayObservable, computed, ObservableClass } from "../observers";
import * as client from "../player/client";
import * as is from "../is";
import {  ContextAlbum, ContextArtist, Device } from "../player/schema/objects";
import { File, Directory, Actor, Album, Artist, Cue, Disc, Entity, Episode, Genre, Movie, Playlist, PlaylistItem, Season, Show, Track, User, Year } from "../api/schema/objects";
import * as xml from "../xnode";
import { formatDuration as format_duration, formatSize, formatTimestamp as format_timestamp } from "../ui/metadata";
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
import * as apiv2 from "../api/schema/api/client";
import * as utils from "../utils";

const apiclient = apiv2.makeClient({ urlPrefix: "/api" });
import * as autoguard from "@joelek/ts-autoguard";
import { string } from "../jdb2/asserts";
import { NumberStatistic } from "../api/schema/api";










function makeUrl(tail: string): string {
	let path = `/sockets/${tail}`;
	let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	let host = window.location.host;
	return `${protocol}//${host}${path}`;
}

let did = utils.generateHexId(16);
let player = new client.ContextClient(makeUrl(`context/?type=browser&name=Client&did=${did}`));
let playlists = new PlaylistsClient(makeUrl(`playlists/`));

window.addEventListener("focus", () => {
	if (!player.isOnline.getState()) {
		player.reconnect();
	}
	if (!playlists.isOnline()) {
		playlists.reconnect();
	}
	//req<{}, {}>("/discover", {}, () => {});
});

function hideModalMenu(): void {
	showDevices.updateState(false);
	showContextMenu.updateState(false);
	showPage.updateState(false);
	modalPageElements.update([]);
	showModal.updateState(undefined);
}

window.addEventListener("keydown", (event) => {
	if (event.code === "Space") {
		if (event.target instanceof HTMLInputElement) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		player.togglePlayback();
	} else if (event.code === "Escape") {
		event.preventDefault();
		event.stopPropagation();
		hideModalMenu();
	}
});

let lastVideo = document.createElement("video");
let currentVideo = document.createElement("video");
let nextVideo = document.createElement("video");

let unlocked = new ObservableClass(false);
let silence = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";
player.playback.addObserver(async (playback) => {
	if (!unlocked.getState() && playback) {
		currentVideo.src = silence;
		try {
			await currentVideo.play();
		} catch (error) {}
		unlocked.updateState(true);
	}
});
currentVideo.addEventListener("ended", () => {
	if (currentVideo.src !== silence) {
		player.next();
	}
});
let isLoading = new ObservableClass(true);
isLoading.addObserver((isLoading) => {
	if (!isLoading) {
		session.update();
	}
});
currentVideo.addEventListener("loadeddata", () => {
	if (currentVideo.src !== silence) {
		isLoading.updateState(false);
	}
});
currentVideo.addEventListener("playing", () => {
	if (currentVideo.src !== silence) {
		player.isCurrentEntryVideo.updateState(currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0);
	}
});
currentVideo.addEventListener("playing", () => {
	if (currentVideo.src !== silence) {
		player.setPlaying(true);
	}
});
currentVideo.addEventListener("pause", () => {
	if (currentVideo.src !== silence) {
		player.setPlaying(false);
	}
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
			play: canPlayCurrent ? player.resume.bind(player) : null,
			pause: canPlayCurrent ? player.pause.bind(player) : null,
			previoustrack: canPlayLast ? player.last.bind(player) : null,
			seekto: canPlayCurrent ? (details) => {
				player.seek(details.seekTime ?? undefined);
			} : null,
			nexttrack: canPlayNext ? player.next.bind(player) : null
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
			mediaPlayerSubtitle.updateState([ show.title, `Season ${episode.season.number}` ].join(" \u00b7 "));
			session.setMetadata({
				title: episode.title
			});
		} else if (Movie.is(currentEntry)) {
			let movie = currentEntry;
			mediaPlayerTitle.updateState(movie.title);
			mediaPlayerSubtitle.updateState(movie.genres.map((genre) => genre.title).join(" \u00b7 "));
			session.setMetadata({
				title: movie.title,
				artwork: movie.artwork.map((image) => ({
					src: `/api/files/${image.file_id}/content/?token=${token}`,
					sizes: `${image.width}x${image.height}`,
					type: image.mime
				}))
			});
		} else if (Track.is(currentEntry)) {
			let track = currentEntry;
			let disc = track.disc;
			let album = disc.album;
			mediaPlayerTitle.updateState(track.title);
			mediaPlayerSubtitle.updateState([ ...track.artists.map((artist) => artist.title), track.disc.album.title ].join(" \u00b7 "));
			session.setMetadata({
				title: track.title,
				artist: track.artists.map((artist) => artist.title).join(" \u00b7 "),
				album: album.title,
				artwork: album.artwork.map((image) => ({
					src: `/api/files/${image.file_id}/content/?token=${token}`,
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
			lastVideo.src = `/api/files/${lastLocalEntry.media.file_id}/content/?token=${token}`;
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
		while (is.present(currentVideo.lastChild)) {
			currentVideo.removeChild(currentVideo.lastChild);
		}
		if (is.absent(currentLocalEntry) || is.absent(token)) {
			currentVideo.src = ``;
			return;
		} else {
			currentVideo.src = `/api/files/${currentLocalEntry.media.file_id}/content/?token=${token}`;
			currentVideo.load();
		}
		if (Movie.is(currentLocalEntry) || Episode.is(currentLocalEntry)) {
			let subtitles = currentLocalEntry.subtitles;
			let defaultSubtitle = subtitles.find((subtitle) => subtitle.language?.iso_639_2 === "swe") ?? subtitles.find((subtitle) => subtitle.language?.iso_639_2 === "eng") ?? subtitles.find((subtitle) => true);
			for (let subtitle of subtitles) {
				let element = document.createElement("track");
				element.src = `/api/files/${subtitle.file_id}/content/?token=${token}`;
				if (is.present(subtitle.language)) {
					element.label = subtitle.language.name;
					element.srclang = subtitle.language.iso_639_1;
					element.kind = "subtitles";
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
			nextVideo.src = ``;
			return;
		} else {
			nextVideo.src = `/api/files/${nextLocalEntry.media.file_id}/content/?token=${token}`;
		}
	};
	player.nextLocalEntry.addObserver(computer);
	player.token.addObserver(computer);
}








const savedToken = new ObservableClass(localStorage.getItem("token") ?? undefined);
const verifiedToken = new ObservableClass(undefined as string | undefined);
savedToken.addObserver((savedToken) => {
	if (is.present(savedToken)) {
		localStorage.setItem("token", savedToken);
	} else {
		localStorage.removeItem("token");
	}
});
savedToken.addObserver(async (savedToken) => {
	if (is.present(savedToken)) {
		try {
			let response = await apiclient["GET:/users/<user_id>/"]({
				options: {
					user_id: "",
					token: savedToken
				}
			});
			if (response.status() === 200) {
				verifiedToken.updateState(savedToken);
				return;
			}
		} catch (error) {}
	}
	verifiedToken.updateState(undefined);
});

const contextMenuEntity = new ObservableClass(undefined as apischema.objects.Entity | apischema.objects.EntityBase | undefined);




const Grid = new GridFactory();
document.head.appendChild(GridFactory.makeStyle().render())

const Icon = new IconFactory();
document.head.appendChild(IconFactory.makeStyle().render())

const carouselFactory = new CarouselFactory(Icon);
document.head.appendChild(CarouselFactory.makeStyle().render())

const PlaybackButton = new PlaybackButtonFactory(apiclient, player, Icon);
document.head.appendChild(PlaybackButtonFactory.makeStyle().render())

const ImageBox = new ImageBoxFactory(verifiedToken);
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















const showContextMenu = new ObservableClass(false);
const contextMenuItems = new ArrayObservable(new Array<xml.XElement>());
contextMenuEntity.addObserver(async (contextMenuEntity) => {
	contextMenuItems.update([]);
	if (apischema.objects.Entity.is(contextMenuEntity)) {
		contextMenuItems.append(
			xml.element("div")
				.set("style", "align-items: center; display: grid; gap: 16px; grid-template-columns: 1fr min-content;")
				.add(renderTextHeader(xml.text("Select action")))
				.add(makeButton()
					.on("click", () => {
						showContextMenu.updateState(false);
					})
					.add(Icon.makeCross())
				)
		);
		contextMenuItems.append(EntityRow.forEntity(contextMenuEntity));
	}
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
		contextMenuItems.append(
			xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.add(xml.element("div")
					.set("style", "position: relative;")
					.add(xml.element("input")
						.bind2("value", title)
						.set("type", "text")
						.set("spellcheck", "false")
						.set("placeholder", "Title...")
						.on("keyup", async (event) => {
							if (event.code === "Enter") {
								(event.target as HTMLInputElement).blur();
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
				)
		);
		contextMenuItems.append(
			xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.bind("data-hide", playlists.playlists.compute((playlists) => playlists.length === 0))
				.repeat(playlists.playlists, (playlist) => xml.element("button")
					.add(xml.text(`Add to "${playlist.getState().title}"`))
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
				)
		);
	} else if (apischema.objects.Playlist.is(contextMenuEntity)) {
		let hasWritePermission = (await playlists.getPermissions({
			playlist: {
				playlist_id: contextMenuEntity.playlist_id
			}
		})).permissions === "write";
		let title = new ObservableClass(contextMenuEntity.title);
		let description = new ObservableClass(contextMenuEntity.description);
		let canUpdate = computed((title, description) => {
			if (title === "") {
				return false;
			}
			return true;
		}, title, description);
		let doUpdate = async () => {
			if (canUpdate.getState()) {
				let playlist = await playlists.updatePlaylist({
					playlist: {
						playlist_id: contextMenuEntity.playlist_id,
						title: title.getState(),
						description:  description.getState()
					}
				});
				if (playlist.errors.length > 0) {
					return;
				}
				showContextMenu.updateState(false);
			}
		};
		contextMenuItems.append(
			xml.element("div")
				.set("data-hide", `${!hasWritePermission}`)
				.set("style", "display: grid; gap: 16px;")
				.add(xml.element("div")
					.set("style", "position: relative;")
					.add(xml.element("input")
						.bind2("value", title)
						.set("type", "text")
						.set("spellcheck", "false")
						.set("placeholder", "Title...")
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
						.set("placeholder", "Description...")
					)
					.add(Icon.makeStar()
						.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
					)
				)
				.add(xml.element("button")
					.bind2("data-enabled", computed((canUpdate) => "" + canUpdate, canUpdate))
					.add(xml.text("Update playlist"))
					.on("click", async () => {
						await doUpdate();
					})
				)
		);
		contextMenuItems.append(
			xml.element("button")
				.add(xml.text("Delete playlist"))
				.on("click", async () => {
					let response = await playlists.deletePlaylist({
						playlist: {
							playlist_id: contextMenuEntity.playlist_id
						}
					});
					if (response.errors.length > 0) {
						return;
					}
					showContextMenu.updateState(false);
				})
		);
	} else if (apischema.objects.Movie.is(contextMenuEntity)) {
		let imdb = contextMenuEntity.imdb;
		if (is.present(imdb)) {
			contextMenuItems.append(
				xml.element("button")
					.add(xml.text("IMDB"))
					.on("click", async () => {
						window.open(`https://www.imdb.com/title/${imdb}`);
						showContextMenu.updateState(false);
					})
			);
		}
	} else if (apischema.objects.Show.is(contextMenuEntity)) {
		let imdb = contextMenuEntity.imdb;
		if (is.present(imdb)) {
			contextMenuItems.append(
				xml.element("button")
					.add(xml.text("IMDB"))
					.on("click", async () => {
						window.open(`https://www.imdb.com/title/${imdb}`);
						showContextMenu.updateState(false);
					})
			);
		}
	} else if (apischema.objects.Episode.is(contextMenuEntity)) {
		let imdb = contextMenuEntity.imdb;
		if (is.present(imdb)) {
			contextMenuItems.append(
				xml.element("button")
					.add(xml.text("IMDB"))
					.on("click", async () => {
						window.open(`https://www.imdb.com/title/${imdb}`);
						showContextMenu.updateState(false);
					})
			);
		}
	} else if (apischema.objects.Artist.is(contextMenuEntity)) {
		let tidal = contextMenuEntity.tidal;
		if (is.present(tidal)) {
			contextMenuItems.append(
				xml.element("button")
					.add(xml.text("TIDAL"))
					.on("click", async () => {
						window.open(`https://listen.tidal.com/artist/${tidal}/`);
						showContextMenu.updateState(false);
					})
			);
		}
	} else if (apischema.objects.Album.is(contextMenuEntity)) {
		let tidal = contextMenuEntity.tidal;
		if (is.present(tidal)) {
			contextMenuItems.append(
				xml.element("button")
					.add(xml.text("TIDAL"))
					.on("click", async () => {
						window.open(`https://listen.tidal.com/album/${tidal}/`);
						showContextMenu.updateState(false);
					})
			);
		}
	}
	showContextMenu.updateState(contextMenuItems.getState().length > 0);
});
























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
		align-items: center;
		display: grid;
		gap: 16px;
		grid-template-columns: 1fr auto;
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

	.page-header__controls {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, min-content);
		grid-auto-flow: column;
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
		overflow: hidden;
		padding: 8px 16px;
		text-overflow: ellipsis;
		transition: background-color 0.125s, color 0.125s;
		white-space: nowrap;
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
		max-width: 1280px;
		padding: 24px;
	}

	.content--narrow {
		max-width: 640px;
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
		gap: 48px;
	}

	.login-modal__form {
		display: grid;
		gap: 16px;
	}








	.modal-container {
		background-color: rgb(31, 31, 31);
		box-shadow: 0px 0px 8px 4px rgb(0, 0, 0, 0.25);
		height: 100%;
		position: absolute; bottom: 0px; right: 0px;
		width: min(320px, 100%);
		z-index: 1;
	}

	.modal-container[data-hide] {
		display: initial!important;
	}

	.modal-container[data-hide=false] {
		transform: none;
		transition: transform 0.5s;
	}

	.modal-container[data-hide=true] {
		transform: translate(100%, 0%);
		transition: none;
	}









	.device-selector {
		display: grid;
		gap: 48px;
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
		height: 40px;
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
		align-items: center;
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, min-content);
		grid-auto-flow: column;
	}

	.media-player__bottom {
		align-items: center;
		display: grid;
		gap: 16px;
		grid-template-columns: min-content auto min-content;
	}

	.media-player__progress {
		display: grid;
		gap: 4px;
	}

	.media-player__progress-bar {
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

	.media-player__progress-track {
		background-color: ${ACCENT_COLOR};
		height: 100%;
		width: 100%;
		position: absolute;
		transform-origin: left;
		z-index: 0;
	}

	.media-player__progress-metadata {
		color: rgb(159, 159, 159);
		font-size: 12px;
		overflow: hidden;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}





	.icon-button {
		background-color: rgb(255, 255, 255);
		border-radius: 50%;
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		fill: rgb(31, 31, 31);
		padding: 8px;
		transition: background-color 0.125s, fill 0.125s, transform 0.125s;
	}

	.icon-button[data-enabled="false"] {
		background-color: rgb(79, 79, 79);
		cursor: default;
	}

	.icon-button--flat {
		background-color: transparent!important;
		box-shadow: none;
		fill: rgb(255, 255, 255);
	}

	.icon-button--flat[data-enabled="false"] {
		fill: rgb(31, 31, 31);
	}

	.icon-button[data-active="true"] {
		background-color: ${ACCENT_COLOR};
		fill: rgb(255, 255, 255);
	}

	.icon-button--flat[data-active="false"] {
		fill: rgb(31, 31, 31);
	}

	.icon-button--flat[data-active="true"] {
		fill: ${ACCENT_COLOR};
	}

	@media (hover: hover) and (pointer: fine) {
		.icon-button:not([data-enabled="false"]):hover {
			transform: scale(1.50);
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
		padding: 64px 0px 128px 0px;
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
		max-width: 1080px;
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








	.statistic {
		display: grid;
		gap: 8px;
	}

	.statistic__title {
		color: rgb(255, 255, 255);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.statistic__subtitle {
		color: rgb(159, 159, 159);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}







	.icon-link {
		background-color: rgb(47, 47, 47);
		border-radius: 4px;
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

function makeStatistic(title: string, subtitle: string): xml.XElement {
	return xml.element("div.statistic")
		.add(xml.element("div.statistic__title")
			.add(xml.text(title))
		)
		.add(xml.element("div.statistic__subtitle")
			.add(xml.text(subtitle))
		);
}

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

function makeButton(options?: Partial<{ style: "flat" | "normal" }>): xml.XElement {
	let style = options?.style ?? "normal";
	return xml.element(`div.icon-button${style === "normal" ? "" : ".icon-button--flat"}`);
}

function makeSearchField(query: ObservableClass<string>) {
	return (
		xml.element("div")
			.set("style", "position: relative;")
			.add(xml.element("input")
				.set("type", "text")
				.set("spellcheck", "false")
				.set("placeholder", "Search...")
				.set("value", query.getState())
				.on("keyup", (event) => {
					if (event.code === "Enter") {
						(event.target as HTMLInputElement).blur();
					}
				})
				.on("change", (event) => {
					query.updateState((event.target as HTMLInputElement).value);
				})
			)
			.add(Icon.makeMagnifyingGlass()
				.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
			)
	);
};

const showPage = new ObservableClass(false);
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

const showModal = new ObservableClass(undefined as "context" | "devices" | "login" | "register" | "page" | undefined);

showContextMenu.addObserver((showContextMenu) => {
	if (showContextMenu) {
		showModal.updateState("context");
	} else {
		showModal.updateState(undefined);
	}
});

showDevices.addObserver((showDevices) => {
	if (showDevices) {
		showModal.updateState("devices");
	} else {
		showModal.updateState(undefined);
	}
});

showPage.addObserver((showPage) => {
	if (showPage) {
		showModal.updateState("page");
	} else {
		showModal.updateState(undefined);
	}
});

verifiedToken.addObserver((verifiedToken) => {
	if (is.absent(verifiedToken)) {
		showModal.updateState("login");
	} else {
		showModal.updateState(undefined);
	}
});

let token: string | undefined;
verifiedToken.addObserver((verifiedToken) => {
	token = verifiedToken;
	player.authenticate(verifiedToken);
	playlists.authenticate(verifiedToken);
});

async function getNewToken(username: string, password: string): Promise<string | undefined> {
	let response = await apiclient["POST:/auth/"]({
		headers: {
			"x-circus-username": username,
			"x-circus-password": password
		}
	});
	let headers = await response.headers();
	savedToken.updateState(headers["x-circus-token"]);
	return savedToken.getState();
}

let mountwrapper = document.createElement('div');

let showUserInterface = new ObservableClass(true);
let appcontainer = xml.element("div.app")
	.render();
document.body.appendChild(appcontainer);
let historyLength = new ObservableClass(window.history.length);
let historyIndex = new ObservableClass(window.history.length - 1);
let lastHistoryIndex = computed((historyLength, historyIndex) => {
	if (historyLength === 0) {
		return;
	}
	if (historyIndex - 1 < 0) {
		return;
	}
	return historyIndex - 1;
}, historyLength, historyIndex);
let nextHistoryIndex = computed((historyLength, historyIndex) => {
	if (historyLength === 0) {
		return;
	}
	if (historyIndex + 1 >= historyLength) {
		return;
	}
	return historyIndex + 1;
}, historyLength, historyIndex);

let appheader = xml.element("div.app__header")
	.bind("data-hide", showUserInterface.addObserver((showUserInterface) => !showUserInterface))
	.add(xml.element("div.content")
		.set("style", "padding: 16px")
		.add(xml.element("div.page-header")
			.add(xml.element("div.page-header__title")
				.add(xml.text(document.title))
				.on("click", () => {
					navigate("");
				})
			)
			.add(xml.element("div.page-header__controls")
				.add(makeButton({ style: "flat" })
					.add(Icon.makeReload()
						.set("width", "16px")
						.set("height", "16px")
					)
					.on("click", () => {
						window.location.reload();
					})
				)
				.add(makeButton({ style: "flat" })
					.bind("data-enabled", lastHistoryIndex.addObserver(is.present))
					.add(Icon.makeChevron({ direction: "left" })
						.set("width", "16px")
						.set("height", "16px")
					)
					.on("click", () => {
						if (is.present(lastHistoryIndex)) {
							window.history.back();
						}
					})
				)
				.add(makeButton({ style: "flat" })
					.bind("data-enabled", nextHistoryIndex.addObserver(is.present))
					.add(Icon.makeChevron()
						.set("width", "16px")
						.set("height", "16px")
					)
					.on("click", () => {
						if (is.present(nextHistoryIndex)) {
							window.history.forward();
						}
					})
				)
				.add(makeButton({ style: "flat" })
					.bind("data-enabled", verifiedToken.addObserver(is.present))
					.add(Icon.makeSettings()
						.set("width", "16px")
						.set("height", "16px")
					)
					.on("click", async () => {
						if (is.present(verifiedToken.getState())) {
							let user = await (await apiclient["GET:/users/<user_id>/"]({
								options: {
									user_id: "",
									token: token ?? ""
								}
							})).payload();
							let response = await apiclient["GET:/statistics/"]({
								options: {
									token: token ?? ""
								}
							});
							let payload = await response.payload();
							let modalPage = xml.element("div.content.content--narrow")
								.add(xml.element("div")
									.set("style", "align-items: center; display: grid; gap: 16px; grid-template-columns: 1fr min-content;")
									.add(renderTextHeader(xml.text("Change settings")))
									.add(makeButton()
										.on("click", () => {
											modalPageElements.update([]);
										})
										.add(Icon.makeCross())
									)
								)
								.add(EntityRow.forUser(user.user))
								.add(xml.element("button")
									.add(xml.text("Logout"))
									.on("click", async () => {
										savedToken.updateState(undefined);
									})
								)
								.add(xml.element("div")
									.set("style", "display: grid; gap: 16px;")
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
												did: device.did,
												id: device.id,
												protocol: device.protocol,
												name: device.name,
												type: device.type
											});
											modalPageElements.update([]);
										})
									)
								)
								.add(Grid.make({ mini: true })
									.add(makeIconLink(Icon.makeFolder(), "Media Root", "directories/0000000000000000/"))
								)
								.add(xml.element("div")
									.set("style", "display: grid; gap: 16px;")
									.set("data-hide", `${payload.statistics.length === 0}`)
									.add(...payload.statistics.map((statistic) => {
										let title = statistic.title;
										let subtitle = `${statistic.value}`;
										if (NumberStatistic.is(statistic)) {
											if (statistic.unit === "BYTES") {
												subtitle = formatSize(statistic.value);
											} else if (statistic.unit === "MILLISECONDS") {
												subtitle = format_duration(statistic.value);
											} else if (statistic.unit === "TIMESTAMP") {
												subtitle = format_timestamp(statistic.value);
											}
										}
										return makeStatistic(title, subtitle);
									}))
								);
							modalPageElements.update([modalPage]);
						}
					})
				)
			)
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
let canRegister = computed((username, password, repeat_password, display_name) => {
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
	if (password !== repeat_password) {
		return false;
	}
	return true;
}, username, password, repeat_password, display_name);
async function doLogin(): Promise<void> {
	if (canLogin.getState()) {
		loginErrors.update([]);
		try {
			let token = await getNewToken(username.getState(), password.getState());
			if (is.present(token)) {
				loginErrors.update([]);
				return;
			}
		} catch (error) {}
		loginErrors.update(["The login was unsuccessful! Please check your credentials and try again."]);
	}
}
async function doRegister(): Promise<void> {
	if (canRegister.getState()) {
		loginErrors.update([]);
		let response = await apiclient["POST:/users/"]({
			payload: {
				username: username.getState(),
				password: password.getState(),
				name: display_name.getState(),
				key_id: registration_key.getState()
			}
		});
		let payload = await response.payload();
		if (apischema.messages.ErrorMessage.is(payload)) {
			loginErrors.update(payload.errors);
		} else {
			loginErrors.update([]);
			savedToken.updateState(payload.token);
		}
	}
}

let modalPageElements = new ArrayObservable<xml.XElement>([]);
modalPageElements.addObserver({
	onappend: (state) => {
		showPage.updateState(modalPageElements.getState().length > 0);
	},
	onsplice: (state, index) => {
		showPage.updateState(modalPageElements.getState().length > 0);
	}
});

let modals = xml.element("div.modal-container")
	.bind("data-hide", showModal.addObserver(is.absent))
	.add(xml.element("div.scroll-container")
		.bind("data-hide", showModal.addObserver((showModal) => showModal !== "page"))
		.repeat(modalPageElements, (v) => v)
	)
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
								did: device.did,
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
							.set("placeholder", "Username...")
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
							.set("placeholder", "Password...")
							.on("keyup", async (event) => {
								if (event.code === "Enter") {
									(event.target as HTMLInputElement).blur();
									await doLogin();
								}
							})
						)
						.add(Icon.makePadlock()
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
		.bind("data-hide", showModal.addObserver((showModal) => showModal !== "register"))
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
							.set("placeholder", "Username...")
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
							.set("placeholder", "Password...")
						)
						.add(Icon.makePadlock()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input.login-modal__password")
							.bind2("value", repeat_password)
							.set("type", "password")
							.set("spellcheck", "false")
							.set("placeholder", "Repeat password...")
						)
						.add(Icon.makePadlock()
							.set("style", "fill: rgb(255, 255, 255); position: absolute; left: 0px; top: 50%; transform: translate(100%, -50%);")
						)
					)
					.add(xml.element("div")
						.set("style", "position: relative;")
						.add(xml.element("input.login-modal__name")
							.bind2("value", display_name)
							.set("type", "text")
							.set("spellcheck", "false")
							.set("placeholder", "Display name...")
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
							.set("placeholder", "Registration key...")
							.on("keyup", async (event) => {
								if (event.code === "Enter") {
									(event.target as HTMLInputElement).blur();
									await doRegister();
								}
							})
						)
						.add(Icon.makePadlock()
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
				.add(xml.text("Attempting to reconnect to the server..."))
			)
		)
	)
	.render();



let progress = xml.element("div.media-player__progress");
let progressbar = xml.element("div.media-player__progress-bar");
let progresscontainer = xml.element("div.media-player__progress-container");
let progresstrack = xml.element("div.media-player__progress-track");
let progressmetadata = xml.element("div.media-player__progress-metadata");

progress.add(
	progressbar.add(
		progresscontainer.add(
			progresstrack
		)
	),
	progressmetadata
);

function formatTimestamp(ms: number): string {
	let s = Math.floor(ms / 1000);
	ms -= (s * 1000);
	let m = Math.floor(s / 60);
	s -= (m * 60);
	let h = Math.floor(m / 60);
	m -= (h * 60);
	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	} else {
		return `${m}:${s.toString().padStart(2, "0")}`;
	}
};

window.requestAnimationFrame(async function computer() {
	let currentEntry = player.currentEntry.getState();
	let playing = player.playing.getState();
	let estimatedProgress = player.estimatedProgress.getState();
	let estimatedProgressTimestamp = player.estimatedProgressTimestamp.getState();
	let scale = 0;
	let metadata = "- / -";
	if (is.present(currentEntry) && is.present(estimatedProgress) && is.present(estimatedProgressTimestamp)) {
		let progress = estimatedProgress;
		if (playing) {
			progress += (Date.now() - estimatedProgressTimestamp) / 1000;
		}
		scale = progress / (currentEntry.media.duration_ms / 1000);
		metadata = `${formatTimestamp(progress * 1000)} / ${formatTimestamp(currentEntry.duration_ms)}`;
	}
	let ref = await progresstrack.ref() as HTMLDivElement;
	ref.style.setProperty("transform", `scale(${scale}, 1.0)`);
	progressmetadata.ref().then((ref) => ref.textContent = metadata);
	window.requestAnimationFrame(computer);
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
progressbar
	.on("pointerdown", async (event) => {
		progressactive = true;
		await progressupdate(event.pageX);
	});

let mediaPlayerItems = new ArrayObservable<xml.XElement>([]);

computed((context, currentEntry) => {
	if (context != null && currentEntry != null) {
		mediaPlayerItems.update([
			EntityRow.forEntity(currentEntry, {
				playbackButton: undefined,
				link: EntityLink.forEntity(context)
			})
		]);
	} else {
		mediaPlayerItems.update([]);
	}
}, player.context, player.currentEntry);

let mp = xml.element("div.content")
	.set("style", "padding: 16px;")
	.add(xml.element("div.media-player")
		.add(xml.element("div.media-player__top")
			.add(xml.element("div.media-player__metadata")
				.repeat(mediaPlayerItems, (mediaPlayerItem) => mediaPlayerItem)/*
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
				}) */
			)
			.add(xml.element("div.media-player__controls")/*
				.add(makeButton()
					.bind("data-hide", player.devices.compute((devices) => {
						return devices.length < 2;
					}))
					.add(Icon.makeBroadcast())
					.on("click", () => {
						showDevices.updateState(!showDevices.getState());
					})
				) */
				.add(makeButton()
					.bind("data-enabled", player.canPlayLast.addObserver(a => a))
					.add(Icon.makeSkip({ direction: "left" }))
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
						player.togglePlayback();
					})
				)
				.add(makeButton()
					.bind("data-enabled", player.canPlayNext.addObserver(a => a))
					.add(Icon.makeSkip())
					.on("click", () => {
						player.next();
					})
				)
			)
		)
		.add(xml.element("div.media-player__bottom")
			.add(makeButton({ style: "flat" })
				.bind("data-active", player.shuffle.addObserver(a => a))
				.add(Icon.makeShuffle()
						.set("width", "16px")
						.set("height", "16px")
				)
				.on("click", () => {
					player.toggleShuffle();
				})
			)
			.add(progress)
			.add(makeButton({ style: "flat" })
				.bind("data-active", player.repeat.addObserver(a => a))
				.add(Icon.makeRepeat()
						.set("width", "16px")
						.set("height", "16px")
				)
				.on("click", () => {
					player.toggleRepeat();
				})
			)
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

let updateviewforuri = async (uri: string): Promise<{ element: Element, title: string }> => {
	let parts: RegExpExecArray | null;
	if (false) {
	} else if ((parts = /^audio[/]tracks[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let track_id = decodeURIComponent(parts[1]);
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let playlists = new ArrayObservable<Playlist>([]);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await apiclient["GET:/tracks/<track_id>/playlists/"]({
					options: {
						track_id,
						token: token ?? "",
						offset
					}
				});
				let payload = await response.payload();
				for (let playlist of payload.playlists) {
					playlists.append(playlist);
				}
				offset += payload.playlists.length;
				if (payload.playlists.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		}
		return apiclient["GET:/tracks/<track_id>/"]({
			options: {
				track_id: parts[1],
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let track = payload.track;
			let last = payload.last;
			let next = payload.next;
			let element = xml.element("div")
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
				.render();
			return {
				element,
				title: `${track.title}`
			};
		});
	} else if ((parts = /^audio[/]tracks[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let tracks = new ArrayObservable<Track>([]);
		let provider: TrackSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					tracks.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`audio/tracks/${encodeURIComponent(query)}`, `Tracks`);
				tracks.update([]);
				provider = new TrackSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Tracks")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(tracks, (track) => EntityCard.forTrack(track))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Tracks`
		};
	} else if ((parts = /^video[/]seasons[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let season_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/seasons/<season_id>/"]({
			options: {
				season_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let season = payload.season;
			let last = payload.last;
			let next = payload.next;
			let episodes = new ArrayObservable<Episode>([]);
			apiclient.getSeasonEpisodes({
				options: {
					season_id,
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				episodes.update(payload.episodes);
			});
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forSeason(season, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.repeat(episodes, (episode, episodeIndex) => {
						return EntityCard.forEpisode(episode, {
							playbackButton: PlaybackButton.forSeason(season, episodeIndex)
						});
					})
				)
				.add(xml.element("div.content")
					.add(entityNavLinkFactory.forSeason(last, next))
				)
				.render();
			return {
				element,
				title: `Season ${season.number}`
			};
		});
	} else if ((parts = /^video[/]seasons[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let seasons = new ArrayObservable<Season>([]);
		let provider: SeasonSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					seasons.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`video/seasons/${encodeURIComponent(query)}`, `Seasons`);
				seasons.update([]);
				provider = new SeasonSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Seasons")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(seasons, (season) => EntityCard.forSeason(season))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Seasons`
		};
	} else if ((parts = /^audio[/]discs[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let disc_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/discs/<disc_id>/"]({
			options: {
				disc_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let disc = payload.disc;
			let last = payload.last;
			let next = payload.next;
			let tracks = new ArrayObservable<Track>([]);
			apiclient.getDiscTracks({
				options: {
					disc_id,
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				tracks.update(payload.tracks);
			});
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forDisc(disc, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 16px;")
					.repeat(tracks, (track, trackIndex) => {
						return EntityRow.forTrack(track, {
							playbackButton: PlaybackButton.forDisc(disc, trackIndex)
						});
					})
				)
				.add(xml.element("div.content")
					.add(entityNavLinkFactory.forDisc(last, next))
				)
				.render();
			return {
				element,
				title: `Disc ${disc.number}`
			};
		});
	} else if ((parts = /^audio[/]discs[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let discs = new ArrayObservable<Disc>([]);
		let provider: DiscSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					discs.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`audio/discs/${encodeURIComponent(query)}`, `Discs`);
				discs.update([]);
				provider = new DiscSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Discs")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(discs, (disc) => EntityCard.forDisc(disc))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Discs`
		};
	} else if ((parts = /^users[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let user_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/users/<user_id>/"]({
			options: {
				user_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let user = payload.user;
			let offset = 0;
			let reachedEnd = new ObservableClass(false);
			let isLoading = new ObservableClass(false);
			let playlists = new ArrayObservable<Playlist>([]);
			let anchor = new ObservableClass(undefined as Playlist | undefined);
			async function load(): Promise<void> {
				if (!reachedEnd.getState() && !isLoading.getState()) {
					isLoading.updateState(true);
					let response = await apiclient["GET:/users/<user_id>/playlists/"]({
						options: {
							user_id,
							token: token ?? "",
							anchor: anchor.getState()?.playlist_id,
							offset
						}
					});
					let payload = await response.payload();
					for (let playlist of payload.playlists) {
						playlists.append(playlist);
						anchor.updateState(playlist);
					}
					offset += payload.playlists.length;
					if (payload.playlists.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
				}
			};
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(renderTextHeader(xml.text(user.name)))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 24px")
					.bind("data-hide", playlists.compute((playlists) => playlists.length === 0))
					.add(renderTextHeader(xml.text("Playlists")))
					.add(Grid.make()
						.repeat(playlists, (playlist) => EntityCard.forPlaylist(playlist))
					)
				)
				.add(observe(xml.element("div").set("style", "height: 1px;"), load))
				.render();
			return {
				element,
				title: `${user.name}`
			};
		});
	} else if ((parts = /^users[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let users = new ArrayObservable<User>([]);
		let provider: UserSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					users.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`users/${encodeURIComponent(query)}`, `Users`);
				users.update([]);
				provider = new UserSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Users")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(users, (user) => EntityCard.forUser(user))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Users`
		};
	} else if ((parts = /^actors[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let actor_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/actors/<actor_id>/"]({
			options: {
				actor_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let actor = payload.actor;
			return apiclient["GET:/actors/<actor_id>/shows/"]({
				options: {
					actor_id,
					token: token ?? "",
					anchor: undefined
				}
			}).then(async (response) => {
				let payload = await response.payload();
				let shows = payload.shows;
				let offset = 0;
				let reachedEnd = new ObservableClass(false);
				let isLoading = new ObservableClass(false);
				let movies = new ArrayObservable<Movie>([]);
				let anchor = new ObservableClass(undefined as Movie | undefined);
				async function load(): Promise<void> {
					if (!reachedEnd.getState() && !isLoading.getState()) {
						isLoading.updateState(true);
						let response = await apiclient["GET:/actors/<actor_id>/movies/"]({
							options: {
								actor_id,
								token: token ?? "",
								anchor: anchor.getState()?.movie_id,
								offset
							}
						});
						let payload = await response.payload();
						for (let movie of payload.movies) {
							movies.append(movie);
							anchor.updateState(movie);
						}
						offset += payload.movies.length;
						if (payload.movies.length === 0) {
							reachedEnd.updateState(true);
						}
						isLoading.updateState(false);
					}
				};
				let element = xml.element("div.content")
					.set("style", "display: grid; gap: 48px;")
					.add(renderTextHeader(xml.text(actor.name)))
					.add(xml.element("div")
						.set("style", "display: grid; gap: 24px;")
						.set("data-hide", `${shows.length === 0}`)
						.add(renderTextHeader(xml.text("Shows")))
						.add(carouselFactory.make(new ArrayObservable(shows.map((show) => EntityCard.forShow(show)))))
					)
					.add(xml.element("div")
						.set("style", "display: grid; gap: 24px;")
						.bind("data-hide", movies.compute((movies) => movies.length === 0))
						.add(renderTextHeader(xml.text("Movies")))
						.add(Grid.make()
							.repeat(movies, (movie) => EntityCard.forMovie(movie))
						)
					)
					.add(observe(xml.element("div").set("style", "height: 1px;"), load))
					.render();
				return {
					element,
					title: `${actor.name}`
				};
			});
		});
	} else if ((parts = /^actors[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let actors = new ArrayObservable<Actor>([]);
		let provider: ActorSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					actors.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`actors/${encodeURIComponent(query)}`, `Actors`);
				actors.update([]);
				provider = new ActorSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Actors")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(actors, (actor) => EntityCard.forActor(actor))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Actors`
		};
	} else if ((parts = /^audio[/]albums[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let album_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/albums/<album_id>/"]({
			options: {
				album_id: album_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let album = payload.album;
			let discs = new ArrayObservable<Disc>([]);
			apiclient.getAlbumDiscs({
				options: {
					album_id,
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				discs.update(payload.discs);
			});
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forAlbum(album, { compactDescription: false }))
				)
				.repeat(discs, (disc, discIndex) => {
					let tracks = new ArrayObservable<Track>([]);
					apiclient.getDiscTracks({
						options: {
							disc_id: disc.disc_id,
							token: token ?? ""
						}
					}).then(async (response) => {
						let payload = await response.payload();
						tracks.update(payload.tracks);
					});
					let element = xml.element("div.content")
						.set("style", "display: grid; gap: 16px;")
						.add(renderTextHeader(xml.text(`Disc ${disc.number}`)))
						.repeat(tracks, (track, trackIndex) => {
							return EntityRow.forTrack(track, {
								playbackButton: PlaybackButton.forAlbum(album, discIndex, trackIndex)
							});
						});
					return element;
				})
				.render();
			return {
				element,
				title: `${album.title}`
			};
		});
	} else if ((parts = /^audio[/]albums[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let albums = new ArrayObservable<Album>([]);
		let provider: AlbumSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					albums.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`audio/albums/${encodeURIComponent(query)}`, `Albums`);
				albums.update([]);
				provider = new AlbumSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Albums")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(albums, (album) => EntityCard.forAlbum(album))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Albums`
		};
	} else if ((parts = /^audio[/]artists[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let artist_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/artists/<artist_id>/"]({
			options: {
				artist_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let artist = payload.artist;
			let tracks = payload.tracks;
			let appearances = payload.appearances;
			let albums = new ArrayObservable<Album>([]);
			apiclient.getArtistAlbums({
				options: {
					artist_id,
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				albums.update(payload.albums);
			});
			let element = xml.element("div")
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
				.add(xml.element("div.content")
					.bind("data-hide", albums.compute((albums) => albums.length === 0))
					.set("style", "display: grid; gap: 24px;")
					.add(renderTextHeader(xml.text("Discography")))
					.add(Grid.make()
						.repeat(albums, (album, albumIndex) => {
							return EntityCard.forAlbum(album, {
								playbackButton: PlaybackButton.forArtist(artist, albumIndex)
							});
						})
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
				.render();
			return {
				element,
				title: `${artist.title}`
			};
		});
	} else if ((parts = /^audio[/]artists[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let artists = new ArrayObservable<Artist>([]);
		let provider: ArtistSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					artists.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`audio/artists/${encodeURIComponent(query)}`, `Artists`);
				artists.update([]);
				provider = new ArtistSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Artists")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(artists, (artist) => EntityCard.forArtist(artist))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Artists`
		};
	} else if ((parts = /^audio[/]playlists[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let playlist_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/playlists/<playlist_id>/"]({
			options: {
				playlist_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let playlist = payload.playlist;
			let hasWritePermission = (await playlists.getPermissions({
				playlist: {
					playlist_id
				}
			})).permissions === "write";
			let items = new ArrayObservable<PlaylistItem>([]);
			apiclient.getPlaylistItems({
				options: {
					playlist_id,
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				items.update(payload.items);
			});
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forPlaylist(playlist, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.bind("data-hide", items.compute((items) => items.length === 0))
					.set("style", "display: grid; gap: 16px;")
					.repeat(items, (item, itemIndex) => xml.element("div")
						.set("style", "align-items: center; display: grid; grid-template-columns: 1fr min-content; gap: 16px;")
						.add(EntityRow.forTrack(item.track, {
							playbackButton: PlaybackButton.forPlaylist(playlist, itemIndex)
						}))
						.add(makeButton()
							.set("data-hide", `${!hasWritePermission}`)
							.on("click", async () => {
								let response = await playlists.deletePlaylistItem({
									playlist_item: {
										playlist_item_id: item.playlist_item_id
									}
								});
								if (response.errors.length > 0) {
									return;
								}
								// TODO: Remove item instead of navigating.
								navigate(uri);
							})
							.add(Icon.makeMinus())
						)
					)
				)
				.render();
			return {
				element,
				title: `${playlist.title}`
			};
		});
	} else if ((parts = /^audio[/]playlists[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let playlists = new ArrayObservable<Playlist>([]);
		let provider: PlaylistSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					playlists.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`audio/playlists/${encodeURIComponent(query)}`, `Playlists`);
				playlists.update([]);
				provider = new PlaylistSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Playlists")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(playlists, (playlist) => EntityCard.forPlaylist(playlist))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Playlists`
		};
	} else if ((parts = /^audio[/]/.exec(uri)) !== null) {
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let albums = new ArrayObservable<apischema.objects.Album>([]);
		let anchor = new ObservableClass(undefined as Album | undefined);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await apiclient.getNewAlbums({
					options: {
						token: token ?? "",
						anchor: anchor.getState()?.album_id,
						offset
					}
				});
				let payload = await response.payload();
				for (let album of payload.albums) {
					albums.append(album);
					anchor.updateState(album);
				}
				offset += payload.albums.length;
				if (payload.albums.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(Grid.make({ mini: true })
					.add(makeIconLink(Icon.makeDisc(), "Albums", "audio/albums/"))
					.add(makeIconLink(Icon.makePerson(), "Artists", "audio/artists/"))
					.add(makeIconLink(Icon.makeBulletList(), "Playlists", "audio/playlists/"))
					.add(makeIconLink(Icon.makeNote(), "Tracks", "audio/tracks/"))
				)
				.add(xml.element("div")
					.set("style", "display: grid; gap: 24px")
					.bind("data-hide", albums.compute((albums) => albums.length === 0))
					.add(renderTextHeader(xml.text("Recently added albums")))
					.add(Grid.make()
						.repeat(albums, (album) => EntityCard.forAlbum(album))
					)
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Listen`
		};
	} else if ((parts = /^video[/]shows[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let show_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/shows/<show_id>/"]({
			options: {
				show_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let show = payload.show;
			let actors = payload.actors;
			let seasons = new ArrayObservable<Season>([]);
			apiclient.getShowSeasons({
				options: {
					show_id,
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				seasons.update(payload.seasons);
			});
			let nextEpisodeElements = new ArrayObservable<xml.XElement>([]);
			apiclient.getShowContext({
				options: {
					show_id,
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				let context = payload.context;
				let next = utils.getNextEpisode(context);
				if (next != null) {
					let element = EntityCard.forEpisode(context.seasons[next.seasonIndex].episodes[next.episodeIndex], {
						playbackButton: PlaybackButton.forShow(show, next.seasonIndex, next.episodeIndex)
					});
					nextEpisodeElements.update([element]);
				}
			});
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forShow(show, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("data-hide", `${actors.length === 0}`)
					.set("style", "display: grid; gap: 16px;")
					.add(...actors.slice(0, 3).map((actor) => EntityRow.forActor(actor)))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 24px;")
					.add(renderTextHeader(xml.text("Next episode")))
					.repeat(nextEpisodeElements, (element) => element)
				)
				.add(xml.element("div.content")
					.add(Grid.make()
						.repeat(seasons, (season, seasonIndex) => EntityCard.forSeason(season, {
							playbackButton: PlaybackButton.forShow(show, seasonIndex)
						}))
					)
				)
				.render();
			return {
				element,
				title: `${show.title}`
			};
		});
	} else if ((parts = /^video[/]shows[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let shows = new ArrayObservable<Show>([]);
		let provider: ShowSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					shows.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`video/shows/${encodeURIComponent(query)}`, `Shows`);
				shows.update([]);
				provider = new ShowSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Shows")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(shows, (show) => EntityCard.forShow(show))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Shows`
		};
	} else if ((parts = /^video[/]episodes[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let episode_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/episodes/<episode_id>/"]({
			options: {
				episode_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let episode = payload.episode;
			let last = payload.last;
			let next = payload.next;
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forEpisode(episode, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.add(entityNavLinkFactory.forEpisode(last, next))
				)
				.render();
			return {
				element,
				title: `${episode.title}`
			};
		});
	} else if ((parts = /^video[/]episodes[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let episodes = new ArrayObservable<Episode>([]);
		let provider: EpisodeSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					episodes.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`video/episodes/${encodeURIComponent(query)}`, `Episodes`);
				episodes.update([]);
				provider = new EpisodeSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Episodes")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(episodes, (episode) => EntityCard.forEpisode(episode))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Episodes`
		};
	} else if ((parts = /^video[/]movies[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let movie_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/movies/<movie_id>/"]({
			options: {
				movie_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let offset = 0;
			let reachedEnd = new ObservableClass(false);
			let isLoading = new ObservableClass(false);
			let movies = new ArrayObservable<Movie>([]);
			let anchor = new ObservableClass(undefined as Movie | undefined);
			async function load(): Promise<void> {
				if (!reachedEnd.getState() && !isLoading.getState()) {
					isLoading.updateState(true);
					let response = await apiclient["GET:/movies/<movie_id>/suggestions/"]({
						options: {
							movie_id,
							token: token ?? "",
							anchor: anchor.getState()?.movie_id,
							offset
						}
					});
					let payload = await response.payload();
					for (let movie of payload.movies) {
						movies.append(movie);
						anchor.updateState(movie);
					}
					offset += payload.movies.length;
					if (payload.movies.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
				}
			};
			let payload = await response.payload();
			let movie = payload.movie;
			let actors = payload.actors;
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forMovie(movie, { compactDescription: false }))
				)
				.add(xml.element("div.content")
					.set("data-hide", `${actors.length === 0}`)
					.set("style", "display: grid; gap: 16px;")
					.add(...actors.slice(0, 3).map((actor) => EntityRow.forActor(actor)))
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
				.render();
			return {
				element,
				title: `${movie.title}`
			};
		});
	} else if ((parts = /^video[/]movies[/]([^/?]*)/.exec(uri)) !== null) {
		let query = new ObservableClass<string>(decodeURIComponent(parts[1]));
		let movies = new ArrayObservable<Movie>([]);
		let provider: MovieSearchResultProvider | undefined;
		async function load(): Promise<void> {
			if (provider != null) {
				let results = await provider.fetch();
				for (let { entity } of results) {
					movies.append(entity);
				}
			}
		};
		window.requestAnimationFrame(() => {
			query.addObserver((query) => {
				replaceUrl(`video/movies/${encodeURIComponent(query)}`, `Movies`);
				movies.update([]);
				provider = new MovieSearchResultProvider(token ?? "", query);
				load();
			});
		});
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Movies")))
			)
			.add(xml.element("div.content")
				.add(makeSearchField(query))
			)
			.add(xml.element("div.content")
				.add(Grid.make()
					.repeat(movies, (movie) => EntityCard.forMovie(movie))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Movies`
		};
	} else if ((parts = /^video[/]genres[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let genre_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/genres/<genre_id>/"]({
			options: {
				genre_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let genre = payload.genre;
			return apiclient["GET:/genres/<genre_id>/shows/"]({
				options: {
					genre_id,
					token: token ?? "",
					anchor: undefined
				}
			}).then(async (response) => {
				let payload = await response.payload();
				let shows = payload.shows;
				let offset = 0;
				let reachedEnd = new ObservableClass(false);
				let isLoading = new ObservableClass(false);
				let movies = new ArrayObservable<Movie>([]);
				let anchor = new ObservableClass(undefined as Movie | undefined);
				async function load(): Promise<void> {
					if (!reachedEnd.getState() && !isLoading.getState()) {
						isLoading.updateState(true);
						let response = await apiclient["GET:/genres/<genre_id>/movies/"]({
							options: {
								genre_id,
								token: token ?? "",
								anchor: anchor.getState()?.movie_id,
								offset
							}
						});
						let payload = await response.payload();
						for (let movie of payload.movies) {
							movies.append(movie);
							anchor.updateState(movie);
						}
						offset += payload.movies.length;
						if (payload.movies.length === 0) {
							reachedEnd.updateState(true);
						}
						isLoading.updateState(false);
					}
				};
				let element = xml.element("div")
					.add(xml.element("div.content")
						.add(renderTextHeader(xml.text(genre.title)))
					)
					.add(shows.length === 0 ? undefined : xml.element("div.content")
						.set("style", "display: grid; gap: 24px;")
						.add(renderTextHeader(xml.text("Shows")))
						.add(carouselFactory.make(new ArrayObservable(shows.map((show) => EntityCard.forShow(show)))))
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
					.render();
				return {
					element,
					title: `${genre.title}`
				};
			});
		});
	} else if ((parts = /^video[/]genres[/]([^/?]*)/.exec(uri)) !== null) {
		let query = decodeURIComponent(parts[1]);
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let genres = new ArrayObservable<Genre>([]);
		let anchor = new ObservableClass(undefined as Genre | undefined);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await apiclient["GET:/genres/<query>"]({
					options: {
						query,
						token: token ?? "",
						anchor: anchor.getState()?.genre_id,
						offset,
						limit: 100
					}
				});
				let payload = await response.payload();
				for (let { entity } of payload.results) {
					genres.append(entity);
					anchor.updateState(entity);
				}
				offset += payload.results.length;
				if (payload.results.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(Grid.make({ mini: true })
					.repeat(genres, (genre) => makeIconLink(Icon.makePieChart(), genre.title, `video/genres/${genre.genre_id}/`))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Genres`
		};
	} else if ((parts = /^video[/]/.exec(uri)) !== null) {
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let movies = new ArrayObservable<apischema.objects.Movie>([]);
		let anchor = new ObservableClass(undefined as Movie | undefined);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await apiclient.getNewMovies({
					options: {
						token: token ?? "",
						anchor: anchor.getState()?.movie_id,
						offset
					}
				});
				let payload = await response.payload();
				for (let movie of payload.movies) {
					movies.append(movie);
					anchor.updateState(movie);
				}
				offset += payload.movies.length;
				if (payload.movies.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(Grid.make({ mini: true })
					.add(makeIconLink(Icon.makeStar(), "Movies", "video/movies/"))
					.add(makeIconLink(Icon.makeMonitor(), "Shows", "video/shows/"))
					.add(makeIconLink(Icon.makePieChart(), "Genres", "video/genres/"))
					.add(makeIconLink(Icon.makePerson(), "Actors", "actors/"))
				)
				.add(xml.element("div")
					.set("style", "display: grid; gap: 24px")
					.bind("data-hide", movies.compute((movies) => movies.length === 0))
					.add(renderTextHeader(xml.text("Recently added movies")))
					.add(Grid.make()
						.repeat(movies, (movie) => EntityCard.forMovie(movie))
					)
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Watch`
		};
	} else if ((parts = /^search[/]([^/?]*)/.exec(uri)) !== null) {
		function getBoolean(uri: string, key: string): boolean | undefined {
			let url = new URL(uri, window.location.origin);
			let value = url.searchParams.get(key);
			if (value === "true") {
				return true;
			}
			if (value === "false") {
				return false;
			}
		}
		let query = new ObservableClass(decodeURIComponent(parts[1]));
		let cues = new ObservableClass(getBoolean(uri, "cues") ?? false);
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let entities = new ArrayObservable<Entity>([]);
		let merger: SearchResultsMerger | undefined;
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState() && merger != null) {
				isLoading.updateState(true);
				let results = await merger.fetch(12);
				for (let { entity } of results) {
					entities.append(entity);
				}
				if (results.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		window.requestAnimationFrame(() => {
			computed((query, cues) => {
				if (!isLoading.getState()) {
					replaceUrl(`search/${encodeURIComponent(query)}?cues=${cues}`, `Search`);
					entities.update([]);
					reachedEnd.updateState(false);
					if (query === "") {
						merger = undefined;
					} else {
						merger = new SearchResultsMerger(token ?? "", query);
						load();
					}
				}
			}, query, cues);
		});
		let headEntities = new ArrayObservable<Entity>([]);
		let tailEntities = new ArrayObservable<Entity>([]);
		entities.addObserver({
			onappend(entity) {
				if (headEntities.getState().length === 0) {
					headEntities.append(entity);
				} else {
					tailEntities.append(entity);
				}
			},
			onsplice(entity, index) {
				if (index === 0) {
					headEntities.update([]);
				} else {
					tailEntities.splice(index - 1);
				}
			}
		});
		let element = xml.element("div.content")
			.add(xml.element("div")
				.set("style", "align-items: center; display: grid; gap: 16px; grid-template-columns: 1fr auto;")
				.add(makeSearchField(query))
				.add(makeButton()
					.bind("data-active", cues.addObserver(a => a))
					.add(Icon.makeQuotationMark())
					.on("click", () => {
						cues.updateState(!cues.getState());
					})
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
			.render();
		return {
			element,
			title: `Search`
		};
	} else if ((parts = /^years[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let year_id = decodeURIComponent(parts[1]);
		return apiclient["GET:/years/<year_id>/"]({
			options: {
				year_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let year = payload.year;
			return apiclient["GET:/years/<year_id>/movies/"]({
				options: {
					year_id,
					token: token ?? "",
					offset: 0,
					anchor: undefined
				}
			}).then(async (response) => {
				let payload = await response.payload();
				let movies = payload.movies;
				let offset = 0;
				let reachedEnd = new ObservableClass(false);
				let isLoading = new ObservableClass(false);
				let albums = new ArrayObservable<Album>([]);
				let anchor = new ObservableClass(undefined as Album | undefined);
				async function load(): Promise<void> {
					if (!reachedEnd.getState() && !isLoading.getState()) {
						isLoading.updateState(true);
						let response = await apiclient["GET:/years/<year_id>/albums/"]({
							options: {
								year_id,
								token: token ?? "",
								anchor: anchor.getState()?.album_id,
								offset
							}
						});
						let payload = await response.payload();
						for (let album of payload.albums) {
							albums.append(album);
							anchor.updateState(album);
						}
						offset += payload.albums.length;
						if (payload.albums.length === 0) {
							reachedEnd.updateState(true);
						}
						isLoading.updateState(false);
					}
				};
				let element = xml.element("div")
					.add(xml.element("div.content")
						.add(EntityCard.forYear(year))
						.add(xml.element("div")
							.set("style", "display: grid; gap: 24px;")
							.set("data-hide", `${movies.length === 0}`)
							.add(renderTextHeader(xml.text("Movies")))
							.add(carouselFactory.make(new ArrayObservable(movies.map((movie) => EntityCard.forMovie(movie)))))
						)
						.add(xml.element("div")
							.set("style", "display: grid; gap: 24px;")
							.bind("data-hide", albums.compute((albums) => albums.length === 0))
							.add(renderTextHeader(xml.text("Albums")))
							.add(Grid.make()
								.repeat(albums, (album) => EntityCard.forAlbum(album))
							)
						)
					)
				.add(observe(xml.element("div").set("style", "height: 1px;"), load))
				.render();
				return {
					element,
					title: `${year.year}`
				};
			});
		});
	} else if ((parts = /^years[/]([^/?]*)/.exec(uri)) !== null) {
		let query = decodeURIComponent(parts[1]);
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let years = new ArrayObservable<Year>([]);
		let anchor = new ObservableClass(undefined as Year | undefined);
		async function load(): Promise<void> {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				let response = await apiclient["GET:/years/<query>"]({
					options: {
						query,
						token: token ?? "",
						anchor: anchor.getState()?.year_id,
						offset,
						limit: 100
					}
				});
				let payload = await response.payload();
				for (let { entity } of payload.results) {
					years.append(entity);
					anchor.updateState(entity);
				}
				offset += payload.results.length;
				if (payload.results.length === 0) {
					reachedEnd.updateState(true);
				}
				isLoading.updateState(false);
			}
		};
		let element = xml.element("div")
			.add(xml.element("div.content")
				.add(Grid.make({ mini: true })
					.repeat(years, (year) => makeIconLink(Icon.makeCalendar(), `${year.year}`, `years/${year.year_id}/`))
				)
			)
			.add(observe(xml.element("div").set("style", "height: 1px;"), load))
			.render();
		return {
			element,
			title: `Years`
		};
	} else if ((parts = /^directories[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let directory_id = decodeURIComponent(parts[1]);
		return apiclient.getDirectory({
			options: {
				directory_id: directory_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let directory = payload.directory;
			let reachedEnd = new ObservableClass(false);
			let isLoading = new ObservableClass(false);
			let entities = new ArrayObservable<Directory | File>([]);
			let merger = new DirectoryContentMerger(token ?? "", directory_id);
			async function load(): Promise<void> {
				if (!reachedEnd.getState() && !isLoading.getState()) {
					isLoading.updateState(true);
					let results = await merger.fetch(12);
					for (let { entity } of results) {
						entities.append(entity);
					}
					if (results.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
				}
			};
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forDirectory(directory))
					.add(xml.element("div")
						.set("style", "display: grid; gap: 24px;")
						.bind("data-hide", entities.compute((entities) => entities.length === 0))
						.add(renderTextHeader(xml.text("Content")))
						.repeat(entities, (entity, entityIndex) => {
							return EntityRow.forEntity(entity, {});
						})
					)
				)
				.add(observe(xml.element("div").set("style", "height: 1px;"), load))
				.render();
			return {
				element,
				title: `${directory.name}`
			};
		});
	} else if ((parts = /^files[/]([0-9a-f]{16})[/]/.exec(uri)) !== null) {
		let file_id = decodeURIComponent(parts[1]);
		return apiclient.getFile({
			options: {
				file_id: file_id,
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let file = payload.file;
			let element = xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forFile(file, { compactDescription: false }))
				)
				.render();
			return {
				element,
				title: `${file.name}`
			};
		});
	} else {
		return apiclient["GET:/users/<user_id>/shows/"]({
			options: {
				user_id: "",
				token: token ?? ""
			}
		}).then(async (response) => {
			let payload = await response.payload();
			let shows = new ArrayObservable<apischema.objects.Show>(payload.shows);
			return apiclient.getUserArtists({
				options: {
					user_id: "",
					token: token ?? ""
				}
			}).then(async (response) => {
				let payload = await response.payload();
				let artists = new ArrayObservable<apischema.objects.Artist>(payload.artists);
				let offset = 0;
				let reachedEnd = new ObservableClass(false);
				let isLoading = new ObservableClass(false);
				let albums = new ArrayObservable<apischema.objects.Album>([]);
				let anchor = new ObservableClass(undefined as Album | undefined);
				async function load(): Promise<void> {
					if (!reachedEnd.getState() && !isLoading.getState()) {
						isLoading.updateState(true);
						let response = await apiclient["GET:/users/<user_id>/albums/"]({
							options: {
								user_id: "",
								token: token ?? "",
								anchor: anchor.getState()?.album_id,
								offset
							}
						});
						let payload = await response.payload();
						for (let album of payload.albums) {
							albums.append(album);
							anchor.updateState(album);
						}
						offset += payload.albums.length;
						if (payload.albums.length === 0) {
							reachedEnd.updateState(true);
						}
						isLoading.updateState(false);
					}
				};
				let element = xml.element("div")
					.add(xml.element("div.content")
						.add(Grid.make({ mini: true })
							.add(makeIconLink(Icon.makeMonitor(), "Watch", "video/"))
							.add(makeIconLink(Icon.makeSpeaker(), "Listen", "audio/"))
							.add(makeIconLink(Icon.makeMagnifyingGlass(), "Search", "search/"))
							.add(makeIconLink(Icon.makeCalendar(), "Years", "years/"))
						)
						.add(xml.element("div")
							.set("style", "display: grid; gap: 24px")
							.bind("data-hide", shows.compute((shows) => shows.length === 0))
							.add(renderTextHeader(xml.text("Suggested shows")))
							.add(carouselFactory.make((() => {
								let widgets = new ArrayObservable<xml.XElement>([]);
								shows.addObserver({
									onappend(show) {
										widgets.append(EntityCard.forShow(show));
									},
									onsplice(show, index) {
										widgets.splice(index);
									}
								});
								return widgets;
							})()))
						)
						.add(xml.element("div")
							.set("style", "display: grid; gap: 24px")
							.bind("data-hide", artists.compute((artists) => artists.length === 0))
							.add(renderTextHeader(xml.text("Suggested artists")))
							.add(carouselFactory.make((() => {
								let widgets = new ArrayObservable<xml.XElement>([]);
								artists.addObserver({
									onappend(artist) {
										widgets.append(EntityCard.forArtist(artist));
									},
									onsplice(show, index) {
										widgets.splice(index);
									}
								});
								return widgets;
							})()))
						)
						.add(xml.element("div")
							.set("style", "display: grid; gap: 24px")
							.bind("data-hide", albums.compute((albums) => albums.length === 0))
							.add(renderTextHeader(xml.text("Suggested albums")))
							.add(Grid.make()
								.repeat(albums, (album) => EntityCard.forAlbum(album))
							)
						)
					)
					.add(observe(xml.element("div").set("style", "height: 1px;"), load))
				.render();
				return {
					element,
					title: `Circus`
				};
			});
		});
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
	let uri = pn.slice(i).join('/') + window.location.search;
	//return uri === '' ? './' : uri;
	return uri;
};

type CacheEntry = {
	uri: string,
	element: Element,
	title: string,
	x: number,
	y: number,
};
let mount_cache = new Array<CacheEntry>();
let mounted_uri: string | undefined;
function replaceUrl(uri: string, title: string): void {
	if (mounted_uri != null) {
		let entry = mount_cache.find((entry) => entry.uri === mounted_uri);
		if (entry != null) {
			entry.uri = uri;
			entry.title = title;
			window.history.replaceState({ ...window.history.state, uri }, "", uri);
			document.title = title;
			mounted_uri = uri;
		}
	}
}
async function navigate(uri: string, use_cache: boolean = false): Promise<void> {
	hideModalMenu();
	if (is.absent(verifiedToken.getState())) {
		while (is.present(mount.lastChild)) {
			mount.lastChild.remove();
		}
		mount.appendChild(xml.element("div.content.content--narrow")
			.add(xml.element("div")
				.set("style", "display: grid; gap: 24px;")
				.add(renderTextHeader(
					xml.text("Not logged in"))
				)
				.add(renderTextParagraph(
					xml.text("Please login using your credentials or register a new user with your user information. The server operator, a.k.a. the circus manager, might require that you provide a valid registration key in order to register. Registration keys can be obtained from the circus manager and are consumed upon successful registration."))
				)
			)
			.add(xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.add(xml.element("button")
					.add(xml.text("Login"))
					.on("click", async () => {
						showModal.updateState("login");
					})
				)
				.add(xml.element("button")
					.add(xml.text("Register"))
					.on("click", async () => {
						showModal.updateState("register");
					})
				)
			)
			.render()
		);
		return;
	}
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
				title: document.title,
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
	if (is.present(entry) && use_cache) {
	} else {
		let { element, title } = await updateviewforuri(uri);
		entry = {
			uri: uri,
			element: element,
			title: title,
			x: 0,
			y: 0
		};
		mount_cache.unshift(entry);
	}
	mount.appendChild(entry.element);
	mount.scrollLeft = entry.x;
	mount.scrollTop = entry.y;
	if (is.absent(window.history.state)) {
		window.history.replaceState({ uri, index: historyIndex.getState() }, "", uri);
	} else {
		if (uri !== window.history.state.uri) {
			window.history.pushState({ uri, index: historyIndex.getState() + 1 }, "", uri);
			historyIndex.updateState(historyIndex.getState() + 1);
			historyLength.updateState(historyIndex.getState() + 1);
		} else {
			historyIndex.updateState(window.history.state.index);
		}
	}
	mounted_uri = entry.uri;
	document.title = entry.title;
}
function setupRouting(): void {
	window.addEventListener("popstate", (event) => {
		let uri: string = event.state.uri;
		navigate(uri, true);
	});
	verifiedToken.addObserver((verifiedToken) => {
		navigate(get_route());
	});
}
setupRouting();

class ResultProvider<A> {
	private fetcher: (anchor?: A) => Promise<Array<{ entity: A, rank: number }>>;
	private anchor?: A;
	private results: Array<{ entity: A, rank: number }>;
	private exhausted: boolean;
	private pending: boolean;
	private index: number;

	constructor(fetcher: (anchor?: A) => Promise<Array<{ entity: A, rank: number }>>) {
		this.fetcher = fetcher;
		this.anchor = undefined;
		this.results = [];
		this.exhausted = false;
		this.pending = false;
		this.index = 0;
	}

	async fetch(): Promise<Array<{ entity: A, rank: number }>> {
		if (this.exhausted || this.pending) {
			return [];
		}
		this.pending = true;
		let results = await this.fetcher(this.anchor);
		this.pending = false;
		if (results.length === 0) {
			this.exhausted = true;
			return [];
		}
		this.results.push(...results);
		this.anchor = results[results.length - 1].entity;
		this.index = this.results.length;
		return results;
	}

	async peek(): Promise<{ entity: A, rank: number } | undefined> {
		if (this.exhausted || this.pending) {
			return;
		}
		if (this.index >= this.results.length) {
			this.pending = true;
			let results = await this.fetcher(this.anchor);
			this.pending = false;
			if (results.length === 0) {
				this.exhausted = true;
				return;
			}
			this.results.push(...results);
		}
		let result = this.results[this.index];
		return result;
	}

	async read(): Promise<{ entity: A, rank: number } | undefined> {
		if (this.exhausted || this.pending) {
			return;
		}
		if (this.index >= this.results.length) {
			this.pending = true;
			let results = await this.fetcher(this.anchor);
			this.pending = false;
			if (results.length === 0) {
				this.exhausted = true;
				return;
			}
			this.results.push(...results);
		}
		let result = this.results[this.index];
		this.anchor = result.entity;
		this.index += 1;
		return result;
	}
};

class AlbumSearchResultProvider extends ResultProvider<Album> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/albums/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.album_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class ArtistSearchResultProvider extends ResultProvider<Artist> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/artists/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.artist_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class PlaylistSearchResultProvider extends ResultProvider<Playlist> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/playlists/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.playlist_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class ShowSearchResultProvider extends ResultProvider<Show> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/shows/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.show_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class EpisodeSearchResultProvider extends ResultProvider<Episode> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/episodes/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.episode_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class MovieSearchResultProvider extends ResultProvider<Movie> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/movies/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.movie_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class TrackSearchResultProvider extends ResultProvider<Track> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/tracks/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.track_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class SeasonSearchResultProvider extends ResultProvider<Season> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/seasons/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.season_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class DiscSearchResultProvider extends ResultProvider<Disc> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/discs/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.disc_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class UserSearchResultProvider extends ResultProvider<User> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/users/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.user_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class ActorSearchResultProvider extends ResultProvider<Actor> {
	constructor(token: string, query: string) {
		super(async (anchor) => {
			let response = await apiclient["GET:/actors/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.actor_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
	}
};

class ResultsMerger<A> {
	protected providers: Array<ResultProvider<A>>;

	constructor(providers: Array<ResultProvider<A>>) {
		this.providers = providers;
	}

	async fetch(limit: number): Promise<Array<{ entity: A, rank: number }>> {
		let entities = [] as Array<{ entity: A, rank: number }>;
		while (entities.length < limit) {
			let candidates = [] as Array<{ result: { entity: A, rank: number }, provider: ResultProvider<A> }>;
			for (let provider of this.providers) {
				let result = await provider.peek();
				if (result == null) {
					continue;
				}
				candidates.push({ result, provider });
			}
			this.providers = candidates.map((candidate) => candidate.provider);
			if (candidates.length === 0) {
				break;
			}
			candidates.sort((one, two) => two.result.rank - one.result.rank);
			let candidate = candidates[0];
			await candidate.provider.read();
			entities.push(candidate.result);
		}
		return entities;
	}
};

class SearchResultsMerger extends ResultsMerger<Entity> {
	constructor(token: string, query: string) {
		let actors = new ResultProvider<Actor>(async (anchor) => {
			let response = await apiclient["GET:/actors/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.actor_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let albums = new ResultProvider<Album>(async (anchor) => {
			let response = await apiclient["GET:/albums/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.album_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let artists = new ResultProvider<Artist>(async (anchor) => {
			let response = await apiclient["GET:/artists/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.artist_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let discs = new ResultProvider<Disc>(async (anchor) => {
			let response = await apiclient["GET:/discs/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.disc_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let episodes = new ResultProvider<Episode>(async (anchor) => {
			let response = await apiclient["GET:/episodes/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.episode_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let genres = new ResultProvider<Genre>(async (anchor) => {
			let response = await apiclient["GET:/genres/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.genre_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let movies = new ResultProvider<Movie>(async (anchor) => {
			let response = await apiclient["GET:/movies/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.movie_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let seasons = new ResultProvider<Season>(async (anchor) => {
			let response = await apiclient["GET:/seasons/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.season_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let playlists = new ResultProvider<Playlist>(async (anchor) => {
			let response = await apiclient["GET:/playlists/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.playlist_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let shows = new ResultProvider<Show>(async (anchor) => {
			let response = await apiclient["GET:/shows/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.show_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let tracks = new ResultProvider<Track>(async (anchor) => {
			let response = await apiclient["GET:/tracks/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.track_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let users = new ResultProvider<User>(async (anchor) => {
			let response = await apiclient["GET:/users/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.user_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		let years = new ResultProvider<Year>(async (anchor) => {
			let response = await apiclient["GET:/years/<query>"]({
				options: {
					token,
					query,
					anchor: anchor?.year_id
				}
			});
			let payload = await response.payload();
			return payload.results;
		});
		super([
			years,
			artists,
			albums,
			movies,
			shows,
			tracks,
			playlists,
			genres,
			actors,
			users,
			episodes,
			seasons,
			discs
		] as Array<ResultProvider<Entity>>);
	}
};

class DirectoryDirectoriesProvider extends ResultProvider<Directory> {
	constructor(token: string, directory_id: string) {
		super(async (anchor) => {
			let response = await apiclient.getDirectoryDirectories({
				options: {
					directory_id,
					token,
					anchor: anchor?.directory_id
				}
			});
			let payload = await response.payload();
			return payload.directories.map((directory) => ({
				rank: 0,
				entity: directory
			}));
		});
	}
};

class DirectoryFilesProvider extends ResultProvider<File> {
	constructor(token: string, directory_id: string) {
		super(async (anchor) => {
			let response = await apiclient.getDirectoryFiles({
				options: {
					directory_id,
					token,
					anchor: anchor?.file_id
				}
			});
			let payload = await response.payload();
			return payload.files.map((file) => ({
				rank: 0,
				entity: file
			}));
		});
	}
};

class DirectoryContentMerger extends ResultsMerger<Directory | File> {
	constructor(token: string, directory_id: string) {
		let directories = new DirectoryDirectoriesProvider(token, directory_id);
		let files = new DirectoryFilesProvider(token, directory_id);
		super([
			directories,
			files
		] as Array<ResultProvider<Directory | File>>);
	}
};
