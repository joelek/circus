import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as sockets from "@joelek/ts-sockets/dist/lib/shared";
import * as shared from "./shared";
import * as is from "../is";

export type WebSocketFactory = (url: string) => sockets.WebSocketLike;

export type TypeSocketClientMessageMap<A extends stdlib.routing.MessageMap<A>> = {
	sys: {
		connect: {

		},
		disconnect: {

		},
		message: {
			type: keyof A,
			data: A[keyof A]
		}
	},
	app: {
		[B in keyof A]: A[B]
	}
};

export class TypeSocketClient<A extends stdlib.routing.MessageMap<A>> {
	private nextConnectionAttemptDelayFactor: number;
	private nextConnectionAttemptDelay: number;
	private router: stdlib.routing.NamespacedMessageRouter<TypeSocketClientMessageMap<A>>;
	private serializer: shared.Serializer<A>;
	private url: string;
	private factory: WebSocketFactory;
	private socket: sockets.WebSocketLike;
	private requests: Map<string, (type: keyof A, data: A[keyof A]) => void>;

	private makeId(): string {
		let string = "";
		for (let i = 0; i < 32; i++) {
			let number = Math.floor(Math.random() * 16);
			string += number.toString(16);
		}
		return string;
	}

	private makeSocket(): sockets.WebSocketLike {
		let socket = this.factory(this.url);
		socket.addEventListener("close", this.onClose.bind(this));
		socket.addEventListener("error", this.onError.bind(this));
		socket.addEventListener("message", this.onMessage.bind(this));
		socket.addEventListener("open", this.onOpen.bind(this));
		return socket;
	}

	private onClose(event: sockets.WebSocketEventMapLike["close"]): void {
		this.router.route("sys", "disconnect", {});
	}

	private onError(event: sockets.WebSocketEventMapLike["error"]): void {
		setTimeout(() => {
			this.socket = this.makeSocket();
		}, this.nextConnectionAttemptDelay);
		this.nextConnectionAttemptDelay = Math.round(this.nextConnectionAttemptDelay * this.nextConnectionAttemptDelayFactor);
	}

	private onMessage(event: sockets.WebSocketEventMapLike["message"]): void {
		try {
			this.serializer.deserialize(event.data as string, (type, data, id) => {
				this.router.route("sys", "message", {
					type,
					data
				});
				if (is.present(id)) {
					let callback = this.requests.get(id);
					if (is.present(callback)) {
						this.requests.delete(id);
						callback(type, data);
					}
				}
				this.router.route("app", type, data);
			});
		} catch (error) {
			this.socket.close();
		}
	}

	private onOpen(event: sockets.WebSocketEventMapLike["open"]): void {
		this.nextConnectionAttemptDelay = 2000;
		this.router.route("sys", "connect", {});
	}

	private queue(payload: string): void {
		if (this.socket.readyState === sockets.ReadyState.OPEN) {
			this.socket.send(payload);
		} else {
			let onopen = () => {
				this.socket.removeEventListener("open", onopen);
				this.socket.send(payload);
			};
			this.socket.addEventListener("open", onopen);
		}
	}

	constructor(url: string, factory: WebSocketFactory, guards: autoguard.serialization.MessageGuardMap<A>) {
		this.nextConnectionAttemptDelayFactor = 2.0 + Math.random();
		this.nextConnectionAttemptDelay = 2000;
		this.router = new stdlib.routing.NamespacedMessageRouter<TypeSocketClientMessageMap<A>>();
		this.serializer = new shared.Serializer<A>(guards);
		this.url = url;
		this.factory = factory;
		this.socket = this.makeSocket();
		this.requests = new Map<string, (type: keyof A, data: A[keyof A]) => void>();
	}

	addEventListener<B extends keyof TypeSocketClientMessageMap<A>, C extends keyof TypeSocketClientMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketClientMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	close(): void {
		this.socket.close();
	}

	reconnect(): void {
		if (this.socket.readyState === sockets.ReadyState.CLOSED) {
			this.socket = this.makeSocket();
		}
	}

	removeEventListener<B extends keyof TypeSocketClientMessageMap<A>, C extends keyof TypeSocketClientMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketClientMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	request<B extends keyof A, C extends keyof A>(type: B, response_type: C, data: A[B]): Promise<A[C]> {
		return new Promise((resolve, reject) => {
			let id = this.makeId();
			let payload = this.serializer.serialize(type, data, id);
			this.requests.set(id, (type, data) => {

				if (type !== response_type) {
					reject(`Received response with type "${type}" when expecting "${response_type}"!`);
				} else {
					resolve(data);
				}
			});
			this.queue(payload);
		});
	}

	send<B extends keyof A>(type: B, data: A[B]): void {
		let payload = this.serializer.serialize(type, data);
		this.queue(payload);
	}
};
