import * as api_response from "./api_response";
import * as utils from "./utils";
import * as languages from "./languages";
import { AuthToken } from "./database";
import * as session from "./session";
import { Autoguard as messages } from "./messages";
import { TypeSocketClient } from "./typesockets";
import { ArrayObservable, Observable, ObservableClass } from "./simpleobs";

function makeRateLimiter<A extends any[]>(callable: (...args: [...A]) => void, ms: number): (...args: [...A]) => void {
	let last = 0;
	return (...args) => {
		let now = Date.now();
		if (now > last + ms) {
			last = now;
			callable(...args);
		}
	};
}






let video = document.createElement('video');
let buffer = document.createElement("video");
let bufferneg = document.createElement("video");



let tsc = TypeSocketClient.connect(messages);


// TODO: Get rid of metadata and bundle with context.
type Metadata = {
	[id: string]: {
		subtitles: Array<api_response.SubtitleResponse>;
	} | undefined;
};
let metadata: Metadata | null = null;
let set_context_metadata = (md: Metadata): void => {
	if (md !== metadata) {
		metadata = md;
	}
};
type ContextEntry = {
	file_id: string,
	title: string,
	subtitle: string
};
type Context = ContextEntry[];













const canSkipPrevClass = new ObservableClass(false);
const canSkipPrev = canSkipPrevClass.addObserver((state) => state);
const canPlayPauseClass = new ObservableClass(false);
const canPlayPause = canPlayPauseClass.addObserver((state) => state);
const canSkipNextClass = new ObservableClass(false);
const canSkipNext = canSkipNextClass.addObserver((state) => state);
const showDevicesClass = new ObservableClass(false);
const showDevices = showDevicesClass.addObserver((state) => state);
const isVideoClass = new ObservableClass(false);
const isVideo = isVideoClass.addObserver((state) => state);

const currentDevice = new ObservableClass<string | null>(null);
currentDevice.addObserver((currentDevice) => {
	console.log(`Current device is ${currentDevice}.`);
});
tsc.addEventListener("app", "TransferPlayback", (message) => {
	currentDevice.updateState(message.device);
});




const chromecasts = new ArrayObservable(new Array<string>());
tsc.addEventListener("sys", "connect", (message) => {
	tsc.send("GetDevicesAvailable", {});
});
tsc.addEventListener("app", "DeviceBecameAvailable", (message) => {
	chromecasts.append(message.id);
});
tsc.addEventListener("app", "DeviceBecameUnavailable", (message) => {
	chromecasts.splice(chromecasts.getState().lastIndexOf(message.id));
});
tsc.addEventListener("app", "AvailableDevices", (message) => {
	chromecasts.update(message.devices);
});








chromecasts.addObserver({
	onupdate(state) {
		if (state.length === 0) {
			showDevicesClass.updateState(false);
		}
	}
});








const context = new ObservableClass<Context | undefined>(undefined);
tsc.addEventListener("app", "SetContext", (message) => {
	// TODO: Support titles.
	let value = message.context?.map((entry) => {
		return {
			file_id: entry.file_id,
			title: "",
			subtitle: ""
		};
	});
	context.updateState(value);
});
let set_context = (value?: Context): void => {
	context.updateState(value);
	tsc.send("SetContext", {
		context: value
	});
};




context.addObserver((context) => {
	canPlayPauseClass.updateState(context != null && context.length >= 0);
});







const context_index = new ObservableClass<number | undefined>(undefined);
tsc.addEventListener("app", "SetContextIndex", (message) => {
	context_index.updateState(message.index);
});
function setIndex(value?: number): void {
	let current_context = context.getState();
	if (value != null) {
		if (current_context == null) {
			throw `Expected a valid context!`;
		}
		if (value < 0 || value >= current_context.length) {
			throw `Expected an non-negative index of at most ${current_context.length - 1}, got ${value}!`;
		}
	}
	context_index.updateState(value);
	tsc.send("SetContextIndex", {
		index: value
	});
}









