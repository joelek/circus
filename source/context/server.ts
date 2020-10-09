import * as libhttp from "http";
import * as liburl from "url";
import * as auth from "../auth";
import * as is from "../is";
import * as observers from "../simpleobs";
import * as schema from "./schema";
import * as typesockets from "../typesockets";

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
	let name = getQuery(url, "name").pop() ?? "";
	let type = getQuery(url, "type").pop() ?? "";
	return {
		id: connection_id,
		name: name,
		type: type
	};
}

type Session = schema.objects.Session & {
	devices: observers.ObservableClass<Array<schema.objects.Device>>,
	progressTimestamp?: number
}

export class ContextServer {
	private chromecasts: observers.ObservableClass<Array<schema.objects.Device>>;
	private tss: typesockets.TypeSocketServer<schema.messages.Autoguard>;
	private tokens = new Map<string, string>();
	private sessions = new Map<string, Session>();

	private getExistingSession(connection_id: string, callback: (session: Session) => void): void {
		let token = this.tokens.get(connection_id);
		if (is.present(token)) {
			let username = auth.getUsername(token);
			let session = this.sessions.get(username);
			if (is.present(session)) {
				callback(session);
			}
		}
	}

	private getSession(username: string): Session {
		let existingSession = this.sessions.get(username);
		if (is.present(existingSession)) {
			return existingSession;
		}
		const session: Session = {
			playback: false,
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
			let deviceWasLost = is.absent(devices.find((device) => {
				return device.id === session.device?.id;
			}));
			if (deviceWasLost) {
				this.updateProgress(session);
				session.playback = false;
				this.tss.send("SetPlayback", devices.map((device) => {
					return device.id;
				}), {
					playback: session.playback
				});
				session.device = undefined;
				this.tss.send("SetDevice", devices.map((device) => {
					return device.id;
				}), {
					device: session.device
				});
			}
		});
		this.sessions.set(username, session);
		return session;
	}

	private revokeAuthentication(connection_id: string): void {
		let token = this.tokens.get(connection_id);
		this.tokens.delete(connection_id);
		if (is.present(token)) {
			let username = auth.getUsername(token);
			let session = this.sessions.get(username);
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
		if (session.playback) {
			if (is.present(session.progress) && is.present(session.progressTimestamp)) {
				session.progress += (now - session.progressTimestamp) / 1000;
			}
		}
		session.progressTimestamp = now;
	}

	constructor() {
		this.chromecasts = new observers.ObservableClass<Array<schema.objects.Device>>([]);
		this.tss = new typesockets.TypeSocketServer(schema.messages.Autoguard);
		this.tss.addEventListener("sys", "connect", (message) => {
			console.log("connect: " + message.connection_url);
			let device = makeDevice(message.connection_id, message.connection_url);
			this.tss.send("SetLocalDevice", message.connection_id, {
				device
			});
			if (device.type === "chromecast") {
				this.chromecasts.updateState([...this.chromecasts.getState(), device]);
			}
		});
		this.tss.addEventListener("sys", "disconnect", (message) => {
			console.log("disconnect: " + message.connection_url);
			let device = makeDevice(message.connection_id, message.connection_url);
			this.revokeAuthentication(message.connection_id);
			if (device.type === "chromecast") {
				this.chromecasts.updateState(this.chromecasts.getState().filter((chromecast) => {
					return chromecast.id !== device.id;
				}));
			}
		});
		this.tss.addEventListener("app", "SetToken", (message) => {
			this.revokeAuthentication(message.connection_id);
			let token = message.data.token;
			if (is.present(token)) {
				let username = auth.getUsername(token);
				this.tokens.set(message.connection_id, token);
				let session = this.getSession(username);
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
				this.tss.send("SetPlayback", message.connection_id, {
					playback: session.playback
				});
				this.tss.send("SetProgress", message.connection_id, {
					progress: session.progress
				});
				this.tss.send("SetToken", message.connection_id, {
					token: token
				});
			}
		});
		this.tss.addEventListener("app", "SetContext", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				session.index = undefined;
				this.tss.send("SetIndex", session.devices.getState().map((device) => {
					return device.id;
				}), {
					index: session.index
				});
				session.context = message.data.context;
				this.tss.send("SetContext", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		});
		this.tss.addEventListener("app", "SetDevice", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				this.updateProgress(session);
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
					this.tss.send("SetToken", session.device.id, {
						token: this.tokens.get(message.connection_id)
					});
				}
			});
		});
		this.tss.addEventListener("app", "SetIndex", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
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
		});
		this.tss.addEventListener("app", "SetPlayback", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				if (is.absent(session.device)) {
					session.device = makeDevice(message.connection_id, message.connection_url);
					this.tss.send("SetDevice", session.devices.getState().map((device) => {
						return device.id;
					}), {
						device: session.device
					});
				}
				this.updateProgress(session);
				session.playback = message.data.playback;
				this.tss.send("SetPlayback", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		});
		this.tss.addEventListener("app", "SetProgress", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
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
		});
	}

	getRequestHandler(): libhttp.RequestListener {
		return this.tss.getRequestHandler();
	}
}
