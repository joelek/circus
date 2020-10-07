import * as libcrypto from "crypto";
import * as libhttp from "http";
import * as libhttps from "https";
import * as liburl from "url";
import { ReadyState, WebSocketLike } from "../typesockets";

function makeHttpPromise(url: string, options: libhttp.RequestOptions): Promise<libhttp.IncomingMessage> {
	return new Promise((resolve, reject) => {
		libhttps.get(url, options, resolve);
	});
}

function makeHttpsPromise(url: string, options: libhttps.RequestOptions): Promise<libhttp.IncomingMessage> {
	return new Promise((resolve, reject) => {
		libhttps.get(url, options, resolve);
	});
}

export class WebSocketClient implements WebSocketLike {
	private state: ReadyState;

	constructor(url: string) {
		this.state = ReadyState.CONNECTING;
		let key = libcrypto.randomBytes(16).toString("base64");
		let headers: libhttp.OutgoingHttpHeaders = {
			"Connection": "upgrade",
			"Host": liburl.parse(url).host ?? "",
			"Sec-WebSocket-Key": key,
			"Sec-WebSocket-Version": "13",
			"Upgrade": "websocket"
		};
		(() => {
			if (url.startsWith("wss:")) {
				return makeHttpsPromise(url.substring(3), { headers, rejectUnauthorized: false });
			} else if (url.startsWith("ws:")) {
				return makeHttpPromise(url.substring(2), { headers });
			} else {
				throw `Expected ${url} to be a WebSocket URL!`;
			}
		})().then((response) => {
			let socket = response.socket;
			socket.on("close", () => {
				this.state = ReadyState.CLOSED;
			});
			if (response.statusCode !== 101) {
				this.state = ReadyState.CLOSING;
				return socket.end();
			}
			let connection = response.headers.connection ?? "";
			if (connection.toLocaleLowerCase() !== "upgrade") {
				this.state = ReadyState.CLOSING;
				return socket.end();
			}
			let upgrade = response.headers.upgrade ?? "";
			if (upgrade.toLocaleLowerCase() !== "websocket") {
				this.state = ReadyState.CLOSING;
				return socket.end();
			}
			let accept = response.headers.accept ?? "";
			let acceptExpected = libcrypto.createHash("sha1")
				.update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
				.digest("base64");
			if (accept !== acceptExpected) {
				this.state = ReadyState.CLOSING;
				return socket.end();
			}
			// SOCKET IS DONE
		});
	}

	addEventListener<A extends keyof WebSocketEventMap>(type: A, listenerer: (event: WebSocketEventMap[A]) => void): void {

	}

	removeEventListener<A extends keyof WebSocketEventMap>(type: A, listenerer: (event: WebSocketEventMap[A]) => void): void {

	}

	send(payload: string): void {

	}

	get readyState(): ReadyState {
		return this.state;
	}
}
