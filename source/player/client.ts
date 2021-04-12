import * as is from "../is";
import * as observers from "../observers/";
import * as schema from "./schema/";
import * as typesockets from "../typesockets/client";

export class ContextClient {
	private tsc: typesockets.TypeSocketClient<schema.messages.Autoguard>;
	readonly estimatedProgress = new observers.ObservableClass(undefined as number | undefined);
	readonly estimatedProgressTimestamp = new observers.ObservableClass(undefined as number | undefined);
	readonly token = new observers.ObservableClass(undefined as string | undefined);
	readonly localDevice = new observers.ObservableClass(undefined as schema.objects.Device | undefined);
	readonly devices = new observers.ArrayObservable(new Array<schema.objects.Device>());
	readonly device = new observers.ObservableClass(undefined as schema.objects.Device | undefined);
	readonly isDeviceLocal = new observers.ObservableClass(false);
	readonly isDeviceRemote = new observers.ObservableClass(false);
	readonly context = new observers.ObservableClass(undefined as schema.objects.Context | undefined);
	readonly contextPath = new observers.ObservableClass(undefined as string[] | undefined);
	readonly flattenedContext = new observers.ObservableClass(undefined as schema.objects.ContextItem[] | undefined);
	readonly lastIndex = new observers.ObservableClass(undefined as number | undefined);
	readonly lastEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly lastLocalEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly currentIndex = new observers.ObservableClass(undefined as number | undefined);
	readonly currentEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly currentLocalEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly nextIndex = new observers.ObservableClass(undefined as number | undefined);
	readonly nextEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly nextLocalEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly playback = new observers.ObservableClass(false);
	readonly progress = new observers.ObservableClass(undefined as number | undefined);
	readonly localPlayback = new observers.ObservableClass(false);
	readonly canPlayLast = new observers.ObservableClass(false);
	readonly canPlayCurrent = new observers.ObservableClass(false);
	readonly canPlayNext = new observers.ObservableClass(false);
	readonly isCurrentEntryVideo = new observers.ObservableClass(false);
	readonly isOnline = new observers.ObservableClass(false);

	private sendPlay(context: schema.objects.Context, index: number): void {
		this.isCurrentEntryVideo.updateState(false);
		this.tsc.send("SetContext", {
			context
		});
		this.tsc.send("SetIndex", {
			index
		});
		this.tsc.send("SetPlayback", {
			playback: true
		});
	}

