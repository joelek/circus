import * as libnet from "net";
import * as libtls from "tls";
import * as libhttp from "http";
import * as cast_message from "./cast_message";
import * as mdns from "./mdns";
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
const MEDIA_SERVER = "https://ap.joelek.se";

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

function makeMediaInformation(item: Episode | Movie | Track, token: string): schema.objects.MediaInformation {
	if (Episode.is(item)) {
		let episode = item;
		let season = episode.season;
		let show = season.show;
		return {
			contentId: `${MEDIA_SERVER}/files/${item.media.file_id}/?token=${token}`,
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
				trackContentId: `${MEDIA_SERVER}/files/${subtitle.file_id}/?token=${token}`,
				trackContentType: subtitle.mime,
				subtype: "SUBTITLES"
			}))
		};
	} else if (Movie.is(item)) {
		let movie = item;
		return {
			contentId: `${MEDIA_SERVER}/files/${item.media.file_id}/?token=${token}`,
			contentType: movie.media.mime,
			streamType: "BUFFERED",
			metadata: {
				metadataType: 0,
				title: movie.title,
				images: movie.artwork.map((image) => ({
					url: `${MEDIA_SERVER}/files/${image.file_id}/?token=${token}`
				}))
			},
			tracks: movie.subtitles.map((subtitle, subtitleIndex) => ({
				...getLanguage(subtitle.language),
				trackId: subtitleIndex,
				type: "TEXT",
				trackType: "TEXT",
				trackContentId: `${MEDIA_SERVER}/files/${subtitle.file_id}/?token=${token}`,
				trackContentType: subtitle.mime,
				subtype: "SUBTITLES"
			}))
		};
	} else if (Track.is(item)) {
		let track = item;
		let disc = track.disc;
		let album = disc.album;
		return {
			contentId: `${MEDIA_SERVER}/files/${item.media.file_id}/?token=${token}`,
			contentType: item.media.mime,
			streamType: "BUFFERED",
			metadata: {
				metadataType: 0,
				title: track.title,
				subtitle: track.artists.map((artist) => artist.title).join(" \u00b7 "),
				images: album.artwork.map((image) => ({
					url: `${MEDIA_SERVER}/files/${image.file_id}/?token=${token}`
				}))
			}
		};
	} else {
		throw `Expected code to be unreachable!`;
	}
}

type Listener = (hostname: string) => void;

const hostnames = new Set<string>();
const listeners = new Set<Listener>();

function addListener(listener: Listener): void {
	if (!listeners.has(listener)) {
		listeners.add(listener);
		for (let hostname of hostnames) {
			try {
				listener(hostname);
			} catch (error) {}
		}
	}
}

function removeListner(listener: Listener): void {
	listeners.delete(listener);
}

// TODO: Invalidate cache of hostnames at reasonable intervals.
mdns.observe("_googlecast._tcp.local", (hostname) => {
	if (!hostnames.has(hostname)) {
		hostnames.add(hostname);
		for (let listener of listeners) {
			try {
				listener(hostname);
			} catch (error) {}
		}
	}
});

function createSocket(hostname: string): Promise<libnet.Socket> {
	return new Promise((resolve, reject) => {
		let socket = libtls.connect({
			host: hostname,
			port: 8009,
			rejectUnauthorized: false
		});
		socket.on("secureConnect", () => {
			console.log(`Connected to chromecast at ${hostname}.`);
			resolve(socket);
		});
		socket.on("close", () => {
			console.log(`Disconnected from chromecast at ${hostname}.`);
		});
		socket.on("error", (error) => {
			socket.end();
		});
	});
}

function getDeviceName(hostname: string): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		libhttp.get(`http://${hostname}:8008/ssdp/device-desc.xml`, (response) => {
			let chunks = [] as Buffer[];
			response.on("data", (chunk) => {
				chunks.push(chunk);
			});
			response.on("end", () => {
				let body = Buffer.concat(chunks);
				let string = body.toString();
				let parts = /<friendlyName>([^<]+)<\/friendlyName>/.exec(string);
				if (is.present(parts)) {
					resolve(parts[1]);
				} else {
					resolve(undefined);
				}
			});
			response.on("error", () => {
				reject();
			});
		});
	});
}

