import { WebSocketLike } from "../typesockets";

export class WebSocketClient implements WebSocketLike {
	private url: string;
	private state: number;

	constructor(url: string) {
		this.url = url;
	}

	addEventListener<A extends keyof WebSocketEventMap>(type: A, listenerer: (event: WebSocketEventMap[A]) => void): void {

	}

	removeEventListener<A extends keyof WebSocketEventMap>(type: A, listenerer: (event: WebSocketEventMap[A]) => void): void {

	}

	send(payload: string): void {

	}

	get readyState(): number {
		return this.state;
	}
}
