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
import { Album, AlbumBase, Artist, ArtistBase, DiscBase, Episode, EpisodeBase, Movie, MovieBase, SeasonBase, Show, ShowBase, Track, TrackBase } from "./media/schema/objects";















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
		if (Track.is(currentEntry)) {
			let track = currentEntry;
			let disc = track.disc;
			let album = disc.album;
			mediaPlayerTitle.updateState(track.title);
			mediaPlayerSubtitle.updateState(track.artists.map((artist) => artist.title).join(" \u2022 "));
			session.setMetadata({
				title: track.title,
				artist: track.artists.map((artist) => artist.title).join(" \u2022 "),
				album: album.title,
				artwork: is.absent(album.artwork) ? undefined : [
					{
						src: `/files/${album.artwork.file_id}/?token=${token}`,
						sizes: `${album.artwork.width}x${album.artwork.height}`,
						type: album.artwork.mime
					}
				]
			});
		} else if (Movie.is(currentEntry)) {
			let movie = currentEntry;
			mediaPlayerTitle.updateState(movie.title);
			mediaPlayerSubtitle.updateState([ movie.year ].join(" \u2022 "));
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
		} else if (Episode.is(currentEntry)) {
			let episode = currentEntry;
			let season = episode.season;
			let show = season.show;
			mediaPlayerTitle.updateState(episode.title);
			mediaPlayerSubtitle.updateState([
				show.title,
				utils.formatSeasonEpisode(season.number, episode.number)
			].join(" \u2022 "));
			session.setMetadata({
				title: episode.title
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
			lastVideo.src = `/files/${lastLocalEntry.file.file_id}/?token=${token}`;
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
			currentVideo.src = `/files/${currentLocalEntry.file.file_id}/?token=${token}`;
		}
		while (currentVideo.lastChild != null) {
			currentVideo.removeChild(currentVideo.lastChild);
		}
		if (Movie.is(currentLocalEntry) || Episode.is(currentLocalEntry)) {
			let subtitles = currentLocalEntry.subtitles;
			let defaultSubtitle = subtitles.find((subtitle) => subtitle.language === "swe") ?? subtitles.find((subtitle) => subtitle.language === "eng");
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
			lastVideo.src = `/files/${nextLocalEntry.file.file_id}/?token=${token}`;
		}
	};
	player.nextLocalEntry.addObserver(computer);
	player.token.addObserver(computer);
}




























namespace xml {
	export interface Node<A extends globalThis.Node> {
		render(): A;
	}

	export class Text implements Node<globalThis.Text> {
		private content: string | ObservableClass<string>;

		constructor(content: string | ObservableClass<string>) {
			this.content = content;
		}

		render(): globalThis.Text {
			let node = document.createTextNode("");
			if (this.content instanceof ObservableClass) {
				this.content.addObserver((content) => {
					node.textContent = content;
				});
			} else {
				node.textContent = this.content;
			}
			return node;
		}
	}

	export interface Listener<A extends keyof HTMLElementEventMap> {
		(event: HTMLElementEventMap[A]): void;
	}

	export interface Renderer<A> {
		(state: A): XElement;
	}

	export class XElement implements Node<globalThis.Element> {
		private tag: string;
		private attributes: Map<string, string>;
		private children: Array<Node<any>>;
		private bound: Map<string, Observable<any>>;
		private bound2: Map<string, ObservableClass<string>>;
		private listeners: Map<keyof HTMLElementEventMap, Array<Listener<keyof HTMLElementEventMap>>>;
		private array?: ArrayObservable<any>;
		private renderer?: Renderer<any>;

		constructor(selector: string) {
			let parts = selector.split(".");
			this.tag = parts[0];
			this.attributes = new Map<string, string>();
			this.children = new Array<Node<any>>();
			this.bound = new Map<string, Observable<any>>();
			this.bound2 = new Map<string, ObservableClass<string>>();
			this.listeners = new Map<keyof HTMLElementEventMap, Array<Listener<keyof HTMLElementEventMap>>>();
			let classes = parts.slice(1).join(" ");
			if (classes !== "") {
				this.attributes.set("class", classes);
			}
		}

		add(...nodes: Array<Node<any> | null | undefined>): this {
			// TODO: Detach node from current parent.
			for (let node of nodes) {
				if (node != null) {
					this.children.push(node);
				}
			}
			return this;
		}

		bind(key: string, observable: Observable<any>): this {
			this.bound.set(key, observable);
			return this;
		}

		bind2(key: string, observable: ObservableClass<string>): this {
			this.bound2.set(key, observable);
			return this;
		}

		on<A extends keyof HTMLElementEventMap>(kind: A, listener: Listener<A>): this {
			let listeners = this.listeners.get(kind) as Array<Listener<A>> | undefined;
			if (listeners == null) {
				listeners = new Array<Listener<A>>();
				this.listeners.set(kind, listeners as any);
			}
			listeners.push((event) => {
				event.stopPropagation();
				listener(event);
			});
			return this;
		}

		render(): globalThis.Element {
			let ns = ["svg", "path"].indexOf(this.tag) >= 0 ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml";
			let element = document.createElementNS(ns, this.tag);
			for (let [kind, listeners] of this.listeners) {
				for (let listener of listeners) {
					element.addEventListener(kind, listener);
				}
			}
			for (let [key, value] of this.attributes) {
				element.setAttribute(key, value);
			}
			for (let [key, observable] of this.bound) {
				observable((value) => {
					element.setAttribute(key, `${value}`);
				});
			}
			for (let [key, observable] of this.bound2) {
				observable.addObserver((value) => {
					element.setAttribute(key, `${value}`);
				});
				if (this.tag === "input" && key === "value") {
					element.addEventListener("change", () => {
						observable.updateState((element as any).value);
					});
				}
			}
			for (let child of this.children) {
				element.appendChild(child.render());
			}
			if (this.array) {
				this.array.addObserver({
					onupdate: (state) => {
						if (this.renderer) {
							while (element.firstChild) {
								element.firstChild.remove();
							}
							for (let value of state) {
								element.appendChild(this.renderer(value).render());
							}
						}
					}
				})
			}
			return element;
		}

		repeat<A>(array: ArrayObservable<A>, renderer: Renderer<A>): this {
			this.array = array;
			this.renderer = renderer;
			return this;
		}

		set(key: string, value: string = ""): this {
			this.attributes.set(key, value);
			return this;
		}
	}

	export function element(selector: string): XElement {
		return new XElement(selector);
	}