	constructor(url: string, factory: typesockets.WebSocketFactory = (url) => new WebSocket(url)) {
		this.tsc = new typesockets.TypeSocketClient(url, factory, schema.messages.Autoguard);
		this.tsc.addEventListener("sys", "connect", () => {
			this.isOnline.updateState(true);
		});
		this.tsc.addEventListener("sys", "disconnect", () => {
			this.isOnline.updateState(false);
		});
		this.context.addObserver((context) => {
			if (is.present(context)) {
				if (schema.objects.ContextAlbum.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let album = context;
					for (let disc of album.discs) {
						files.push(...disc.tracks);
					}
					this.flattenedContext.updateState(files);
				} else if (schema.objects.ContextArtist.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let artist = context;
					for (let album of artist.albums) {
						for (let disc of album.discs) {
							files.push(...disc.tracks);
						}
					}
					this.flattenedContext.updateState(files);
				} else if (schema.objects.ContextEpisode.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let episode = context;
					files.push(episode);
					this.flattenedContext.updateState(files);
				} else if (schema.objects.ContextMovie.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let movie = context;
					files.push(movie);
					this.flattenedContext.updateState(files);
				} else if (schema.objects.ContextPlaylist.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let playlist = context;
					for (let item of playlist.items) {
						files.push(item.track);
					}
					this.flattenedContext.updateState(files);
				} else if (schema.objects.ContextSeason.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let season = context;
					files.push(...season.episodes);
					this.flattenedContext.updateState(files);
				} else if (schema.objects.ContextShow.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let show = context;
					for (let season of show.seasons) {
						files.push(...season.episodes);
					}
					this.flattenedContext.updateState(files);
				} else if (schema.objects.ContextTrack.is(context)) {
					let files = [] as schema.objects.ContextItem[];
					let track = context;
					files.push(track);
					this.flattenedContext.updateState(files);
				} else {
					throw `Expected code to be unreachable!`;
				}
			}
		});
		{
			let computer = () => {
				let context = this.context.getState();
				let currentIndex = this.currentIndex.getState();
				if (is.present(context) && is.present(currentIndex)) {
					if (schema.objects.ContextAlbum.is(context)) {
						let discIndex = 0;
						let trackIndex = currentIndex;
						let album = context;
						let discs = album.discs;
						for (let d = 0; d < discs.length; d++) {
							let length = discs[d].tracks.length;
							if (trackIndex >= length) {
								discIndex += 1;
								trackIndex -= length;
							} else {
								break;
							}
						}
						return this.contextPath.updateState([
							context.album_id,
							context.discs[discIndex].disc_id,
							context.discs[discIndex].tracks[trackIndex].track_id
						]);
					} else if (schema.objects.ContextArtist.is(context)) {
						let albumIndex = 0;
						let discIndex = 0;
						let trackIndex = currentIndex;
						let artist = context;
						let albums = artist.albums;
						outer: for (let a = 0; a < albums.length; a++) {
							let discs = albums[a].discs;
							for (let d = 0; d < discs.length; d++) {
								let length = discs[d].tracks.length;
								if (trackIndex >= length) {
									discIndex += 1;
									trackIndex -= length;
								} else {
									break outer;
								}
							}
							albumIndex += 1;
							discIndex = 0;
						}
						return this.contextPath.updateState([
							context.artist_id,
							context.albums[albumIndex].album_id,
							context.albums[albumIndex].discs[discIndex].disc_id,
							context.albums[albumIndex].discs[discIndex].tracks[trackIndex].track_id
						]);
					} else if (schema.objects.ContextEpisode.is(context)) {
						return this.contextPath.updateState([
							context.episode_id
						]);
					} else if (schema.objects.ContextMovie.is(context)) {
						return this.contextPath.updateState([
							context.movie_id
						]);
					} else if (schema.objects.ContextPlaylist.is(context)) {
						let itemIndex = currentIndex;
						return this.contextPath.updateState([
							context.playlist_id,
							context.items[itemIndex].track.track_id
						]);
					} else if (schema.objects.ContextShow.is(context)) {
						let seasonIndex = 0;
						let episodeIndex = currentIndex;
						let show = context;
						let seasons = show.seasons;
						for (let d = 0; d < seasons.length; d++) {
							let length = seasons[d].episodes.length;
							if (episodeIndex >= length) {
								seasonIndex += 1;
								episodeIndex -= length;
							} else {
								break;
							}
						}
						return this.contextPath.updateState([
							context.show_id,
							context.seasons[seasonIndex].season_id,
							context.seasons[seasonIndex].episodes[episodeIndex].episode_id
						]);
					} else if (schema.objects.ContextSeason.is(context)) {
						let episodeIndex = currentIndex;
						return this.contextPath.updateState([
							context.season_id,
							context.episodes[episodeIndex].episode_id
						]);
					} else if (schema.objects.ContextTrack.is(context)) {
						return this.contextPath.updateState([
							context.track_id
						]);
					} else {
						throw `Expected code to be unreachable!`;
					}
				}
				this.contextPath.updateState(undefined);
			};
			this.context.addObserver(computer);
			this.currentIndex.addObserver(computer);
		}
		this.lastEntry.addObserver((lastEntry) => {
			this.canPlayLast.updateState(is.present(lastEntry));
		});
		this.currentEntry.addObserver((currentEntry) => {
			this.canPlayCurrent.updateState(is.present(currentEntry));
		});
		this.nextEntry.addObserver((nextEntry) => {
			this.canPlayNext.updateState(is.present(nextEntry));
		});
		this.progress.addObserver((progress) => {
			this.estimatedProgress.updateState(progress);
			this.estimatedProgressTimestamp.updateState(Date.now());
		});
		this.playback.addObserver((playback) => {
			let estimatedProgress = this.estimatedProgress.getState();
			let estimatedProgressTimestamp = this.estimatedProgressTimestamp.getState();
			let now = Date.now();
			if (!playback) {
				if (is.present(estimatedProgress) && is.present(estimatedProgressTimestamp)) {
					this.estimatedProgress.updateState(estimatedProgress + (now - estimatedProgressTimestamp) / 1000);
				}
			}
			this.estimatedProgressTimestamp.updateState(now);
		});
		this.estimatedProgress.addObserver((estimatedProgress) => {
			console.log(`Estimated progress to ${estimatedProgress ?? 0}`);
		});
		{
			let computer = () => {
				let playback = this.playback.getState();
				let isDeviceLocal = this.isDeviceLocal.getState();
				this.localPlayback.updateState(isDeviceLocal && playback);
			};
			this.playback.addObserver(computer);
			this.isDeviceLocal.addObserver(computer);
		}
		{
			let computer = () => {
				let lastEntry = this.lastEntry.getState();
				let isDeviceLocal = this.isDeviceLocal.getState();
				this.lastLocalEntry.updateState(isDeviceLocal ? lastEntry : undefined);
			};
			this.lastEntry.addObserver(computer);
			this.isDeviceLocal.addObserver(computer);
		}
		{
			let computer = () => {
				let currentEntry = this.currentEntry.getState();
				let isDeviceLocal = this.isDeviceLocal.getState();
				this.currentLocalEntry.updateState(isDeviceLocal ? currentEntry : undefined);
			};
			this.currentEntry.addObserver(computer);
			this.isDeviceLocal.addObserver(computer);
		}
		{
			let computer = () => {
				let nextEntry = this.nextEntry.getState();
				let isDeviceLocal = this.isDeviceLocal.getState();
				this.nextLocalEntry.updateState(isDeviceLocal ? nextEntry : undefined);
			};
			this.nextEntry.addObserver(computer);
			this.isDeviceLocal.addObserver(computer);
		}
		{
			let computer = () => {
				let localDevice = this.localDevice.getState();
				let device = this.device.getState();
				if (is.present(localDevice) && is.present(device)) {
					if (localDevice.id === device.id) {
						return this.isDeviceLocal.updateState(true);
					}
				}
				return this.isDeviceLocal.updateState(false);
			};
			this.localDevice.addObserver(computer);
			this.device.addObserver(computer);
		}
		{
			let computer = () => {
				let localDevice = this.localDevice.getState();
				let device = this.device.getState();
				if (is.present(localDevice) && is.present(device)) {
					if (localDevice.id !== device.id) {
						return this.isDeviceRemote.updateState(true);
					}
				}
				return this.isDeviceRemote.updateState(false);
			};
			this.localDevice.addObserver(computer);
			this.device.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let currentIndex = this.currentIndex.getState();
				if (is.present(flattenedContext) && is.present(currentIndex)) {
					let index = currentIndex - 1;
					if (index >= 0 && index < flattenedContext.length) {
						return this.lastIndex.updateState(index);
					}
				}
				return this.lastIndex.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.currentIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let currentIndex = this.currentIndex.getState();
				if (is.present(flattenedContext) && is.present(currentIndex)) {
					let index = currentIndex + 1;
					if (index >= 0 && index < flattenedContext.length) {
						return this.nextIndex.updateState(index);
					}
				}
				return this.nextIndex.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.currentIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let lastIndex = this.lastIndex.getState();
				if (is.present(flattenedContext) && is.present(lastIndex)) {
					return this.lastEntry.updateState(flattenedContext[lastIndex]);
				}
				return this.lastEntry.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.lastIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let contextIndex = this.currentIndex.getState();
				if (is.present(flattenedContext) && is.present(contextIndex)) {
					if (contextIndex >= 0 && contextIndex + 0 < flattenedContext.length) {
						return this.currentEntry.updateState(flattenedContext[contextIndex + 0]);
					}
				}
				return this.currentEntry.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.currentIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let nextIndex = this.nextIndex.getState();
				if (is.present(flattenedContext) && is.present(nextIndex)) {
					return this.nextEntry.updateState(flattenedContext[nextIndex]);
				}
				return this.nextEntry.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.nextIndex.addObserver(computer);
		}
		this.tsc.addEventListener("app", "SetLocalDevice", (message) => {
			this.localDevice.updateState(message.device);
		});
		this.tsc.addEventListener("app", "SetDevices", (message) => {
			this.devices.update(message.devices);
		});
		this.tsc.addEventListener("app", "SetContext", (message) => {
			this.context.updateState(message.context);
		});
		this.tsc.addEventListener("app", "SetDevice", (message) => {
			this.device.updateState(message.device);
		});
		this.tsc.addEventListener("app", "SetIndex", (message) => {
			this.currentIndex.updateState(message.index);
		});
		this.tsc.addEventListener("app", "SetPlayback", (message) => {
			this.playback.updateState(message.playback);
		});
		this.tsc.addEventListener("app", "SetProgress", (message) => {
			this.progress.updateState(message.progress);
		});
		this.tsc.addEventListener("app", "SetToken", (message) => {
			this.token.updateState(message.token);
		});
		this.isOnline.addObserver((isOnline) => {
			if (!isOnline) {
				this.context.updateState(undefined);
				this.currentIndex.updateState(undefined);
				this.playback.updateState(false);
				this.progress.updateState(undefined);
			}
		});
		observers.computed((isOnline, token) => {
			if (isOnline) {
				this.tsc.send("SetToken", {
					token
				});
			}
		}, this.isOnline, this.token);
	}