const contextEntry = new ObservableClass<ContextEntry | undefined>(undefined);
function computeContexEntry(): void {
	let current_context = context.getState();
	let current_index = context_index.getState();
	if (current_context != null && current_index != null && current_index >= 0 && current_index < current_context.length) {
		let entry = current_context[current_index];
		contextEntry.updateState(entry);
	}
}
context.addObserver(computeContexEntry);
context_index.addObserver(computeContexEntry);
contextEntry.addObserver((entry) => {
	// TODO: make observable for titles/currently playing object.
	if (entry != null) {
		let element = document.querySelector("div.media-player__title");
		if (element) {
			element.textContent = entry.title;
		}
		let element2 = document.querySelector("div.media-player__subtitle");
		if (element2) {
			element2.textContent = entry.subtitle;
		}
		session.setMetadata({
			title: entry.title
		});
	}
});
contextEntry.addObserver((entry) => {
	if (entry != null) {
		let fid = entry.file_id;
		video.src = `/files/${fid}/?token=${token}`;
		while (video.lastChild !== null) {
			video.removeChild(video.lastChild);
		}
		if (metadata !== null) {
			let md = metadata[fid];
			if (md !== undefined) {
				let defaultSubtitle = md.subtitles.find((subtitle) => subtitle.language === "swe") || md.subtitles.find((subtitle) => subtitle.language === "eng");
				for (let i = 0; i < md.subtitles.length; i++) {
					let st = md.subtitles[i];
					let e = document.createElement('track');
					if (st.language != null) {
						let language = languages.db[st.language];
						if (language != null) {
							e.label = language.title;
							e.srclang = language.iso639_1;
							e.kind = "subtitles";
						}
						if (st === defaultSubtitle) {
							e.setAttribute("default", "");
						}
					}
					e.src = `/files/${st.file_id}/?token=${token}`;
					video.appendChild(e);
				}
			}
		}
		if (currentDevice.getState() == null) {
			video.play();
		}
	}
});










const nextContextEntry = new ObservableClass<ContextEntry | undefined>(undefined);
(() => {
	function computer(): void {
		let current_context = context.getState();
		let current_index = context_index.getState();
		if (current_context != null && current_index != null && current_index + 1 >= 0 && current_index + 1 < current_context.length) {
			let entry = current_context[current_index + 1];
			nextContextEntry.updateState(entry);
		} else {
			nextContextEntry.updateState(undefined);
		}
	}
	context.addObserver(computer);
	context_index.addObserver(computer);
})();
nextContextEntry.addObserver((entry) => {
	canSkipNextClass.updateState(entry != null);
	if (entry != null) {
		buffer.src = `/files/${entry.file_id}/?token=${token}`;
	}
});








const prevContextEntry = new ObservableClass<ContextEntry | undefined>(undefined);
(() => {
	function computer(): void {
		let current_context = context.getState();
		let current_index = context_index.getState();
		if (current_context != null && current_index != null && current_index - 1 >= 0 && current_index - 1 < current_context.length) {
			let entry = current_context[current_index - 1];
			prevContextEntry.updateState(entry);
		} else {
			prevContextEntry.updateState(undefined);
		}
	}
	context.addObserver(computer);
	context_index.addObserver(computer);
})();
prevContextEntry.addObserver((entry) => {
	canSkipPrevClass.updateState(entry != null);
	if (entry != null) {
		bufferneg.src = `/files/${entry.file_id}/?token=${token}`;
	}
});








const progress = new ObservableClass<number>(0);
progress.addObserver((progress) => {
	if (currentDevice.getState() != null) {
		video.currentTime = progress;
	}
});
tsc.addEventListener("app", "SetProgress", (message) => {
	progress.updateState(message.progress);
});
let set_progress = (value: number): void => {
	progress.updateState(value);
	/*
	tsc.send("SetProgress", {
		progress: value
	});
	*/
};








