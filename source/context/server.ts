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
	let name = getQuery(url, "client").pop() ?? "Client";
	return {
		id: connection_id,
		name: name
	};
}

type Session = schema.objects.Session & {
	devices: observers.ObservableClass<Array<schema.objects.Device>>,
	progressTimestamp?: number
}

export class ContextServer {
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
		let devices = session.devices;
		devices.addObserver((devices) => {
			this.tss.send("SetDevices", devices.map((device) => {
				return device.id;
			}), {
				devices
			});
		});
		devices.addObserver((devices) => {
			this.updateProgress(session);
		});
		devices.addObserver((devices) => {
			let deviceWasLost = is.absent(devices.find((device) => {
				return device.id === session.device?.id;
			}));
			if (deviceWasLost) {
				let device = devices[devices.length - 1] as schema.objects.Device | undefined;
				if (session.playback) {
					session.playback = false;
					this.tss.send("SetPlayback", devices.map((device) => {
						return device.id;
					}), {
						playback: session.playback
					});
				}
				session.device = device;
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
		this.tss = new typesockets.TypeSocketServer(schema.messages.Autoguard);
		this.tss.addEventListener("sys", "connect", (message) => {
			let device = makeDevice(message.connection_id, message.connection_url);
			this.tss.send("SetLocalDevice", message.connection_id, {
				device
			});
		});
		this.tss.addEventListener("sys", "disconnect", (message) => {
			this.revokeAuthentication(message.connection_id);
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
			}
		});
		this.tss.addEventListener("app", "SetContext", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				session.context = message.data.context;
				this.tss.send("SetContext", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		});
		this.tss.addEventListener("app", "SetDevice", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				session.device = message.data.device;
				this.tss.send("SetDevice", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		});
		this.tss.addEventListener("app", "SetIndex", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				session.index = message.data.index;
				this.tss.send("SetIndex", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		});
		this.tss.addEventListener("app", "SetPlayback", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
				this.updateProgress(session);
				session.playback = message.data.playback;
				this.tss.send("SetPlayback", session.devices.getState().map((device) => {
					return device.id;
				}), message.data);
			});
		});
		this.tss.addEventListener("app", "SetProgress", (message) => {
			this.getExistingSession(message.connection_id, (session) => {
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
