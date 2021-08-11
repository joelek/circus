import * as libnet from "net";
import * as libtls from "tls";
import * as cast_message from "./cast_message";
import * as mdns from "../mdns";
import * as schema from "./schema";
import * as is from "../is";
import * as languages from "../languages";
import * as observers from "../observers/";
import * as libcontext from "../player/client";
import * as autoguard from "@joelek/ts-autoguard";
import * as sockets from "@joelek/ts-sockets";
import * as stdlib from "@joelek/ts-stdlib";
import { Episode, Movie, Track } from "../api/schema/objects";

const DEBUG = false;

function getLanguage(language: string | undefined): { language: string, name: string } {
	let entry =  languages.db[language ?? "eng"] ?? languages.db["eng"];
	return {
		language: [
			entry.iso639_1,
			entry.iso3166_1
		].join("-"),
		name: entry.title
	};
}

function makeMediaInformation(item: Episode | Movie | Track, media_server_host: string, token: string): schema.objects.MediaInformation {
	if (Episode.is(item)) {
		let episode = item;
		let season = episode.season;
		let show = season.show;
		return {
			contentId: `${media_server_host}/api/files/${item.media.file_id}/?token=${token}`,
			contentType: episode.media.mime,
			streamType: "BUFFERED",
			metadata: {
				metadataType: 0,
				title: episode.title,
				subtitle: show.title
			},
			tracks: episode.subtitles.map((subtitle, subtitleIndex) => ({
				...getLanguage(subtitle.language),
				trackId: subtitleIndex,
				type: "TEXT",
				trackType: "TEXT",
				trackContentId: `${media_server_host}/api/files/${subtitle.file_id}/?token=${token}`,
				trackContentType: subtitle.mime,
				subtype: "SUBTITLES"
			}))
		};
	} else if (Movie.is(item)) {
		let movie = item;
		return {
			contentId: `${media_server_host}/api/files/${item.media.file_id}/?token=${token}`,
			contentType: movie.media.mime,
			streamType: "BUFFERED",
			metadata: {
				metadataType: 0,
				title: movie.title,
				images: movie.artwork.map((image) => ({
					url: `${media_server_host}/api/files/${image.file_id}/?token=${token}`
				}))
			},
			tracks: movie.subtitles.map((subtitle, subtitleIndex) => ({
				...getLanguage(subtitle.language),
				trackId: subtitleIndex,
				type: "TEXT",
				trackType: "TEXT",
				trackContentId: `${media_server_host}/api/files/${subtitle.file_id}/?token=${token}`,
				trackContentType: subtitle.mime,
				subtype: "SUBTITLES"
			}))
		};
	} else if (Track.is(item)) {
		let track = item;
		let disc = track.disc;
		let album = disc.album;
		return {
			contentId: `${media_server_host}/api/files/${item.media.file_id}/?token=${token}`,
			contentType: item.media.mime,
			streamType: "BUFFERED",
			metadata: {
				metadataType: 0,
				title: track.title,
				subtitle: track.artists.map((artist) => artist.title).join(" \u00b7 "),
				images: album.artwork.map((image) => ({
					url: `${media_server_host}/api/files/${image.file_id}/?token=${token}`
				}))
			}
		};
	} else {
		throw `Expected code to be unreachable!`;
	}
}

function getDeviceName(service_info: Array<string>): string {
	for (let entry of service_info) {
		let parts = entry.split("=");
		if (parts.length >= 2) {
			let key = parts[0];
			if (key === "fn") {
				return parts.slice(1).join("=");
			}
		}
	}
	return "Chromecast";
}

function getDeviceType(service_info: Array<string>): string {
	for (let entry of service_info) {
		let parts = entry.split("=");
		if (parts.length >= 2) {
			let key = parts[0];
			if (key === "md") {
				return parts.slice(1).join("=");
			}
		}
	}
	return "Generic Cast Device";
}

const connections = new Map<string, libnet.Socket>();