	export function text(content: string | ObservableClass<string>): Text {
		return new Text(content);
	}
}


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

		.page-header__title:active {
			transform: none;
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
		background-color: rgb(63, 63, 63);
		border-radius: 4px;
		color: rgb(255, 255, 255);
		font-size: 16px;
		padding: 8px;
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
		content: "\u2022";
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

	.media-widget__image {
		position: absolute;
		width: 100%;
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





	.image-box {
		border-radius: 2px;
		overflow: hidden;
		padding-bottom: 100%;
		position: relative;
	}

	.image-box__image {
		position: absolute;
		width: 100%;
	}







	.content {
		box-sizing: border-box;
		margin: 0px auto;
		max-width: 960px;
		padding: 32px;
	}













	.text-header {

	}

	.text-header__title {
		color: rgb(159, 159, 159);
		font-size: 20px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}














	.entity-header {
		display: grid;
		gap: 16px;
		grid-auto-flow: row;
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







	.playback-button {
		background-color: rgb(255, 255, 255);
		border-radius: 50%;
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		fill: rgb(31, 31, 31);
		margin: 16px;
		padding: 8px;
		position: absolute;
			bottom: 0%;
			right: 0%;
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

	}

	.playlist__content {
		display: grid;
		gap: 16px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
	}











	.playlist-item {
		cursor: pointer;
		display: grid;
		gap: 8px;
		grid-auto-flow: row;
		grid-auto-rows: max-content;
		transition: padding 0.1s;
	}

	.playlist-item[data-playing="true"] {
		border-left: 4px solid ${ACCENT_COLOR};
		padding-left: 32px;
	}

	@media (hover: hover) and (pointer: fine) {
		.playlist-item:hover {
			border-left: 4px solid rgb(255, 255, 255);
			padding-left: 32px;
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
		overflow: auto;
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

function computeDuration(ms: number): {
	ms: number,
	s: number,
	m: number,
	h: number,
	d: number
} {
	let s = Math.floor(ms / 1000);
	ms -= s * 1000;
	let m = Math.floor(s / 60);
	s -= m * 60;
	let h = Math.floor(m / 60);
	m -= h * 60;
	let d = Math.floor(h / 24);
	h -= d * 24;
	return {
		ms,
		s,
		m,
		h,
		d
	};
}

let format_duration = (ms: number): string => {
	let duration = computeDuration(ms);
	if (duration.d >= 10) {
		return `${duration.d}d`;
	} else if (duration.d >= 1) {
		return `${duration.d}d ${duration.h}h`;
	} else if (duration.h >= 10) {
		return `${duration.h}h`;
	} else if (duration.h >= 1) {
		return `${duration.h}h ${duration.m}m`;
	} else if (duration.m >= 10) {
		return `${duration.m}m`;
	} else if (duration.m >= 1) {
		return `${duration.m}m ${duration.s}s`;
	} else {
		return `${duration.s}s`;
	}
};

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


let tokenobs = new ObservableClass(localStorage.getItem("token") ?? undefined);
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

showVideo.addObserver((showVideo) => {
	if (showVideo) {
		mount.style.setProperty("display", "none");
	} else {
		mount.style.removeProperty("display");
	}
});


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
			.set("placeholder", "Username...")
		)
		.add(xml.element("input.login-modal__password")
			.bind2("value", password)
			.set("type", "password")
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

// move
let devicelist = new ArrayObservable<Device & {
	active: boolean,
	local: boolean,
	remote: boolean
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
				local: localDevice?.id === device.id,
				remote: localDevice?.id !== device.id
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
						.add(makeBroadcastIcon())
					)
					.add(xml.element("div.device-selector__device-info")
						.add(xml.element("div.device-selector__device-name")
							.add(xml.text(device.name))
						)
						.add(xml.element("div.device-selector__device-type")
							.add(xml.text(device.type))
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
	.render();
scroll_container.appendChild(mount);
mountwrapper.appendChild(scroll_container);



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

const makeNextIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M1,15.268c-0.173,0-0.345-0.045-0.5-0.134C0.19,14.955,0,14.625,0,14.268V1.732c0-0.357,0.19-0.688,0.5-0.866C0.655,0.776,0.827,0.732,1,0.732s0.345,0.044,0.5,0.134l10.855,6.269c0.31,0.179,0.5,0.509,0.5,0.866s-0.19,0.688-0.5,0.866L1.5,15.134C1.345,15.223,1.173,15.268,1,15.268z")
	).add(xml.element("path")
		.set("d", "M13,16c-0.553,0-1-0.447-1-1V1c0-0.552,0.447-1,1-1h2c0.553,0,1,0.448,1,1v14c0,0.553-0.447,1-1,1H13z")
	);

const makePrevIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M15,15.268c-0.173,0-0.346-0.045-0.5-0.134L3.645,8.867c-0.31-0.179-0.5-0.509-0.5-0.866s0.19-0.688,0.5-0.866L14.5,0.866c0.154-0.089,0.327-0.134,0.5-0.134s0.346,0.044,0.5,0.134C15.81,1.044,16,1.375,16,1.732v12.536c0,0.357-0.19,0.688-0.5,0.866C15.346,15.223,15.173,15.268,15,15.268z")
	).add(xml.element("path")
		.set("d", "M1,16c-0.552,0-1-0.447-1-1V1c0-0.552,0.448-1,1-1h2c0.552,0,1,0.448,1,1v14c0,0.553-0.448,1-1,1H1z")
	);

const makeHomeIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M3,16c-0.552,0-1-0.447-1-1V9H1.334C0.929,9,0.563,8.755,0.409,8.38C0.255,8.005,0.342,7.574,0.631,7.289l6.662-6.59C7.488,0.506,7.742,0.41,7.996,0.41c0.256,0,0.512,0.098,0.707,0.293L11,3V2c0-0.552,0.447-1,1-1h1c0.553,0,1,0.448,1,1v4l1.293,1.293c0.286,0.286,0.372,0.716,0.217,1.09C15.355,8.756,14.99,9,14.586,9H14v6c0,0.553-0.447,1-1,1H3z")
	);

const makeFullscreenIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M10.343,8.071c-0.266,0-0.52-0.105-0.707-0.293L8.222,6.364c-0.391-0.391-0.391-1.023,0-1.414l2.121-2.121L9.222,1.707C8.936,1.421,8.85,0.991,9.005,0.617C9.16,0.244,9.524,0,9.929,0H15c0.553,0,1,0.448,1,1v5.071c0,0.404-0.243,0.769-0.617,0.924C15.259,7.046,15.129,7.071,15,7.071c-0.26,0-0.516-0.102-0.707-0.293l-1.121-1.121L11.05,7.778C10.862,7.966,10.608,8.071,10.343,8.071L10.343,8.071z")
	)
	.add(xml.element("path")
		.set("d", "M1,16c-0.552,0-1-0.447-1-1V9.929C0,9.524,0.244,9.16,0.617,9.005C0.741,8.954,0.871,8.929,1,8.929c0.26,0,0.516,0.102,0.707,0.293l1.122,1.121L4.95,8.222c0.195-0.195,0.451-0.293,0.707-0.293s0.512,0.098,0.707,0.293l1.415,1.414c0.188,0.188,0.293,0.441,0.293,0.707c0,0.265-0.105,0.52-0.293,0.707l-2.122,2.122l1.121,1.121c0.286,0.286,0.372,0.716,0.217,1.09S6.475,16,6.071,16H1z")
	);

const makeBackIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M13,15.268c-0.173,0-0.346-0.045-0.5-0.134L1.645,8.867c-0.31-0.179-0.5-0.509-0.5-0.866s0.19-0.688,0.5-0.866L12.5,0.866c0.154-0.089,0.327-0.134,0.5-0.134s0.346,0.044,0.5,0.134C13.81,1.044,14,1.375,14,1.732v12.536c0,0.357-0.19,0.688-0.5,0.866C13.346,15.223,13.173,15.268,13,15.268z")
	);

const makeBroadcastIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M1,16c-0.552,0-1-0.447-1-1v-1.829c0-0.325,0.158-0.629,0.423-0.816C0.594,12.233,0.795,12.171,1,12.171c0.112,0,0.226,0.019,0.334,0.058c1.144,0.405,2.032,1.294,2.438,2.438c0.109,0.306,0.062,0.646-0.125,0.911C3.458,15.843,3.153,16,2.829,16H1z")
	)
	.add(xml.element("path")
		.set("d", "M6.929,16c-0.498,0-0.919-0.365-0.99-0.857c-0.376-2.616-2.465-4.706-5.081-5.081C0.366,9.99,0,9.568,0,9.071l0-2.016C0,6.771,0.121,6.5,0.333,6.31C0.517,6.145,0.754,6.055,1,6.055c0.037,0,0.073,0.002,0.11,0.006c4.604,0.511,8.317,4.224,8.829,8.829c0.031,0.282-0.059,0.565-0.248,0.777C9.5,15.879,9.229,16,8.945,16H6.929z")
	)
	.add(xml.element("path")
		.set("d", "M12.962,16c-0.522,0-0.957-0.402-0.997-0.924C11.518,9.229,6.771,4.482,0.924,4.035C0.403,3.996,0,3.561,0,3.038l0-2.005c0-0.276,0.115-0.541,0.316-0.73C0.502,0.129,0.747,0.033,1,0.033c0.022,0,0.044,0,0.066,0.002c7.968,0.527,14.373,6.933,14.899,14.898c0.018,0.276-0.079,0.548-0.268,0.75C15.508,15.886,15.243,16,14.967,16H12.962z")
	);;

const makePlayIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M3,15.268c-0.173,0-0.345-0.045-0.5-0.134C2.19,14.955,2,14.625,2,14.268V1.732c0-0.357,0.19-0.688,0.5-0.866C2.655,0.776,2.827,0.732,3,0.732s0.345,0.044,0.5,0.134l10.855,6.269c0.31,0.179,0.5,0.509,0.5,0.866s-0.19,0.688-0.5,0.866L3.5,15.134C3.345,15.223,3.173,15.268,3,15.268z")
	);

