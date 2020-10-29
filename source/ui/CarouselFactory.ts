import * as xnode from "../xnode";

const CSS = `
	.carousel {
		align-items: start;
		display: grid;
		gap: 24px;
		grid-auto-flow: column;
		grid-auto-columns: 100%;
		overflow: scroll hidden;
		scroll-snap-type: x mandatory;
	}

	@media (hover: hover) and (pointer: fine) {
		.carousel {
			scroll-snap-type: none;
		}
	}

	.carousel > * {
		scroll-snap-align: start;
		transform: translate3d(0, 0, 0);
	}
`;

export class CarouselFactory {
	constructor() {

	}

	make(): xnode.XElement {
		return xnode.element("div.carousel");
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