export function observe(websocket_host: string, media_server_host: string): void {
	mdns.observe("_googlecast._tcp.local", async (service_device) => {
		try {
			let { hostname, service_info } = { ...service_device };
			let connection = connections.get(hostname);
			if (is.absent(connection)) {
				let socket = libtls.connect({
					host: hostname,
					port: 8009,
					rejectUnauthorized: false
				});
				connections.set(hostname, socket);
				socket.on("secureConnect", () => {
					console.log(`Connected to Cast device at ${hostname}.`);
					let deviceName = getDeviceName(service_info ?? []);
					let deviceType = getDeviceType(service_info ?? []);
					new ChromecastPlayer(socket, websocket_host, media_server_host, deviceName, deviceType);
				});
				socket.on("close", () => {
					console.log(`Disconnected from Cast device at ${hostname}.`);
					connections.delete(hostname);
				});
				socket.on("error", (error) => {
					socket.destroy();
				});
			}
		} catch (error) {
			console.log(error);
		}
	});
};

export function discover(): void {
	mdns.sendDiscoveryPacket("_googlecast._tcp.local");
};

function unwrapPacketPayload(socket: libnet.Socket, onpayload: (buffer: Buffer) => void) {
	let buffered = Buffer.alloc(0);
	let waiting_header = true;
	let bytes_required = 4;
	socket.on("data", (chunk) => {
		buffered = Buffer.concat([buffered, chunk]);
		while (buffered.length >= bytes_required) {
			let buffer = buffered.slice(0, bytes_required);
			buffered = buffered.slice(bytes_required);
			if (waiting_header) {
				waiting_header = false;
				bytes_required = buffer.readUInt32BE(0);
			} else {
				waiting_header = true;
				bytes_required = 4;
				onpayload(buffer);
			}
		}
	});
}

class MessageHandler {
	private socket: libnet.Socket;

	constructor(socket: libnet.Socket, onmessage: (message: cast_message.CastMessage) => void) {
		this.socket = socket;
		unwrapPacketPayload(socket, (payload) => {
			try {
				let message = cast_message.parseCastMessage(payload);
				if (DEBUG && message.namespace !== HearbeatHandler.NAMESPACE) {
					console.log("incoming", message);
				}
				onmessage(message);
			} catch (error) {
				console.log(error);
			}
		});
	}

	getRequestId(): number {
		return Math.floor(Math.random() * 65536);
	}

	send(message: Partial<cast_message.CastMessage> & { namespace: string }): void {
		if (DEBUG && message.namespace !== HearbeatHandler.NAMESPACE) {
			console.log("outgoing", message);
		}
		let buffer = cast_message.serializeCastMessage({
			protocol_version: message.protocol_version ?? cast_message.ProtocolVersion.CASTV2_1_0,
			source_id: message.source_id ?? "sender-0",
			destination_id: message.destination_id ?? "receiver-0",
			namespace: message.namespace,
			payload_type: message.payload_type ?? cast_message.PayloadType.STRING,
			payload_utf8: message.payload_utf8,
			payload_binary: message.payload_binary
		});
		let header = Buffer.alloc(4);
		header.writeUInt32BE(buffer.length, 0);
		this.socket.write(header);
		this.socket.write(buffer);
	}
}

class ConnectionHandler {
	static readonly NAMESPACE = "urn:x-cast:com.google.cast.tp.connection";

	private messageHandler: MessageHandler;
	private serializer: autoguard.serialization.MessageSerializer<schema.connection.Autoguard.Guards>;
	readonly listeners: stdlib.routing.MessageRouter<schema.connection.Autoguard.Guards>;

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.connection.Autoguard.Guards);
		this.listeners = new stdlib.routing.MessageRouter<schema.connection.Autoguard.Guards>();
	}

	handle(message: cast_message.CastMessage): void {
		let data = JSON.parse(message.payload_utf8 ?? "{}");
		let type = autoguard.guards.String.as(data.type);
		this.serializer.deserialize(JSON.stringify({ type, data }), (type, data) => {
			this.listeners.route(type, data);
		});
	}

	send<A extends keyof schema.connection.Autoguard.Guards>(type: A, data: schema.connection.Autoguard.Guards[A], transportId?: string): void {
		this.messageHandler.send({
			namespace: ConnectionHandler.NAMESPACE,
			destination_id: transportId,
			payload_utf8: JSON.stringify(data)
		});
	}
}

class HearbeatHandler {
	static readonly NAMESPACE = "urn:x-cast:com.google.cast.tp.heartbeat";

