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
		[B in keyof A]: A[B]
	}
};

export class TypeSocketClient<A extends stdlib.routing.MessageMap<A>> {
	private nextConnectionAttemptDelayFactor: number;
	private nextConnectionAttemptDelay: number;
	private router: stdlib.routing.NamespacedMessageRouter<TypeSocketClientMessageMap<A>>;
	private serializer: autoguard.serialization.MessageSerializer<A>;
	private url: string;
	private factory: sockets.WebSocketFactory;
	private socket: sockets.WebSocket;

	private onClose(event: WebSocketEventMap["close"]): void {
		this.router.route("sys", "disconnect", {});
	}

	private onError(event: WebSocketEventMap["error"]): void {
		setTimeout(() => {
			this.socket = this.factory(this.url);
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

	constructor(url: string, factory: sockets.WebSocketFactory, guards: autoguard.serialization.MessageGuardMap<A>) {
		this.nextConnectionAttemptDelayFactor = 2.0 + Math.random();
		this.nextConnectionAttemptDelay = 2000;
		this.router = new stdlib.routing.NamespacedMessageRouter<TypeSocketClientMessageMap<A>>();
		this.serializer = new autoguard.serialization.MessageSerializer<A>(guards);
		this.url = url;
		this.factory = factory;
		this.socket = factory(url);
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
		let readyState: ReadyState = this.socket.readyState;
		if (readyState === sockets.ReadyState.OPEN) {
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

export type TypeSocketServerMessageMap<A extends stdlib.routing.MessageMap<A>> = {
	sys: {
		connect: {
			connection_id: string,
			connection_url: string
		},
		disconnect: {
			connection_id: string,
			connection_url: string
		}
		message: {
			connection_id: string,
			connection_url: string,
			type: keyof A,
			data: A[keyof A]
		}
	},
	app: {
		[B in keyof A]: {
			connection_id: string,
			connection_url: string,
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
			let connection_url = message.connection_url;
			this.router.route("sys", "connect", {
				connection_id,
				connection_url
			});
		});
		this.socket.addEventListener("disconnect", (message) => {
			let connection_id = message.connection_id;
			let connection_url = message.connection_url;
			this.router.route("sys", "disconnect", {
				connection_id,
				connection_url
			});
		});
		this.socket.addEventListener("message", (message) => {
			let connection_id = message.connection_id;
			let connection_url = message.connection_url;
			let payload = message.buffer.toString();
			this.serializer.deserialize(payload, (type, data) => {
				console.log(`${connection_id} -> ${type}`);
				this.router.route("sys", "message", {
					connection_id,
					connection_url,
					type,
					data
				});
				this.router.route("app", type, {
					connection_id,
					connection_url,
					data
				});
			});
		});
	}

	addEventListener<B extends keyof TypeSocketServerMessageMap<A>, C extends keyof TypeSocketServerMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketServerMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}
/*
	broadcast<B extends keyof A>(type: B, data: A[B]): void {
		let payload = this.serializer.serialize(type, data);
		this.socket.broadcast(payload);
	}

	close(connection_id: string): void {
		this.socket.close(connection_id);
	}
*/
	getRequestHandler(): libhttp.RequestListener {
		return this.socket.getRequestHandler();
	}

	removeEventListener<B extends keyof TypeSocketServerMessageMap<A>, C extends keyof TypeSocketServerMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketServerMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	send<B extends keyof A>(type: B, connection_ids: string | Array<string>, data: A[B]): void {
		let payload = this.serializer.serialize(type, data);
		for (let connection_id of Array.isArray(connection_ids) ? connection_ids : [connection_ids]) {
			console.log(`${connection_id} <- ${type}`);
			try {
				this.socket.send(connection_id, payload);
			} catch (error) {}
		}
	}
};