	authenticate(token?: string): void {
		this.token.updateState(token);
	}

	close(): void {
		this.tsc.close();
	}

	last(): void {
		let lastIndex = this.lastIndex.getState();
		if (is.present(lastIndex)) {
			this.currentIndex.updateState(lastIndex);
			this.tsc.send("SetIndex", {
				index: lastIndex
			});
		} else {
			this.pause();
		}
	}

	next(): void {
		let nextIndex = this.nextIndex.getState();
		if (is.present(nextIndex)) {
			this.currentIndex.updateState(nextIndex);
			this.tsc.send("SetIndex", {
				index: nextIndex
			});
		} else {
			this.pause();
		}
	}

	pause(): void {
		this.playback.updateState(false);
		this.tsc.send("SetPlayback", {
			playback: false
		});
	}

	play(): void {
		this.resume();
	}

	playAlbum(album: schema.objects.ContextAlbum, discIndex?: number, trackIndex?: number): void {
		let index = 0;
		if (is.present(discIndex)) {
			let discs = album.discs;
			if (discIndex < 0 || discIndex >= discs.length) {
				throw `Expected ${discIndex} to be a number between 0 and ${discs.length}!`;
			}
			index += discs.slice(0, discIndex).reduce((sum, disc) => sum + disc.tracks.length, 0);
			if (is.present(trackIndex)) {
				let tracks = discs[discIndex].tracks;
				if (trackIndex < 0 || trackIndex >= tracks.length) {
					throw `Expected ${trackIndex} to be a number between 0 and ${tracks.length}!`;
				}
				index += trackIndex;
			}
		}
		return this.sendPlay(album, index);
	}

