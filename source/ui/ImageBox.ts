import * as observables from "../simpleobs";
import * as xnode from "../xnode";
import * as theme from "./theme";
import * as is from "../is";

const CSS = `
	.image-box {
		background-color: ${theme.BACKGROUND_0};
		position: relative;
	}

	.image-box--aspect-1-1 {
		padding-bottom: ${1/1 * 100}%;
	}

	.image-box--aspect-16-9 {
		padding-bottom: ${9/16 * 100}%;
	}

	.image-box--aspect-2-3 {
		padding-bottom: ${3/2 * 100}%;
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

	for(url?: string, aspectRatio: "1-1" | "16-9" | "2-3" = "1-1"): xnode.XElement {
		let isLoaded = new observables.ObservableClass(false);
		return xnode.element(`div.image-box.image-box--aspect-${aspectRatio}`)
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

	forPoster(url?: string): xnode.XElement {
		return this.for(url, "2-3");
	}

	forSquare(url?: string): xnode.XElement {
		return this.for(url, "1-1");
	}

	forVideo(url?: string): xnode.XElement {
		return this.for(url, "16-9");
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
