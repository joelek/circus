
import * as libcrypto from "crypto";
import { TypeSocketServer } from "./typesockets";
import { Autoguard as messages } from "./messages";
import * as chromecasts from "./chromecasts";
import * as cc from "./cc";
import { Device } from "./objects";
import { ArrayObservable } from "./simpleobs";

export const tss = new TypeSocketServer(messages);


type Session = {
	token?: string,
	device: Device
};

let sessions = new Map<string, Session>(); // CONNECTION => SESSION
let devices = new ArrayObservable(new Array<Device>()); // ALL DEVICES, ALL USERS
tss.addEventListener("sys", "connect", (message) => {
	let device = {
		id: message.connection_id,
		title: "Browser"
	};
	sessions.set(message.connection_id, {});
	tss.send("SetDeviceId", message.connection_id, {
		id: message.connection_id
	});
});
tss.addEventListener("sys", "disconnect", (message) => {
	sessions.delete(message.connection_id);
	let index = devices.getState().findIndex((device) => {
		return device.id === message.connection_id;
	});
	if (index < 0) {
		return;
	}
	devices.splice(index);
});





let ccdevices = new Map<string, Device>();
tss.addEventListener("app", "Authenticate", (message) => {
	let token = message.data.token;
	if (token == null) {
		return;
	}
	try {
		auth.getUsername(token);
		sessions.set(message.connection_id, token);
		for (let session of sessions) {

		}
	} catch (error) {}

	if (token != null) {
		if (cc.isPlayingUsingToken(token)) {
			let ccsession = cc.getSession();
			if (ccsession != null) {
				let device = ccdevices.get(ccsession.device);
				if (device == null) {
					return;
				}
				tss.send("TransferPlayback", message.connection_id, {
					device,
					origin: ccsession.origin
				});
				tss.send("SetContext", message.connection_id, {
					context: cc.controller.context.getState()
				});
				tss.send("SetContextIndex", message.connection_id, {
					index: cc.controller.contextIndex.getState()
				});
				tss.send("SetPlaying", message.connection_id, {
					playing: cc.controller.shouldPlay.getState()
				});
			}
		}
	}
});

chromecasts.addObserver({
	onconnect(hostname) {
		let id = libcrypto.randomBytes(16).toString("hex");
		let device = {
			id,
			title: "Chromecast"
		};
		ccdevices.set(hostname, device);
		devices.push(device);
		for (let [connection_id, token] of sessions) {
			tss.send("DeviceBecameAvailable", connection_id, {
				device
			});
		}
	},
	ondisconnect(hostname) {
		let device = ccdevices.get(hostname);
		if (device == null) {
			return;
		}
		devices.splice(devices.lastIndexOf(device), 1);
		ccdevices.delete(hostname);
		for (let [connection_id, token] of sessions) {
			tss.send("DeviceBecameUnavailable", connection_id, {
				device
			});
		}
	}
});
chromecasts.observe();

tss.addEventListener("app", "TransferPlayback", async (message) => {
	let token = sessions.get(message.connection_id);
	if (token != null) {
		for (let [hostname, device] of ccdevices) {
			if (message.data.device.id === device.id) {
				try {
					await cc.launch(hostname, token, message.data.origin);
				} catch (error) {}
				return;
			}
		}
		cc.disconnect();
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === token);
		for (let [connection_id, token] of sessions) {
			tss.send("TransferPlayback", connection_id, message.data);
		}
	}
});

cc.controller.isLaunched.addObserver((isLaunched) => {
	const session = cc.getSession();
	if (session != null) {
		let device = ccdevices.get(session.device);
		if (device == null) {
			return;
		}
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("TransferPlayback", connection_id, {
				device: isLaunched ? device : { id: connection_id, title: "This Device" },
				origin: session.origin
			});
		}
	}
});

cc.controller.context.addObserver((context) => {
	const session = cc.getSession();
	if (session != null) {
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContext", connection_id, {
				context: context
			});
		}
	}
});

cc.controller.contextIndex.addObserver((contextIndex) => {
	const session = cc.getSession();
	if (session != null) {
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContextIndex", connection_id, {
				index: contextIndex
			});
		}
	}
});

cc.controller.isPlaying.addObserver((isPlaying) => {
	const session = cc.getSession();
	if (session != null) {
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === session.token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetPlaying", connection_id, {
				playing: isPlaying
			});
		}
	}
});

tss.addEventListener("app", "SetContext", async (message) => {
	let token = sessions.get(message.connection_id);
	if (token == null) {
		return;
	}
	if (cc.isPlayingUsingToken(token)) {
		cc.controller.context.updateState(message.data.context);
	} else {
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContext", connection_id, message.data);
		}
	}
});

tss.addEventListener("app", "SetContextIndex", async (message) => {
	let token = sessions.get(message.connection_id);
	if (token == null) {
		return;
	}
	if (cc.isPlayingUsingToken(token)) {
		cc.controller.contextIndex.updateState(message.data.index);
	} else {
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetContextIndex", connection_id, message.data);
		}
	}
});

tss.addEventListener("app", "SetPlaying", async (message) => {
	let token = sessions.get(message.connection_id);
	console.log(token);
	if (token == null) {
		return;
	}
	if (cc.isPlayingUsingToken(token)) {
		cc.controller.shouldPlay.updateState(message.data.playing);
	} else {
		let sessions = Array.from(sessions.entries()).filter((entry) => entry[1] === token);
		for (let [connection_id, token] of sessions) {
			tss.send("SetPlaying", connection_id, message.data);
		}
	}
});