	playArtist(artist: schema.objects.ContextArtist, albumIndex?: number, discIndex?: number, trackIndex?: number): void {
		let index = 0;
		if (is.present(albumIndex)) {
			let albums = artist.albums;
			if (albumIndex < 0 || albumIndex >= albums.length) {
				throw `Expected ${albumIndex} to be a number between 0 and ${albums.length}!`;
			}
			index += albums.slice(0, albumIndex).reduce((sum, album) => sum + album.discs.reduce((sum, disc) => sum + disc.tracks.length, 0), 0);
			if (is.present(discIndex)) {
				let discs = albums[albumIndex].discs;
				if (discIndex < 0 || discIndex >= discs.length) {
					throw `Expected ${discIndex} to be a number between 0 and ${discs.length}!`;
				}
				index += discs.slice(0, discIndex).reduce((sum, disc) => sum + disc.tracks.length, 0);
				if (is.present(trackIndex)) {
					let tracks = discs[discIndex].tracks;
					if (trackIndex < 0 || trackIndex >= tracks.length) {
						throw `Expected ${trackIndex} to be a number between 0 and ${tracks.length}!`;
					}
					index += trackIndex;
				}
			}
		}
		return this.sendPlay(artist, index);
	}

	playDisc(disc: schema.objects.ContextDisc, trackIndex?: number): void {
		let index = 0;
		if (is.present(trackIndex)) {
			let tracks = disc.tracks;
			if (trackIndex < 0 || trackIndex >= tracks.length) {
				throw `Expected ${trackIndex} to be a number between 0 and ${tracks.length}!`;
			}
			index += trackIndex;
		}
		return this.sendPlay(disc, index);
	}

