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

	.image-box--poster {
		padding-bottom: ${3/2 * 100}%;
	}

	.image-box--square {
		padding-bottom: ${1/1 * 100}%;
	}

	.image-box--video {
		padding-bottom: ${9/16 * 100}%;
	}

	.image-box--landscape {
		padding-bottom: ${2/3 * 100}%;
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
		position: absolute;
		width: 100%;
	}

	.image-box--multiple
	.image-box__image:nth-child(1) {
		border-radius: 2px;
		box-shadow: 0px 0px 32px rgb(0, 0, 0, 0.50);
		transform: translate(-50%, -50%) scale(50%);
		left: 50%;
		top: 50%;
		z-index: 3;
	}

	.image-box--multiple
	.image-box__image:nth-child(2) {
		border-radius: 2px;
		box-shadow: 0px 0px 32px rgb(0, 0, 0, 0.50);
		transform: translate(-50%, -50%) scale(33.3%);
		left: 25%;
		top: 50%;
		z-index: 2;
	}

	.image-box--multiple
	.image-box__image:nth-child(3) {
		border-radius: 2px;
		box-shadow: 0px 0px 32px rgb(0, 0, 0, 0.50);
		transform: translate(-50%, -50%) scale(33.3%);
		left: 75%;
		top: 50%;
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

export class ImageBoxFactory {
	private token: observables.ObservableClass<undefined | string>;

	constructor(token: observables.ObservableClass<undefined | string>) {
		this.token = token;
	}

	for(urls: Array<string>, multiple?: boolean, format: "poster" | "square" | "video" | "landscape" = "square"): xnode.XElement {
		let node = xnode.element(`div.image-box.image-box--${format}${multiple ? ".image-box--multiple" : ""}`);
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

	forPoster(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, "poster");
	}

	forSquare(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, "square");
	}

	forVideo(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, "video");
	}

	forLandscape(urls: Array<string>, multiple?: boolean): xnode.XElement {
		return this.for(urls, multiple, "landscape");
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