	private messageHandler: MessageHandler;
	private serializer: autoguard.serialization.MessageSerializer<schema.heartbeat.Autoguard.Guards>;
	readonly listeners: stdlib.routing.MessageRouter<schema.heartbeat.Autoguard.Guards>;

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.heartbeat.Autoguard.Guards);
		this.listeners = new stdlib.routing.MessageRouter<schema.heartbeat.Autoguard.Guards>();
	}

	handle(message: cast_message.CastMessage): void {
		let data = JSON.parse(message.payload_utf8 ?? "{}");
		let type = autoguard.guards.String.as(data.type);
		this.serializer.deserialize(JSON.stringify({ type, data }), (type, data) => {
			this.listeners.route(type, data);
		});
	}

	send<A extends keyof schema.heartbeat.Autoguard.Guards>(type: A, data: schema.heartbeat.Autoguard.Guards[A]): void {
		this.messageHandler.send({
			namespace: HearbeatHandler.NAMESPACE,
			payload_utf8: JSON.stringify(data)
		});
	}
}

type MediaCallback = (message: schema.media.Autoguard.Guards[keyof schema.media.Autoguard.Guards]) => void;

class MediaHandler {
	static readonly NAMESPACE = "urn:x-cast:com.google.cast.media";

	private messageHandler: MessageHandler;
	private serializer: autoguard.serialization.MessageSerializer<schema.media.Autoguard.Guards>;
	private callbacks: Map<number, MediaCallback>;
	readonly listeners: stdlib.routing.MessageRouter<schema.media.Autoguard.Guards>;
	readonly transportId = new observers.ObservableClass(undefined as string | undefined);
	readonly mediaSessionId = new observers.ObservableClass(undefined as number | undefined);

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.media.Autoguard.Guards);
		this.callbacks = new Map<number, MediaCallback>();
		this.listeners = new stdlib.routing.MessageRouter<schema.media.Autoguard.Guards>();
	}

	handle(message: cast_message.CastMessage): void {
		let data = JSON.parse(message.payload_utf8 ?? "{}");
		let type = autoguard.guards.String.as(data.type);
		try {
			this.serializer.deserialize(JSON.stringify({ type, data }), (type, data) => {
				let callback = this.callbacks.get(data.requestId);
				if (is.present(callback)) {
					this.callbacks.delete(data.requestId);
					callback(data);
				}
				this.listeners.route(type, data);
			});
		} catch (error) {
			console.log(JSON.stringify(data, null, 2));
		}
	}

	send<A extends keyof schema.media.Autoguard.Guards>(type: A, data: schema.media.Autoguard.Guards[A], callback?: MediaCallback): void {
		data.requestId = this.messageHandler.getRequestId();
		if (is.present(callback)) {
			this.callbacks.set(data.requestId, callback);
		}
		this.messageHandler.send({
			namespace: MediaHandler.NAMESPACE,
			destination_id: this.transportId.getState(),
			payload_utf8: JSON.stringify(data)
		});
	}
}

type ReceiverCallback = (message: schema.receiver.Autoguard.Guards[keyof schema.receiver.Autoguard.Guards]) => void;

class ReceiverHandler {
	static readonly NAMESPACE = "urn:x-cast:com.google.cast.receiver";

	private messageHandler: MessageHandler;
	private serializer: autoguard.serialization.MessageSerializer<schema.receiver.Autoguard.Guards>;
	private callbacks: Map<number, ReceiverCallback>;
	readonly listeners: stdlib.routing.MessageRouter<schema.receiver.Autoguard.Guards>;

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.receiver.Autoguard.Guards);
		this.callbacks = new Map<number, ReceiverCallback>();
		this.listeners = new stdlib.routing.MessageRouter<schema.receiver.Autoguard.Guards>();
	}

	handle(message: cast_message.CastMessage): void {
		let data = JSON.parse(message.payload_utf8 ?? "{}");
		let type = autoguard.guards.String.as(data.type);
		this.serializer.deserialize(JSON.stringify({ type, data }), (type, data) => {
			let callback = this.callbacks.get(data.requestId);
			if (is.present(callback)) {
				this.callbacks.delete(data.requestId);
				callback(data);
			}
			this.listeners.route(type, data);
		});
	}

	send<A extends keyof schema.receiver.Autoguard.Guards>(type: A, data: schema.receiver.Autoguard.Guards[A], callback?: ReceiverCallback): void {
		data.requestId = this.messageHandler.getRequestId();
		if (is.present(callback)) {
			this.callbacks.set(data.requestId, callback);
		}
		this.messageHandler.send({
			namespace: ReceiverHandler.NAMESPACE,
			payload_utf8: JSON.stringify(data)
		});
	}
}

