import * as api_response from "./api_response";
import * as utils from "./utils";
import * as languages from "./languages";
import { AuthToken } from "./database";
import * as session from "./session";
import { String } from "@joelek/ts-autoguard/build/autoguard-lib/guards";

namespace xml {
	interface Node<A extends globalThis.Node> {
		render(): A;
	}

	class Text implements Node<globalThis.Text> {
		private content: String;

		constructor(content: String) {
			this.content = content;
		}

		render(): globalThis.Text {
			return document.createTextNode(this.content);
		}
	}

	class Element implements Node<globalThis.Element> {
		private tag: string;
		private attributes: Map<string, string>;
		private children: Array<Node<any>>;

		constructor(tag: string) {
			this.tag = tag;
			this.attributes = new Map<string, string>();
			this.children = new Array<Node<any>>();
		}

		add(node: Node<any>): this {
			// TODO: Detach node from current parent.
			this.children.push(node);
			return this;
		}

		render(): globalThis.Element {
			let ns = ["svg", "path"].indexOf(this.tag) >= 0 ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml";
			let element = document.createElementNS(ns, this.tag);
			for (let [key, value] of this.attributes) {
				element.setAttribute(key, value);
			}
			for (let child of this.children) {
				element.appendChild(child.render());
			}
			return element;
		}

		set(key: string, value: string = ""): this {
			this.attributes.set(key, value);
			return this;
		}
	}

	export function element(tag: string): Element {
		// TODO: Support parsing of selector.
		return new Element(tag);
	}

	export function text(content: string): Text {
		return new Text(content);
	}
}


