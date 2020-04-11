import * as api_response from "./api_response";
import * as utils from "./utils";
import * as languages from "./languages";

let style = document.createElement('style');
style.innerText = `
	* {
		border: none;
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

	body {
		background-color: rgb(31, 31, 31);
		color: rgb(255, 255, 255);
		font-family: sans-serif;
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
		background-color: rgb(31,31,31);
	}

	.slider-widget__knob-wrapper {
		position: relative;
	}

	.slider-widget__knob {
		box-shadow: 0px 0px 8px 0px rgba(0, 0, 0, 0.5);
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: rgb(255,255,255);
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
`;
document.head.appendChild(style);

let format_duration = (ms: number): string => {
	let s = (ms / 1000) | 0;
	let m = (s / 60) | 0;
	let h = (m / 60) | 0;
	if (h > 0) {
		let tm = `00${m % 60}`.slice(-2);
		let ts = `00${s % 60}`.slice(-2);
		return `${h}:${tm}:${ts}`;
	} else {
		let ts = `00${s % 60}`.slice(-2);
		return `${m}:${ts}`;
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
video.style.setProperty('width', '100%');
document.body.appendChild(video);
let context: Context | null = null;
let metadata: Metadata | null = null;
let context_index: number | null = null;
let play = (index: number): void => {
	if (index === context_index) {
		return;
	}
	if (context === null) {
		return;
	}
	let fid = context.files[index];
	video.src = `/files/${fid}/?token=${token}`;
	while (video.lastChild !== null) {
		video.removeChild(video.lastChild);
	}
	if (metadata !== null) {
		let md = metadata[fid];
		if (md !== undefined) {
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
				}
				e.src = `/files/${st.file_id}/?token=${token}`;
				video.appendChild(e);
			}
		}
	}
	video.play();
	context_index = index;
};
let seek = (offset_ms: number): void => {
	video.currentTime = (offset_ms / 1000);
};
let next = (): void => {
	if (context !== null && context_index !== null && context_index >= 0 && context_index < context.files.length - 1) {
		play(context_index + 1);
	}
};
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
chromecast.appendChild(ccp);
let ccload = document.createElement('button');
ccload.textContent = 'Cast';
ccload.addEventListener('click', () => {
	video.pause();
	req(`/api/cc/load/`, { context, index: context_index, token: token }, (status, response) => {});
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
				d.innerText = `${disc.number}`;
				mount.appendChild(d);
				for (let track of disc.tracks) {
					let x = document.createElement('div');
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
				d.innerText = `${album.title}`;
				d.addEventListener('click', () => {
					navigate(`audio/albums/${album.album_id}/`);
				});
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^audio[/]artists[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ArtistResponse>(`/api/audio/artists/${parts[1]}/`, {}, (status, response) => {
			let a = document.createElement('div');
			a.style.setProperty('font-size', '24px');
			a.innerText = `${response.title}`;
			mount.appendChild(a);
			for (let album of response.albums) {
				let d = document.createElement('div');
				d.innerText = `${album.title}`;
				d.addEventListener('click', () => {
					navigate(`audio/albums/${album.album_id}/`);
				});
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^audio[/]artists[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ArtistsResponse>(`/api/audio/artists/`, {}, (status, response) => {
			for (let artist of response.artists) {
				let d = document.createElement('div');
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
		d.addEventListener('click', () => {
			navigate('audio/artists/');
		});
		mount.appendChild(d);
		let d2 = document.createElement('div');
		d2.innerText = 'Albums';
		d2.addEventListener('click', () => {
			navigate('audio/albums/');
		});
		mount.appendChild(d2);
		let d3 = document.createElement('div');
		d3.innerText = 'Lists';
		d3.addEventListener('click', () => {
			navigate('audio/lists/');
		});
		mount.appendChild(d3);
	} else if ((parts = /^video[/]shows[/]([0-9a-f]{32})[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.ShowResponse>(`/api/video/shows/${parts[1]}/?token=${token}`, {}, (status, response) => {
			let d = document.createElement('div');
			d.innerText = `${response.title}`;
			d.style.setProperty('font-size', '24px');
			mount.appendChild(d);
			let context: Context = {
				files: response.seasons.reduce((files, season) => {
					files.push(...season.episodes.map(episode => episode.file_id));
					return files;
				}, new Array<string>())
			};
			let context_metadata: Metadata = {};
			for (let season of response.seasons) {
				let d = document.createElement('div');
				d.innerText = `${season.number}`;
				mount.appendChild(d);
				for (let episode of season.episodes) {
					context_metadata[episode.file_id] = {
						subtitles: episode.subtitles
					};
					let d2 = document.createElement('div');
					if (episode.streamed) {
						d2.classList.add("watched");
					}
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
				let d = document.createElement('div');
				d.innerText = `${show.title}`;
				d.addEventListener('click', () => {
					navigate(`video/shows/${show.show_id}/`);
				});
				mount.appendChild(d);
			}
		});
	} else if ((parts = /^video[/]episodes[/]([0-9a-f]{32})[/](?:([0-9]+)[/])?/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.EpisodeResponse>(`/api/video/episodes/${parts[1]}/`, {}, (status, response) => {
			let d = document.createElement('div');
			d.innerText = `${response.title}`;
			d.style.setProperty('font-size', '24px');
			mount.appendChild(d);
			let d2 = document.createElement('div');
			d2.innerText = format_duration(response.duration);
			mount.appendChild(d2);
			let d4 = document.createElement('div');
			d4.innerText = response.summary || "";
			mount.appendChild(d4);
			let context: Context = {
				files: [ response.file_id ]
			};
			let context_metadata: Metadata = {};
			context_metadata[response.file_id] = {
				subtitles: response.subtitles
			};
			let d3 = document.createElement('div');
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
			d2.innerText = response.summary || "";
			mount.appendChild(d2);
			let wrap = document.createElement('div');
			let img = document.createElement('img');
			img.src = `/files/${response.poster_file_id}/?token=${token}`;
			img.style.setProperty('width', '100%');
			wrap.appendChild(img);
			mount.appendChild(wrap);
			let context: Context = {
				files: response.movie_parts.map((part) => part.file_id)
			};
			let context_metadata: Metadata = {};
			for (let movie_part of response.movie_parts) {
				context_metadata[movie_part.file_id] = {
					subtitles: movie_part.subtitles
				};
				let d3 = document.createElement('div');
				if (movie_part.streamed) {
					d3.classList.add("watched");
				}
				d3.innerText = `part ${movie_part.number}`;
				d3.addEventListener('click', () => {
					set_context(context);
					set_context_metadata(context_metadata);
					play(context.files.indexOf(movie_part.file_id));
					if (parts !== null && parts.length >= 3) {
						let start_ms = Number.parseInt(parts[2], 10);
						seek(start_ms);
					}
				});
				mount.appendChild(d3);
			}
		});
	} else if ((parts = /^video[/]movies[/]/.exec(uri)) !== null) {
		req<api_response.ApiRequest, api_response.MoviesResponse>(`/api/video/movies/`, {}, (status, response) => {
			for (let movie of response.movies) {
				let d = document.createElement('div');
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
					h2.innerText = cue.subtitle.movie_part.movie.title;
					d.appendChild(h2);
					let h3 = document.createElement("h3");
					h3.innerText = "" + cue.subtitle.movie_part.movie.year;
					d.appendChild(h3);
				} else if (cue.subtitle.episode) {
					let episode = cue.subtitle.episode;
					let h2 = document.createElement("h2");
					h2.innerText = episode.title;
					d.appendChild(h2);
					let h3 = document.createElement("h3");
					h3.innerText = [
						episode.season.show.title,
						utils.formatSeasonEpisode(episode.season.number, episode.number)
					].join(" \u2022 ");
					d.appendChild(h3);
				}
				let pre = document.createElement("pre");
				pre.innerText = `${cue.lines.join("\n")}`;
				d.appendChild(pre);
				let p = document.createElement("p");
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
					window.open("/files/" + cue.cue_id + "/");
				});
				d.appendChild(b2);
				results.appendChild(d);
			}
		});
	} else if ((parts = /^video[/]/.exec(uri)) !== null) {
		let d = document.createElement('div');
		d.innerText = 'Shows';
		d.addEventListener('click', () => {
			navigate('video/shows/');
		});
		mount.appendChild(d);
		d = document.createElement('div');
		d.innerText = 'Movies';
		d.addEventListener('click', () => {
			navigate('video/movies/');
		});
		mount.appendChild(d);
		d = document.createElement('div');
		d.innerText = 'Cues';
		d.addEventListener('click', () => {
			navigate('video/cues/');
		});
		mount.appendChild(d);
	} else {
		let d = document.createElement('div');
		d.innerText = 'Audio';
		d.addEventListener('click', () => {
			navigate('audio/');
		});
		mount.appendChild(d);
		let v = document.createElement('div');
		v.innerText = 'Video';
		v.addEventListener('click', () => {
			navigate('video/');
		});
		mount.appendChild(v);
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
