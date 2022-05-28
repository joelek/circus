import * as is from "../is";
import * as observers from "../observers/";
import * as schema from "./schema/";
import * as typesockets from "../typesockets/client";

export class ContextClient {
	private tsc: typesockets.TypeSocketClient<schema.messages.Autoguard.Guards>;
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
	readonly shuffle = new observers.ObservableClass(false);
	readonly repeat = new observers.ObservableClass(false);
	readonly flattenedContext = new observers.ObservableClass(undefined as schema.objects.ContextItem[] | undefined);
	readonly lastEntryIndex = new observers.ObservableClass(undefined as number | undefined);
	readonly lastEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly lastLocalEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly currentEntryIndex = new observers.ObservableClass(undefined as number | undefined);
	readonly currentEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly currentLocalEntry = new observers.ObservableClass(undefined as schema.objects.ContextItem | undefined);
	readonly nextEntryIndex = new observers.ObservableClass(undefined as number | undefined);
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

	private flattenContext(context: schema.objects.Context): Array<schema.objects.ContextItem> {
		if (schema.objects.ContextAlbum.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let album = context;
			for (let disc of album.discs) {
				files.push(...disc.tracks);
			}
			return files;
		} else if (schema.objects.ContextArtist.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let artist = context;
			for (let album of artist.albums) {
				for (let disc of album.discs) {
					files.push(...disc.tracks);
				}
			}
			return files;
		} else if (schema.objects.ContextEpisode.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let episode = context;
			files.push(episode);
			return files;
		} else if (schema.objects.ContextMovie.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let movie = context;
			files.push(movie);
			return files;
		} else if (schema.objects.ContextPlaylist.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let playlist = context;
			for (let item of playlist.items) {
				files.push(item.track);
			}
			return files;
		} else if (schema.objects.ContextSeason.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let season = context;
			files.push(...season.episodes);
			return files;
		} else if (schema.objects.ContextShow.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let show = context;
			for (let season of show.seasons) {
				files.push(...season.episodes);
			}
			return files;
		} else if (schema.objects.ContextTrack.is(context)) {
			let files = [] as schema.objects.ContextItem[];
			let track = context;
			files.push(track);
			return files;
		} else {
			throw `Expected code to be unreachable!`;
		}
	}