const makePauseIcon = () => xml.element("svg")
	.set("width", "12px")
	.set("height", "12px")
	.set("viewBox", "0 0 16 16")
	.add(xml.element("path")
		.set("d", "M3,16c-0.552,0-1-0.447-1-1V1c0-0.552,0.448-1,1-1h2c0.552,0,1,0.448,1,1v14c0,0.553-0.448,1-1,1H3z")
	)
	.add(xml.element("path")
		.set("d", "M11,16c-0.553,0-1-0.447-1-1V1c0-0.552,0.447-1,1-1h2c0.553,0,1,0.448,1,1v14c0,0.553-0.447,1-1,1H11z")
	);

const makeButton = () => xml.element("div.icon-button");
const makeLink = (url: string) => xml.element("a")
	.set("href", url)
	.on("click", (event) => {
		navigate(url);
	});

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
				.bind("data-active", player.isDeviceRemote.addObserver((isDeviceRemote) => {
					return isDeviceRemote === true;
				}))
				.add(makeBroadcastIcon())
				.on("click", () => {
					showDevices.updateState(!showDevices.getState());
				})
			)
			.add(makeButton()
				.bind("data-enabled", player.canPlayLast.addObserver(a => a))
				.add(makePrevIcon())
				.on("click", () => {
					player.last();
				})
			)
			.add(makeButton()
				.bind("data-enabled", player.canPlayCurrent.addObserver(a => a))
				.add(makePlayIcon()
					.bind("data-hide", player.playback.addObserver((playback) => {
						return playback === true;
					}))
				)
				.add(makePauseIcon()
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
				.add(makeNextIcon())
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

scroll_container.appendChild(videowrapper);
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
function makeAlbum(album: ContextAlbum, play: () => void): xml.XElement {
	let duration_ms = 0;
	for (let disc of album.discs) {
		for (let track of disc.tracks) {
			duration_ms += track.file.duration_ms;
		}
	}
	let title = album.title;
	let subtitle = album.artists.map(artist => artist.title).join(" \u2022 ");
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
			.add(is.absent(album.artwork) ? undefined : xml.element("img.media-widget__image")
				.set("src", `/files/${album.artwork.file_id}/?token=${token}`)
			)
			.add(xml.element("div.playback-button")
				.add(makePlayIcon()
					.bind("data-hide", isPlaying.addObserver(a => a))
				)
				.add(makePauseIcon()
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
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(title))
				)
				.add(xml.element("div.media-widget__subtitle")
					.add(xml.text(subtitle))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(...tags.map(makeTag))
			)
		)
}
function makeMovie(movie: Movie, play: () => void): xml.XElement {
	let title = movie.title;
	let subtitle = [].join(" \u2022 ");
	let tags = [
		"Movie",
		`${movie.year}`,
		format_duration(movie.file.duration_ms)
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
			.add(is.absent(movie.artwork) ? undefined : xml.element("img.media-widget__image")
				.set("src", `/files/${movie.artwork.file_id}/?token=${token}`)
			)
			.add(xml.element("div.playback-button")
				.add(makePlayIcon()
					.bind("data-hide", isPlaying.addObserver(a => a))
				)
				.add(makePauseIcon()
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
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(title))
				)
				.add(subtitle === "" ? undefined : xml.element("div.media-widget__subtitle")
					.add(xml.text(subtitle))
				)
			)
			.add(xml.element("div.media-widget__tags")
				.add(...tags.map(makeTag))
			)
		);
}

function makeGrid(title: string | undefined, ...elements: xml.XElement[]) {
	return xml.element("div.media-grid")
		.add(!title ? undefined : xml.element("div.media-grid__header")
			.add(renderTextHeader(title))
		)
		.add(xml.element("div.media-grid__content")
			.add(...elements)
		);
}

function makeImage(file_id: string) {
	return xml.element("div.image-box")
		.add(xml.element("img.image-box__image")
			.set("src", `/files/${file_id}/?token=${token}`)
		);
}
function renderTextHeader(title: string) {
	return xml.element("div.text-header")
		.add(xml.element("div.text-header__title")
			.add(xml.text(title))
		);
}
const makeEntityHeader = (title: string, subtitle: string | null, tags: Array<string> = []) => {
	return xml.element("div.entity-header")
		.add(xml.element("div.entity-header__titles")
			.add(xml.element("div.entity-header__title")
				.add(xml.text(title))
			)
			.add(subtitle == null ? null : xml.element("div.entity-header__subtitle")
				.add(xml.text(subtitle))
			)
		)
		.add(xml.element("div.entity-header__tags")
			.add(...tags.map(makeTag))
		);
}

