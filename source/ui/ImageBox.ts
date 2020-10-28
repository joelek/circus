import * as observables from "../simpleobs";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as is from "../is";

const CSS = `
	.image-box {
		background-color: ${theme.BACKGROUND_3};
		position: relative;
	}

	.image-box--circle {
		border-radius: 50%;
		overflow: hidden;
		padding-bottom: ${1/1 * 100}%;
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

	.image-box__image {
		height: 100%;
		object-fit: cover;
		position: absolute;
		width: 100%;
	}

	[data-opaque] {
		opacity: 0;
		transition: opacity 0.1s;
	}

	[data-opaque="true"] {
		opacity: 1;
	}
`;

export class ImageBoxFactory {
	private token: observables.ObservableClass<undefined | string>;

	constructor(token: observables.ObservableClass<undefined | string>) {
		this.token = token;
	}

	for(url?: string, format: "circle" | "poster" | "square" | "video" = "square"): xnode.XElement {
		let isLoaded = new observables.ObservableClass(false);
		return xnode.element(`div.image-box.image-box--${format}`)
			.add(is.absent(url) ? undefined : xnode.element("img.image-box__image")
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

	forCircle(url?: string): xnode.XElement {
		return this.for(url, "circle");
	}

	forPoster(url?: string): xnode.XElement {
		return this.for(url, "poster");
	}

	forSquare(url?: string): xnode.XElement {
		return this.for(url, "square");
	}

	forVideo(url?: string): xnode.XElement {
		return this.for(url, "video");
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