	private sendPlay(context: schema.objects.Context, index?: number): void {
		if (is.absent(index)) {
			if (this.shuffle.getState()) {
				let flattenedContext = this.flattenContext(context);
				index = Math.floor(Math.random() * flattenedContext.length);
			} else {
				index = 0;
			}
		}
		this.context.updateState(context);
		this.currentEntryIndex.updateState(index);
		this.playback.updateState(true);
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
		this.tsc = new typesockets.TypeSocketClient(url, factory, schema.messages.Autoguard.Guards);
		this.tsc.addEventListener("sys", "connect", () => {
			this.isOnline.updateState(true);
		});
		this.tsc.addEventListener("sys", "disconnect", () => {
			this.isOnline.updateState(false);
		});
		this.context.addObserver((context) => {
			if (is.present(context)) {
				this.flattenedContext.updateState(this.flattenContext(context));
			}
		});
		{
			let computer = () => {
				let context = this.context.getState();
				let currentEntryIndex = this.currentEntryIndex.getState();
				if (is.present(context) && is.present(currentEntryIndex)) {
					if (schema.objects.ContextAlbum.is(context)) {
						let discIndex = 0;
						let trackIndex = currentEntryIndex;
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
							context.discs[discIndex]?.disc_id,
							context.discs[discIndex]?.tracks[trackIndex]?.track_id
						].filter(is.present));
					} else if (schema.objects.ContextArtist.is(context)) {
						let albumIndex = 0;
						let discIndex = 0;
						let trackIndex = currentEntryIndex;
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
							context.albums[albumIndex]?.album_id,
							context.albums[albumIndex]?.discs[discIndex]?.disc_id,
							context.albums[albumIndex]?.discs[discIndex]?.tracks[trackIndex]?.track_id
						].filter(is.present));
					} else if (schema.objects.ContextEpisode.is(context)) {
						return this.contextPath.updateState([
							context.episode_id
						].filter(is.present));
					} else if (schema.objects.ContextMovie.is(context)) {
						return this.contextPath.updateState([
							context.movie_id
						].filter(is.present));
					} else if (schema.objects.ContextPlaylist.is(context)) {
						let itemIndex = currentEntryIndex;
						return this.contextPath.updateState([
							context.playlist_id,
							context.items[itemIndex]?.track.track_id
						].filter(is.present));
					} else if (schema.objects.ContextShow.is(context)) {
						let seasonIndex = 0;
						let episodeIndex = currentEntryIndex;
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
							context.seasons[seasonIndex]?.season_id,
							context.seasons[seasonIndex]?.episodes[episodeIndex]?.episode_id
						].filter(is.present));
					} else if (schema.objects.ContextSeason.is(context)) {
						let episodeIndex = currentEntryIndex;
						return this.contextPath.updateState([
							context.season_id,
							context.episodes[episodeIndex]?.episode_id
						].filter(is.present));
					} else if (schema.objects.ContextTrack.is(context)) {
						return this.contextPath.updateState([
							context.track_id
						].filter(is.present));
					} else {
						throw `Expected code to be unreachable!`;
					}
				}
				this.contextPath.updateState(undefined);
			};
			this.context.addObserver(computer);
			this.currentEntryIndex.addObserver(computer);
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
		}, true);
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
		this.progress.addObserver((progress) => {
			console.log(`Progress: ${progress}`);
		});
		this.estimatedProgress.addObserver((estimatedProgress) => {
			console.log(`Estimated progress: ${estimatedProgress}`);
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
				let currentEntryIndex = this.currentEntryIndex.getState();
				let shuffle = this.shuffle.getState();
				let repeat = this.repeat.getState();
				let lastEntryIndex: number | undefined;
				if (is.present(flattenedContext) && is.present(currentEntryIndex)) {
					if (shuffle) {
					} else {
						let index = currentEntryIndex - 1;
						if (repeat) {
							index = (index + flattenedContext.length) % flattenedContext.length;
						}
						lastEntryIndex = index;
					}
				}
				return this.lastEntryIndex.updateState(lastEntryIndex);
			};
			this.flattenedContext.addObserver(computer);
			this.currentEntryIndex.addObserver(computer);
			this.shuffle.addObserver(computer);
			this.repeat.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let currentEntryIndex = this.currentEntryIndex.getState();
				let shuffle = this.shuffle.getState();
				let repeat = this.repeat.getState();
				let nextEntryIndex: number | undefined;
				if (is.present(flattenedContext) && is.present(currentEntryIndex)) {
					if (shuffle) {
						nextEntryIndex = Math.floor(Math.random() * flattenedContext.length);
					} else {
						let index = currentEntryIndex + 1;
						if (repeat) {
							index = index % flattenedContext.length;
						}
						nextEntryIndex = index;
					}
				}
				return this.nextEntryIndex.updateState(nextEntryIndex);
			};
			this.flattenedContext.addObserver(computer);
			this.currentEntryIndex.addObserver(computer);
			this.shuffle.addObserver(computer);
			this.repeat.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let lastEntryIndex = this.lastEntryIndex.getState();
				if (is.present(flattenedContext) && is.present(lastEntryIndex)) {
					if (lastEntryIndex >= 0 && lastEntryIndex < flattenedContext.length) {
						return this.lastEntry.updateState(flattenedContext[lastEntryIndex]);
					}
				}
				return this.lastEntry.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.lastEntryIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let currentEntryIndex = this.currentEntryIndex.getState();
				if (is.present(flattenedContext) && is.present(currentEntryIndex)) {
					if (currentEntryIndex >= 0 && currentEntryIndex < flattenedContext.length) {
						return this.currentEntry.updateState(flattenedContext[currentEntryIndex]);
					}
				}
				return this.currentEntry.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.currentEntryIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let flattenedContext = this.flattenedContext.getState();
				let nextEntryIndex = this.nextEntryIndex.getState();
				if (is.present(flattenedContext) && is.present(nextEntryIndex)) {
					if (nextEntryIndex >= 0 && nextEntryIndex < flattenedContext.length) {
						return this.nextEntry.updateState(flattenedContext[nextEntryIndex]);
					}
				}
				return this.nextEntry.updateState(undefined);
			};
			this.flattenedContext.addObserver(computer);
			this.nextEntryIndex.addObserver(computer);
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
			this.currentEntryIndex.updateState(message.index);
		});
		this.tsc.addEventListener("app", "SetPlayback", (message) => {
			this.playback.updateState(message.playback);
		});
		this.tsc.addEventListener("app", "SetProgress", (message) => {
			this.progress.updateState(message.progress);
		});
		this.tsc.addEventListener("app", "SetRepeat", (message) => {
			this.repeat.updateState(message.repeat);
		});
		this.tsc.addEventListener("app", "SetShuffle", (message) => {
			this.shuffle.updateState(message.shuffle);
		});
		this.tsc.addEventListener("app", "SetToken", (message) => {
			this.token.updateState(message.token);
		});
		this.isOnline.addObserver((isOnline) => {
			if (!isOnline) {
				this.context.updateState(undefined);
				this.currentEntryIndex.updateState(undefined);
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
		let lastEntryIndex = this.lastEntryIndex.getState();
		if (is.present(lastEntryIndex)) {
			this.currentEntryIndex.updateState(undefined);
			this.currentEntryIndex.updateState(lastEntryIndex);
			this.tsc.send("SetIndex", {
				index: lastEntryIndex
			});
		} else {
			this.pause();
		}
	}

	next(): void {
		let nextEntryIndex = this.nextEntryIndex.getState();
		if (is.present(nextEntryIndex)) {
			this.currentEntryIndex.updateState(undefined);
			this.currentEntryIndex.updateState(nextEntryIndex);
			this.tsc.send("SetIndex", {
				index: nextEntryIndex
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
		let index: number | undefined;
		if (is.present(discIndex)) {
			index = index ?? 0;
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
		let index: number | undefined;
		if (is.present(albumIndex)) {
			index = index ?? 0;
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
		let index: number | undefined;
		if (is.present(trackIndex)) {
			index = index ?? 0;
			let tracks = disc.tracks;
			if (trackIndex < 0 || trackIndex >= tracks.length) {
				throw `Expected ${trackIndex} to be a number between 0 and ${tracks.length}!`;
			}
			index += trackIndex;
		}
		return this.sendPlay(disc, index);
	}

	playEpisode(episode: schema.objects.ContextEpisode): void {
		this.sendPlay(episode);
	}

	playMovie(movie: schema.objects.ContextMovie): void {
		this.sendPlay(movie);
	}

	playPlaylist(playlist: schema.objects.ContextPlaylist, itemIndex?: number): void {
		let index: number | undefined;
		if (is.present(itemIndex)) {
			index = index ?? 0;
			let items = playlist.items;
			if (itemIndex < 0 || itemIndex >= items.length) {
				throw `Expected ${itemIndex} to be a number between 0 and ${items.length}!`;
			}
			index += itemIndex;
		}
		return this.sendPlay(playlist, index);
	}

	playSeason(season: schema.objects.ContextSeason, episodeIndex?: number): void {
		let index: number | undefined;
		if (is.present(episodeIndex)) {
			index = index ?? 0;
			let episodes = season.episodes;
			if (episodeIndex < 0 || episodeIndex >= episodes.length) {
				throw `Expected ${episodeIndex} to be a number between 0 and ${episodes.length}!`;
			}
			index += episodeIndex;
		}
		return this.sendPlay(season, index);
	}

	playShow(show: schema.objects.ContextShow, seasonIndex?: number, episodeIndex?: number): void {
		let index: number | undefined;
		if (is.present(seasonIndex)) {
			index = index ?? 0;
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
		this.sendPlay(track);
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

	togglePlayback(): void {
		if (this.playback.getState()) {
			this.pause();
		} else {
			this.resume();
		}
	}

	toggleRepeat(): void {
		let repeat = !this.repeat.getState();
		this.repeat.updateState(repeat);
		this.tsc.send("SetRepeat", {
			repeat: repeat
		});
	}

	toggleShuffle(): void {
		let shuffle = !this.shuffle.getState();
		this.shuffle.updateState(shuffle);
		this.tsc.send("SetShuffle", {
			shuffle: shuffle
		});
	}

	transfer(device?: schema.objects.Device): void {
		this.tsc.send("SetDevice", {
			device: device
		});
	}
}
