import * as api_response from "./api_response";
import * as utils from "./utils";
import * as languages from "./languages";
import { AuthToken } from "./database";
import * as session from "./browserMediaSession";
import { ArrayObservable, computed, Observable, ObservableClass } from "./simpleobs";
import * as client from "./context/client";
import * as schema from "./context/schema";
import * as is from "./is";
import { Context, ContextAlbum, ContextArtist, Device } from "./context/schema/objects";
import { Album, AlbumBase, Artist, ArtistBase, Cue, Disc, DiscBase, Entity, Episode, EpisodeBase, Genre, GenreBase, Movie, MovieBase, Person, Playlist, PlaylistBase, Season, SeasonBase, Show, ShowBase, Track, TrackBase, User, UserBase } from "./api/schema/objects";
import * as xml from "./xnode";
import { formatDuration as format_duration } from "./ui/metadata";

import { GridFactory } from "./ui/Grid";
import { IconFactory } from "./ui/Icon";
import { ImageBoxFactory } from "./ui/ImageBox";
import { EntityLinkFactory } from "./ui/EntityLink";
import { EntityCardFactory } from "./ui/EntityCard";
import { EntityRowFactory } from "./ui/EntityRow";
import { PlaybackButtonFactory } from "./ui/PlaybackButton";






		function getYears(season: Season): number[] {
			let years = season.episodes.reduce((years, episode) => {
				if (is.present(episode.year)) {
					if (!years.includes(episode.year)) {
						years.push(episode.year);
					}
				}
				return years;
			}, [] as number[]);
			return years.sort();
		}
		function getYearsForShow(show: Show): number[] {
			let set = new Set<number>();
			for (let season of show.seasons) {
				for (let episode of season.episodes) {
					if (is.present(episode.year)) {
						set.add(episode.year);
					}
				}
			}
			let years = Array.from(set);
			return years.sort();
		}








function makeUrl(): string {
	let path = `/sockets/context/?type=browser&name=Browser`;
	let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	let host = window.location.host;
	return `${protocol}//${host}${path}`;
}

let player = new client.ContextClient(makeUrl());
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
player.playback.addObserver((playback) => {
	currentVideo.autoplay = playback;
})
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
				artwork: is.absent(movie.artwork) ? undefined : [
					{
						src: `/files/${movie.artwork.file_id}/?token=${token}`,
						sizes: `${movie.artwork.width}x${movie.artwork.height}`,
						type: movie.artwork.mime
					}
				]
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
				artwork: is.absent(album.artwork) ? undefined : [
					{
						src: `/files/${album.artwork.file_id}/?token=${token}`,
						sizes: `${album.artwork.width}x${album.artwork.height}`,
						type: album.artwork.mime
					}
				]
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
			lastVideo.src = `/files/${lastLocalEntry.segment.file.file_id}/?token=${token}`;
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
			currentVideo.src = `/files/${currentLocalEntry.segment.file.file_id}/?token=${token}`;
		}
		while (currentVideo.lastChild != null) {
			currentVideo.removeChild(currentVideo.lastChild);
		}
		if (Movie.is(currentLocalEntry) || Episode.is(currentLocalEntry)) {
			let subtitles = currentLocalEntry.segment.subtitles;
			let defaultSubtitle = subtitles.find((subtitle) => subtitle.language === "swe") ?? subtitles.find((subtitle) => subtitle.language === "eng");
			for (let subtitle of subtitles) {
				let element = document.createElement("track");
				element.src = `/files/${subtitle.file.file_id}/?token=${token}`;
				if (is.present(subtitle.language)) {
					let language = languages.db[subtitle.language];
					if (is.present(language)) {
						element.label = language.title;
						element.srclang = language.iso639_1;
						element.kind = "subtitles";
					}
					if (subtitle === defaultSubtitle) {
						element.setAttribute("default", "");
					}
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
			lastVideo.src = `/files/${nextLocalEntry.segment.file.file_id}/?token=${token}`;
		}
	};
	player.nextLocalEntry.addObserver(computer);
	player.token.addObserver(computer);
}










const tokenobs = new ObservableClass(localStorage.getItem("token") ?? undefined);

const Grid = new GridFactory();
document.head.appendChild(GridFactory.makeStyle().render())

const Icon = new IconFactory();
document.head.appendChild(IconFactory.makeStyle().render())

const PlaybackButton = new PlaybackButtonFactory(player, Icon);
document.head.appendChild(PlaybackButtonFactory.makeStyle().render())

const ImageBox = new ImageBoxFactory(tokenobs);
document.head.appendChild(ImageBoxFactory.makeStyle().render())

const EntityLink = new EntityLinkFactory(navigate);
document.head.appendChild(EntityLinkFactory.makeStyle().render())

const EntityCard = new EntityCardFactory(EntityLink, ImageBox, PlaybackButton);
document.head.appendChild(EntityCardFactory.makeStyle().render())

