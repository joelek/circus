import * as is from "../is";
import * as observers from "../simpleobs";
import * as schema from "./schema";
import * as typesockets from "../typesockets";

type AlbumIndices = { disc: number, track: number };
type ArtistIndices = { album: number, disc: number, track: number };
type Indices = AlbumIndices | ArtistIndices;

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
	readonly contextId = new observers.ObservableClass(undefined as string | undefined);
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

	constructor(url: string, factory: typesockets.WebSocketFactory = (url) => new WebSocket(url)) {
		this.tsc = new typesockets.TypeSocketClient(url, factory, schema.messages.Autoguard);
		this.context.addObserver((context) => {
			if (is.present(context)) {
				if (schema.objects.ContextAlbum.is(context)) {
					this.contextId.updateState(context.album_id);
					let tracks = [] as schema.objects.ContextItem[];
					for (let disc of context.discs) {
						tracks.push(...disc.tracks);
					}
					this.flattenedContext.updateState(tracks);
				} else if (schema.objects.ContextArtist.is(context)) {
					this.contextId.updateState(context.artist_id);
					let tracks = [] as schema.objects.ContextItem[];
					for (let album of context.albums) {
						for (let disc of album.discs) {
							tracks.push(...disc.tracks);
						}
					}
					this.flattenedContext.updateState(tracks);
				}
			}
		});
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
		this.token.addObserver((token) => {
			this.tsc.send("SetToken", {
				token
			});
		});
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
	}

	authenticate(token?: string): void {
		this.tsc.send("SetToken", {
			token
		});
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
		}
	}

	next(): void {
		let nextIndex = this.nextIndex.getState();
		if (is.present(nextIndex)) {
			this.currentIndex.updateState(nextIndex);
			this.tsc.send("SetIndex", {
				index: nextIndex
			});
		}
	}

	pause(): void {
		this.playback.updateState(false);
		this.tsc.send("SetPlayback", {
			playback: false
		});
	}

	play(context: schema.objects.ContextAlbum, i: AlbumIndices, progress: number): void;
	play(context: schema.objects.ContextArtist, i: ArtistIndices, progress: number): void;
	play(context: schema.objects.Context, i: Indices, progress: number): void {
		let index = (() => {
			if (schema.objects.ContextAlbum.is(context)) {
				let indices = i as AlbumIndices;
				let index = indices.track;
				index += context.discs.slice(0, indices.disc).reduce((sum, disc) => sum + disc.tracks.length, 0);
				return index;
			}
			if (schema.objects.ContextArtist.is(context)) {
				let indices = i as ArtistIndices;
				let index = indices.track;
				index += context.albums.slice(0, indices.album).reduce((sum, album) => sum + album.discs.reduce((sum, disc) => sum + disc.tracks.length, 0), 0);
				return index;
			}
		})();
		this.tsc.send("SetContext", {
			context
		});
		this.tsc.send("SetIndex", {
			index
		});
		this.seek(progress);
		this.resume();
	}

	resume(): void {
		this.playback.updateState(true);
		this.tsc.send("SetPlayback", {
			playback: true
		});
	}

	seek(progress: number): void {
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