const isPlaying = new ObservableClass(false);
isPlaying.addObserver((isPlaying) => {
	if (currentDevice.getState() == null) {
		if (isPlaying) {
			video.play();
		} else {
			video.pause();
		}
	}
});
tsc.addEventListener("app", "SetPlaying", (message) => {
	isPlaying.updateState(message.playing);
});
function setPlayback(value: boolean): void {
	isPlaying.updateState(value);
	tsc.send("SetPlaying", {
		playing: value
	});
}











const localPlayerProgress = new ObservableClass(0);
localPlayerProgress.addObserver(makeRateLimiter((localPlayerProgress) => {
	set_progress(localPlayerProgress);
}, 1000));










const isLocalPlayerPlaying = new ObservableClass(false);
isLocalPlayerPlaying.addObserver((isLocalPlayerPlaying) => {
	if (currentDevice.getState() == null) {
		setPlayback(isLocalPlayerPlaying);
	}
});
currentDevice.addObserver((currentDevice) => {
	if (currentDevice != null) {
		isLocalPlayerPlaying.updateState(false);
	}
});







const showVideo = new ObservableClass(false);
currentDevice.addObserver((currentDevice) => {
	showVideo.updateState(currentDevice == null && isVideoClass.getState());
});
isVideoClass.addObserver((isVideo) => {
	showVideo.updateState(currentDevice.getState() == null && isVideo);
});








function play(index: number): void {
	setIndex(index);
	setPlayback(true);
};
function transferPlaybackToDevice(device: string) {
	if (token) {
		tsc.send("TransferPlayback", {
			device: device,
			token: token,
			origin: window.location.origin
		});
		tsc.send("SetContext", {
			context: context.getState()
		});
		tsc.send("SetContextIndex", {
			index: context_index.getState()
		});
		/*
		tsc.send("SetProgress", {
			progress: progress.getState()
		});
		*/
		tsc.send("SetPlaying", {
			playing: isPlaying.getState()
		});
	}
}
function resume() {
	if (context.getState() != null) {
		setPlayback(true);
	}
}
function pause() {
	if (context.getState() != null) {
		setPlayback(false);
	}
}
function pauseresume() {
	if (isPlaying.getState()) {
		pause();
	} else {
		resume();
	}
}
// TODO: Support on other device.
let playfile = (path: string): void => {
	/*
	context = null;
	context_index = null;
	metadata = null;
	video.src = `${path}?token=${token}`;
	while (video.lastChild !== null) {
		video.removeChild(video.lastChild);
	}
	video.play();
	*/
};
function prev(): void {
	let state = context_index.getState();
	if (state != null) {
		setIndex(state - 1);
	}
}
function next(): void {
	let state = context_index.getState();
	if (state != null) {
		setIndex(state + 1);
	}
}
session.setHandlers({
	play: resume,
	pause: pause,
	previoustrack: prev,
	nexttrack: next
});









































namespace xml {
	export interface Node<A extends globalThis.Node> {
		render(): A;
	}

	export class Text implements Node<globalThis.Text> {
		private content: string;

		constructor(content: string) {
			this.content = content;
		}

