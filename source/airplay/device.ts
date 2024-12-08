import * as libcrypto from "crypto";
import * as websockets from "@joelek/websockets";
import * as stdlib from "@joelek/stdlib";
import * as player from "../player/client";
import * as is from "../is";
import * as observers from "../observers/";
import * as schema from "./schema/";
import * as api from "./api";
import * as http from "./http";
import * as plist from "./plist";
import * as utils from "../utils";
import { Episode, Movie } from "../api/schema/objects";

const PORT = 7000;

function makeCorrelationID(): string {
	return [
		libcrypto.randomBytes(4).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(2).toString("hex"),
		libcrypto.randomBytes(6).toString("hex")
	].join("-");
}

type DeviceEventMap = {
	"connect": {};
	"close": {};
};

export class Device extends stdlib.routing.MessageRouter<DeviceEventMap> {
	constructor(host: string, websocket_host: string, media_server_host: string, device_name: string, device_type: string) {
		super();
		let correlation_id = makeCorrelationID();
		let outbound = new http.OutboundSocket({ host: host, port: PORT });
		outbound.addObserver("close", () => {
			this.route("close", {});
		});
		api.getServerInfo(outbound, correlation_id).then(() => {
			let inbound = new http.InboundSocket({ host: host, port: PORT }, {
				method: "POST",
				path: "/reverse",
				headers: [
					{ key: "X-Apple-Purpose", value: "event" },
					{ key: "X-Apple-Session-ID", value: correlation_id }
				]
			}, async (request) => {
				let string = request.body.toString();
				let document = plist.parseFromString(string);
				if (schema.messages.PlayingEvent.is(document)) {
					context.setPlaying(true);
					if (!context.playback.getState()) {
						context.resume();
					}
				} else if (schema.messages.PausedEvent.is(document)) {
					context.setPlaying(false);
					if (context.playback.getState()) {
						context.pause();
					}
				} else if (schema.messages.LoadingEvent.is(document)) {
					context.setPlaying(false);
				} else if (schema.messages.StoppedEvent.is(document)) {
					context.setPlaying(false);
					if (document.reason === "ended") {
						context.next();
					}
				}
				return {
					status: 200,
					reason: "OK"
				};
			});
			inbound.addObserver("connect", () => {
				this.route("connect", {});
			});
			inbound.addObserver("close", () => {
				this.route("close", {});
			});
			let did = utils.generateHexId(16);
			let url = `${websocket_host}/sockets/context/?protocol=airplay&name=${encodeURIComponent(device_name)}&type=${encodeURIComponent(device_type)}&did=${did}`;
			let context = new player.ContextClient(url, (url) => new websockets.WebSocketClient(url));
			observers.computed(async (currentLocalEntry, token) => {
				if (is.present(currentLocalEntry) && is.present(token)) {
					let url = `${media_server_host}/api/files/${currentLocalEntry.media.file_id}/content/?token=${token}`;
					await api.play(outbound, correlation_id, url, 0.0);
					if (Episode.is(currentLocalEntry) || Movie.is(currentLocalEntry)) {
						for (let subtitle of currentLocalEntry.subtitles) {
							let url = `${media_server_host}/api/files/${subtitle.file_id}/content/?token=${token}`;
							// TODO: Figure out how to show subtitles through AirPlay.
						}
					}
				} else {
					await api.stop(outbound, correlation_id);
				}
			}, context.currentLocalEntry, context.token);
			observers.computed(async (currentLocalEntry, progress) => {
				if (is.present(currentLocalEntry) && is.present(progress)) {
					await api.scrub(outbound, correlation_id, progress);
				}
			}, context.currentLocalEntry, context.progress);
			observers.computed(async (playback) => {
				await api.rate(outbound, correlation_id, playback ? 1.0 : 0.0);
			}, context.playback);
			this.addObserver("close", () => {
				context.close();
				outbound.close();
				inbound.close();
			});
		});
	}
};