function pluralize(amount: number, zero: string, one: string, many: string): string {
	if (amount >= 2) {
		return amount + " " + many;
	}
	if (amount >= 1) {
		return amount + " " + one;
	}
	if (amount >= 0) {
		return amount + " " + zero;
	}
	throw "Expected a non-negative amount!";
}

// TODO: Make API and Context consistent.
function translateMovieResponse(rmovie: api_response.MovieResponse): Movie {
	let movie: MovieBase = {
		movie_id: rmovie.movie_id,
		title: rmovie.title,
		year: rmovie.year,
		summary: rmovie.summary ?? "",
		artwork: is.absent(rmovie.poster_file_id) ? undefined : {
			file_id: rmovie.poster_file_id,
			mime: "image/jpg",
			height: 720,
			width: 1080
		},
		file: {
			file_id: rmovie.movie_parts[0].file_id,
			mime: "video/mp4",
			duration_ms: rmovie.movie_parts[0].duration
		},
		subtitles: rmovie.movie_parts[0].subtitles.map((rsubtitle) => ({
			file_id: rsubtitle.file_id,
			mime: "text/vtt",
			language: rsubtitle.language ?? undefined
		}))
	};
	return movie;
}
function translateShowResponse(rshow: api_response.ShowResponse): Show {
	let show: ShowBase = {
		show_id: rshow.show_id,
		title: rshow.title
	};
	return {
		...show,
		seasons: rshow.seasons.map((rseason) => {
			let season: SeasonBase = {
				season_id: rseason.season_id,
				number: rseason.number,
				show: show
			};
			return {
				...season,
				episodes: rseason.episodes.map((repisode) => {
					let episode: EpisodeBase = {
						episode_id: repisode.episode_id,
						title: repisode.title,
						summary: repisode.summary ?? "",
						number: repisode.number,
						file: {
							file_id: repisode.file_id,
							mime: "video/mp4",
							duration_ms: repisode.duration
						},
						subtitles: repisode.subtitles.map((rsubtitle) => ({
							file_id: rsubtitle.file_id,
							mime: "text/vtt",
							language: rsubtitle.language ?? undefined
						})),
						season: season
					};
					return episode;
				})
			}
		})
	};
}
function translateAlbumResponse(ralbum: api_response.AlbumResponse): ContextAlbum {
	let album: AlbumBase = {
		album_id: ralbum.album_id,
		title: ralbum.title,
		year: ralbum.year,
		artists: ralbum.artists.map((artist) => ({
			artist_id: artist.artist_id,
			title: artist.title
		})),
		artwork: is.absent(ralbum.cover_file_id) ? undefined : {
			file_id: ralbum.cover_file_id,
			mime: "image/jpg",
			height: 1080,
			width: 1080
		}
	};
	return {
		...album,
		discs: ralbum.discs.map((rdisc) => {
			let disc: DiscBase = {
				disc_id: rdisc.disc_id,
				album: album
			};
			return {
				...disc,
				tracks: rdisc.tracks.map((rtrack) => {
					let track: TrackBase = {
						track_id: rtrack.track_id,
						title: rtrack.title,
						disc: disc,
						artists: rtrack.artists.map((rartist) => ({
							artist_id: rartist.artist_id,
							title: rartist.title
						})),
						file: {
							file_id: rtrack.file_id,
							mime: "audio/mp4",
							duration_ms: rtrack.duration
						}
					};
					return track;
				})
			}
		})
	};
}
function translateArtistResponse(rartist: api_response.ArtistResponse): ContextArtist {
	let artist: ArtistBase = {
		artist_id: rartist.artist_id,
		title: rartist.title,
	};
	return {
		...artist,
		albums: rartist.albums.map(translateAlbumResponse)
	};
}