export function observe(tls: boolean): void {
	addListener(async (hostname) => {
		let socket = await createSocket(hostname);
		socket.on("close", () => {
			hostnames.delete(hostname);
		});
		let deviceName = await getDeviceName(hostname);
		new ChromecastPlayer(socket, deviceName ?? "Chromecast", tls);
	});
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
	private serializer: autoguard.serialization.MessageSerializer<schema.connection.Autoguard>;
	readonly listeners: stdlib.routing.MessageRouter<schema.connection.Autoguard>;

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.connection.Autoguard);
		this.listeners = new stdlib.routing.MessageRouter<schema.connection.Autoguard>();
	}

	handle(message: cast_message.CastMessage): void {
		let data = JSON.parse(message.payload_utf8 ?? "{}");
		let type = autoguard.guards.String.as(data.type);
		this.serializer.deserialize(JSON.stringify({ type, data }), (type, data) => {
			this.listeners.route(type, data);
		});
	}

	send<A extends keyof schema.connection.Autoguard>(type: A, data: schema.connection.Autoguard[A], transportId?: string): void {
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
	private serializer: autoguard.serialization.MessageSerializer<schema.heartbeat.Autoguard>;
	readonly listeners: stdlib.routing.MessageRouter<schema.heartbeat.Autoguard>;

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.heartbeat.Autoguard);
		this.listeners = new stdlib.routing.MessageRouter<schema.heartbeat.Autoguard>();
	}

	handle(message: cast_message.CastMessage): void {
		let data = JSON.parse(message.payload_utf8 ?? "{}");
		let type = autoguard.guards.String.as(data.type);
		this.serializer.deserialize(JSON.stringify({ type, data }), (type, data) => {
			this.listeners.route(type, data);
		});
	}

	send<A extends keyof schema.heartbeat.Autoguard>(type: A, data: schema.heartbeat.Autoguard[A]): void {
		this.messageHandler.send({
			namespace: HearbeatHandler.NAMESPACE,
			payload_utf8: JSON.stringify(data)
		});
	}
}

type MediaCallback = (message: schema.media.Autoguard[keyof schema.media.Autoguard]) => void;

class MediaHandler {
	static readonly NAMESPACE = "urn:x-cast:com.google.cast.media";

	private messageHandler: MessageHandler;
	private serializer: autoguard.serialization.MessageSerializer<schema.media.Autoguard>;
	private callbacks: Map<number, MediaCallback>;
	readonly listeners: stdlib.routing.MessageRouter<schema.media.Autoguard>;
	readonly transportId = new observers.ObservableClass(undefined as string | undefined);
	readonly mediaSessionId = new observers.ObservableClass(undefined as number | undefined);

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.media.Autoguard);
		this.callbacks = new Map<number, MediaCallback>();
		this.listeners = new stdlib.routing.MessageRouter<schema.media.Autoguard>();
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

	send<A extends keyof schema.media.Autoguard>(type: A, data: schema.media.Autoguard[A], callback?: MediaCallback): void {
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

type ReceiverCallback = (message: schema.receiver.Autoguard[keyof schema.receiver.Autoguard]) => void;

class ReceiverHandler {
	static readonly NAMESPACE = "urn:x-cast:com.google.cast.receiver";

	private messageHandler: MessageHandler;
	private serializer: autoguard.serialization.MessageSerializer<schema.receiver.Autoguard>;
	private callbacks: Map<number, ReceiverCallback>;
	readonly listeners: stdlib.routing.MessageRouter<schema.receiver.Autoguard>;

	constructor(messageHandler: MessageHandler) {
		this.messageHandler = messageHandler;
		this.serializer = new autoguard.serialization.MessageSerializer(schema.receiver.Autoguard);
		this.callbacks = new Map<number, ReceiverCallback>();
		this.listeners = new stdlib.routing.MessageRouter<schema.receiver.Autoguard>();
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

	send<A extends keyof schema.receiver.Autoguard>(type: A, data: schema.receiver.Autoguard[A], callback?: ReceiverCallback): void {
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

	constructor(socket: libnet.Socket, deviceName: string, tls: boolean) {
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
		let url = `${tls ? "wss:" : "ws:"}//127.0.0.1/sockets/context/?type=chromecast&name=${deviceName}`;
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
					let media = makeMediaInformation(currentLocalEntry, token);
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