	playEpisode(episode: schema.objects.ContextEpisode): void {
		this.sendPlay(episode, 0);
	}

	playMovie(movie: schema.objects.ContextMovie): void {
		this.sendPlay(movie, 0);
	}

	playPlaylist(playlist: schema.objects.ContextPlaylist, itemIndex?: number): void {
		let index = 0;
		if (is.present(itemIndex)) {
			let items = playlist.items;
			if (itemIndex < 0 || itemIndex >= items.length) {
				throw `Expected ${itemIndex} to be a number between 0 and ${items.length}!`;
			}
			index += itemIndex;
		}
		return this.sendPlay(playlist, index);
	}

	playSeason(season: schema.objects.ContextSeason, episodeIndex?: number): void {
		let index = 0;
		if (is.present(episodeIndex)) {
			let episodes = season.episodes;
			if (episodeIndex < 0 || episodeIndex >= episodes.length) {
				throw `Expected ${episodeIndex} to be a number between 0 and ${episodes.length}!`;
			}
			index += episodeIndex;
		}
		return this.sendPlay(season, index);
	}

	playShow(show: schema.objects.ContextShow, seasonIndex?: number, episodeIndex?: number): void {
		let index = 0;
		if (is.present(seasonIndex)) {
			let seasons = show.seasons;
			if (seasonIndex < 0 || seasonIndex >= seasons.length) {
				throw `Expected ${seasonIndex} to be a number between 0 and ${seasons.length}!`;
			}
			index += seasons.slice(0, seasonIndex).reduce((sum, season) => sum + season.episodes.length, 0);
			if (is.present(episodeIndex)) {
				let episodes = seasons[seasonIndex].episodes;
				if (episodeIndex < 0 || episodeIndex >= episodes.length) {
					throw `Expected ${episodeIndex} to be a number between 0 and ${episodes.length}!`;
				}
				index += episodeIndex;
			}
		}
		return this.sendPlay(show, index);
	}

	playTrack(track: schema.objects.ContextTrack): void {
		this.sendPlay(track, 0);
	}

	reconnect(): void {
		this.tsc.reconnect();
	}

	resume(): void {
		if (this.canPlayCurrent.getState()) {
			this.playback.updateState(true);
			this.tsc.send("SetPlayback", {
				playback: true
			});
		}
	}

	seek(progress?: number): void {
		this.progress.updateState(progress);
		this.tsc.send("SetProgress", {
			progress: progress
		});
	}

	toggle(): void {
		if (this.playback.getState()) {
			this.pause();
		} else {
			this.resume();
		}
	}

	transfer(device?: schema.objects.Device): void {
		this.tsc.send("SetDevice", {
			device: device
		});
	}
}