let updateviewforuri = (uri: string): void => {
	while (mount.lastChild !== null) {
		mount.removeChild(mount.lastChild);
	}
	let parts: RegExpExecArray | null;
	if ((parts = /^audio[/]albums[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AlbumResponse>(`/api/audio/albums/${parts[1]}/`, {}, (status, response) => {
			let context = translateAlbumResponse(response);
			let duration_ms = 0;
			for (let disc of response.discs) {
				for (let track of disc.tracks) {
					duration_ms += track.duration;
				}
			}
			let header = xml.element("div.content")
				.add(makeEntityHeader(response.title, response.artists.map(artist => artist.title).join(" \u2022 "), [
					"Album",
					`${response.year}`,
					format_duration(duration_ms)
				]))
				.render();
			mount.appendChild(header);
			if (response.cover_file_id) {
				mount.appendChild(xml.element("div.content")
					.add(xml.element("div.media-grid")
						.add(xml.element("div.media-grid__header")
							.add(renderTextHeader("Artwork"))
						)
						.add(xml.element("div.media-grid__content")
							.add(makeImage(response.cover_file_id))
						)
					)
					.render());
			}
			for (let discIndex = 0; discIndex < response.discs.length; discIndex++) {
				let disc = context.discs[discIndex];
				if (disc.tracks.length > 0) {
					let content = xml.element("div.content")
						.add(xml.element("div.playlist")
							.add(xml.element("div.playlist__header")
								.add(renderTextHeader("Tracks"))
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
										.add(xml.text(track.artists.map((artist) => artist.title).join(" \u2022 ")))
									)
									.on("click", () => {
										player.playAlbum(context, discIndex, trackIndex);
									})
								))
							)
						);
					mount.appendChild(content.render());
				}
			}
		});
	} else if ((parts = /^audio[/]albums[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AlbumsResponse>(`/api/audio/albums/`, {}, (status, response) => {
			for (let album of response.albums) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '24px');
				d.innerText = `${album.title}`;
				d.addEventListener('click', () => {
					navigate(`audio/albums/${album.album_id}/`);
				});
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^audio[/]artists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ArtistResponse>(`/api/audio/artists/${parts[1]}/`, {}, (status, response) => {
			let context = translateArtistResponse(response);
			let duration_ms = 0;
			for (let album of response.albums) {
				for (let disc of album.discs) {
					for (let track of disc.tracks) {
						duration_ms += track.duration;
					}
				}
			}
			let widget = xml.element("div.content")
				.add(makeEntityHeader(response.title, null, [
					"Artist",
					format_duration(duration_ms)
				]))
				.render();
			mount.appendChild(widget);
			if (context.albums.length > 0) {
				let content = xml.element("div.content").render();
				mount.appendChild(content);
				let mediaGrid = xml.element("div.media-grid")
					.add(xml.element("div.media-grid__header")
						.add(renderTextHeader("Discography"))
					)
					.render();
				content.appendChild(mediaGrid);
				let mediaGrid__content = xml.element("div.media-grid__content")
					.add(...context.albums.map((album, albumIndex) => {
						return makeAlbum(album, () => player.playArtist(context, albumIndex));
					}))
				.render();
				mediaGrid.appendChild(mediaGrid__content);
			}
			if (response.appearances.length > 0) {
				let content = xml.element("div.content").render();
				mount.appendChild(content);
				let mediaGrid = xml.element("div.media-grid")
					.add(xml.element("div.media-grid__header")
						.add(renderTextHeader("Appearances"))
					)
					.render();
				content.appendChild(mediaGrid);
				let mediaGrid__content = xml.element("div.media-grid__content").render();
				mediaGrid.appendChild(mediaGrid__content);
				for (let album of response.appearances) {
					let context = translateAlbumResponse(album);
					let widget = makeAlbum(context, () => player.playAlbum(context))
						.render();
					mediaGrid__content.appendChild(widget);
				}
			}
		});
	} else if ((parts = /^audio[/]artists[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ArtistsResponse>(`/api/audio/artists/`, {}, (status, response) => {
			for (let artist of response.artists) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '24px');
				d.innerText = `${artist.title}`;
				d.addEventListener('click', () => {
					navigate(`audio/artists/${artist.artist_id}/`);
				});
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^audio[/]lists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AudiolistResponse>(`/api/audio/lists/${parts[1]}/`, {}, (status, response) => {
			let a = document.createElement('div');
			a.style.setProperty('font-size', '24px');
			a.innerText = `${response.title}`;
			mount.appendChild(a);
			for (let item of response.items) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '16px');
				d.innerText = `${item.track.title}`;
				d.addEventListener('click', () => {
					//player.play(context, context.findIndex(entry => entry.file_id === item.track.file_id), 0);
				});
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^audio[/]lists[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AudiolistsResponse>(`/api/audio/lists/`, {}, (status, response) => {
			for (let list of response.audiolists) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '24px');
				d.innerText = `${list.title}`;
				d.addEventListener('click', () => {
					navigate(`audio/lists/${list.audiolist_id}/`);
				});
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^audio[/]/.exec(uri)) !== null) {
		let d = document.createElement('div');
		d.innerText = 'Artists';
		d.style.setProperty('font-size', '24px');
		d.addEventListener('click', () => {
			navigate('audio/artists/');
		});
		mount.appendChild(d);
		let d2 = document.createElement('div');
		d2.style.setProperty('font-size', '24px');
		d2.innerText = 'Albums';
		d2.addEventListener('click', () => {
			navigate('audio/albums/');
		});
		mount.appendChild(d2);
		let d3 = document.createElement('div');
		d3.style.setProperty('font-size', '24px');
		d3.innerText = 'Lists';
		d3.addEventListener('click', () => {
			navigate('audio/lists/');
		});
		mount.appendChild(d3);
	} else if ((parts = /^video[/]shows[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		function getNextEpisode(show: api_response.ShowResponse): api_response.EpisodeResponse & { season: number } {
			let episodes = show.seasons.reduce((array, season) => {
				return array.concat(season.episodes.map((episodes) => {
					return {
						...episodes,
						season: season.number
					};
				}));
			}, new Array<api_response.EpisodeResponse & { season: number }>());
			let lastIndex = episodes.length - 1;
			for (let i = 0; i < episodes.length; i++) {
				if ((episodes[i].streamed || 0) > (episodes[lastIndex].streamed || 0)) {
					lastIndex = i;
				}
			}
			let nextIndex = (lastIndex + 1) % episodes.length;
			return episodes[nextIndex];
		}
		req<api_response.ApiRequest, api_response.ShowResponse>(`/api/video/shows/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let d = document.createElement('div');
			d.innerText = `${response.title}`;
			mount.appendChild(d);
/* 			let context: schema.objects.Context = response.seasons.reduce((files, season) => {
					files.push(...season.episodes.map(episode => {
						return {
							file_id: episode.file_id,
							title: episode.title,
							subtitle: [response.title, utils.formatSeasonEpisode(season.number, episode.number)].join(" \u2022 ")
						};
					}));
					return files;
				}, new Array<schema.objects.ContextItem>()); */
			let nextEpisode = getNextEpisode(response);
			{
				let d2 = document.createElement("div");
				d2.classList.add("group");
				let h4 = document.createElement("h4");
				h4.style.setProperty("font-size", "12px");
				h4.textContent = "s" + nextEpisode.season.toString().padStart(2, "0") + "e" + nextEpisode.number.toString().padStart(2, "0") + ": " + nextEpisode.title;
				let p1 = document.createElement("p");
				p1.style.setProperty("font-size", "16px");
				p1.textContent = nextEpisode.summary;
				let p2 = document.createElement("p");
				p2.style.setProperty("font-size", "16px");
				p2.textContent = [
					format_duration(nextEpisode.duration)
				].join(" \u2022 ");
				let button = document.createElement("button");
				button.textContent = "Watch";
				button.addEventListener("click", () => {
					//player.play(context, context.findIndex(entry => entry.file_id === nextEpisode.file_id), 0);
				});
				d2.appendChild(h4);
				d2.appendChild(p1);
				d2.appendChild(p2);
				d2.appendChild(button);
				d.appendChild(d2);
			}
			for (let season of response.seasons) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '24px');
				d.innerText = `${season.number}`;
				mount.appendChild(d);
				for (let episode of season.episodes) {
					let d2 = document.createElement('div');
					if (episode.streamed != null) {
						d2.classList.add("watched");
					}
					d2.style.setProperty('font-size', '16px');
					d2.innerText = `${episode.title} ${format_duration(episode.duration)}`;
					d2.addEventListener('click', () => {
						//player.play(context, context.findIndex(entry => entry.file_id === episode.file_id), 0);
					});
					mount.appendChild(d2);
				}
			}
		});
	} else if ((parts = /^video[/]shows[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ShowsResponse>(`/api/video/shows/`, {}, (status, response) => {
			for (let show of response.shows) {
				let wrapper = document.createElement("div");
				wrapper.setAttribute("class", "group");
				let h2 = document.createElement("h2");
				h2.style.setProperty('font-size', '24px');
				h2.innerText = `${show.title}`;
				wrapper.appendChild(h2);
				let p = document.createElement("p");
				p.style.setProperty('font-size', '16px');
				p.innerText = show.genres.map((genre) => genre.title).join(" \u2022 ");
				wrapper.appendChild(p);
				let button = document.createElement("button");
				button.textContent = "Browse";
				button.addEventListener("click", () => {
					navigate(`video/shows/${show.show_id}/`);
				});
				wrapper.appendChild(button);
				mount.appendChild(wrapper);
			}
		});
	} else if ((parts = /^video[/]episodes[/]([0-9a-f]{32})[/](?:([0-9]+)[/])?/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.EpisodeResponse>(`/api/video/episodes/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let d = document.createElement('div');
			d.innerText = `${response.title}`;
			d.style.setProperty('font-size', '24px');
			mount.appendChild(d);
			let d2 = document.createElement('div');
			d2.style.setProperty('font-size', '12px');
			d2.innerText = format_duration(response.duration);
			mount.appendChild(d2);
			let d4 = document.createElement('div');
			d4.style.setProperty('font-size', '16px');
			d4.innerText = response.summary || "";
			mount.appendChild(d4);
/* 			let context: schema.objects.Context = [{
				file_id: response.file_id,
				title: response.title,
				subtitle: ["TOOD", utils.formatSeasonEpisode(0, response.number)].join(" \u2022 ")
			}]; */
			let d3 = document.createElement('button');
			d3.innerText = `load`;
			d3.addEventListener('click', () => {
				let progress = parts != null && parts.length >= 3 ? Number.parseInt(parts[2], 10) / 1000 : 0;
				//player.play(context, context.findIndex(entry => entry.file_id === response.file_id), progress);
			});
			mount.appendChild(d3);
		});
	} else if ((parts = /^video[/]movies[/]([0-9a-f]{32})[/](?:([0-9]+)[/])?/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.MovieResponse>(`/api/video/movies/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let d = document.createElement('div');
			d.innerText = `${response.title} (${response.year})`;
			d.style.setProperty('font-size', '24px');
			mount.appendChild(d);
			let d2 = document.createElement('div');
			d2.style.setProperty('font-size', '24px');
			d2.innerText = response.summary || "";
			mount.appendChild(d2);
/* 			let context: schema.objects.Context = response.movie_parts.map((part) => {
				return {
					file_id: part.file_id,
					title: response.title,
					subtitle: `${response.year}`
				};
			}); */
			let streamed = true;
			let duration = 0;
			for (let movie_part of response.movie_parts) {
				streamed = streamed && (movie_part.streamed != null);
				duration += movie_part.duration;
			}
			let d3 = document.createElement('div');
			if (streamed) {
				d3.classList.add("watched");
			}
			d3.style.setProperty('font-size', '12px');
			d3.innerText = format_duration(duration);
			mount.appendChild(d3);
			let button = document.createElement("button");
			button.innerText = `Play`;
			button.addEventListener('click', () => {
				let progress = parts != null && parts.length >= 3 ? Number.parseInt(parts[2], 10) / 1000 : 0;
				//player.play(context, 0, progress);
			});
			mount.appendChild(button);
			let wrap = document.createElement('div');
			let img = document.createElement('img');
			img.src = `/files/${response.poster_file_id}/?token=${token}`;
			img.style.setProperty('width', '100%');
			wrap.appendChild(img);
			mount.appendChild(wrap);
		});
	} else if ((parts = /^video[/]movies[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.MoviesResponse>(`/api/video/movies/?token=${token}`, {}, (status, response) => {
			let movies = response.movies.map(translateMovieResponse);
			let element = xml.element("div.content")
				.add(makeGrid(undefined, ...movies.map((movie) => makeMovie(movie, () => player.playMovie(movie)))));
			mount.appendChild(element.render());
		});
	} else if ((parts = /^video[/]cues[/](.*)/.exec(uri)) !== null) {
		let query = decodeURIComponent(parts[1]);
		let wrapper = document.createElement("div");
		let searchbox = document.createElement("input");
		searchbox.setAttribute("type", "text");
		searchbox.setAttribute("placeholder", "Search query...");
		searchbox.setAttribute("value", query);
		wrapper.appendChild(searchbox);
		let searchbutton = document.createElement("button");
		searchbutton.textContent = "Search";
		wrapper.appendChild(searchbutton);
		let results = document.createElement("div");
		wrapper.appendChild(results);
		let cb = () => {
			let new_query = searchbox.value;
			if (new_query !== "" && new_query !== query) {
				navigate("video/cues/" + encodeURIComponent(new_query));
			}
		};
		searchbox.addEventListener("keyup", (event) => {
			if (event.keyCode === 13) {
				cb();
			}
		});
		searchbutton.addEventListener("click", () => {
			cb();
		});
		mount.appendChild(wrapper);
		req<api_response.CuesRequest, api_response.CuesResponse>(`/api/video/cues/`, { query }, (status, response) => {
			while (results.lastChild !== null) {
				results.removeChild(results.lastChild);
			}
			for (let cue of response.cues) {
				let d = document.createElement('div');
				d.classList.add("group");
				if (cue.subtitle.movie_part) {
					let h2 = document.createElement("h2");
					h2.style.setProperty("font-size", "24px");
					h2.innerText = cue.subtitle.movie_part.movie.title;
					d.appendChild(h2);
					let h3 = document.createElement("h3");
					h3.style.setProperty("font-size", "12px");
					h3.innerText = "" + cue.subtitle.movie_part.movie.year;
					d.appendChild(h3);
				} else if (cue.subtitle.episode) {
					let episode = cue.subtitle.episode;
					let h2 = document.createElement("h2");
					h2.style.setProperty("font-size", "24px");
					h2.innerText = episode.title;
					d.appendChild(h2);
					let h3 = document.createElement("h3");
					h3.style.setProperty("font-size", "16px");
					h3.innerText = [
						episode.season.show.title,
						utils.formatSeasonEpisode(episode.season.number, episode.number)
					].join(" \u2022 ");
					d.appendChild(h3);
				}
				let pre = document.createElement("pre");
				pre.style.setProperty("font-size", "16px");
				pre.innerText = `${cue.lines.join("\n")}`;
				d.appendChild(pre);
				let p = document.createElement("p");
				p.style.setProperty("font-size", "12px");
				p.innerText = format_duration(cue.start_ms);
				d.appendChild(p);
				let b1 = document.createElement("button");
				b1.textContent = "Go to video";
				b1.addEventListener("click", () => {
					let episode = cue.subtitle.episode;
					let movie = cue.subtitle.movie_part;
					if (episode != null) {
						navigate(`video/episodes/${episode.episode_id}/${cue.start_ms}/`);
					} else if (movie != null) {
						navigate(`video/movies/${movie.movie_id}/${cue.start_ms}/`);
					}
				});
				d.appendChild(b1);
				let b2 = document.createElement("button");
				b2.textContent = "Generate meme";
				b2.addEventListener("click", () => {
					window.open("/media/gifs/" + cue.cue_id + "/");
				});
				d.appendChild(b2);
				results.appendChild(d);
			}
		});
	} else if ((parts = /^video[/]channels[/]([0-9]+)[/]/.exec(uri)) !== null) {
		let channel_id = parts[1];
		req<api_response.ChannelRequest, api_response.ChannelResponse>(`/api/video/channels/${channel_id}/?token=${token}`, {}, (status, response) => {
			let d = document.createElement('div');
			d.innerText = `Channel`;
			d.style.setProperty('font-size', '24px');
			mount.appendChild(d);
			let button = document.createElement("button");
			button.textContent = "Play";
			button.addEventListener("click", () => {
				//playfile(`/media/channels/${channel_id}/${Date.now()}/`);
			});
			mount.appendChild(button);
/* 			let context: schema.objects.Context = response.segments.reduce((files, segment) => {
				if (segment.movie != null) {
					let title = segment.movie.title;
					return files.concat(segment.movie.movie_parts.map((movie_part) => {
						return {
							file_id: movie_part.file_id,
							title: title,
							subtitle: ""
						};
					}));
				}
				if (segment.episode != null) {
					return files.concat([{
						file_id: segment.episode.file_id,
						title: segment.episode.title,
						subtitle: ""
					}]);
				}
				return files;
			}, new Array<schema.objects.ContextItem>()); */
			for (let segment of response.segments) {
				const movie = segment.movie;
				if (movie != null) {
					for (let movie_part of movie.movie_parts) {
						let d2 = document.createElement("div");
						d2.style.setProperty("display", "flex");
						d2.classList.add("group");
						let left = document.createElement("div");
						left.style.setProperty("width", "25%");
						let image = document.createElement("img");
						image.setAttribute("src", `/files/${movie.poster_file_id || ""}/?token=${token}`);
						image.style.setProperty("width", "100%");
						left.appendChild(image);
						let right = document.createElement("div");
						right.style.setProperty("width", "100%");
						d2.appendChild(left);
						d2.appendChild(right);
						let h3 = document.createElement("h3");
						h3.style.setProperty("font-size", "16px");
						h3.textContent = movie.title;
						let h4 = document.createElement("h4");
						h4.style.setProperty("font-size", "12px");
						h4.textContent = "";
						let p1 = document.createElement("p");
						p1.style.setProperty("font-size", "16px");
						p1.textContent = movie.summary;
						let p2 = document.createElement("p");
						p2.style.setProperty("font-size", "16px");
						p2.textContent = [
							movie.year.toString().padStart(4, "0"),
							format_duration(movie_part.duration)
						].join(" \u2022 ");
						let button = document.createElement("button");
						button.textContent = "Play";
						button.addEventListener("click", () => {
							//player.play(context, context.findIndex(entry => entry.file_id === movie_part.file_id), 0);
						});
						right.appendChild(h3);
						right.appendChild(h4);
						right.appendChild(p1);
						right.appendChild(p2);
						right.appendChild(button);
						mount.appendChild(d2);
					}
					continue;
				}
				const episode = segment.episode;
				if (episode != null) {
					let d2 = document.createElement("div");
					d2.classList.add("group");
					let h3 = document.createElement("h3");
					h3.style.setProperty("font-size", "16px");
					h3.textContent = episode.season.show.title;
					let h4 = document.createElement("h4");
					h3.style.setProperty("font-size", "12px");
					h4.textContent = "s" + episode.season.number.toString().padStart(2, "0") + "e" + episode.number.toString().padStart(2, "0") + ": " + episode.title;
					let p1 = document.createElement("p");
					p1.style.setProperty("font-size", "16px");
					p1.textContent = episode.summary;
					let p2 = document.createElement("p");
					p2.style.setProperty("font-size", "16px");
					p2.textContent = [
						format_duration(episode.duration)
					].join(" \u2022 ");
					let button = document.createElement("button");
					button.textContent = "Play";
					button.addEventListener("click", () => {
						//player.play(context, context.findIndex(entry => entry.file_id === episode.file_id), 0);
					});
					d2.appendChild(h3);
					d2.appendChild(h4);
					d2.appendChild(p1);
					d2.appendChild(p2);
					d2.appendChild(button);
					mount.appendChild(d2);
					continue;
				}
			}
		});
	} else if ((parts = /^video[/]channels[/]/.exec(uri)) !== null) {
		req<api_response.ChannelsRequest, api_response.ChannelsResponse>(`/api/video/channels/`, {}, (status, response) => {
			for (let channel of response.channels) {
				let d = document.createElement('div');
				d.classList.add("group");
				let h2 = document.createElement("h2");
				h2.textContent = `Channel ${channel.channel_id}`;
				h2.style.setProperty("font-size", "24px");
				d.appendChild(h2);
				let p = document.createElement("p");
				p.style.setProperty("font-size", "16px");
				p.textContent = channel.title;
				d.appendChild(p);
				let b = document.createElement("button");
				b.textContent = "View";
				b.addEventListener('click', () => {
					navigate(`video/channels/${channel.channel_id}/`);
				});
				d.appendChild(b);
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^video[/]genres[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		let genre_id = parts[1];
		req<api_response.GenreRequest, api_response.GenreResponse>(`/api/video/genres/${genre_id}/`, {}, (status, response) => {
			let movies = document.createElement("div");
			for (let movie of response.movies) {
				let d2 = document.createElement("div");
				d2.style.setProperty("display", "flex");
				d2.classList.add("group");
				let left = document.createElement("div");
				left.style.setProperty("width", "25%");
				let image = document.createElement("img");
				image.setAttribute("src", `/files/${movie.poster_file_id || ""}/?token=${token}`);
				image.style.setProperty("width", "100%");
				left.appendChild(image);
				let right = document.createElement("div");
				right.style.setProperty("width", "100%");
				d2.appendChild(left);
				d2.appendChild(right);
				let h3 = document.createElement("h3");
				h3.style.setProperty("font-size", "16px");
				h3.textContent = movie.title;
				let h4 = document.createElement("h4");
				h4.style.setProperty("font-size", "12px");
				h4.textContent = "";
				let p1 = document.createElement("p");
				p1.style.setProperty("font-size", "16px");
				p1.textContent = movie.summary;
				let p2 = document.createElement("p");
				p2.style.setProperty("font-size", "16px");
				p2.textContent = [
					movie.year.toString().padStart(4, "0")
				].join(" | ");
				let button = document.createElement("button");
				button.textContent = "View";
				button.addEventListener("click", () => {
					navigate(`video/movies/${movie.movie_id}/`);
				});
				right.appendChild(h3);
				right.appendChild(h4);
				right.appendChild(p1);
				right.appendChild(p2);
				right.appendChild(button);
				movies.appendChild(d2);
			}
			let shows = document.createElement("div");
			for (let show of response.shows) {
				let d2 = document.createElement("div");
				d2.classList.add("group");
				let h3 = document.createElement("h3");
				h3.style.setProperty("font-size", "16px");
				h3.textContent = show.title;
				d2.appendChild(h3);
				let button = document.createElement("button");
				button.textContent = "View";
				button.addEventListener("click", () => {
					navigate(`video/shows/${show.show_id}/`);
				});
				shows.appendChild(d2);
			}
			mount.appendChild(movies);
			mount.appendChild(shows);
		});
	} else if ((parts = /^video[/]genres[/]/.exec(uri)) !== null) {
		req<api_response.GenresRequest, api_response.GenresResponse>(`/api/video/genres/`, {}, (status, response) => {
			for (let genre of response.genres) {
				let d = document.createElement('div');
				d.classList.add("group");
				let h2 = document.createElement("h2");
				h2.style.setProperty("font-size", "24px");
				h2.textContent = `${genre.title}`;
				d.appendChild(h2);
				let b = document.createElement("button");
				b.textContent = "Browse";
				b.addEventListener('click', () => {
					navigate(`video/genres/${genre.video_genre_id}/`);
				});
				d.appendChild(b);
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^video[/]/.exec(uri)) !== null) {
		let d = document.createElement('div');
		d.style.setProperty("font-size", "24px");
		d.innerText = 'Shows';
		d.addEventListener('click', () => {
			navigate('video/shows/');
		});
		mount.appendChild(d);
		d = document.createElement('div');
		d.style.setProperty("font-size", "24px");
		d.innerText = 'Movies';
		d.addEventListener('click', () => {
			navigate('video/movies/');
		});
		mount.appendChild(d);
		d = document.createElement('div');
		d.style.setProperty("font-size", "24px");
		d.innerText = 'Cues';
		d.addEventListener('click', () => {
			navigate('video/cues/');
		});
		mount.appendChild(d);
		d = document.createElement('div');
		d.style.setProperty("font-size", "24px");
		d.innerText = 'Channels';
		d.addEventListener('click', () => {
			navigate('video/channels/');
		});
		mount.appendChild(d);
		d = document.createElement('div');
		d.style.setProperty("font-size", "24px");
		d.innerText = 'Genres';
		d.addEventListener('click', () => {
			navigate('video/genres/');
		});
		mount.appendChild(d);
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
						.add(renderTextHeader("Tokens"))
					)
					.add(xml.element("div.playlist__content")
						.add(...response.tokens.map((token) => {
							return renderAccessToken(token);
						}))
					)
				)
				.render());
		});
	} else if ((parts = /^search[/](.*)/.exec(uri)) !== null) {
		let query = decodeURIComponent(parts[1]);
		{
			let input = document.createElement("input");
			input.setAttribute("placeholder", "Search for content...");
			input.setAttribute("type", "text");
			input.setAttribute("value", query);
			input.addEventListener("keyup", (event) => {
				if (event.key === "Enter") {
					let new_query = input.value;
					if (new_query !== "" && new_query !== query) {
						navigate("search/" + encodeURIComponent(new_query));
					}
				}
			});
			mount.appendChild(input);
		}
		{
			let results = document.createElement("div");
			mount.appendChild(results);
			req<api_response.SearchRequest, api_response.SearchResponse>(`/api/search/${parts[1]}`, {}, (status, response) => {
				while (results.lastChild !== null) {
					results.removeChild(results.lastChild);
				}
				if (response.movies.length > 0) {
					{
						let h2 = document.createElement("h2");
						h2.style.setProperty("font-size", "24px");
						h2.textContent = "Movies";
						results.appendChild(h2);
					}
					for (let movie of response.movies) {
						let wrapper = document.createElement("div");
						wrapper.setAttribute("class", "group");
						let p = document.createElement("p");
						p.style.setProperty("font-size", "16px");
						p.textContent = movie.title;
						let button = document.createElement("button");
						button.textContent = "View";
						button.addEventListener("click", () => {
							navigate(`video/movies/${movie.movie_id}/`);
						});
						wrapper.appendChild(p);
						wrapper.appendChild(button);
						results.appendChild(wrapper);
					}
				}
				if (response.episodes.length > 0) {
					{
						let h2 = document.createElement("h2");
						h2.style.setProperty("font-size", "24px");
						h2.textContent = "Episodes";
						results.appendChild(h2);
					}
					for (let episode of response.episodes) {
						let wrapper = document.createElement("div");
						wrapper.setAttribute("class", "group");
						let p = document.createElement("p");
						p.style.setProperty("font-size", "16px");
						p.textContent = episode.title;
						let button = document.createElement("button");
						button.textContent = "View";
						button.addEventListener("click", () => {
							navigate(`video/episodes/${episode.episode_id}/`);
						});
						wrapper.appendChild(p);
						wrapper.appendChild(button);
						results.appendChild(wrapper);
					}
				}
				if (response.shows.length > 0) {
					{
						let h2 = document.createElement("h2");
						h2.style.setProperty("font-size", "24px");
						h2.textContent = "Shows";
						results.appendChild(h2);
					}
					for (let show of response.shows) {
						let wrapper = document.createElement("div");
						wrapper.setAttribute("class", "group");
						let p = document.createElement("p");
						p.style.setProperty("font-size", "16px");
						p.textContent = show.title;
						let button = document.createElement("button");
						button.textContent = "View";
						button.addEventListener("click", () => {
							navigate(`video/shows/${show.show_id}/`);
						});
						wrapper.appendChild(p);
						wrapper.appendChild(button);
						results.appendChild(wrapper);
					}
				}
				if (response.artists.length > 0) {
					{
						let h2 = document.createElement("h2");
						h2.style.setProperty("font-size", "24px");
						h2.textContent = "Artists";
						results.appendChild(h2);
					}
					for (let artist of response.artists) {
						let wrapper = document.createElement("div");
						wrapper.setAttribute("class", "group");
						let p = document.createElement("p");
						p.style.setProperty("font-size", "16px");
						p.textContent = artist.title;
						let button = document.createElement("button");
						button.textContent = "View";
						button.addEventListener("click", () => {
							navigate(`audio/artists/${artist.artist_id}/`);
						});
						wrapper.appendChild(p);
						wrapper.appendChild(button);
						results.appendChild(wrapper);
					}
				}
				if (response.albums.length > 0) {
					{
						let h2 = document.createElement("h2");
						h2.style.setProperty("font-size", "24px");
						h2.textContent = "Albums";
						results.appendChild(h2);
					}
					for (let album of response.albums) {
						let wrapper = document.createElement("div");
						wrapper.setAttribute("class", "group");
						let p = document.createElement("p");
						p.style.setProperty("font-size", "16px");
						p.textContent = album.title;
						let button = document.createElement("button");
						button.textContent = "View";
						button.addEventListener("click", () => {
							navigate(`audio/albums/${album.album_id}/`);
						});
						wrapper.appendChild(p);
						wrapper.appendChild(button);
						results.appendChild(wrapper);
					}
				}
				if (response.tracks.length > 0) {
					{
						let h2 = document.createElement("h2");
						h2.style.setProperty("font-size", "24px");
						h2.textContent = "Tracks";
						results.appendChild(h2);
					}
					for (let track of response.tracks) {
						let wrapper = document.createElement("div");
						wrapper.setAttribute("class", "group");
						let p = document.createElement("p");
						p.style.setProperty("font-size", "16px");
						p.textContent = track.title;
						let button = document.createElement("button");
						button.textContent = "View";
						button.addEventListener("click", () => {
							navigate(`audio/albums/${track.disc.album.album_id}/`);
						});
						wrapper.appendChild(p);
						wrapper.appendChild(button);
						results.appendChild(wrapper);
					}
				}
			});
		}
	} else {
		let s = document.createElement('div');
		s.style.setProperty("font-size", "24px");
		s.innerText = 'Search';
		s.addEventListener('click', () => {
			navigate('search/');
		});
		mount.appendChild(s)
		let d = document.createElement('div');
		d.style.setProperty("font-size", "24px");
		d.innerText = 'Audio';
		d.addEventListener('click', () => {
			navigate('audio/');
		});
		mount.appendChild(d);
		let v = document.createElement('div');
		v.style.setProperty("font-size", "24px");
		v.innerText = 'Video';
		v.addEventListener('click', () => {
			navigate('video/');
		});
		mount.appendChild(v);
		let t = document.createElement('div');
		t.style.setProperty("font-size", "24px");
		t.innerText = 'Tokens';
		t.addEventListener('click', () => {
			navigate('tokens/');
		});
		mount.appendChild(t);
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



let navigate = (uri: string): void => {
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