		render(): globalThis.Text {
			return document.createTextNode(this.content);
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
		private listeners: Map<keyof HTMLElementEventMap, Array<Listener<keyof HTMLElementEventMap>>>;
		private array?: ArrayObservable<any>;
		private renderer?: Renderer<any>;

		constructor(selector: string) {
			let parts = selector.split(".");
			this.tag = parts[0];
			this.attributes = new Map<string, string>();
			this.children = new Array<Node<any>>();
			this.bound = new Map<string, Observable<any>>();
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

		on<A extends keyof HTMLElementEventMap>(kind: A, listener: Listener<A>): this {
			let listeners = this.listeners.get(kind);
			if (listeners == null) {
				listeners = new Array<Listener<A>>();
				this.listeners.set(kind, listeners);
			}
			listeners.push(listener);
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

	export function text(content: string): Text {
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
		background-color: rgb(255, 207, 0);
		color: rgb(31, 31, 31);
	}

	button {
		background-color: rgb(255, 207, 0);
		border-radius: 4px;
		color: rgb(31, 31, 31);
		cursor: pointer;
		font-size: 12px;
		padding: 4px 16px;
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
		color: rgb(255, 207, 0);
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
		.playback-button:hover {
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









	.device-selector {
		background-color: rgba(0, 0, 0, 0.75);
		position: absolute;
			height: 100%;
			width: 100%;
		transform: translate(0, -100%);
		transition: transform 0.25s;
		z-index: 1;
	}

	.device-selector[data-hide="false"] {
		transform: none;
	}

	.device-selector__devices {

	}








	.device {
		font-size: 16px;
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

	@media (hover: hover) and (pointer: fine) {
		.icon-button:hover {
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

let token = localStorage.getItem('token');
let logincontainer = document.createElement('div');
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
			.add(xml.text("Zenplayer"))
			.on("click", () => {
				navigate("/");
			})
		)
	)
	.render();
appcontainer.appendChild(appheader);

mountwrapper.setAttribute("class", "app__content");
appcontainer.appendChild(mountwrapper);

let device_selector = xml.element("div.device-selector")
	.bind("data-hide", showDevices((value) => !value))
	.add(xml.element("div.device-selector__devices")
		.repeat(chromecasts, (state) => xml.element("div.device")
			.add(xml.text("Chromecast"))
			.on("click", () => {
				transferPlaybackToDevice(state);
			})
		)
	)
	.render();
mountwrapper.appendChild(device_selector);
let scroll_container = xml.element("div.scroll-container")
	.render();
mountwrapper.appendChild(scroll_container);



/*
    if (document.webkitFullscreenElement) {
      document.webkitCancelFullScreen();
    } else {
      const el = document.documentElement;
      el.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
 */
req<api_response.ApiRequest, api_response.AuthWithTokenReponse>(`/api/auth/?token=${token}`, {}, (status, response) => {
	if (!(status >= 200 && status < 300)) {
		localStorage.removeItem('token');
		let container = document.createElement("div");
		let username = document.createElement('input');
		username.setAttribute('type', 'text');
		username.setAttribute("placeholder", "Username...");
		container.appendChild(username);
		let password = document.createElement('input');
		password.setAttribute('type', 'password');
		password.setAttribute("placeholder", "Passphrase...");
		container.appendChild(password);
		let cb = () => {
			req<api_response.AuthRequest, api_response.AuthResponse>(`/api/auth/`, { username: username.value, password: password.value }, (status, response) => {
				if (status === 200) {
					token = response.token;
					localStorage.setItem('token', token);
					logincontainer.removeChild(container);
					scroll_container.appendChild(mount);
				}
			});
		};
		password.addEventListener('keyup', (event) => {
			if (event.keyCode === 13) {
				cb();
			}
		});
		let login = document.createElement('button'); login.textContent = 'Login';
		login.addEventListener('click', (event) => {
			cb();
		});
		container.appendChild(login);
		logincontainer.appendChild(container);
	} else {
		scroll_container.appendChild(mount);
	}
});

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

let mp = xml.element("div.content")
	.set("style", "padding: 16px;")
	.add(xml.element("div.media-player")
		.add(xml.element("div.media-player__metadata")
			.add(xml.element("div.media-player__title")
				.add(xml.text(""))
			)
			.add(xml.element("div.media-player__subtitle")
				.add(xml.text(""))
			)
		)
		.add(xml.element("div.media-player__controls")
			.add(makeButton()
				.bind("data-hide", chromecasts.compute((state) => {
					return state.length === 0;
				}))
				.add(makeBroadcastIcon())
				.on("click", () => {
					showDevicesClass.updateState(!showDevicesClass.getState());
				})
			)
			.add(makeButton()
				.bind("data-enabled", canSkipPrev)
				.add(makePrevIcon())
				.on("click", () => {
					prev();
				})
			)
			.add(makeButton()
				.bind("data-enabled", canPlayPause)
				.add(makePlayIcon()
					.bind("data-hide", isPlaying.addObserver((isPlaying) => {
						return isPlaying ? "true" : "false";
					}))
				)
				.add(makePauseIcon()
					.bind("data-hide", isPlaying.addObserver((isPlaying) => {
						return isPlaying ? "false" : "true";
					}))
				)
				.on("click", () => {
					pauseresume();
				})
			)
			.add(makeButton()
				.bind("data-enabled", canSkipNext)
				.add(makeNextIcon())
				.on("click", () => {
					next();
				})
			)
		)
	)
	.render();
appcontainer.appendChild(mpw);
mpw.appendChild(mp);

video.addEventListener("ended", () => {
	next();
});
video.addEventListener("pause", () => {
	isLocalPlayerPlaying.updateState(false);
});
video.addEventListener("play", () => {
	isLocalPlayerPlaying.updateState(true);
});
video.addEventListener("timeupdate", () => {
	localPlayerProgress.updateState(video.currentTime);
});
isLocalPlayerPlaying.addObserver((isLocalPlayerPlaying) => {
	if (isLocalPlayerPlaying) {
		video.play();
	} else {
		video.pause();
	}
});
video.setAttribute('controls', '');
video.setAttribute('playsinline', '');
video.setAttribute("preload", "auto");
video.style.setProperty('height', '100%');
video.style.setProperty('width', '100%');
buffer.setAttribute("preload", "auto");
buffer.style.setProperty("display", "none");
bufferneg.setAttribute("preload", "auto");
bufferneg.style.setProperty("display", "none");
mp.appendChild(logincontainer);

let videowrapper = xml.element("div")
	.bind("data-hide", showVideo.addObserver((showVideo) => {
		return !showVideo;
	}))
	.set("style", "background-color: rgb(0, 0, 0); height: 100%;")
	.render();

scroll_container.appendChild(videowrapper);
videowrapper.appendChild(video);
videowrapper.appendChild(buffer);
videowrapper.appendChild(bufferneg);

video.addEventListener("playing", () => {
	isVideoClass.updateState(video.videoWidth > 0 && video.videoHeight > 0);
});




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
const makePlaybackButton = () => xml.element("div.playback-button")
	.add(makePlayIcon());
function makeAlbum(album: api_response.AlbumResponse): xml.XElement {
	let duration_ms = 0;
	for (let disc of album.discs) {
		for (let track of disc.tracks) {
			duration_ms += track.duration;
		}
	}
	let title = album.title;
	let subtitle = album.artists.map(artist => artist.title).join(" \u2022 ");
	let tags = [
		"Album",
		`${album.year}`,
		format_duration(duration_ms)
	];
	return xml.element("div.media-widget")
		.add(xml.element("div.media-widget__artwork")
			.add(xml.element("img.media-widget__image")
				.set("src", `/files/${album.cover_file_id}/?token=${token}`)
			)
			.add(makePlaybackButton())
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
		);
}
function makeMovie(movie: api_response.MovieResponse): xml.XElement {
	let duration_ms = 0;
	let context = new Array<ContextEntry>();
	let metadata: Metadata = {};
	for (let movie_part of movie.movie_parts) {
		duration_ms += movie_part.duration;
		context.push({
			file_id: movie_part.file_id,
			title: movie.title,
			subtitle: ""
		});
		metadata[movie_part.file_id] = {
			subtitles: movie_part.subtitles
		};
	}
	let title = movie.title;
	let subtitle = [].join(" \u2022 ");
	let tags = [
		"Movie",
		`${movie.year}`,
		format_duration(duration_ms)
	];
	return xml.element("div.media-widget")
		.on("click", () => {
			navigate(`video/movies/${movie.movie_id}/`)
		})
		.add(xml.element("div.media-widget__artwork")
			.set("style", "padding-bottom: 150%;")
			.add(xml.element("img.media-widget__image")
				.set("src", `/files/${movie.poster_file_id}/?token=${token}`)
			)
			.add(makePlaybackButton()
				.on("click", (event) => {
					event.stopPropagation();
					set_context(context);
					set_context_metadata(metadata);
					play(0);
				})
			)
		)
		.add(xml.element("div.media-widget__metadata")
			.add(xml.element("div.media-widget__titles")
				.add(xml.element("div.media-widget__title")
					.add(xml.text(title))
				)
				.add(!subtitle ? undefined : xml.element("div.media-widget__subtitle")
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

let updateviewforuri = (uri: string): void => {
	while (mount.lastChild !== null) {
		mount.removeChild(mount.lastChild);
	}
	let parts: RegExpExecArray | null;
	if ((parts = /^audio[/]albums[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AlbumResponse>(`/api/audio/albums/${parts[1]}/`, {}, (status, response) => {
			let context = new Array<ContextEntry>();
			let duration_ms = 0;
			for (let disc of response.discs) {
				for (let track of disc.tracks) {
					context.push({
						file_id: track.file_id,
						title: track.title,
						subtitle: track.artists.map((artist) => artist.title).join(" \u2022 ")
					});
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
			for (let disc of response.discs) {
				if (disc.tracks.length > 0) {
					let content = xml.element("div.content")
						.add(xml.element("div.playlist")
							.add(xml.element("div.playlist__header")
								.add(renderTextHeader("Tracks"))
							)
							.add(xml.element("div.playlist__content")
								.add(...disc.tracks.map((track) => xml.element("div.playlist-item")
									.bind("data-playing", contextEntry.addObserver((contextEntry) => {
										return contextEntry?.file_id === track.file_id;
									}))
									.add(xml.element("div.playlist-item__title")
										.add(xml.text(track.title))
									)
									.add(xml.element("div.playlist-item__subtitle")
										.add(xml.text(track.artists.map((artist) => artist.title).join(" \u2022 ")))
									)
									.on("click", () => {
										set_context(context);
										play(context.findIndex(entry => entry.file_id === track.file_id));
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
			let context = new Array<ContextEntry>();
			let duration_ms = 0;
			for (let album of response.albums) {
				for (let disc of album.discs) {
					for (let track of disc.tracks) {
						context.push({
							file_id: track.file_id,
							title: track.title,
							subtitle: track.artists.map((artist) => artist.title).join(" \u2022 ")
						});
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
			if (response.albums.length > 0) {
				let content = xml.element("div.content").render();
				mount.appendChild(content);
				let mediaGrid = xml.element("div.media-grid")
					.add(xml.element("div.media-grid__header")
						.add(renderTextHeader("Discography"))
					)
					.render();
				content.appendChild(mediaGrid);
				let mediaGrid__content = xml.element("div.media-grid__content").render();
				mediaGrid.appendChild(mediaGrid__content);
				for (let album of response.albums) {
					let widget = makeAlbum(album).render();
					widget.querySelector(".playback-button")?.addEventListener("click", (event) => {
						let index = context.findIndex(entry => entry.file_id === album.discs[0].tracks[0].file_id);
						set_context(context);
						play(index);
						event.stopPropagation();
					});
					widget.addEventListener('click', () => {
						navigate(`audio/albums/${album.album_id}/`);
					});
					mediaGrid__content.appendChild(widget);
				}
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
					let context = new Array<ContextEntry>();
					for (let disc of album.discs) {
						for (let track of disc.tracks) {
							context.push({
								file_id: track.file_id,
								title: track.title,
								subtitle: track.artists.map((artist) => artist.title).join(" \u2022 ")
							});
						}
					}
					let widget = makeAlbum(album).render();
					widget.querySelector(".playback-button")?.addEventListener("click", (event) => {
						set_context(context);
						play(0);
						event.stopPropagation();
					});
					widget.addEventListener('click', () => {
						navigate(`audio/albums/${album.album_id}/`);
					});
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
			let context = response.items.map((item) => {
				return {
					file_id: item.track.file_id,
					title: item.track.title,
					subtitle: ""
				};
			});
			for (let item of response.items) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '16px');
				d.innerText = `${item.track.title}`;
				d.addEventListener('click', () => {
					set_context(context);
					play(context.findIndex(entry => entry.file_id === item.track.file_id));
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
			let context: Context = response.seasons.reduce((files, season) => {
					files.push(...season.episodes.map(episode => {
						return {
							file_id: episode.file_id,
							title: episode.title,
							subtitle: [response.title, utils.formatSeasonEpisode(season.number, episode.number)].join(" \u2022 ")
						};
					}));
					return files;
				}, new Array<ContextEntry>());
			let context_metadata: Metadata = {};
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
					set_context(context);
					set_context_metadata(context_metadata);
					play(context.findIndex(entry => entry.file_id === nextEpisode.file_id));
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
					context_metadata[episode.file_id] = {
						subtitles: episode.subtitles
					};
					let d2 = document.createElement('div');
					if (episode.streamed != null) {
						d2.classList.add("watched");
					}
					d2.style.setProperty('font-size', '16px');
					d2.innerText = `${episode.title} ${format_duration(episode.duration)}`;
					d2.addEventListener('click', () => {
						set_context(context);
						set_context_metadata(context_metadata);
						play(context.findIndex(entry => entry.file_id === episode.file_id));
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
			let context: Context = [{
				file_id: response.file_id,
				title: response.title,
				subtitle: ["TOOD", utils.formatSeasonEpisode(0, response.number)].join(" \u2022 ")
			}];
			let context_metadata: Metadata = {};
			context_metadata[response.file_id] = {
				subtitles: response.subtitles
			};
			let d3 = document.createElement('button');
			d3.innerText = `load`;
			d3.addEventListener('click', () => {
				set_context(context);
				set_context_metadata(context_metadata);
				play(context.findIndex(entry => entry.file_id === response.file_id));
				if (parts !== null && parts.length >= 3) {
					let start_ms = Number.parseInt(parts[2], 10);
					set_progress(start_ms);
				}
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
			let context: Context = response.movie_parts.map((part) => {
				return {
					file_id: part.file_id,
					title: response.title,
					subtitle: `${response.year}`
				};
			});
			let context_metadata: Metadata = {};
			let streamed = true;
			let duration = 0;
			for (let movie_part of response.movie_parts) {
				context_metadata[movie_part.file_id] = {
					subtitles: movie_part.subtitles
				};
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
				set_context(context);
				set_context_metadata(context_metadata);
				play(0);
				if (parts !== null && parts.length >= 3) {
					let start_ms = Number.parseInt(parts[2], 10);
					set_progress(start_ms);
				}
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
			let element = xml.element("div.content")
				.add(makeGrid(undefined, ...response.movies.map(makeMovie)));
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
				playfile(`/media/channels/${channel_id}/${Date.now()}/`);
			});
			mount.appendChild(button);
			let context: Context = response.segments.reduce((files, segment) => {
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
			}, new Array<ContextEntry>());
			let context_metadata: Metadata = {};
			for (let segment of response.segments) {
				const movie = segment.movie;
				if (movie != null) {
					for (let movie_part of movie.movie_parts) {
						context_metadata[movie_part.file_id] = {
							subtitles: movie_part.subtitles
						};
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
							set_context(context);
							set_context_metadata(context_metadata);
							play(context.findIndex(entry => entry.file_id === movie_part.file_id));
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
					context_metadata[episode.file_id] = {
						subtitles: episode.subtitles
					};
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
						set_context(context);
						set_context_metadata(context_metadata);
						play(context.findIndex(entry => entry.file_id === episode.file_id));
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
	if (window.history.state === null) {
		window.history.replaceState({ 'uri': uri }, '', uri);
	} else {
		if (uri !== window.history.state.uri) {
			window.history.pushState({ 'uri': uri }, '', uri);
		}
	}
	updateviewforuri(uri);
};
navigate(get_route());
window.addEventListener('popstate', (event) => {
	navigate(event.state.uri);
});
