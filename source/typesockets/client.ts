import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as sockets from "@joelek/ts-sockets/build/shared";

export interface WebSocketLike {
	addEventListener<A extends keyof WebSocketEventMap>(type: A, listener: (event: WebSocketEventMap[A]) => void): void;
	close(status?: sockets.StatusCode): void;
	removeEventListener<A extends keyof WebSocketEventMap>(type: A, listener: (event: WebSocketEventMap[A]) => void): void;
	send(payload: string | Buffer): void;
	readonly readyState: sockets.ReadyState;
};

export type WebSocketFactory = (url: string) => WebSocketLike;

export type TypeSocketClientMessageMap<A extends stdlib.routing.MessageMap<A>> = {
	sys: {
		connect: {

		},
		disconnect: {

		}
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
	private serializer: autoguard.serialization.MessageSerializer<A>;
	private url: string;
	private factory: WebSocketFactory;
	private socket: WebSocketLike;

	private makeSocket(): WebSocketLike {
		let socket = this.factory(this.url);
		socket.addEventListener("close", this.onClose.bind(this));
		socket.addEventListener("error", this.onError.bind(this));
		socket.addEventListener("message", this.onMessage.bind(this));
		socket.addEventListener("open", this.onOpen.bind(this));
		return socket;
	}

	private onClose(event: WebSocketEventMap["close"]): void {
		this.router.route("sys", "disconnect", {});
	}

	private onError(event: WebSocketEventMap["error"]): void {
		setTimeout(() => {
			this.socket = this.makeSocket();
		}, this.nextConnectionAttemptDelay);
		this.nextConnectionAttemptDelay = Math.round(this.nextConnectionAttemptDelay * this.nextConnectionAttemptDelayFactor);
	}

	private onMessage(event: WebSocketEventMap["message"]): void {
		let deserialized = event.data as string;
		this.serializer.deserialize(deserialized, (type, data) => {
			this.router.route("sys", "message", {
				type,
				data
			});
			this.router.route("app", type, data);
		});
	}

	private onOpen(event: WebSocketEventMap["open"]): void {
		this.nextConnectionAttemptDelay = 2000;
		this.router.route("sys", "connect", {});
	}

	constructor(url: string, factory: WebSocketFactory, guards: autoguard.serialization.MessageGuardMap<A>) {
		this.nextConnectionAttemptDelayFactor = 2.0 + Math.random();
		this.nextConnectionAttemptDelay = 2000;
		this.router = new stdlib.routing.NamespacedMessageRouter<TypeSocketClientMessageMap<A>>();
		this.serializer = new autoguard.serialization.MessageSerializer<A>(guards);
		this.url = url;
		this.factory = factory;
		this.socket = this.makeSocket();
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

	send<B extends keyof A>(type: B, data: A[B]): void {
		if (this.socket.readyState === sockets.ReadyState.OPEN) {
			this.socket.send(this.serializer.serialize(type, data));
		} else {
			let open = () => {
				this.socket.removeEventListener("open", open);
				this.socket.send(this.serializer.serialize(type, data));
			};
			this.socket.addEventListener("open", open);
		}
	}
};
