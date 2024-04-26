import * as libhttp from "http";
import * as liburl from "url";
import * as auth from "../server/auth";
import * as is from "../is";
import * as observers from "../observers/";
import * as schema from "./schema/";
import * as typesockets from "../typesockets/";
import { ReadableQueue } from "@joelek/atlas";
import * as atlas from "../database/atlas";

function getQuery(url: liburl.UrlWithParsedQuery, key: string): Array<string> {
	let values = url.query[key] ?? [];
	if (Array.isArray(values)) {
		return values;
	} else {
		return [values];
	}
}

function makeDevice(connection_id: string, connection_url: string): schema.objects.Device {
	let url = liburl.parse(connection_url, true);
	let did = getQuery(url, "did").pop() ?? "";
	let protocol = getQuery(url, "protocol").pop() ?? "";
	let name = getQuery(url, "name").pop() ?? "";
	let type = getQuery(url, "type").pop() ?? "";
	let enabled = getQuery(url, "enabled").pop() !== "false";
	return {
		did: did,
		id: connection_id,
		protocol: protocol,
		name: name,
		type: type,
		enabled: enabled
	};
}

type Session = schema.objects.Session & {
	devices: observers.ObservableClass<Array<schema.objects.Device>>,
	progressTimestamp?: number
}

export class ContextServer {
	private chromecasts: observers.ObservableClass<Array<schema.objects.Device>>;
	private tss: typesockets.TypeSocketServer<schema.messages.Autoguard.Guards>;
	private tokens = new Map<string, string>();
	private sessions = new Map<string, Session>();

	private async getExistingSession(queue: ReadableQueue, connection_id: string, callback: (session: Session) => void): Promise<void> {
		let token = this.tokens.get(connection_id);
		if (is.present(token)) {
			let user_id = await auth.getUserId(queue, token);
			let session = this.sessions.get(user_id);
			if (is.present(session)) {
				callback(session);
			}
		}
	}

	private getSession(user_id: string): Session {
		let existingSession = this.sessions.get(user_id);
		if (is.present(existingSession)) {
			return existingSession;
		}
		const session: Session = {
			playback: false,
			playing: false,
			repeat: false,
			shuffle: false,
			devices: new observers.ObservableClass(new Array<schema.objects.Device>())
		};
		let allDevices = new observers.ObservableClass<Array<schema.objects.Device>>([]);
		{
			let computer = () => {
				let devices = session.devices.getState();
				let chromecasts = this.chromecasts.getState().filter((chromecast) => {
					return is.absent(devices.find((device) => {
						return device.id === chromecast.id;
					}));
				});
				allDevices.updateState([...devices, ...chromecasts]);
			};
			session.devices.addObserver(computer);
			this.chromecasts.addObserver(computer);
		}
		allDevices.addObserver((allDevices) => {
			this.tss.send("SetDevices", session.devices.getState().map((device) => {
				return device.id;
			}), {
				devices: allDevices
			});
		});
		session.devices.addObserver((devices) => {
			this.updateProgress(session);
		});
		session.devices.addObserver((devices) => {
			let deviceWasLost = is.present(session.device) && is.absent(devices.find((device) => {
				return device.id === session.device?.id;
			}));
			if (deviceWasLost) {
				let deviceCandidates = devices.filter((device) => {
					return device.did === session.device?.did;
				});
				let device = deviceCandidates.pop();
				this.updateProgress(session);
				this.tss.send("SetProgress", devices.map((device) => {
					return device.id;
				}), {
					progress: session.progress
				});
				session.playback = session.playback && is.present(device);
				this.tss.send("SetPlayback", devices.map((device) => {
					return device.id;
				}), {
					playback: session.playback
				});
				session.playing = false;
				this.tss.send("SetPlaying", devices.map((device) => {
					return device.id;
				}), {
					playing: session.playing
				});
				session.device = device;
				this.tss.send("SetDevice", devices.map((device) => {
					return device.id;
				}), {
					device: session.device
				});
			}
		});
		this.sessions.set(user_id, session);
		return session;
	}

	private async revokeAuthentication(queue: ReadableQueue, connection_id: string): Promise<void> {
		let token = this.tokens.get(connection_id);
		this.tokens.delete(connection_id);
		if (is.present(token)) {
			let user_id = await auth.getUserId(queue, token);
			let session = this.sessions.get(user_id);
			if (is.present(session)) {
				let devices = session.devices;
				devices.updateState(devices.getState().filter((device) => {
					return device.id !== connection_id;
				}));
			}
		}
	}

	private updateProgress(session: Session): void {
		let now = Date.now();
		if (session.playing) {
			if (is.present(session.progress) && is.present(session.progressTimestamp)) {
				session.progress += (now - session.progressTimestamp) / 1000;
			}
		}
		session.progressTimestamp = now;
	}

