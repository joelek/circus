import * as libhttp from "http";
import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as sockets from "@joelek/ts-sockets";

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
		[B in keyof A]: {
			connection_id: string,
			data: A[B]
		}
	}
};

export class TypeSocketClient<A extends stdlib.routing.MessageMap<A>> {
	private nextConnectionAttemptDelayFactor: number;
	private nextConnectionAttemptDelay: number;
	private router: stdlib.routing.NamespacedMessageRouter<TypeSocketClientMessageMap<A>>;
	private serializer: autoguard.serialization.MessageSerializer<A>;
	private socket: WebSocket;

	private onClose(event: WebSocketEventMap["close"]): void {
		this.router.route("sys", "disconnect", {});
	}

	private onError(event: WebSocketEventMap["error"]): void {
		setTimeout(() => {
			this.socket = new WebSocket(this.socket.url);
			this.socket.addEventListener("close", this.onClose.bind(this));
			this.socket.addEventListener("error", this.onError.bind(this));
			this.socket.addEventListener("message", this.onMessage.bind(this));
			this.socket.addEventListener("open", this.onOpen.bind(this));
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

	constructor(url: string, guards: autoguard.serialization.MessageGuardMap<A>) {
		this.nextConnectionAttemptDelayFactor = 2.0 + Math.random();
		this.nextConnectionAttemptDelay = 2000;
		this.router = new stdlib.routing.NamespacedMessageRouter<TypeSocketClientMessageMap<A>>();
		this.serializer = new autoguard.serialization.MessageSerializer<A>(guards);
		this.socket = new WebSocket(url);
		this.socket.addEventListener("close", this.onClose.bind(this));
		this.socket.addEventListener("error", this.onError.bind(this));
		this.socket.addEventListener("message", this.onMessage.bind(this));
		this.socket.addEventListener("open", this.onOpen.bind(this));
	}

	addEventListener<B extends keyof TypeSocketClientMessageMap<A>, C extends keyof TypeSocketClientMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketClientMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	removeEventListener<B extends keyof TypeSocketClientMessageMap<A>, C extends keyof TypeSocketClientMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketClientMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	send<B extends keyof A>(type: B, data: A[B]): void {
		this.socket.send(this.serializer.serialize(type, data));
	}

	static connect<A>(guards: autoguard.serialization.MessageGuardMap<A>): TypeSocketClient<A> {
		let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		let host = window.location.host;
		let url = `${protocol}//${host}/typesockets/`;
		return new TypeSocketClient(url, guards);
	}
};

export type TypeSocketServerMessageMap<A extends stdlib.routing.MessageMap<A>> = {
	sys: {
		connect: {
			connection_id: string
		},
		disconnect: {
			connection_id: string
		}
		message: {
			connection_id: string,
			type: keyof A,
			data: A[keyof A]
		}
	},
	app: {
		[B in keyof A]: {
			connection_id: string,
			data: A[B]
		}
	}
};

export class TypeSocketServer<A extends stdlib.routing.MessageMap<A>> {
	private router: stdlib.routing.NamespacedMessageRouter<TypeSocketServerMessageMap<A>>;
	private serializer: autoguard.serialization.MessageSerializer<A>;
	private socket: sockets.WebSocketServer;

	constructor(guards: autoguard.serialization.MessageGuardMap<A>) {
		this.router = new stdlib.routing.NamespacedMessageRouter<TypeSocketServerMessageMap<A>>();
		this.serializer = new autoguard.serialization.MessageSerializer<A>(guards);
		this.socket = new sockets.WebSocketServer();
		this.socket.addEventListener("connect", (message) => {
			let connection_id = message.connection_id;
			this.router.route("sys", "connect", {
				connection_id
			});
		});
		this.socket.addEventListener("disconnect", (message) => {
			let connection_id = message.connection_id;
			this.router.route("sys", "disconnect", {
				connection_id
			});
		});
		this.socket.addEventListener("message", (message) => {
			let connection_id = message.connection_id;
			this.serializer.deserialize(message.buffer.toString("utf8"), (type, data) => {
				this.router.route("sys", "message", {
					connection_id,
					type,
					data
				});
				this.router.route("app", type, {
					connection_id,
					data
				});
			});
		});
	}

	addEventListener<B extends keyof TypeSocketServerMessageMap<A>, C extends keyof TypeSocketServerMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketServerMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	getRequestHandler(): libhttp.RequestListener {
		return this.socket.getRequestHandler();
	}

	removeEventListener<B extends keyof TypeSocketServerMessageMap<A>, C extends keyof TypeSocketServerMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketServerMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	send<B extends keyof A>(type: B, connection_id: string, data: A[B]): void {
		this.socket.send(connection_id, this.serializer.serialize(type, data));
	}
};
