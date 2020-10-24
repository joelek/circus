import * as libhttp from "http";
import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as sockets from "@joelek/ts-sockets";

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
	private debug: boolean;

	constructor(guards: autoguard.serialization.MessageGuardMap<A>, debug: boolean = false) {
		this.router = new stdlib.routing.NamespacedMessageRouter<TypeSocketServerMessageMap<A>>();
		this.serializer = new autoguard.serialization.MessageSerializer<A>(guards);
		this.socket = new sockets.WebSocketServer();
		this.debug = debug;
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
				if (this.debug) {
					console.log(`${connection_id} -> ${type}`);
				}
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

	broadcast<B extends keyof A>(type: B, data: A[B]): void {
		let payload = this.serializer.serialize(type, data);
		this.socket.broadcast(payload);
	}

	close(connection_id: string): void {
		this.socket.close(connection_id);
	}

	getRequestHandler(): libhttp.RequestListener {
		return this.socket.getRequestHandler();
	}

	removeEventListener<B extends keyof TypeSocketServerMessageMap<A>, C extends keyof TypeSocketServerMessageMap<A>[B]>(namespace: B, type: C, listener: stdlib.routing.MessageObserver<TypeSocketServerMessageMap<A>[B][C]>): void {
		this.router.addObserver(namespace, type, listener);
	}

	send<B extends keyof A>(type: B, connection_ids: string | Array<string>, data: A[B]): void {
		let payload = this.serializer.serialize(type, data);
		for (let connection_id of Array.isArray(connection_ids) ? connection_ids : [connection_ids]) {
			if (this.debug) {
				console.log(`${connection_id} <- ${type}`);
			}
			try {
				this.socket.send(connection_id, payload);
			} catch (error) {}
		}
	}
};