const APPLICATION_ID = "CC1AD845";

class ChromecastPlayer {
	private socket: libnet.Socket;
	private heartbeatHandler: HearbeatHandler;
	private connectionHandler: ConnectionHandler;
	private mediaHandler: MediaHandler;
	private receiverHandler: ReceiverHandler;
	private context: libcontext.ContextClient;
	private timer: NodeJS.Timeout | undefined;

	setTimer(): void {
		if (is.present(this.timer)) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
		this.timer = setTimeout(() => {
			this.timer = undefined;
			this.heartbeatHandler.send("PING", {
				type: "PING"
			});
			this.timer = setTimeout(() => {
				this.socket.destroy();
			}, 5000);
		}, 5000);
	}

	constructor(socket: libnet.Socket, websocket_host: string, media_server_host: string, device_name: string, device_type: string) {
		let messageHandler = new MessageHandler(socket, (message) => {
			let namespace = message.namespace;
			if (namespace === ConnectionHandler.NAMESPACE) {
				this.connectionHandler.handle(message);
			} else if (namespace === HearbeatHandler.NAMESPACE) {
				this.heartbeatHandler.handle(message);
			} else if (namespace === MediaHandler.NAMESPACE) {
				this.mediaHandler.handle(message);
			} else if (namespace === ReceiverHandler.NAMESPACE) {
				this.receiverHandler.handle(message);
			}
		});
		this.socket = socket;
		this.heartbeatHandler = new HearbeatHandler(messageHandler);
		this.connectionHandler = new ConnectionHandler(messageHandler);
		this.mediaHandler = new MediaHandler(messageHandler);
		this.receiverHandler = new ReceiverHandler(messageHandler);
		let url = `${websocket_host}/sockets/context/?protocol=cast&name=${encodeURIComponent(device_name)}&type=${encodeURIComponent(device_type)}`;
		this.context = new libcontext.ContextClient(url, (url) => new sockets.WebSocketClient(url));
		this.timer = undefined;
		socket.on("close", () => {
			if (is.present(this.timer)) {
				clearTimeout(this.timer);
			}
			this.context.close();
		});
		this.connectionHandler.send("CONNECT", {
			type: "CONNECT"
		});
		this.connectionHandler.listeners.addObserver("CLOSE", (message) => {
			this.mediaHandler.transportId.updateState(undefined);
		});
		this.heartbeatHandler.listeners.addObserver("PING", (message) => {
			this.heartbeatHandler.send("PONG", {
				"type": "PONG"
			});
		});
		this.heartbeatHandler.listeners.addObserver("PONG", (message) => {
			this.setTimer();
		});
		this.receiverHandler.listeners.addObserver("RECEIVER_STATUS", (message) => {
			let applications = message.status.applications ?? [];
			let application = applications.find((application) => {
				return application.appId === APPLICATION_ID;
			});
			if (is.present(application)) {
				this.mediaHandler.transportId.updateState(application.transportId);
			} else {
				this.mediaHandler.transportId.updateState(undefined);
			}
		});
		this.mediaHandler.listeners.addObserver("MEDIA_STATUS", (message) => {
			let status = message.status[message.status.length - 1] as schema.objects.MediaStatus | undefined;
			if (is.present(status)) {
				let mediaSessionId = this.mediaHandler.mediaSessionId.getState();
				if (is.present(mediaSessionId)) {
					if (status.mediaSessionId === mediaSessionId) {
						if (this.context.isDeviceLocal.getState()) {
							if (status.playerState === "IDLE" && status.idleReason === "FINISHED") {
								this.context.next();
							}
						}
					} else {
						this.mediaHandler.mediaSessionId.updateState(undefined);
					}
				}
			}
		});
		this.setTimer();
		this.mediaHandler.transportId.addObserver((transportId) => {
			if (is.present(transportId)) {
				this.connectionHandler.send("CONNECT", {
					type: "CONNECT"
				}, transportId);
			}
		});
		this.context.isDeviceLocal.addObserver((isDeviceLocal) => {
			if (isDeviceLocal) {
				let transportId = this.mediaHandler.transportId.getState();
				if (is.absent(transportId)) {
					this.receiverHandler.send("LAUNCH", {
						type: "LAUNCH",
						requestId: -1,
						appId: APPLICATION_ID
					});
				}
			} else {
				let mediaSessionId = this.mediaHandler.mediaSessionId.getState();
				if (is.present(mediaSessionId)) {
					this.mediaHandler.send("STOP", {
						type: "STOP",
						requestId: -1,
						mediaSessionId: mediaSessionId
					});
				}
			}
		});
		{
			let computer = () => {
				let transportId = this.mediaHandler.transportId.getState();
				let currentLocalEntry = this.context.currentLocalEntry.getState();
				let token = this.context.token.getState();
				if (is.present(transportId) && is.present(currentLocalEntry) && is.present(token)) {
					let media = makeMediaInformation(currentLocalEntry, media_server_host, token);
					let activeTrackIds: number[] | undefined;
					if (is.present(media.tracks)) {
						let swe = media.tracks.find((track) => {
							return (track as any).language === "sv-SE";
						});
						if (is.present(swe)) {
							activeTrackIds = [ swe.trackId ];
						} else {
							let eng = media.tracks.find((track) => {
								return (track as any).language === "en-US";
							});
							if (is.present(eng)) {
								activeTrackIds = [ eng.trackId ];
							} else {
								let jpn = media.tracks.find((track) => {
									return (track as any).language === "ja-JP";
								});
								if (is.present(jpn)) {
									activeTrackIds = [ jpn.trackId ];
								} else {
									if (media.tracks.length > 0) {
										activeTrackIds = [ 0 ];
									}
								}
							}
						}
					}
					this.mediaHandler.send("LOAD", {
						type: "LOAD",
						requestId: -1,
						media: media,
						autoplay: false,
						activeTrackIds: activeTrackIds
					}, (message) => {
						if (schema.media.MEDIA_STATUS.is(message)) {
							let status = message.status[message.status.length - 1] as schema.objects.MediaStatus | undefined;
							if (is.present(status)) {
								this.mediaHandler.mediaSessionId.updateState(status.mediaSessionId);
							}
						}
					});
				}
			};
			this.mediaHandler.transportId.addObserver(computer);
			this.context.currentLocalEntry.addObserver(computer);
			this.context.token.addObserver(computer);
		}
		{
			// Transfer context when application is lost and device is local.
			this.mediaHandler.transportId.addObserver((transportId) => {
				if (is.absent(transportId) && this.context.isDeviceLocal.getState()) {
					this.context.transfer(undefined);
				}
			});
		}
		{
			// Reset media session when application is lost.
			this.mediaHandler.transportId.addObserver((transportId) => {
				if (is.absent(transportId)) {
					this.mediaHandler.mediaSessionId.updateState(undefined);
				}
			});
		}
		{
			// Handle playback changes when there is an active media session.
			let computer = () => {
				let mediaSessionId = this.mediaHandler.mediaSessionId.getState();
				if (is.present(mediaSessionId)) {
					let playback = this.context.playback.getState();
					if (playback) {
						this.mediaHandler.send("PLAY", {
							type: "PLAY",
							requestId: -1,
							mediaSessionId: mediaSessionId
						});
					} else {
						this.mediaHandler.send("PAUSE", {
							type: "PAUSE",
							requestId: -1,
							mediaSessionId: mediaSessionId
						});
					}
				}
			};
			this.mediaHandler.mediaSessionId.addObserver(computer);
			this.context.playback.addObserver(computer);
		}
		{
			// Handle progress changes when there is an active media session.
			let computer = () => {
				let mediaSessionId = this.mediaHandler.mediaSessionId.getState();
				if (is.present(mediaSessionId)) {
					let progress = this.context.progress.getState() ?? 0;
					this.mediaHandler.send("SEEK", {
						type: "SEEK",
						requestId: -1,
						mediaSessionId: mediaSessionId,
						currentTime: progress
					});
				}
			};
			this.mediaHandler.mediaSessionId.addObserver(computer);
			this.context.progress.addObserver(computer);
		}
	}
}