const EntityRow = new EntityRowFactory(EntityLink, ImageBox, PlaybackButton);
document.head.appendChild(EntityRowFactory.makeStyle().render())

























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
		transition: color 0.1s;
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
		transition: transform 0.1s;
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

	[data-grid] {
		margin: 0px auto;
		max-width: 960px;
		min-width: 160px;
		padding: 16px;
	}

	[data-cell] {
		display: inline-block;
		vertical-align: top;
	}

	@media all and (max-width: 319px) {
		[data-cell^="1:"] {
			width: 16.66%;
		}

		[data-cell^="2:"] {
			width: 33.33%;
		}

		[data-cell^="3:"] {
			width: 50.00%;
		}

		[data-cell^="4:"] {
			width: 66.66%;
		}

		[data-cell^="5:"] {
			width: 83.33%;
		}

		[data-cell^="6:"] {
			width: 100.00%;
		}
	}

	@media all and (min-width: 320px) and (max-width: 479px) {
		[data-cell*=":1:"] {
			width: 16.66%;
		}

		[data-cell*=":2:"] {
			width: 33.33%;
		}

		[data-cell*=":3:"] {
			width: 50.00%;
		}

		[data-cell*=":4:"] {
			width: 66.66%;
		}

		[data-cell*=":5:"] {
			width: 83.33%;
		}

		[data-cell*=":6:"] {
			width: 100.00%;
		}
	}

	@media all and (min-width: 480px) {
		[data-cell$=":1"] {
			width: 16.66%;
		}

		[data-cell$=":2"] {
			width: 33.33%;
		}

		[data-cell$=":3"] {
			width: 50.00%;
		}

		[data-cell$=":4"] {
			width: 66.66%;
		}

		[data-cell$=":5"] {
			width: 83.33%;
		}

		[data-cell$=":6"] {
			width: 100.00%;
		}
	}

	[data-flex] {
		--gap: max(0px, calc(var(--gap, 0px) - 4px));
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	[data-flex="x"] {
		flex-direction: row;
		width: 100%;
	}

	[data-flex="x"] > :not(:first-child) {
		margin-left: var(--gap, 0px);
	}

	[data-flex="y"] {
		flex-direction: column;
		height: 100%;
	}

	[data-flex="y"] > :not(:first-child) {
		margin-top: var(--gap, 0px);
	}

	[data-wrap="false"] {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	body {
		background-color: rgb(31, 31, 31);
		color: rgb(255, 255, 255);
		font-family: "Nunito", sans-serif;
		overflow: hidden;
		user-select: none;
	}

	body ::selection {
		background-color: ${ACCENT_COLOR};
		color: rgb(255, 255, 255);
	}

	button {
		background-color: ${ACCENT_COLOR};
		border-radius: 4px;
		color: rgb(255, 255, 255);
		cursor: pointer;
		font-size: 16px;
		padding: 8px 16px;
		transition: transform 0.1s;
	}

	button[data-enabled="false"] {
		background-color: rgb(79, 79, 79);
		cursor: default;
	}

	@media (hover: hover) and (pointer: fine) {
		button:not([data-enabled="false"]):hover {
			transform: scale(1.25);
		}

		button:active {
			transform: none;
		}
	}

	input {
		background-color: rgb(47, 47, 47);
		border-radius: 2px;
		box-sizing: border-box;
		color: rgb(255, 255, 255);
		font-size: 16px;
		padding: 8px;
		width: 100%;
	}

	.group {
		background-color: rgb(63, 63, 63);
		border-radius: 2px;
		margin: 8px;
		padding: 4px;
	}

	.group > * {
		margin: 4px;
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

	.watched::before {
		content: "\u00b7";
		color: ${ACCENT_COLOR};
	}













	.media-widget {
		background-color: rgb(47, 47, 47);
		border-radius: 2px;
		cursor: pointer;
		display: grid;
		gap: 0px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
		overflow: hidden;
	}

	.media-widget__artwork {
		background-color: rgb(0, 0, 0);
		background-size: cover;
		padding-bottom: 100%;
		position: relative;
	}

	.media-widget__images {
		display: grid;
		grid-auto-flow: column;
		height: 100%;
		justify-content: start;
		position: absolute;
		width: 100%;
	}

	.media-widget__image {
		height: 100%;
		object-fit: cover;
		width: 100%;
	}

	.media-widget__playback {
		position: absolute;
			bottom: 16px;
			right: 16px;
	}

	.media-widget__metadata {
		display: grid;
		gap: 16px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
		padding: 16px;
	}

	.media-widget__titles {
		display: grid;
		gap: 8px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
	}

	.media-widget__title {
		color: rgb(255, 255, 255);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-widget__subtitle {
		color: rgb(159, 159, 159);
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-widget__tags {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, min-content);
		grid-auto-flow: column;
	}

	.media-widget__description {
		color: rgb(159, 159, 159);
		font-size: 12px;
		line-height: 1.25;
		word-break: break-word;
	}











	.media-tag {
		background-color: rgb(63, 63, 63);
		border-radius: 2px;
		color: rgb(159, 159, 159);
		font-size: 12px;
		padding: 4px 8px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-tag--accent {
		background-color: ${ACCENT_COLOR};
		color: rgb(255, 255, 255);
	}







	.content {
		box-sizing: border-box;
		margin: 0px auto;
		max-width: 960px;
		padding: 32px;
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














	.entity-header {
		align-items: start;
		display: grid;
		gap: 24px;
		grid-template-columns: repeat(auto-fit, minmax(240px, auto));
	}

	.entity-header__artwork {
		border-radius: 2px;
		overflow: hidden;
		position: relative;
	}

	.entity-header__playback {
		position: absolute;
			bottom: 16px;
			right: 16px;
	}

	.entity-header__content {

	}

	.entity-header__whitespace {
		font-size: 16px;
		line-height: 0;
		overflow: hidden;
	}

	.entity-header__metadata {
		display: grid;
		gap: 16px;
		grid-auto-rows: max-content;
	}

	.entity-header__titles {
		display: grid;
		gap: 8px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
	}

	.entity-header__title {
		color: rgb(255, 255, 255);
		font-size: 24px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-header__subtitle {
		color: rgb(159, 159, 159);
		font-size: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-header__tags {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, min-content);
		grid-auto-flow: column;
	}

	.entity-header__description {
		color: rgb(159, 159, 159);
		font-size: 16px;
		line-height: 1.25;
		word-break: break-word;
	}











	.media-grid {
		display: grid;
		gap: 24px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
	}

	.media-grid__header {

	}

	.media-grid__content {
		display: grid;
		gap: 24px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	}










	.playlist {
		display: grid;
		gap: 24px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
	}

	.playlist__header {
		display: grid;
		gap: 16px;
	}

	.playlist__tags {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, min-content);
		grid-auto-flow: column;
	}

	.playlist__content {
		display: grid;
		gap: 16px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
	}











	.playlist-item {
		border-left: 4px solid transparent;
		cursor: pointer;
		display: grid;
		gap: 8px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
		margin-left: -16px;
		padding-left: 12px;
	}

	.playlist-item[data-playing="true"] {
		border-color: ${ACCENT_COLOR};
	}

	@media (hover: hover) and (pointer: fine) {
		.playlist-item:hover {
			border-color: rgb(255, 255, 255);
		}
	}

	.playlist-item__title {
		color: rgb(255, 255, 255);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.playlist-item__subtitle {
		color: rgb(159, 159, 159);
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.playlist-item__tags {
		display: grid;
		gap: 8px;
		grid-auto-columns: minmax(auto, min-content);
	}







	.login-modal {
		box-sizing: border-box;
		display: grid;
		gap: 16px;
		grid-auto-rows: min-content;
		height: 100%;
		margin: 0px auto;
		max-width: 320px;
		padding: 32px;
		width: 100%;
	}

	.login-modal__form {
		display: grid;
		gap: 8px;
	}








	.modal-container {
		background-color: rgb(31, 31, 31);
		height: 100%;
		position: absolute;
		width: 100%;
		z-index: 1;
	}

	.modal-container__content {
		margin: 0px auto;
		height: 100%;
		max-width: 480px;
		overflow: hidden;
		width: 100%;
	}









	.device-selector {
		padding: 32px;
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
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}














	.media-player {
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.media-player__subtitle {
		color: rgb(159, 159, 159);
		font-size: 12px;
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








	.icon-button {
		background-color: rgb(255, 255, 255);
		border-radius: 50%;
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		fill: rgb(31, 31, 31);
		padding: 8px;
		transition: transform 0.1s;
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
		grid-template-rows: min-content 1fr min-content;
	}

	.app__header {
		background-color: ${ACCENT_COLOR};
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		z-index: 1;
	}

	.app__content {
		height: auto;
		overflow: hidden;
		position: relative;
		z-index: 0;
	}

	.app__devices {
		background-color: ${ACCENT_COLOR};
	}

	.app__devices-container {
		cursor: pointer;
		display: grid;
		gap: 8px;
		grid-template-columns: min-content 1fr;
	}

	.app__devices-icon {
		fill: rgb(255, 255, 255);
	}

	.app__devices-text {
		color: rgb(255, 255, 255);
		font-size: 16px;
	}

	.app__navigation {
		background-color: rgb(47, 47, 47);
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		position: relative;
		z-index: 1;
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











	.login-modal {
		box-sizing: border-box;
		display: grid;
		gap: 16px;
		grid-auto-rows: min-content;
		height: 100%;
		margin: 0px auto;
		max-width: 320px;
		padding: 32px;
		width: 100%;
	}

	.login-modal__form {
		display: grid;
		gap: 8px;
	}
`;
document.head.appendChild(style);

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
}

const showDevices = new ObservableClass(false);
player.devices.addObserver({
	onupdate: (devices) => {
		if (devices.length < 2) {
			showDevices.updateState(false);
		}
	}
});
const showVideo = new ObservableClass(false);
{
	let computer = () => {
		let isDeviceLocal = player.isDeviceLocal.getState();
		let isCurrentEntryVideo = player.isCurrentEntryVideo.getState();
		showVideo.updateState(isDeviceLocal && isCurrentEntryVideo);
	};
	player.isDeviceLocal.addObserver(computer);
	player.isCurrentEntryVideo.addObserver(computer);
}
const showLogin = new ObservableClass(false);
const showModal = new ObservableClass(false);
{
	let computer = () => {
		showModal.updateState(showLogin.getState() || showDevices.getState());
	};
	showLogin.addObserver(computer);
	showDevices.addObserver(computer);
}


let token: string | undefined;
tokenobs.addObserver((token2) => {
	token = token2;
	player.authenticate(token);
});
let valid_token: boolean | undefined;
async function getToken(): Promise<string | undefined> {
	if (valid_token == null) {
		return new Promise((resolve, reject) => {
			req<api_response.ApiRequest, api_response.AuthWithTokenReponse>(`/api/auth/?token=${token}`, {}, (status, response) => {
				valid_token = (status >= 200 && status < 300);
				if (!valid_token) {
					localStorage.removeItem("token");
					token = undefined;
				}
				tokenobs.updateState(token);
				resolve(token);
			});
		});
	} else {
		return token;
	}
}
async function getNewToken(username: string, password: string): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		req<api_response.AuthRequest, api_response.AuthResponse>(`/api/auth/`, { username, password }, (status, response) => {
			valid_token = (status >= 200 && status < 300);
			if (!valid_token) {
				localStorage.removeItem("token");
				token = undefined;
			} else {
				token = response.token;
				localStorage.setItem("token", token);
			}
			tokenobs.updateState(token);
			resolve(token);
		});
	});
}

let mount = document.createElement('div');
let mountwrapper = document.createElement('div');

let appcontainer = xml.element("div.app")
	.render();
document.body.appendChild(appcontainer);

let appheader = xml.element("div.app__header")
	.add(xml.element("div.content")
		.set("style", "padding: 24px")
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

let username = new ObservableClass("");
let password = new ObservableClass("");
mountwrapper.appendChild(xml.element("div.login-modal")
	.bind("data-hide", showLogin.addObserver(showLogin => !showLogin))
	.add(xml.element("div.login-modal__form")
		.add(xml.element("input.login-modal__username")
			.bind2("value", username)
			.set("type", "text")
			.set("spellcheck", "false")
			.set("placeholder", "Username...")
		)
		.add(xml.element("input.login-modal__password")
			.bind2("value", password)
			.set("type", "password")
			.set("spellcheck", "false")
			.set("placeholder", "Password...")
			.on("keyup", async (event) => {
				if (event.key === "Enter") {
					let token = await getNewToken(username.getState(), password.getState());
					if (token != null) {
						showLogin.updateState(false);
					}
				}
			})
		)
	)
	.add(xml.element("button")
		.add(xml.text("Login"))
		.on("click", async () => {
			let token = await getNewToken(username.getState(), password.getState());
			if (token != null) {
				showLogin.updateState(false);
			}
		})
	)
	.render());

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
		onupdate: computer
	});
	player.device.addObserver(computer);
	player.localDevice.addObserver(computer);
}

// TODO: observer for modal content
let modals = xml.element("div.modal-container")
	.bind("data-hide", showModal.addObserver(a => !a))
	.add(xml.element("div.modal-container__content")
		.add(xml.element("div.device-selector")
			.bind("data-hide", showDevices.addObserver(a => !a))
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
							.add(xml.text(device.local ? "local" : "remote"))
						)
					)
					.on("click", () => {
						player.transfer({
							id: device.id,
							type: device.type,
							name: device.name
						});
						showDevices.updateState(false);
					})
				)
			)
		)
	);

mountwrapper.appendChild(modals.render());
let scroll_container = xml.element("div.scroll-container")
	.bind("data-hide", showVideo.addObserver((showVideo) => showVideo))
	.render();
let sentinel = xml.element("div.scroll-container__sentinel")
	.set("style", "height: 1px")
	.render();
scroll_container.appendChild(mount);
scroll_container.appendChild(sentinel);
mountwrapper.appendChild(scroll_container);
let scrollobserver: undefined | (() => Promise<void>);
function setScrollObserver(obs?: () => Promise<void>): void {
	if (is.present(scrollobserver)) {
		observer.unobserve(sentinel);
	}
	scrollobserver = obs;
	if (is.present(scrollobserver)) {
		observer.observe(sentinel);
	}
}
let observer = new IntersectionObserver(async (entries) => {
	if (is.absent(scrollobserver)) {
		return;
	}
	for (let entry of entries) {
		if (entry.target === sentinel && entry.isIntersecting) {
			await scrollobserver();
			setScrollObserver(scrollobserver);
			break;
		}
	}
}, {
	root: scroll_container
});

/*
    if (document.webkitFullscreenElement) {
      document.webkitCancelFullScreen();
    } else {
      const el = document.documentElement;
      el.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
 */


let mpw = xml.element("div.app__navigation")
	.render();


const makeButton = () => xml.element("div.icon-button");

let mp = xml.element("div.content")
	.set("style", "padding: 16px;")
	.add(xml.element("div.media-player")
		.add(xml.element("div.media-player__metadata")
			.add(xml.element("div.media-player__title")
				.add(xml.text(mediaPlayerTitle))
			)
			.add(xml.element("div.media-player__subtitle")
				.add(xml.text(mediaPlayerSubtitle))
			)
			.on("click", (event) => {
				let context = player.context.getState();
				if (is.present(context)) {
					if (Album.is(context)) {
						navigate(`audio/albums/${context.album_id}/`);
					} else if (Artist.is(context)) {
						navigate(`audio/artists/${context.artist_id}/`);
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

let videowrapper = xml.element("div")
	.bind("data-hide", showVideo.addObserver((showVideo) => {
		return !showVideo;
	}))
	.set("style", "background-color: rgb(0, 0, 0); height: 100%;")
	.render();

mountwrapper.appendChild(videowrapper);
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


const makeTag = (content: string) => xml.element("div.media-tag")
	.add(xml.text(content));

const makeAccentTag = (content: string) => xml.element("div.media-tag.media-tag--accent")
	.add(xml.text(content));

function makeAlbum(album: ContextAlbum, play: () => void): xml.XElement {
	let duration_ms = 0;
	for (let disc of album.discs) {
		for (let track of disc.tracks) {
			duration_ms += track.segment.file.duration_ms;
		}
	}
	let title = album.title;
	let tags = [
		"Album",
		`${album.year}`,
		format_duration(duration_ms)
	];
	let isContext = computed((contextPath) => {
		if (!is.present(contextPath)) {
			return false;
		}
		if (contextPath[contextPath.length - 3] !== album.album_id) {
			return false;
		}
		return true;
	}, player.contextPath);
	let isPlaying = computed((isContext, playback) => {
		return isContext && playback;
	}, isContext, player.playback);
	return xml.element("div.media-widget")
		.on("click", (event) => {
			navigate(`audio/albums/${album.album_id}/`);
		})
		.add(xml.element("div.media-widget__artwork")
			.add(is.absent(album.artwork) ? undefined : xml.element("div.media-widget__images")
				.add(xml.element("img.media-widget__image")
					.set("src", `/files/${album.artwork.file_id}/?token=${token}`)
				)
			)
			.add(xml.element("div.media-widget__playback")
				.add(
					xml.element("div.playback-button")
					.add(Icon.makePlay()
						.bind("data-hide", isPlaying.addObserver(a => a))
					)
					.add(Icon.makePause()
						.bind("data-hide", isPlaying.addObserver(a => !a))
					)
					.on("click", (event) => {
						if (isPlaying.getState()) {
							player.pause();
						} else {
							if (isContext.getState()) {
								player.resume();
							} else {
								play();
							}
						}
					})
				)
			)
		)
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(title))
				)
				.add(xml.element("div.media-widget__subtitle")
					.add(...xml.joinarray(album.artists.map((artist) => EntityLink.forArtist(artist))))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(...tags.map(makeTag))
			)
		);
}

function makeArtist(artist: ContextArtist, play: () => void = () => player.playArtist(artist)): xml.XElement {
	let duration_ms = 0;
	for (let album of artist.albums) {
		for (let disc of album.discs) {
			for (let track of disc.tracks) {
				duration_ms += track.segment.file.duration_ms;
			}
		}
	}
	let isContext = computed((contextPath) => {
		if (!is.present(contextPath)) {
			return false;
		}
		if (contextPath[contextPath.length - 4] !== artist.artist_id) {
			return false;
		}
		return true;
	}, player.contextPath);
	let isPlaying = computed((isContext, playback) => {
		return isContext && playback;
	}, isContext, player.playback);
	return xml.element("div.media-widget")
		.on("click", () => {
			navigate(`audio/artists/${artist.artist_id}/`);
		})
		.add(xml.element("div.media-widget__artwork")
			.add(xml.element("div.media-widget__playback")
				.add(xml.element("div.playback-button")
					.add(Icon.makePlay()
						.bind("data-hide", isPlaying.addObserver(a => a))
					)
					.add(Icon.makePause()
						.bind("data-hide", isPlaying.addObserver(a => !a))
					)
					.on("click", () => {
						if (isPlaying.getState()) {
							player.pause();
						} else {
							if (isContext.getState()) {
								player.resume();
							} else {
								play();
							}
						}
					})
				)
			)
		)
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(artist.title))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(makeTag("Artist"))
				.add(makeTag(format_duration(duration_ms)))
			)
		);
}

function makeEpisode(episode: Episode, play: () => void): xml.XElement {
	let title = episode.title;
	let tags = [
		"Episode",
		`${episode.year}`,
		format_duration(episode.segment.file.duration_ms)
	];
	let isContext = computed((contextPath) => {
		if (!is.present(contextPath)) {
			return false;
		}
		if (contextPath[contextPath.length - 1] !== episode.episode_id) {
			return false;
		}
		return true;
	}, player.contextPath);
	let isPlaying = computed((isContext, playback) => {
		return isContext && playback;
	}, isContext, player.playback);
	return xml.element("div.media-widget")
		.on("click", () => {
			navigate(`video/episodes/${episode.episode_id}/`)
		})
		.add(xml.element("div.media-widget__artwork")
			.set("style", "padding-bottom: 56.25%;")
			.add(xml.element("div.media-widget__images")
				.add(xml.element("img.media-widget__image")
					.set("src", `/media/stills/${episode.segment.file.file_id}/?token=${token}`)
				)
			)
			.add(xml.element("div.media-widget__playback")
				.add(xml.element("div.playback-button")
					.add(Icon.makePlay()
						.bind("data-hide", isPlaying.addObserver(a => a))
					)
					.add(Icon.makePause()
						.bind("data-hide", isPlaying.addObserver(a => !a))
					)
					.on("click", (event) => {
						if (isPlaying.getState()) {
							player.pause();
						} else {
							if (isContext.getState()) {
								player.resume();
							} else {
								play();
							}
						}
					})
				)
			)
		)
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(title))
				)
				.add(xml.element("div.media-widget__subtitle")
					.add(...xml.joinarray([EntityLink.forShow(episode.season.show), EntityLink.forSeason(episode.season)]))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(...tags.map(makeTag))
			)
		);
}

function makeShow(show: Show, play: () => void): xml.XElement {
	const duration_ms = show.seasons.reduce((sum, season) => {
		return sum + season.episodes.reduce((sum, episode) => {
			return sum + episode.segment.file.duration_ms;
		}, 0);
	}, 0);
	let tags = [
		"Show",
		format_duration(duration_ms)
	];
	let isContext = computed((contextPath) => {
		if (!is.present(contextPath)) {
			return false;
		}
		if (contextPath[contextPath.length - 3] !== show.show_id) {
			return false;
		}
		return true;
	}, player.contextPath);
	let isPlaying = computed((isContext, playback) => {
		return isContext && playback;
	}, isContext, player.playback);
	return xml.element("div.media-widget")
		.on("click", () => {
			navigate(`video/shows/${show.show_id}/`)
		})
		.add(xml.element("div.media-widget__artwork")
			.set("style", "padding-bottom: 150%;")
			.add(is.absent(show.artwork) ? undefined : xml.element("div.media-widget__images")
				.add(xml.element("img.media-widget__image")
					.set("src", `/files/${show.artwork.file_id}/?token=${token}`)
				)
			)
			.add(xml.element("div.media-widget__playback")
				.add(xml.element("div.playback-button")
					.add(Icon.makePlay()
						.bind("data-hide", isPlaying.addObserver(a => a))
					)
					.add(Icon.makePause()
						.bind("data-hide", isPlaying.addObserver(a => !a))
					)
					.on("click", (event) => {
						if (isPlaying.getState()) {
							player.pause();
						} else {
							if (isContext.getState()) {
								player.resume();
							} else {
								play();
							}
						}
					})
				)
			)
		)
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(show.title))
				)
				.add(xml.element("div.media-widget__subtitle")
					.add(...xml.joinarray(show.genres.map((genre) => EntityLink.forGenre(genre))))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(...tags.map(makeTag))
			)
		);
}
function makeMovie(movie: Movie, play: () => void = () => player.playMovie(movie)): xml.XElement {
	let title = movie.title;
	let tags = [
		"Movie",
		`${movie.year}`,
		format_duration(movie.segment.file.duration_ms)
	];
	let isContext = computed((contextPath) => {
		if (!is.present(contextPath)) {
			return false;
		}
		if (contextPath[contextPath.length - 1] !== movie.movie_id) {
			return false;
		}
		return true;
	}, player.contextPath);
	let isPlaying = computed((isContext, playback) => {
		return isContext && playback;
	}, isContext, player.playback);
	return xml.element("div.media-widget")
		.on("click", () => {
			navigate(`video/movies/${movie.movie_id}/`)
		})
		.add(xml.element("div.media-widget__artwork")
			.set("style", "padding-bottom: 150%;")
			.add(is.absent(movie.artwork) ? undefined : xml.element("div.media-widget__images")
				.add(xml.element("img.media-widget__image")
					.set("src", `/files/${movie.artwork.file_id}/?token=${token}`)
				)
			)
			.add(xml.element("div.media-widget__playback")
				.add(xml.element("div.playback-button")
					.add(Icon.makePlay()
						.bind("data-hide", isPlaying.addObserver(a => a))
					)
					.add(Icon.makePause()
						.bind("data-hide", isPlaying.addObserver(a => !a))
					)
					.on("click", (event) => {
						if (isPlaying.getState()) {
							player.pause();
						} else {
							if (isContext.getState()) {
								player.resume();
							} else {
								play();
							}
						}
					})
				)
			)
		)
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(title))
				)
				.add(xml.element("div.media-widget__subtitle")
					.add(...xml.joinarray(movie.genres.map((genre) => EntityLink.forGenre(genre))))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(...tags.map(makeTag))
			)
		);
}

function makePlaylist(playlist: Playlist, play: () => void = () => player.playPlaylist(playlist)): xml.XElement {
	let duration_ms = 0;
	for (let item of playlist.items) {
		duration_ms += item.track.segment.file.duration_ms;
	}
	let isContext = computed((contextPath) => {
		if (!is.present(contextPath)) {
			return false;
		}
		if (contextPath[contextPath.length - 2] !== playlist.playlist_id) {
			return false;
		}
		return true;
	}, player.contextPath);
	let isPlaying = computed((isContext, playback) => {
		return isContext && playback;
	}, isContext, player.playback);
	return xml.element("div.media-widget")
		.on("click", () => {
			navigate(`audio/playlists/${playlist.playlist_id}/`);
		})
		.add(xml.element("div.media-widget__artwork")
			.add(xml.element("div.media-widget__playback")
				.add(xml.element("div.playback-button")
					.add(Icon.makePlay()
						.bind("data-hide", isPlaying.addObserver((isPlaying) => isPlaying))
					)
					.add(Icon.makePause()
						.bind("data-hide", isPlaying.addObserver((isPlaying) => !isPlaying))
					)
					.on("click", () => {
						if (isPlaying.getState()) {
							player.pause();
						} else {
							if (isContext.getState()) {
								player.resume();
							} else {
								play();
							}
						}
					})
				)
			)
		)
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(playlist.title))
				)
				.add(xml.element("div.media-widget__subtitle")
					.add(EntityLink.forUser(playlist.user))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(makeTag("Playlist"))
				.add(makeTag(format_duration(duration_ms)))
			)
		);
}

function makeGrid(title: string | undefined, ...elements: xml.XElement[]) {
	return xml.element("div.media-grid")
		.add(!title ? undefined : xml.element("div.media-grid__header")
			.add(renderTextHeader(xml.text(title)))
		)
		.add(xml.element("div.media-grid__content")
			.add(...elements)
		);
}

function renderTextHeader(content: xml.XNode<any>) {
	return xml.element("div.text-header")
		.add(content);
}
function renderTextParagraph(content: xml.XNode<any>) {
	return xml.element("div.text-paragraph")
		.add(content);
}

function maybe<A, B>(value: A | undefined | null, cb: (value: A) => B): B | undefined {
	if (is.present(value)) {
		return cb(value);
	}
}

const makeEntityHeader = (title: string, subtitles: xml.XNode<any>[] = [], tags: Array<string> = [], image?: xml.XElement, playButton?: xml.XElement, description?: string, watched?: boolean) => {
	return xml.element("div.entity-header")
		.add(xml.element("div.entity-header__artwork")
			.add(image)
			.add(xml.element("div.entity-header__playback")
				.add(playButton))
		)
		.add(xml.element("div.entity-header__content")
			.add(xml.element("div.entity-header__whitespace")
				.add(xml.text(".".repeat(1000)))
			)
			.add(xml.element("div.entity-header__metadata")
				.add(xml.element("div.entity-header__titles")
					.add(xml.element("div.entity-header__title")
						.add(xml.text(title))
					)
					.add(subtitles.length === 0 ? undefined : xml.element("div.entity-header__subtitle")
						.add(...xml.joinarray(subtitles))
					)
				)
				.add(xml.element("div.entity-header__tags")
					.add(!watched ? undefined : makeAccentTag("\u2713"))
					.add(...tags.map(makeTag))
				)
				.add(maybe(description, (description) => xml.element("div.entity-header__description")
					.add(xml.text(description)))
				)
			)
		);
}

let updateviewforuri = (uri: string): void => {
	setScrollObserver();
	while (mount.lastChild !== null) {
		mount.removeChild(mount.lastChild);
	}
	let parts: RegExpExecArray | null;
	if (false) {
	} else if ((parts = /^audio[/]tracks[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<{}, api_response.TrackResponse>(`/api/audio/tracks/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let track = response.track;
			mount.appendChild(xml.element("div.content")
				.add(makeEntityHeader(
					track.title,
					[...track.artists.map((artist) => EntityLink.forArtist(artist)), EntityLink.forAlbum(track.disc.album)],
					["Track", `${track.disc.album.year}`, format_duration(track.segment.file.duration_ms)],
					ImageBox.forSquare(is.absent(track.disc.album.artwork) ? undefined : `/files/${track.disc.album.artwork.file_id}/`),
					PlaybackButton.forTrack(track)
				))
				.render());
		});
	} else if ((parts = /^audio[/]tracks[/]([^/?]*)/.exec(uri)) !== null) {
		let query = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let tracks = new ArrayObservable<Track>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.TracksResponse>(`/api/audio/tracks/${encodeURIComponent(query)}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let track of response.tracks) {
						tracks.append(track);
					}
					offset += response.tracks.length;
					if (response.tracks.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Tracks")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(tracks, (track) => EntityRow.forTrack(track))
				)
			)
			.render()
		);
	} else if ((parts = /^video[/]seasons[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<{}, api_response.SeasonResponse>(`/api/video/seasons/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let season = response.season;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forSeason(season)
						.set("data-header", "true")
					)
				)
				.add(xml.element("div.content")
					.add(Grid.make()
						.add(...season.episodes.map((episode, episodeIndex) => {
							return EntityCard.forEpisode(episode, PlaybackButton.forSeason(season, {
								resume: () => player.resume(),
								play: () => player.playSeason(season, episodeIndex)
							}));
						}))
					)
				)
				.render());
		});
	} else if ((parts = /^video[/]seasons[/]([^/?]*)/.exec(uri)) !== null) {
		let query = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let seasons = new ArrayObservable<Season>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.SeasonsResponse>(`/api/video/seasons/${encodeURIComponent(query)}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let season of response.seasons) {
						seasons.append(season);
					}
					offset += response.seasons.length;
					if (response.seasons.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Seasons")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(seasons, (season) => EntityRow.forSeason(season))
				)
			)
			.render()
		);
	} else if ((parts = /^audio[/]discs[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<{}, api_response.DiscResponse>(`/api/audio/discs/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let disc = response.disc;
			let album = disc.album;
			let duration_ms = 0;
			for (let track of disc.tracks) {
				duration_ms += track.segment.file.duration_ms;
			}
			mount.appendChild(xml.element("div.content")
				.add(makeEntityHeader(
					`${disc.album.title} \u00b7 Disc ${disc.number}`,
					disc.album.artists.map((artist) => EntityLink.forArtist(artist)),
					["Disc", `${album.year}`, format_duration(duration_ms)],
					ImageBox.forSquare(is.absent(album.artwork) ? undefined : `/files/${album.artwork.file_id}/`),
					PlaybackButton.forDisc(disc)
				))
				.render());
		});
	} else if ((parts = /^audio[/]discs[/]([^/?]*)/.exec(uri)) !== null) {
		let query = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let discs = new ArrayObservable<Disc>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.DiscsResponse>(`/api/audio/discs/${encodeURIComponent(query)}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let disc of response.discs) {
						discs.append(disc);
					}
					offset += response.discs.length;
					if (response.discs.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Discs")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(discs, (disc) => EntityRow.forDisc(disc))
				)
			)
			.render()
		);
	} else if ((parts = /^users[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<{}, api_response.UserResponse>(`/api/users/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let user = response.user;
			mount.appendChild(xml.element("div.content")
				.add(renderTextHeader(xml.text(user.name)))
				.render());
		});
	} else if ((parts = /^users[/]([^/?]*)/.exec(uri)) !== null) {
		let query = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let users = new ArrayObservable<User>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.UsersResponse>(`/api/users/${encodeURIComponent(query)}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let user of response.users) {
						users.append(user);
					}
					offset += response.users.length;
					if (response.users.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Users")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(users, (user) => EntityRow.forUser(user))
				)
			)
			.render()
		);
	} else if ((parts = /^persons[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<{}, api_response.PersonResponse>(`/api/persons/${parts[1]}/?token=${token}`, {}, (_, response) => {
			let person = response.person;
			let shows = response.shows;
			let movies = response.movies;
			mount.appendChild(xml.element("div.content")
				.set("style", "display: grid; gap: 32px;")
				.add(renderTextHeader(xml.text(person.name)))
				.add(makeGrid("Shows", ...shows.map((show) => makeShow(show, () => player.playShow(show)))))
				.add(makeGrid("Movies", ...movies.map((movie) => makeMovie(movie, () => player.playMovie(movie)))))
				.render());
		});
	} else if ((parts = /^persons[/]([^/?]*)/.exec(uri)) !== null) {
		let query = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let persons = new ArrayObservable<Person>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.PersonsResponse>(`/api/persons/${encodeURIComponent(query)}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let person of response.persons) {
						persons.append(person);
					}
					offset += response.persons.length;
					if (response.persons.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Persons")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(persons, (person) => EntityRow.forPerson(person))
				)
			)
			.render()
		);
	} else if ((parts = /^audio[/]albums[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AlbumResponse>(`/api/audio/albums/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let album = response.album;
			let isContext = computed((contextPath) => {
				if (!is.present(contextPath)) {
					return false;
				}
				if (contextPath[contextPath.length - 3] !== album.album_id) {
					return false;
				}
				return true;
			}, player.contextPath);
			let isPlaying = computed((isContext, playback) => {
				return isContext && playback;
			}, isContext, player.playback);
			let duration_ms = 0;
			for (let disc of album.discs) {
				for (let track of disc.tracks) {
					duration_ms += track.segment.file.duration_ms;
				}
			}
			let header = xml.element("div.content")
				.add(makeEntityHeader(album.title, album.artists.map((artist) => EntityLink.forArtist(artist)), [
					"Album",
					`${album.year}`,
					format_duration(duration_ms)
				], ImageBox.forSquare(is.absent(album.artwork) ? undefined : `/files/${album.artwork.file_id}/`),
					xml.element("div.playback-button")
						.add(Icon.makePlay()
							.bind("data-hide", isPlaying.addObserver(a => a))
						)
						.add(Icon.makePause()
							.bind("data-hide", isPlaying.addObserver(a => !a))
						)
						.on("click", (event) => {
							if (isPlaying.getState()) {
								player.pause();
							} else {
								if (isContext.getState()) {
									player.resume();
								} else {
									player.playAlbum(album);
								}
							}
						})
					))
				.render();
			mount.appendChild(header);
			for (let discIndex = 0; discIndex < album.discs.length; discIndex++) {
				let disc = album.discs[discIndex];
				if (disc.tracks.length > 0) {
					let content = xml.element("div.content")
						.add(xml.element("div.playlist")
							.add(xml.element("div.playlist__header")
								.add(renderTextHeader(xml.text(`Disc ${disc.number}`)))
							)
							.add(xml.element("div.playlist__content")
								.add(...disc.tracks.map((track, trackIndex) => xml.element("div.playlist-item")
									.bind("data-playing", player.contextPath.addObserver((contextPath) => {
										if (is.absent(contextPath)) {
											return false;
										}
										if (contextPath[contextPath.length - 3] !== track.disc.album.album_id) {
											return false;
										}
										if (contextPath[contextPath.length - 2] !== track.disc.disc_id) {
											return false;
										}
										if (contextPath[contextPath.length - 1] !== track.track_id) {
											return false;
										}
										return true;
									}))
									.add(xml.element("div.playlist-item__title")
										.add(xml.text(track.title))
									)
									.add(xml.element("div.playlist-item__subtitle")
										.add(xml.text(track.artists.map((artist) => artist.title).join(" \u00b7 ")))
									)
									.on("click", () => {
										player.playAlbum(album, discIndex, trackIndex);
									})
								))
							)
						);
					mount.appendChild(content.render());
				}
			}
		});
	} else if ((parts = /^audio[/]albums[/]([^/?]*)/.exec(uri)) !== null) {
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let albums = new ArrayObservable<Album>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.AlbumsResponse>(`/api/audio/albums/?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let album of response.albums) {
						albums.append(album);
					}
					offset += response.albums.length;
					if (response.albums.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Albums")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(albums, (album) => makeAlbum(album, () => player.playAlbum(album)))
				)
			)
			.render()
		);
	} else if ((parts = /^audio[/]artists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ArtistResponse>(`/api/audio/artists/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let artist = response.artist;
			let appearances = response.appearances;
			let isContext = computed((contextPath) => {
				if (!is.present(contextPath)) {
					return false;
				}
				if (contextPath[contextPath.length - 4] !== artist.artist_id) {
					return false;
				}
				return true;
			}, player.contextPath);
			let isPlaying = computed((isContext, playback) => {
				return isContext && playback;
			}, isContext, player.playback);
			let duration_ms = 0;
			for (let album of artist.albums) {
				for (let disc of album.discs) {
					for (let track of disc.tracks) {
						duration_ms += track.segment.file.duration_ms;
					}
				}
			}
			let widget = xml.element("div.content")
				.add(makeEntityHeader(
						artist.title,
						[],
						["Artist", format_duration(duration_ms)],
						ImageBox.forSquare(),
						xml.element("div.playback-button")
							.add(Icon.makePlay()
								.bind("data-hide", isPlaying.addObserver(a => a))
							)
							.add(Icon.makePause()
								.bind("data-hide", isPlaying.addObserver(a => !a))
							)
							.on("click", () => {
								if (isPlaying.getState()) {
									player.pause();
								} else {
									if (isContext.getState()) {
										player.resume();
									} else {
										player.playArtist(artist);
									}
								}
							}),
						undefined
					)
				)
				.render();
			mount.appendChild(widget);
			if (artist.albums.length > 0) {
				let content = xml.element("div.content").render();
				mount.appendChild(content);
				let mediaGrid = xml.element("div.media-grid")
					.add(xml.element("div.media-grid__header")
						.add(renderTextHeader(xml.text("Discography")))
					)
					.render();
				content.appendChild(mediaGrid);
				let mediaGrid__content = xml.element("div.media-grid__content")
					.add(...artist.albums.map((album, albumIndex) => {
						return makeAlbum(album, () => player.playArtist(artist, albumIndex));
					}))
				.render();
				mediaGrid.appendChild(mediaGrid__content);
			}
			if (appearances.length > 0) {
				let content = xml.element("div.content").render();
				mount.appendChild(content);
				let mediaGrid = xml.element("div.media-grid")
					.add(xml.element("div.media-grid__header")
						.add(renderTextHeader(xml.text("Appearances")))
					)
					.render();
				content.appendChild(mediaGrid);
				let mediaGrid__content = xml.element("div.media-grid__content").render();
				mediaGrid.appendChild(mediaGrid__content);
				for (let appearance of response.appearances) {
					let widget = makeAlbum(appearance, () => player.playAlbum(appearance))
						.render();
					mediaGrid__content.appendChild(widget);
				}
			}
		});
	} else if ((parts = /^audio[/]artists[/]([^/?]*)/.exec(uri)) !== null) {
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let artists = new ArrayObservable<Artist>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<api_response.ApiRequest, api_response.ArtistsResponse>(`/api/audio/artists/?offset=${offset}&token=${token}`, {}, (status, response) => {
					for (let artist of response.artists) {
						artists.append(artist);
					}
					offset += response.artists.length;
					if (response.artists.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Artists")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(artists, (artist) => makeArtist(artist, () => player.playArtist(artist)))
				)
			)
			.render()
		);
	} else if ((parts = /^audio[/]playlists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.PlaylistResponse>(`/api/audio/playlists/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let playlist = response.playlist;
			let duration_ms = 0;
			for (let item of playlist.items) {
				duration_ms += item.track.segment.file.duration_ms;
			}
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(makeEntityHeader(
							playlist.title,
							[EntityLink.forUser(playlist.user)],
							["Playlist", format_duration(duration_ms)],
							ImageBox.forSquare(),
							undefined,
							playlist.description
						)
					)
				)
				.add(xml.element("div.content")
					.add(xml.element("div.playlist__content")
						.add(...playlist.items.map((item, itemIndex) => xml.element("div.playlist-item")
							.bind("data-playing", player.contextPath.addObserver((contextPath) => {
								if (is.absent(contextPath)) {
									return false;
								}
								if (contextPath[contextPath.length - 2] !== playlist.playlist_id) {
									return false;
								}
								if (contextPath[contextPath.length - 1] !== item.track.track_id) {
									return false;
								}
								return true;
							}))
							.add(xml.element("div.playlist-item__title")
								.add(xml.text(item.track.title))
							)
							.add(xml.element("div.playlist-item__subtitle")
								.add(xml.text(item.track.artists.map((artist) => artist.title).join(" \u00b7 ")))
							)
							.on("click", () => {
								player.playPlaylist(playlist, itemIndex);
							})
						))
					)
				)
			.render());
		});
	} else if ((parts = /^audio[/]playlists[/]([^/?]*)/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.PlaylistsResponse>(`/api/audio/playlists/?token=${token}`, {}, (status, response) => {
			let playlists = response.playlists;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(renderTextHeader(xml.text("Playlists")))
				)
				.add(xml.element("div.content")
					.add(makeGrid(
							undefined,
							...playlists.map((playlist) => makePlaylist(playlist))
						)
					)
				)
			.render());

		});
	} else if ((parts = /^audio[/]/.exec(uri)) !== null) {
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Audio")))
			)
			.add(xml.element("div.content")
				.set("style", "display: grid; gap: 32px;")
				.add(renderTextHeader(EntityLink.for("audio/artists/", "Artists")))
				.add(renderTextHeader(EntityLink.for("audio/albums/", "Albums")))
				.add(renderTextHeader(EntityLink.for("audio/playlists/", "Playlists")))
			)
		.render());
	} else if ((parts = /^video[/]shows[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
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
		req<api_response.ApiRequest, api_response.ShowResponse>(`/api/video/shows/${parts[1]}/?token=${token}`, {}, (status, response) => {
			const show = response.show;
			const duration_ms = show.seasons.reduce((sum, season) => {
				return sum + season.episodes.reduce((sum, episode) => {
					return sum + episode.segment.file.duration_ms;
				}, 0);
			}, 0);
			const indices = getNextEpisode(show);
			const episode = is.absent(indices) ? undefined : show.seasons[indices.seasonIndex].episodes[indices.episodeIndex];
			let isContext = computed((contextPath) => {
				if (!is.present(contextPath)) {
					return false;
				}
				if (contextPath[contextPath.length - 3] !== show.show_id) {
					return false;
				}
				return true;
			}, player.contextPath);
			let isPlaying = computed((isContext, playback) => {
				return isContext && playback;
			}, isContext, player.playback);
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(makeEntityHeader(show.title, undefined, [
						"Show",
						format_duration(duration_ms)
					], ImageBox.forPoster(is.absent(show.artwork) ? undefined : `/files/${show.artwork.file_id}/`)
						.set("style", "padding-bottom: 150%"),
					xml.element("div.playback-button")
						.add(Icon.makePlay()
							.bind("data-hide", isPlaying.addObserver(a => a))
						)
						.add(Icon.makePause()
							.bind("data-hide", isPlaying.addObserver(a => !a))
						)
						.on("click", (event) => {
							if (isPlaying.getState()) {
								player.pause();
							} else {
								if (isContext.getState()) {
									player.resume();
								} else {
									player.playShow(show);
								}
							}
						}),
					show.summary
					)
					)
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 16px;")
					.add(...show.actors.map((actor) => renderTextParagraph(EntityLink.forPerson(actor))))
				)
				.add(xml.element("div.content")
					.add(is.absent(indices) || is.absent(episode) ? undefined : makeGrid("Suggested episodes", ...[
						makeEpisode(episode, () => {
							player.playShow(show, indices.seasonIndex, indices.episodeIndex);
						})
					]))
				)
				.add(...show.seasons.map((season, seasonIndex) => xml.element("div.content")
					.add(xml.element("div.playlist")
						.add(xml.element("div.playlist__header")
							.add(renderTextHeader(xml.text(`Season ${season.number}`)))
							.add(xml.element("div.playlist__tags")
								.add(...getYears(season).map((year) => makeTag(year.toString())))
							)
						)
						.add(xml.element("div.playlist__content")
							.add(...season.episodes.map((episode, episodeIndex) => xml.element("div.playlist-item")
								.bind("data-playing", player.contextPath.addObserver((contextPath) => {
									if (is.absent(contextPath)) {
										return false;
									}
									if (contextPath[contextPath.length - 2] !== episode.season.season_id) {
										return false;
									}
									if (contextPath[contextPath.length - 1] !== episode.episode_id) {
										return false;
									}
									return true;
								}))
								.add(xml.element("div.playlist-item__title")
									.add(xml.text(episode.title))
								)
								.add(xml.element("div.playlist-item__subtitle")
									.add(xml.text(episode.season.show.title))
								)
								.on("click", () => {
									player.playShow(show, seasonIndex, episodeIndex);
								})
							))
						)
					)
				))
				.render()
			);
		});
	} else if ((parts = /^video[/]shows[/]([^/?]*)/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ShowsResponse>(`/api/video/shows/?token=${token}`, {}, (status, response) => {
			let shows = response.shows;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(renderTextHeader(xml.text("Shows")))
				)
				.add(xml.element("div.content")
					.add(makeGrid(undefined, ...shows.map((show) => makeShow(show, () => {
						player.playShow(show);
					}))))
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]episodes[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		let episode_id = parts[1];
		req<api_response.ApiRequest, api_response.EpisodeResponse>(`/api/video/episodes/${episode_id}/?token=${token}`, {}, (status, response) => {
			let episode = response.episode;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forEpisode(episode)
						.set("data-header", "true")
					)
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]episodes[/]([^/?]*)/.exec(uri)) !== null) {
		let query = parts[1];
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let episodes = new ArrayObservable<Episode>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.EpisodesResponse>(`/api/video/episodes/${encodeURIComponent(query)}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let episode of response.episodes) {
						episodes.append(episode);
					}
					offset += response.episodes.length;
					if (response.episodes.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Episodes")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(episodes, (episode) => EntityRow.forEpisode(episode))
				)
			)
			.render()
		);
	} else if ((parts = /^video[/]movies[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		let movie_id = parts[1];
		req<api_response.ApiRequest, api_response.MovieResponse>(`/api/video/movies/${movie_id}/?token=${token}`, {}, (status, response) => {
			let offset = 0;
			let reachedEnd = new ObservableClass(false);
			let isLoading = new ObservableClass(false);
			let movies = new ArrayObservable<Movie>([]);
			setScrollObserver(() => new Promise((resolve, reject) => {
				if (!reachedEnd.getState() && !isLoading.getState()) {
					isLoading.updateState(true);
					req<{}, api_response.MovieMovieSuggestionsResponse>(`/api/video/movies/${movie_id}/suggestions/movies/?offset=${offset}&token=${token}`, {}, (_, response) => {
						for (let movie of response.movies) {
							movies.append(movie);
						}
						offset += response.movies.length;
						if (response.movies.length === 0) {
							reachedEnd.updateState(true);
						}
						isLoading.updateState(false);
						resolve();
					});
				}
			}));
			let movie = response.movie;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(EntityCard.forMovie(movie)
						.set("data-header", "true")
					)
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 16px;")
					.add(...movie.actors.map((actor) => renderTextParagraph(EntityLink.forPerson(actor))))
				)
				.add(xml.element("div.content")
					.bind("data-hide", movies.compute((movies) => movies.length === 0))
					.set("style", "display: grid; gap: 16px;")
					.add(renderTextHeader(xml.text("Suggested movies")))
					.add(Grid.make()
						.repeat(movies, (movie) => EntityCard.forMovie(movie))
					)
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]movies[/]([^/?]*)/.exec(uri)) !== null) {
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let movies = new ArrayObservable<Movie>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<api_response.ApiRequest, api_response.MoviesResponse>(`/api/video/movies/?offset=${offset}&token=${token}`, {}, (status, response) => {
					for (let movie of response.movies) {
						movies.append(movie);
					}
					offset += response.movies.length;
					if (response.movies.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Movies")))
			)
			.add(xml.element("div.content")
				.add(xml.element("div.media-grid__content")
					.repeat(movies, (movie) => makeMovie(movie, () => player.playMovie(movie)))
				)
			)
			.render()
		);
	} else if ((parts = /^video[/]cues[/]([^/?]*)/.exec(uri)) !== null) {
		//navigate(`video/episodes/${episode.episode_id}/${cue.start_ms}/`);
		//navigate(`video/movies/${movie.movie_id}/${cue.start_ms}/`);
		//window.open("/media/gifs/" + cue.cue_id + "/");
		let query = new ObservableClass(decodeURIComponent(parts[1]));
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let cues = new ArrayObservable<Cue & { media: Episode | Movie }>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.CuesResponse>(`/api/video/cues/${encodeURIComponent(query.getState())}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let cue of response.cues) {
						cues.append(cue);
					}
					offset += response.cues.length;
					if (response.cues.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div.content")
			.set("style", "display: grid; gap: 32px;")
			.add(xml.element("input")
				.set("type", "text")
				.set("spellcheck", "false")
				.set("placeholder", "Search for cues...")
				.bind2("value", query)
				.on("keyup", (event) => {
					if (event.key === "Enter") {
						navigate(`video/cues/${encodeURIComponent(query.getState())}/`);
					}
				})
			)
			.add(xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.repeat(cues, (cue) => {
					let media = cue.media;
					if (Episode.is(media)) {
						let episode = media;
						return EntityRow.forEpisode(episode, PlaybackButton.forEpisode(episode, {
							play: () => {
								player.playEpisode(episode);
								player.seek(cue.start_ms / 1000);
							},
							resume: () => {
								player.seek(cue.start_ms / 1000);
								player.resume();
							}
						}));
					}
					if (Movie.is(media)) {
						let movie = media;
						return EntityRow.forMovie(movie, PlaybackButton.forMovie(movie, {
							play: () => {
								player.playMovie(movie);
								player.seek(cue.start_ms / 1000);
							},
							resume: () => {
								player.seek(cue.start_ms / 1000);
								player.resume();
							}
						}));
					}
				})
			)
			.render());
	} else if ((parts = /^video[/]genres[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		let genre_id = parts[1];
		req<{}, api_response.GenreResponse>(`/api/video/genres/${genre_id}/?token=${token}`, {}, (status, response) => {
			let genre = response.genre;
			req<{}, api_response.GenreShowsResponse>(`/api/video/genres/${genre_id}/shows/?token=${token}`, {}, (status, response) => {
				let shows = response.shows;
				req<{}, api_response.GenreMoviesResponse>(`/api/video/genres/${genre_id}/movies/?token=${token}`, {}, (status, response) => {
					let movies = response.movies;
					mount.appendChild(xml.element("div")
						.add(xml.element("div.content")
							.add(renderTextHeader(xml.text(genre.title)))
						)
						.add(shows.length === 0 ? undefined : xml.element("div.content")
							.add(makeGrid("Shows", ...shows.map((show) => makeShow(show, () => {
								player.playShow(show);
							}))))
						)
						.add(movies.length === 0 ? undefined : xml.element("div.content")
							.add(makeGrid("Movies", ...movies.map((movie) => makeMovie(movie, () => {
								player.playMovie(movie);
							}))))
						)
						.render()
					);
				});
			});
		});
	} else if ((parts = /^video[/]genres[/]([^/?]*)/.exec(uri)) !== null) {
		req<{}, api_response.GenresResponse>(`/api/video/genres/?token=${token}`, {}, (status, response) => {
			let genres = response.genres;
			mount.appendChild(xml.element("div")
				.add(xml.element("div.content")
					.add(renderTextHeader(xml.text("Video Genres")))
				)
				.add(xml.element("div.content")
					.set("style", "display: grid; gap: 32px;")
					.add(...genres.map((genre) => renderTextHeader(EntityLink.forGenre(genre))))
				)
				.render()
			);
		});
	} else if ((parts = /^video[/]/.exec(uri)) !== null) {
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Video")))
			)
			.add(xml.element("div.content")
				.set("style", "display: grid; gap: 32px;")
				.add(renderTextHeader(EntityLink.for("video/shows/", "Shows")))
				.add(renderTextHeader(EntityLink.for("video/movies/", "Movies")))
				.add(renderTextHeader(EntityLink.for("video/genres/", "Genres")))
				.add(renderTextHeader(EntityLink.for("video/cues/", "Cues")))
			)
		.render());
	} else if ((parts = /^tokens[/]/.exec(uri)) !== null) {
		req<api_response.TokensRequest, api_response.TokensResponse>(`/api/tokens/?token=${token}`, {}, (status, response) => {
			function renderAccessToken(token: AuthToken): xml.XElement {
				let duration_ms = token.expires_ms - Date.now();
				return xml.element("div.access-token")
					.add(xml.element("div.access-token__title")
						.add(xml.text((token.selector.match(/.{1,2}/g) || []).join(":")))
					)
					.add(xml.element("div.access-token__subtitle")
						.add(xml.text(`Expires in ${format_duration(duration_ms)}.`))
					);
			}
			mount.appendChild(xml.element("div.content")
				.add(xml.element("div.playlist")
					.add(xml.element("div.playlist__header")
						.add(renderTextHeader(xml.text("Tokens")))
					)
					.add(xml.element("div.playlist__content")
						.add(...response.tokens.map((token) => {
							return renderAccessToken(token);
						}))
					)
				)
				.render());
		});
	} else if ((parts = /^search[/]([^/]*)/.exec(uri)) !== null) {
		let query = new ObservableClass(decodeURIComponent(parts[1]));
		let offset = 0;
		let reachedEnd = new ObservableClass(false);
		let isLoading = new ObservableClass(false);
		let entities = new ArrayObservable<Entity>([]);
		setScrollObserver(() => new Promise((resolve, reject) => {
			if (!reachedEnd.getState() && !isLoading.getState()) {
				isLoading.updateState(true);
				req<{}, api_response.SearchResponse>(`/api/search/${encodeURIComponent(query.getState())}?offset=${offset}&token=${token}`, {}, (_, response) => {
					for (let entity of response.entities) {
						entities.append(entity);
					}
					offset += response.entities.length;
					if (response.entities.length === 0) {
						reachedEnd.updateState(true);
					}
					isLoading.updateState(false);
					resolve();
				});
			}
		}));
		mount.appendChild(xml.element("div.content")
			.set("style", "display: grid; gap: 32px;")
			.add(xml.element("input")
				.set("type", "text")
				.set("spellcheck", "false")
				.set("placeholder", "Search for content...")
				.bind2("value", query)
				.on("keyup", (event) => {
					if (event.key === "Enter") {
						navigate(`search/${encodeURIComponent(query.getState())}/`);
					}
				})
			)
			.add(xml.element("div")
				.set("style", "display: grid; gap: 16px;")
				.repeat(entities, (entity) => EntityRow.forEntity(entity))
			)
			.render());
	} else {
		mount.appendChild(xml.element("div")
			.add(xml.element("div.content")
				.add(renderTextHeader(xml.text("Home")))
			)
			.add(xml.element("div.content")
				.set("style", "display: grid; gap: 32px;")
				.add(renderTextHeader(EntityLink.for("audio/", "Audio")))
				.add(renderTextHeader(EntityLink.for("video/", "Video")))
				.add(renderTextHeader(EntityLink.for("search/", "Search")))
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



function navigate (uri: string): void {
	getToken().then((token) => {
		if (token == null) {
			showLogin.updateState(true);
		} else {
			if (window.history.state === null) {
				window.history.replaceState({ 'uri': uri }, '', uri);
			} else {
				if (uri !== window.history.state.uri) {
					window.history.pushState({ 'uri': uri }, '', uri);
				}
			}
			updateviewforuri(uri);
		}
	});
};
navigate(get_route());
window.addEventListener('popstate', (event) => {
	navigate(event.state.uri);
});
