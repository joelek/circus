import * as libcrypto from "crypto";
import * as sockets from "@joelek/ts-sockets";
import * as stdlib from "@joelek/ts-stdlib";
import * as player from "../player/client";
import * as is from "../is";
import * as observers from "../observers/";
import * as schema from "./schema/";
import * as api from "./api";
import * as http from "./http";
import * as plist from "./plist";

const MEDIA_SERVER = "https://ap.joelek.se";
const PORT = 7000;

function makeSessionID(): string {
	return [
		libcrypto.randomBytes(4).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(6).toString("hex")
	].join("-");
}

type DeviceEventMap = {
	"close": {}
};

export class Device extends stdlib.routing.MessageRouter<DeviceEventMap> {
	private session_id: string;
	private context: player.ContextClient;
	private outbound: http.OutboundSocket;
	private inbound: http.InboundSocket;

	constructor(host: string, wss: boolean) {
		super();
		let session_id = makeSessionID();
		let outbound = new http.OutboundSocket({ host: host, port: PORT });
		outbound.addObserver("close", () => {
			this.route("close", {});
		});
		let inbound = new http.InboundSocket({ host: host, port: PORT }, {
			method: "POST",
			path: "/reverse",
			headers: [
				{ key: "X-Apple-Purpose", value: "event" },
				{ key: "X-Apple-Session-ID", value: session_id }
			]
		}, async (request) => {
			let string = request.body.toString();
			let document = plist.parseFromString(string);
			if (schema.messages.Event.is(document)) {
				let event = document;
				console.log(event);
			}
			return {
				status: 200,
				reason: "OK"
			};
		});
		inbound.addObserver("close", () => {
			this.route("close", {});
		});
		let url = `${wss ? "wss:" : "ws:"}//127.0.0.1/sockets/context/?protocol=airplay&name=AirPlayDevice`;
		let context = new player.ContextClient(url, (url) => new sockets.WebSocketClient(url));
		observers.computed(async (currentLocalEntry, token) => {
			if (is.present(currentLocalEntry) && is.present(token)) {
				let url = `${MEDIA_SERVER}/files/${currentLocalEntry.media.file_id}/?token=${token}`;
				let response = await api.play(outbound, session_id, url, 0.0);
			}
		}, context.currentLocalEntry, context.token);
		observers.computed(async (currentLocalEntry, progress) => {
			if (is.present(currentLocalEntry) && is.present(progress)) {
				let response = await api.scrub(outbound, session_id, progress);
			}
		}, context.currentLocalEntry, context.progress);
		this.session_id = session_id;
		this.context = context;
		this.outbound = outbound;
		this.inbound = inbound;
		this.addObserver("close", () => {
			this.context.close();
			this.outbound.close();
			this.inbound.close();
		});
	}
};
