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
	}

	.carousel__controls {
		display: grid;
		gap: 16px;
		grid-auto-flow: column;
		justify-content: center;
	}
`;

export class CarouselFactory {
	private iconFactory: IconFactory;

	constructor(iconFactory: IconFactory) {
		this.iconFactory = iconFactory;
	}

	make(children: observers.ArrayObservable<xnode.XElement>): xnode.XElement {
		let childLength = new observers.ObservableClass(children.getState().length);
		children.compute((children) => {
			childLength.updateState(children.length);
		});
		let activeIndex = new observers.ObservableClass(0);
		let canScrollLast = observers.computed((activeIndex) => {
			return activeIndex > 0;
		}, activeIndex);
		let canScrollNext = observers.computed((activeIndex, childLength) => {
			return activeIndex < childLength - 1;
		}, activeIndex, childLength);
		let contentElement = xnode.element("div.carousel__content");
		contentElement.ref().then(async (contentElement) => {
			let observer = new IntersectionObserver(async (entries) => {
				for (let entry of entries) {
					for (let [index, child] of children.getState().entries()) {
						let ref = await child.ref();
						if (entry.target === ref && entry.isIntersecting) {
							activeIndex.updateState(index);
							return;
						}
					}
				}
			}, {
				root: contentElement
			});
			children.addObserver({
				async onappend(state) {
					observer.observe(await state.ref());
				},
				async onsplice(state, index) {
					observer.unobserve(await state.ref());
				}
			});
		});
		return xnode.element("div.carousel")
			.add(contentElement
				.repeat(children, (child) => child)
			)
			.add(xnode.element("div.carousel__controls")
				.add(xnode.element("div.icon-button")
					.bind("data-enabled", canScrollLast.addObserver((canScrollLast) => `${canScrollLast}`))
					.add(this.iconFactory.makeChevron({ direction: "left" }))
					.on("click", async () => {
						if (canScrollLast.getState()) {
							let content = await contentElement.ref() as HTMLElement;
							let child = children.getState()[activeIndex.getState() - 1];
							let ref = await child.ref() as HTMLElement;
							content.scrollTo({ left: ref.offsetLeft - content.offsetLeft, behavior: "smooth" });
						}
					})
				)
				.add(xnode.element("div.icon-button")
					.bind("data-enabled", canScrollNext.addObserver((canScrollNext) => `${canScrollNext}`))
					.add(this.iconFactory.makeChevron())
					.on("click", async () => {
						if (canScrollNext.getState()) {
							let content = await contentElement.ref() as HTMLElement;
							let child = children.getState()[activeIndex.getState() + 1];
							let ref = await child.ref() as HTMLElement;
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
