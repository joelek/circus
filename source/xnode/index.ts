import * as is from "../is";
import { ObservableClass, Observable, ArrayObservable } from "../observers/";

export interface XNode<A extends globalThis.Node> {
	render(): A;
}

export class XText implements XNode<globalThis.Text> {
	private content: string | ObservableClass<string>;

	constructor(content: string | ObservableClass<string>) {
		this.content = content;
	}

	render(): globalThis.Text {
		let node = document.createTextNode("");
		if (this.content instanceof ObservableClass) {
			this.content.addObserver((content) => {
				node.textContent = content;
			});
		} else {
			node.textContent = this.content;
		}
		return node;
	}
}

export interface Listener<A extends keyof HTMLElementEventMap> {
	(event: HTMLElementEventMap[A]): void;
}

export interface Renderer<A> {
	(state: A): XElement | undefined;
}

export class XElement implements XNode<globalThis.Element> {
	private tag: string;
	private attributes: Map<string, string>;
	private children: Array<XNode<any>>;
	private bound: Map<string, Observable<any>>;
	private bound2: Map<string, ObservableClass<string>>;
	private listeners: Map<keyof HTMLElementEventMap, Array<Listener<keyof HTMLElementEventMap>>>;
	private array?: ArrayObservable<any>;
	private renderer?: Renderer<any>;
	private element: globalThis.Element | undefined;

	constructor(selector: string) {
		let parts = selector.split(".");
		this.tag = parts[0];
		this.attributes = new Map<string, string>();
		this.children = new Array<XNode<any>>();
		this.bound = new Map<string, Observable<any>>();
		this.bound2 = new Map<string, ObservableClass<string>>();
		this.listeners = new Map<keyof HTMLElementEventMap, Array<Listener<keyof HTMLElementEventMap>>>();
		let classes = parts.slice(1).join(" ");
		if (classes !== "") {
			this.attributes.set("class", classes);
		}
	}

	add(...nodes: Array<XNode<any> | null | undefined>): this {
		// TODO: Detach node from current parent.
		for (let node of nodes) {
			if (node != null) {
				this.children.push(node);
			}
		}
		return this;
	}

	bind(key: string, observable: Observable<any>): this {
		this.bound.set(key, observable);
		return this;
	}

	bind2(key: string, observable: ObservableClass<string>): this {
		this.bound2.set(key, observable);
		return this;
	}

	on<A extends keyof HTMLElementEventMap>(kind: A, listener: Listener<A>, override = true): this {
		let listeners = this.listeners.get(kind) as Array<Listener<A>> | undefined;
		if (listeners == null) {
			listeners = new Array<Listener<A>>();
			this.listeners.set(kind, listeners as any);
		}
		listeners.push((event) => {
			if (override) {
				event.preventDefault();
				event.stopPropagation();
			}
			listener(event);
		});
		return this;
	}

	ref(): globalThis.Element {
		if (is.absent(this.element)) {
			throw `Expected element to be rendered!`;
		}
		return this.element;
	}

	render(): globalThis.Element {
		let ns = ["svg", "path"].indexOf(this.tag) >= 0 ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml";
		let element = this.element = document.createElementNS(ns, this.tag);
		element.setAttribute = (() => {
			let setAttribute = element.setAttribute.bind(element);
			return (key: string, value: string) => {
				if (key === "src") {
					let observer = new IntersectionObserver((entries) => {
						for (let entry of entries) {
							if (entry.target === element && entry.isIntersecting) {
								observer.unobserve(element);
								setAttribute(key, value);
							}
						}
					}, { root: document.body });
					observer.observe(element);
				} else {
					setAttribute(key, value);
				}
			};
		})();
		for (let [kind, listeners] of this.listeners) {
			for (let listener of listeners) {
				element.addEventListener(kind, listener);
			}
		}
		for (let [key, value] of this.attributes) {
			element.setAttribute(key, value);
		}
		for (let [key, observable] of this.bound) {
			observable((value) => {
				element.setAttribute(key, `${value}`);
			});
		}
		for (let [key, observable] of this.bound2) {
			observable.addObserver((value) => {
				element.setAttribute(key, `${value}`);
			});
			if (this.tag === "input" && key === "value") {
				element.addEventListener("input", () => {
					observable.updateState((element as any).value);
				});
			}
		}
		for (let child of this.children) {
			element.appendChild(child.render());
		}
		if (this.array) {
			this.array.addObserver({
				onupdate: (state) => {
					if (this.renderer) {
						while (element.firstChild) {
							element.firstChild.remove();
						}
						for (let value of state) {
							let child = this.renderer(value);
							if (is.present(child)) {
								element.appendChild(child.render());
							}
						}
					}
				}
			})
		}
		return element;
	}

	repeat<A>(array: ArrayObservable<A>, renderer: Renderer<A>): this {
		this.array = array;
		this.renderer = renderer;
		return this;
	}

	set(key: string, value: string = ""): this {
		this.attributes.set(key, value);
		return this;
	}
}

export function element(selector: string): XElement {
	return new XElement(selector);
}

export function text(content: string | ObservableClass<string>): XText {
	return new XText(content);
}

export function joinarray(nodes: XNode<any>[], joiner: string = " \u00b7 "): XNode<any>[] {
	let array = [] as XNode<any>[];
	for (let node of nodes) {
		array.push(node);
		array.push(text(joiner));
	}
	array.pop();
	return array;
}
