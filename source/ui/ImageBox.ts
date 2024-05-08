import * as observables from "../observers/";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as is from "../is";

const CSS = `
	.image-box {
		background-color: ${theme.BACKGROUND_3};
		border-radius: 4px;
		overflow: hidden;
		position: relative;
		will-change: opacity;
	}

	.image-box--1-1 {
		padding-bottom: ${1/1 * 100}%;
	}

	.image-box--4-3 {
		padding-bottom: ${3/4 * 100}%;
	}

	.image-box--3-4 {
		padding-bottom: ${4/3 * 100}%;
	}

	.image-box--3-2 {
		padding-bottom: ${2/3 * 100}%;
	}

	.image-box--2-3 {
		padding-bottom: ${3/2 * 100}%;
	}

	.image-box--16-9 {
		padding-bottom: ${9/16 * 100}%;
	}

	.image-box--9-16 {
		padding-bottom: ${9/16 * 100}%;
	}

	.image-box--multiple {

	}

	.image-box__content {
		height: 100%;
		object-fit: contain;
		position: absolute;
		width: 100%;
	}

	.image-box__image {
		height: 100%;
		position: absolute;
		object-fit: contain;
		width: 100%;
	}

	.image-box--multiple
	.image-box__image:nth-child(1) {
		border-radius: 2px;
		box-shadow: 0px 0px 32px rgb(0, 0, 0, 0.50);
		transform: translate(-50%, -50%) scale(75%);
		left: 50%;
		top: 50%;
		width: auto;
		z-index: 3;
	}

	.image-box--multiple
	.image-box__image:nth-child(2) {
		border-radius: 2px;
		box-shadow: 0px 0px 32px rgb(0, 0, 0, 0.50);
		transform: translate(-50%, -50%) scale(50%);
		left: 25%;
		top: 50%;
		width: auto;
		z-index: 2;
	}

	.image-box--multiple
	.image-box__image:nth-child(3) {
		border-radius: 2px;
		box-shadow: 0px 0px 32px rgb(0, 0, 0, 0.50);
		transform: translate(-50%, -50%) scale(50%);
		left: 75%;
		top: 50%;
		width: auto;
		z-index: 1;
	}

	.image-box--multiple
	.image-box__image:nth-child(n+4) {
		display: none;
	}

	[data-opaque] {
		opacity: 0;
		transition: opacity 1.000s;
	}

	[data-opaque="true"] {
		opacity: 1;
		//filter: blur(32px);
	}
`;

export type AspectRatio = {
	x: number;
	y: number;
};

const TARGETS = {
	"1:1": { x:  1, y:  1 },
	"4:3": { x:  4, y:  3 },
	"3:4": { x:  3, y:  4 },
	"3:2": { x:  3, y:  2 },
	"2:3": { x:  2, y:  3 },
	"16:9": { x: 16, y:  9 },
	"9:16": { x:  9, y: 16 }
};

export const AspectRatio = {
	TARGETS,

	computeOverlap(target: AspectRatio, source: AspectRatio): number {
		let a = source.x * target.y;
		let b = target.x * source.y;
		// If source is wider than target.
		if (a > b) {
			return b / a;
		} else {
			return a / b;
		}
	},

	getOptimal(source: AspectRatio): AspectRatio {
		let candidates = Object.values(TARGETS).map((target) => {
			let overlap = AspectRatio.computeOverlap(target, source);
			return {
				target,
				overlap
			};
		});
		candidates.sort((one, two) => one.overlap - two.overlap);
		let candidate = candidates.pop();
		if (candidate == null) {
			throw new Error();
		}
		return candidate.target;
	}
};

export class ImageBoxFactory {
	private token: observables.ObservableClass<undefined | string>;

	constructor(token: observables.ObservableClass<undefined | string>) {
		this.token = token;
	}

	for(urls: Array<string>, multiple?: boolean, ar?: AspectRatio): xnode.XElement {
		ar = ar ?? TARGETS["1:1"];
		let node = xnode.element(`div.image-box.image-box--${ar.x}-${ar.y}${multiple ? ".image-box--multiple" : ""}`);
		let content = xnode.element(`div.image-box__content`);
		for (let url of urls) {
			if (is.absent(url)) {
				continue;
			}
			let isLoaded = new observables.ObservableClass(false);
			content.add(xnode.element("img.image-box__image")
				.bind("data-opaque", isLoaded.addObserver((isLoaded) => isLoaded))
				.bind("src", this.token.addObserver((token) => {
					if (is.present(token) && is.present(url)) {
						return `${url}?token=${token}`;
					}
				}))
				.on("load", () => {
					isLoaded.updateState(true);
				})
			);
		}
		return node
			.add(content);
	}

	forPortrait(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, TARGETS["2:3"]);
	}

	forSquare(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, TARGETS["1:1"]);
	}

	forVideo(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, TARGETS["16:9"]);
	}

	forLandscape(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, TARGETS["3:2"]);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