	constructor() {
		this.chromecasts = new observers.ObservableClass<Array<schema.objects.Device>>([]);
		this.tss = new typesockets.TypeSocketServer(schema.messages.Autoguard.Guards);
		this.tss.addEventListener("sys", "connect", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			console.log("connect: " + message.connection_url);
			let device = makeDevice(message.connection_id, message.connection_url);
			this.tss.send("SetLocalDevice", message.connection_id, {
				device
			});
			if (device.protocol === "cast" || device.protocol === "airplay") {
				this.chromecasts.updateState([...this.chromecasts.getState(), device]);
			}
		}));
		this.tss.addEventListener("sys", "disconnect", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			console.log("disconnect: " + message.connection_url);
			let device = makeDevice(message.connection_id, message.connection_url);
			await this.revokeAuthentication(queue, message.connection_id);
			if (device.protocol === "cast" || device.protocol === "airplay") {
				this.chromecasts.updateState(this.chromecasts.getState().filter((chromecast) => {
					return chromecast.id !== device.id;
				}));
			}
		}));
		this.tss.addEventListener("app", "SetToken", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.revokeAuthentication(queue, message.connection_id);
			let token = message.data.token;
			if (is.present(token)) {
				let user_id = await auth.getUserId(queue, token);
				this.tokens.set(message.connection_id, token);
				let session = this.getSession(user_id);
				let device = makeDevice(message.connection_id, message.connection_url);
				session.devices.updateState([...session.devices.getState(), device]);
				this.tss.send("SetContext", message.connection_id, {
					context: session.context
				});
				this.tss.send("SetDevice", message.connection_id, {
					device: session.device
				});
				this.tss.send("SetIndex", message.connection_id, {
					index: session.index
				});
				this.tss.send("SetOrder", message.connection_id, {
					order: session.order
				});
				this.tss.send("SetPlayback", message.connection_id, {
					playback: session.playback
				});
				this.tss.send("SetPlaying", message.connection_id, {
					playing: session.playing
				});
				this.tss.send("SetProgress", message.connection_id, {
					progress: session.progress
				});
				this.tss.send("SetRepeat", message.connection_id, {
					repeat: session.repeat
				});
				this.tss.send("SetShuffle", message.connection_id, {
					shuffle: session.shuffle
				});
				this.tss.send("SetToken", message.connection_id, {
					token: token
				});
			}
		}));
		this.tss.addEventListener("app", "SetContext", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.playing = false;
				this.tss.send("SetPlaying", session.devices.getState().map((device) => {
					return device.id;
				}), {
					playing: session.playing
				});
				session.index = undefined;
				this.tss.send("SetIndex", session.devices.getState().map((device) => {
					return device.id;
				}), {
					index: session.index
				});
				session.order = undefined;
				this.tss.send("SetOrder", session.devices.getState().map((device) => {
					return device.id;
				}), {
					order: session.order
				});
				session.context = message.data.context;
				this.tss.send("SetContext", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
		this.tss.addEventListener("app", "SetLocalDevice", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				let devices = session.devices.getState();
				let index = devices.findIndex((device) => device.id === message.connection_id);
				if (index < 0) {
					return;
				}
				devices.splice(index, 1, message.data.device);
				session.devices.updateState([...devices]);
			});
		}));
		this.tss.addEventListener("app", "SetDevice", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				this.updateProgress(session);
				session.playing = false;
				this.tss.send("SetPlaying", session.devices.getState().map((device) => {
					return device.id;
				}), {
					playing: session.playing
				});
				this.tss.send("SetProgress", session.devices.getState().map((device) => {
					return device.id;
				}), {
					progress: session.progress
				});
				session.device = message.data.device;
				this.tss.send("SetDevice", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
				if (is.present(session.device)) {
					let token = this.tokens.get(session.device.id);
					if (is.absent(token)) {
						this.tss.send("SetToken", session.device.id, {
							token: this.tokens.get(message.connection_id)
						});
					}
				}
			});
		}));
		this.tss.addEventListener("app", "SetIndex", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.playing = false;
				this.tss.send("SetPlaying", session.devices.getState().map((device) => {
					return device.id;
				}), {
					playing: session.playing
				});
				session.progress = is.present(message.data.index) ? 0 : undefined;
				session.progressTimestamp = Date.now();
				this.tss.send("SetProgress", session.devices.getState().map((device) => {
					return device.id;
				}), {
					progress: session.progress
				});
				session.index = message.data.index;
				this.tss.send("SetIndex", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
		this.tss.addEventListener("app", "SetOrder", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.order = message.data.order;
				this.tss.send("SetOrder", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
		this.tss.addEventListener("app", "SetPlayback", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.playback = message.data.playback;
				this.tss.send("SetPlayback", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
		this.tss.addEventListener("app", "SetPlaying", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				this.updateProgress(session);
				session.playing = message.data.playing;
				this.tss.send("SetPlaying", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
		this.tss.addEventListener("app", "SetProgress", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.progress = message.data.progress;
				session.progressTimestamp = Date.now();
				this.tss.send("SetProgress", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
		this.tss.addEventListener("app", "SetRepeat", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.repeat = message.data.repeat;
				this.tss.send("SetRepeat", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
		this.tss.addEventListener("app", "SetShuffle", (message) => atlas.transactionManager.enqueueReadableTransaction(async (queue) => {
			await this.getExistingSession(queue, message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.shuffle = message.data.shuffle;
				this.tss.send("SetShuffle", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		}));
	}

	getRequestHandler(): libhttp.RequestListener {
		return this.tss.getRequestHandler();
	}
}
