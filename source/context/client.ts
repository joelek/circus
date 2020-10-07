import * as is from "../is";
import * as observers from "../simpleobs";
import * as schema from "./schema";
import * as typesockets from "../typesockets";

export class ContextClient {
	private tsc: typesockets.TypeSocketClient<schema.messages.Autoguard>;
	readonly estimatedProgress = new observers.ObservableClass(undefined as number | undefined);
	readonly estimatedProgressTimestamp = new observers.ObservableClass(undefined as number | undefined);
	readonly token = new observers.ObservableClass(undefined as string | undefined);
	readonly localDevice = new observers.ObservableClass(undefined as schema.objects.Device | undefined);
	readonly devices = new observers.ArrayObservable(new Array<schema.objects.Device>());
	readonly device = new observers.ObservableClass(undefined as schema.objects.Device | undefined);
	readonly isDeviceLocal = new observers.ObservableClass(false);
	readonly context = new observers.ObservableClass(undefined as schema.objects.Context | undefined);
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

	constructor(name: string) {
		let path = `/sockets/context/?client=${encodeURIComponent(name)}`;
		this.tsc = typesockets.TypeSocketClient.connect(path, schema.messages.Autoguard);
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
				let context = this.context.getState();
				let currentIndex = this.currentIndex.getState();
				if (is.present(context) && is.present(currentIndex)) {
					let index = currentIndex - 1;
					if (index >= 0 && index < context.length) {
						return this.lastIndex.updateState(index);
					}
				}
				return this.lastIndex.updateState(undefined);
			};
			this.context.addObserver(computer);
			this.currentIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let context = this.context.getState();
				let currentIndex = this.currentIndex.getState();
				if (is.present(context) && is.present(currentIndex)) {
					let index = currentIndex + 1;
					if (index >= 0 && index < context.length) {
						return this.nextIndex.updateState(index);
					}
				}
				return this.nextIndex.updateState(undefined);
			};
			this.context.addObserver(computer);
			this.currentIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let context = this.context.getState();
				let lastIndex = this.lastIndex.getState();
				if (is.present(context) && is.present(lastIndex)) {
					return this.lastEntry.updateState(context[lastIndex]);
				}
				return this.lastEntry.updateState(undefined);
			};
			this.context.addObserver(computer);
			this.lastIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let context = this.context.getState();
				let contextIndex = this.currentIndex.getState();
				if (is.present(context) && is.present(contextIndex)) {
					if (contextIndex >= 0 && contextIndex + 0 < context.length) {
						return this.currentEntry.updateState(context[contextIndex + 0]);
					}
				}
				return this.currentEntry.updateState(undefined);
			};
			this.context.addObserver(computer);
			this.currentIndex.addObserver(computer);
		}
		{
			let computer = () => {
				let context = this.context.getState();
				let nextIndex = this.nextIndex.getState();
				if (is.present(context) && is.present(nextIndex)) {
					return this.nextEntry.updateState(context[nextIndex]);
				}
				return this.nextEntry.updateState(undefined);
			};
			this.context.addObserver(computer);
			this.nextIndex.addObserver(computer);
		}
		this.tsc.addEventListener("app", "SetLocalDevice", (message) => {
			this.localDevice.updateState(message.device);
		});
		this.tsc.addEventListener("app", "SetDevices", (message) => {
			this.devices.update(message.devices);
		});
		this.token.addObserver(() => {
			let token = this.token.getState();
			this.tsc.send("SetToken", {
				token
			});
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

	play(context: schema.objects.Context, index: number, progress: number): void {
		this.tsc.send("SetPlayback", {
			playback: false
		});
		this.tsc.send("SetContext", {
			context
		});
		this.tsc.send("SetIndex", {
			index
		});
		this.tsc.send("SetProgress", {
			progress
		});
		this.tsc.send("SetPlayback", {
			playback: true
		});
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

	transfer(device: schema.objects.Device): void {
		this.tsc.send("SetDevice", {
			device: device
		});
	}
}