let style = document.createElement('style');
style.innerText = `
	* {
		border: none;
		font-size: 0px;
		line-height: 1;
		margin: 0px;
		outline: none;
		padding: 0px;
	}

	html {
		height: 100%;
	}

	body {
		height: 100%;
	}

	[data-grid] {
		margin: 0px auto;
		max-width: 640px;
		min-width: 160px;
		padding: 16px;
	}

	[data-cell] {
		display: inline-block;
		vertical-align: top;
	}

	[data-cell] > * {
		margin: 8px;
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
		box-sizing: border-box;
		display: flex;
		flex-flow: row wrap;
	}

	[data-wrap] {
		flex: 0 0 auto;
	}

	[data-fill] {
		flex: 1 1 0%;
		min-width: 0%;
		max-width: 100%;
	}

	[data-full] {
		width: 100%;
	}

	body {
		background-color: rgb(31, 31, 31);
		color: rgb(255, 255, 255);
		font-family: "Open Sans", sans-serif;
		overflow-y: scroll;
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
		padding: 8px 32px;
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
		overflow: hidden;
	}

	.media-widget__artwork {
		background-color: rgb(0, 0, 0);
		background-size: cover;
		padding-bottom: 100%;
		position: relative;
	}

	.media-widget__play-button {
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
	}

	.media-widget__metadata {
		padding: 12px;
	}

	.media-widget__metadata > * {
		margin: 4px;
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

	.media-widget__tag {
		background-color: rgb(63, 63, 63);
		border-radius: 2px;
		color: rgb(159, 159, 159);
		font-size: 12px;
		overflow: hidden;
		padding: 4px 8px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.text-header {

	}

	.text-header__title {
		font-size: 20px;
	}

	.entity-header {
		position: relative;
	}

	.entity-header__metadata {
		margin: -4px;
	}

	.entity-header__metadata > * {
		margin: 4px;
	}

	.entity-header__title {
		font-size: 24px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entity-header__play-button {
		background-color: rgb(255, 255, 255);
		border-radius: 50%;
		box-shadow: 0px 0px 8px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		fill: rgb(31, 31, 31);
		margin: 16px;
		padding: 8px;
		position: absolute;
			right: 0%;
			top: 0%;
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
	if (duration.h > 0) {
		let h = "" + duration.h;
		let m = `00${duration.m}`.slice(-2);
		let s = `00${duration.s}`.slice(-2);
		return `${h}:${m}:${s}`;
	} else {
		let m = "" + duration.m;
		let s = `00${duration.s}`.slice(-2);
		return `${m}:${s}`;
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
document.body.appendChild(logincontainer);
let mount = document.createElement('div');
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
					document.body.appendChild(mount);
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
		document.body.appendChild(mount);
	}
});

type Context = {
	files: Array<string>;
};
type Metadata = {
	[id: string]: {
		subtitles: Array<api_response.SubtitleResponse>;
	} | undefined;
};
let video = document.createElement('video');
video.setAttribute('controls', '');
video.setAttribute('playsinline', '');
video.setAttribute("preload", "auto");
video.style.setProperty('width', '100%');
document.body.appendChild(video);
let buffer = document.createElement("video");
buffer.setAttribute("preload", "auto");
buffer.style.setProperty("display", "none");
document.body.appendChild(buffer);

let context: Context | null = null;
let metadata: Metadata | null = null;
let context_index: number | null = null;

class Player {
	private audio: AudioContext;
	private context: Context | null;
	private index: number;
	private one: HTMLAudioElement;
	private two: HTMLAudioElement;

	constructor(document: Document) {
		// @ts-ignore
		this.audio = new (window.AudioContext || window.webkitAudioContext)();
		this.context = null;
		this.index = 0;
		let one = document.createElement("audio");
		one.setAttribute("preload", "auto");
		let two = document.createElement("audio");
		two.setAttribute("preload", "auto");
		this.one = one;
		this.two = two;
		this.one.addEventListener("ended", () => {
			this.index += 1;
			this.two.play();
			if (this.context) {
				let id = this.context.files[this.index + 1];
				this.one.src = `/files/${id}/?token=${token}`;
			}
		});
		this.two.addEventListener("ended", () => {
			this.index += 1;
			this.one.play();
			if (this.context) {
				let id = this.context.files[this.index + 1];
				this.two.src = `/files/${id}/?token=${token}`;
			}
		});
		let sourceOne = this.audio.createMediaElementSource(this.one);
		let sourceTwo = this.audio.createMediaElementSource(this.two);
		sourceOne.connect(this.audio.destination);
		sourceTwo.connect(this.audio.destination);
	}

	play(context: Context, index: number): void {
		this.audio.resume();
		this.context = context; // TODO: Copy.
		this.index = index;
		this.one.src = `/files/${this.context.files[this.index + 0]}/?token=${token}`;
		this.two.src = `/files/${this.context.files[this.index + 1]}/?token=${token}`;
		this.one.play();
	}
}

type Deferred<A> = A | undefined;

let player: Deferred<Player>;




let play = (index: number): void => {
	if (index === context_index) {
		return;
	}
	if (context === null) {
		return;
	}
/*
	if (!player) {
		player = new Player(document);
	}
	player.play(context, index);
*/
	let fid = context.files[index];
	video.src = `/files/${fid}/?token=${token}`;
	if (index + 1 < context.files.length) {
		let fid = context.files[index + 1];
		buffer.src = `/files/${fid}/?token=${token}`;
	}
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
	video.play();
	context_index = index;
	session.setMetadata({
		title: "Castaway"
	});
};
let playfile = (path: string): void => {
	context = null;
	context_index = null;
	metadata = null;
	video.src = `${path}?token=${token}`;
	while (video.lastChild !== null) {
		video.removeChild(video.lastChild);
	}
	video.play();
};
let seek = (offset_ms: number): void => {
	video.currentTime = (offset_ms / 1000);
};
function playPreviousTrackInContext(): void {
	if (context !== null && context_index !== null && context_index - 1 >= 0 && context_index - 1 < context.files.length) {
		play(context_index - 1);
	}
}
let next = (): void => {
	if (context !== null && context_index !== null && context_index >= 0 && context_index < context.files.length - 1) {
		play(context_index + 1);
	}
};
session.setHandlers({
	play: () => {
		video.play();
	},
	pause: () => {
		video.pause();
	},
	previoustrack: playPreviousTrackInContext,
	nexttrack: next
});
video.addEventListener('ended', next);
let set_context = (ctx: Context): void => {
	if (ctx !== context) {
		context = ctx;
		context_index = null;
	}
};
let set_context_metadata = (md: Metadata): void => {
	if (md !== metadata) {
		metadata = md;
		context_index = null;
	}
};
let chromecast = document.createElement("div");
chromecast.classList.add("group");
let ccp = document.createElement("p");
ccp.textContent = "Chromecast";
ccp.style.setProperty("font-size", "16px");
chromecast.appendChild(ccp);
let ccload = document.createElement('button');
ccload.textContent = 'Cast';
ccload.addEventListener('click', () => {
	video.pause();
	req(`/api/cc/load/`, { context, index: context_index, token: token, origin: window.location.origin }, (status, response) => {});
});
chromecast.appendChild(ccload);
let ccpause = document.createElement('button');
ccpause.textContent = 'Pause';
ccpause.addEventListener('click', () => {
	req(`/api/cc/pause/`, { token: token }, (status, response) => {});
});
chromecast.appendChild(ccpause);
let ccresume = document.createElement('button');
ccresume.textContent = 'Resume';
ccresume.addEventListener('click', () => {
	req(`/api/cc/resume/`, { token: token }, (status, response) => {});
});
chromecast.appendChild(ccresume);



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
document.body.appendChild(chromecast);
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



let updateviewforuri = (uri: string): void => {
	while (mount.lastChild !== null) {
		mount.removeChild(mount.lastChild);
	}
	let parts: RegExpExecArray | null;
	if ((parts = /^audio[/]albums[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.AlbumResponse>(`/api/audio/albums/${parts[1]}/`, {}, (status, response) => {
			let a = document.createElement('div');
			a.style.setProperty('font-size', '24px');
			a.innerText = `${response.title}`;
			mount.appendChild(a);
			let wrap = document.createElement('div');
			let img = document.createElement('img');
			img.src = `/files/${response.cover_file_id}/?token=${token}`;
			img.style.setProperty('width', '100%');
			wrap.appendChild(img);
			mount.appendChild(wrap);
			let context = {
				files: response.discs.reduce((tracks, disc) => {
					tracks.push(...disc.tracks.map(track => track.file_id));
					return tracks;
				}, new Array<string>())
			};
			for (let disc of response.discs) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '24px');
				d.innerText = `${disc.number}`;
				mount.appendChild(d);
				for (let track of disc.tracks) {
					let x = document.createElement('div');
					x.style.setProperty('font-size', '16px');
					x.innerText = `${track.title} ${format_duration(track.duration)}`;
					x.addEventListener('click', () => {
						set_context(context);
						play(context.files.indexOf(track.file_id));
					});
					mount.appendChild(x);
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
		const renderTag = (content: string) => xml.element("div")
			.set("class", "media-widget__tag")
			.set("data-wrap")
			.add(xml.text(content))
			.render();
		function renderAlbum(album: api_response.AlbumResponse): Element {
			let widget = xml.element("div")
				.set("class", "media-widget")
				.add(xml.element("div")
					.set("class", "media-widget__artwork")
					.set("style", `background-image: url('/files/${album.cover_file_id}/?token=${token}');`)
					.add(xml.element("div")
						.set("class", "media-widget__play-button")
						.add(xml.element("svg")
							.set("width", "16px")
							.set("height", "16px")
							.set("viewBox", "0 0 16 16")
							.add(xml.element("path")
								.set("fill", "inherit")
								.set("d", "M3,15.268c-0.173,0-0.345-0.045-0.5-0.134C2.19,14.955,2,14.625,2,14.268V1.732c0-0.357,0.19-0.688,0.5-0.866C2.655,0.776,2.827,0.732,3,0.732s0.345,0.044,0.5,0.134l10.857,6.268c0.31,0.179,0.5,0.509,0.5,0.866s-0.19,0.688-0.5,0.866L3.5,15.134C3.345,15.223,3.173,15.268,3,15.268z")
							)
						)
					)
				)
				.render();
			let metadata = document.createElement("div");
			metadata.setAttribute("data-flex", "");
			metadata.setAttribute("class", "media-widget__metadata");
			widget.appendChild(metadata);
			let title = document.createElement("div");
			title.setAttribute("data-full", "");
			title.setAttribute("class", "media-widget__title");
			title.innerText = album.title;
			metadata.appendChild(title);
			album.artists.forEach((artist) => {
				let subtitle = document.createElement("div");
				subtitle.setAttribute("data-full", "");
				subtitle.setAttribute("class", "media-widget__subtitle");
				subtitle.innerText = artist.title;
				metadata.appendChild(subtitle);
			});
			let spacer = document.createElement("div");
			spacer.setAttribute("data-full", "");
			metadata.appendChild(spacer);
			metadata.appendChild(renderTag("Album"));
			metadata.appendChild(renderTag(`${album.year}`));
			let duration = computeDuration(album.discs.reduce((sum, disc) => {
				return sum + disc.tracks.reduce((sum, track) => {
					return sum + track.duration;
				}, 0);
			}, 0));
			metadata.appendChild(renderTag(`${(duration.d * 24 + duration.h) * 60 + duration.m} min`));
			return widget;
		}
		function renderTextHeader(string: string): HTMLElement {
			let widget = document.createElement("div");
			widget.setAttribute("class", "text-header");
			let title = document.createElement("div");
			title.setAttribute("class", "text-header__title");
			title.innerText = string;
			widget.appendChild(title);
			return widget;
		}
		function renderArtistHeader(response: api_response.ArtistResponse): HTMLElement {
			let background = document.createElement("div");
			background.style.setProperty("background-image", "linear-gradient(to top, rgba(0, 0, 0, 0.0), rgba(0, 0, 0, 1.0))");
			let grid = document.createElement("div");
			grid.setAttribute("data-grid", "");
			background.appendChild(grid);
			let cell = document.createElement("div");
			cell.setAttribute("data-cell", "6:6:6");
			grid.appendChild(cell);
			let widget = document.createElement("div");
			cell.appendChild(widget);
			widget.setAttribute("class", "entity-header");
			let metadata = document.createElement("div");
			metadata.setAttribute("data-flex", "");
			metadata.setAttribute("class", "entity-header__metadata");
			widget.appendChild(metadata);
			let title = document.createElement("div");
			title.setAttribute("data-full", "");
			title.setAttribute("class", "entity-header__title");
			title.innerText = `${response.title}`;
			metadata.appendChild(title);
			let spacer = document.createElement("div");
			spacer.setAttribute("data-full", "");
			metadata.appendChild(spacer);
			metadata.appendChild(renderTag("Artist"));
			metadata.appendChild(renderTag(`${response.albums.length} albums`));
			let play_button = document.createElement("div");
			play_button.setAttribute("class", "entity-header__play-button");
			play_button.innerHTML = `<svg width="16px" height="16px" viewBox="0 0 16 16"><path fill="inherit" d="M3,15.268c-0.173,0-0.345-0.045-0.5-0.134C2.19,14.955,2,14.625,2,14.268V1.732c0-0.357,0.19-0.688,0.5-0.866C2.655,0.776,2.827,0.732,3,0.732s0.345,0.044,0.5,0.134l10.857,6.268c0.31,0.179,0.5,0.509,0.5,0.866s-0.19,0.688-0.5,0.866L3.5,15.134C3.345,15.223,3.173,15.268,3,15.268z"/></svg>`;
			widget.appendChild(play_button);
			return background
		}
		req<api_response.ApiRequest, api_response.ArtistResponse>(`/api/audio/artists/${parts[1]}/`, {}, (status, response) => {
			let context = {
				files: new Array<string>()
			};
			for (let album of response.albums) {
				for (let disc of album.discs) {
					for (let track of disc.tracks) {
						context.files.push(track.file_id);
					}
				}
			}
			let widget = renderArtistHeader(response);
			widget.querySelector(".entity-header__play-button")?.addEventListener("click", () => {
				set_context(context);
				play(0);
			});
			mount.appendChild(widget);
			let container = document.createElement("div");
			container.setAttribute("data-grid", "");
			let cell = document.createElement("div");
			cell.setAttribute("data-cell", "6:6:6");
			cell.appendChild(renderTextHeader("Discography"));
			container.appendChild(cell);
			for (let album of response.albums) {
				let widget = renderAlbum(album);
				widget.querySelector(".media-widget__play-button")?.addEventListener("click", (event) => {
					let index = context.files.indexOf(album.discs[0].tracks[0].file_id);
					set_context(context);
					play(index);
					event.stopPropagation();
				});
				widget.addEventListener('click', () => {
					navigate(`audio/albums/${album.album_id}/`);
				});
				let cell = document.createElement("div");
				cell.setAttribute("data-cell", "6:6:3");
				cell.appendChild(widget);
				container.appendChild(cell);
			}
			mount.appendChild(container);
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
			let context = {
				files: response.items.map((item) => {
					return item.track.file_id;
				})
			};
			for (let item of response.items) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '16px');
				d.innerText = `${item.track.title}`;
				d.addEventListener('click', () => {
					set_context(context);
					play(context.files.indexOf(item.track.file_id));
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
			let context: Context = {
				files: response.seasons.reduce((files, season) => {
					files.push(...season.episodes.map(episode => episode.file_id));
					return files;
				}, new Array<string>())
			};
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
					play(context.files.indexOf(nextEpisode.file_id));
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
						play(context.files.indexOf(episode.file_id));
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
			let context: Context = {
				files: [ response.file_id ]
			};
			let context_metadata: Metadata = {};
			context_metadata[response.file_id] = {
				subtitles: response.subtitles
			};
			let d3 = document.createElement('button');
			d3.innerText = `load`;
			d3.addEventListener('click', () => {
				set_context(context);
				set_context_metadata(context_metadata);
				play(context.files.indexOf(response.file_id));
				if (parts !== null && parts.length >= 3) {
					let start_ms = Number.parseInt(parts[2], 10);
					seek(start_ms);
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
			let context: Context = {
				files: response.movie_parts.map((part) => part.file_id)
			};
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
					seek(start_ms);
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
		req<api_response.ApiRequest, api_response.MoviesResponse>(`/api/video/movies/`, {}, (status, response) => {
			for (let movie of response.movies) {
				let d = document.createElement('div');
				d.style.setProperty('font-size', '24px');
				d.innerText = `${movie.title}`;
				d.addEventListener('click', () => {
					navigate(`video/movies/${movie.movie_id}/`);
				});
				mount.appendChild(d);
			}
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
			let context: Context = {
				files: response.segments.reduce((files, segment) => {
					if (segment.movie != null) {
						return files.concat(segment.movie.movie_parts.map((movie_part) => {
							return movie_part.file_id;
						}));
					}
					if (segment.episode != null) {
						return files.concat([segment.episode.file_id]);
					}
					return files;
				}, new Array<string>())
			};
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
							play(context.files.indexOf(movie_part.file_id));
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
						play(context.files.indexOf(episode.file_id));
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
		let results = document.createElement("div");
		mount.appendChild(results);
		req<api_response.TokensRequest, api_response.TokensResponse>(`/api/tokens/?token=${token}`, {}, (status, response) => {
			function renderToken(token: AuthToken): HTMLElement {
				let wrapper = document.createElement("div");
				wrapper.setAttribute("class", "group");
				let p = document.createElement("p");
				p.style.setProperty("font-size", "16px");
				let duration = computeDuration(token.expires_ms - Date.now());
				p.innerText = `Expires in ${duration.d} days, ${duration.h} hours and ${duration.m} minutes.`;
				wrapper.appendChild(p);
				return wrapper;
			}
			for (let token of response.tokens) {
				results.appendChild(renderToken(token));
			}
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
