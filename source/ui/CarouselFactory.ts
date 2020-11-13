import * as observers from "../observers";
import * as is from "../is";
import * as xnode from "../xnode";
import { IconFactory } from "./Icon";

const CSS = `
	.carousel {
		display: grid;
		gap: 24px;
	}

	.carousel__content {
		align-items: start;
		display: grid;
		gap: 24px;
		grid-auto-flow: column;
		grid-auto-columns: 100%;
		overflow: scroll hidden;
		scroll-behavior: smooth;
		scroll-snap-type: x mandatory;
	}

	@media (hover: hover) and (pointer: fine) {
		.carousel__content {
			overflow: hidden;
		}
	}

	.carousel__content > * {
		scroll-snap-align: start;
		transform: translate3d(0, 0, 0);
	}

	.carousel__controls {
		display: grid;
		gap: 8px;
		grid-auto-flow: column;
		justify-content: center;
	}
`;

export class CarouselFactory {
	private iconFactory: IconFactory;

	constructor(iconFactory: IconFactory) {
		this.iconFactory = iconFactory;
	}

	make(...children: Array<xnode.XElement>): xnode.XElement {
		let activeIndex = new observers.ObservableClass(0);
		let canScrollLast = observers.computed((activeIndex) => {
			return activeIndex > 0;
		}, activeIndex);
		let canScrollNext = observers.computed((activeIndex) => {
			return activeIndex < children.length - 1;
		}, activeIndex);
		let contentElement = xnode.element("div.carousel__content");
		return xnode.element("div.carousel")
			.add(contentElement
				.add(...children)
				.on("scroll", () => {
					let content = contentElement.ref() as HTMLElement;
					let index = 0;
					for (let child of children) {
						let ref = child.ref() as HTMLElement;
						if (ref.offsetLeft - content.offsetLeft < content.scrollLeft) {
							index += 1;
						}
					}
					activeIndex.updateState(index);
				})
			)
			.add(xnode.element("div.carousel__controls")
				.add(xnode.element("div.icon-button")
					.bind("data-enabled", canScrollLast.addObserver((canScrollLast) => `${canScrollLast}`))
					.add(this.iconFactory.makeChevron()
						.set("style", "transform: scale(-1.0, 1.0);")
					)
					.on("click", () => {
						if (canScrollLast.getState()) {
							let content = contentElement.ref() as HTMLElement;
							let child = children[activeIndex.getState() - 1];
							let ref = child.ref() as HTMLElement;
							content.scrollTo({ left: ref.offsetLeft - content.offsetLeft, behavior: "smooth" });
						}
					})
				)
				.add(xnode.element("div.icon-button")
					.bind("data-enabled", canScrollNext.addObserver((canScrollNext) => `${canScrollNext}`))
					.add(this.iconFactory.makeChevron())
					.on("click", () => {
						if (canScrollNext.getState()) {
							let content = contentElement.ref() as HTMLElement;
							let child = children[activeIndex.getState() + 1];
							let ref = child.ref() as HTMLElement;
							content.scrollTo({ left: ref.offsetLeft - content.offsetLeft, behavior: "smooth" });
						}
					})
				)
			);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
