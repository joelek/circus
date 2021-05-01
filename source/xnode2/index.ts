/* import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";

export type XMessage<A, B> = {
	data: A;
	sender: B;
};

export type Listener<A, B> = (message: XMessage<A, B>) => void;

export type EventMap<A extends stdlib.routing.MessageMap<A>, B> = {
	[C in keyof A]: XMessage<A[C], B>;
};

export type Primitive = boolean | null | number | string | undefined;

export function stringifyPrimitive(primitive: Primitive): string | undefined {
	if (is.present(primitive)) {
		return String(primitive);
	}
};

export type ObservableChagneEvent<A> = {
	last: A;
	next: A;
};

export type ObservableEventMap<A> = {
	"change": ObservableChagneEvent<A>;
	"test": {};
};

export class Observable<A extends Primitive> {
	private router: stdlib.routing.MessageRouter<EventMap<ObservableEventMap<A>, Observable<A>>>;
	private state: A;

	constructor(state: A) {
		this.router = new stdlib.routing.MessageRouter<EventMap<ObservableEventMap<A>, Observable<A>>>();
		this.state = state;
	}

	on<B extends keyof ObservableEventMap<A>>(type: B, listener: Listener<ObservableEventMap<A>[B], Observable<A>>): this {
		this.router.addObserver(type, listener);
		if (type === "change") {
			(listener as Listener<ObservableEventMap<A>["change"], Observable<A>>)({
				data: {
					last: this.state,
					next: this.state,
				},
				sender: this
			});
		}
		return this;
	}

	off<B extends keyof ObservableEventMap<A>>(type: B, listener: Listener<ObservableEventMap<A>[B], Observable<A>>): this {
		this.router.removeObserver(type, listener);
		return this;
	}

	update(state: A): this {
		if (state !== this.state) {

		}
		return this;
	}
};

export function observable<A>(state: A): Observable<A> {
	return new Observable<A>(state);
};

export type Value = Primitive | Observable<Primitive>;





export interface XNode<A extends Node> {
	unbox(): A;
};

export class XText implements XNode<Text> {
	private text: Text;

	constructor(text: Text) {
		this.text = text;
	}

	unbox(): Text {
		return this.text;
	}
};

export function text(value: Value): XText {
	let text = document.createTextNode("");
	let observable = value instanceof Observable ? value : new Observable(value);
	observable.on("change", (event, target) => {
		text.textContent = stringifyPrimitive(event.state) ?? "";
	});
	return new XText(text);
};

export class XElement<A extends HTMLElement> implements XNode<A> {
	private element: A;
	private listeners: Map<Listener<HTMLElementEventMap[B], XElement<A>, >;

	constructor(element: A) {
		this.element = element;
	}

	append(...nodes: Array<XNode<Node> | undefined>): this {
		for (let node of nodes) {
			if (is.present(node)) {
				this.element.appendChild(node.unbox());
			}
		}
		return this;
	}

	attribute(key: string, value: Value): this {
		let observable = value instanceof Observable ? value : new Observable(value);
		observable.on("change", (event, target) => {
			let string = stringifyPrimitive(event.state);
			if (is.present(string)) {
				this.element.setAttribute(key, string);
			} else {
				this.element.removeAttribute(key);
			}
		});
		return this;
	}

	on<B extends keyof HTMLElementEventMap>(type: B, listener: Listener<HTMLElementEventMap[B], XElement<A>>): this {
		this.element.addEventListener(type, (event) => {
			listener(event, this);
		});
		return this;
	}

	off<B extends keyof HTMLElementEventMap>(type: B, listener: Listener<HTMLElementEventMap[B], XElement<A>>): this {
		// TODO
		return this;
	}

	selector(selector: string): this {
		// TODO
		return this;
	}

	unbox(): A {
		return this.element;
	}
};

export function element<A extends keyof HTMLElementTagNameMap>(type: A): XElement<HTMLElementTagNameMap[A]> {
	let element = document.createElement(type);
	return new XElement(element);
};






let div = element("div").selector(".test")
	.attribute("data-hide", "")
	.on("click", (message) => {
		console.log(message.sender.unbox());
	})
	.append(text("hej"))
	.unbox();
 */
