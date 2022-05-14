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
		grid-auto-columns: min-content;
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

	.carousel__control {
		display: grid;
		gap: 8px;
		justify-items: center;
	}

	.carousel__control-title {
		color: rgb(159, 159, 159);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		let childVisibilities = new observers.ArrayObservable<boolean>([]);
		children.addObserver({
			onappend(state) {
				childVisibilities.append(false);
			},
			onsplice(state, index) {
				childVisibilities.splice(index);
			}
		});
		let childrenBefore = new observers.ObservableClass(0);
		let childrenAfter = new observers.ObservableClass(0);
		let childrenVisible = observers.computed((before, after, length) => {
			return length - before - after;
		}, childrenBefore, childrenAfter, childLength);
		childVisibilities.compute((childVisibilities) => {
			let before = 0;
			let after = 0;
			for (let i = 0; i < childVisibilities.length; i += 1) {
				if (childVisibilities[i] === true) {
					break;
				}
				before += 1;
			}
			for (let i = childVisibilities.length - 1; i >= 0; i -= 1) {
				if (childVisibilities[i] === true) {
					break;
				}
				after += 1;
			}
			childrenBefore.updateState(before);
			childrenAfter.updateState(after);
		});
		let canScrollLast = observers.computed((childrenBefore) => {
			return childrenBefore > 0;
		}, childrenBefore);
		let canScrollNext = observers.computed((childrenAfter) => {
			return childrenAfter > 0;
		}, childrenAfter);
		let contentElement = xnode.element("div.carousel__content");
		contentElement.ref().then(async (contentElement) => {
			let observer = new IntersectionObserver(async (entries) => {
				let vis = childVisibilities.getState();
				for (let entry of entries) {
					for (let [index, child] of children.getState().entries()) {
						let ref = await child.ref();
						if (entry.target === ref) {
							vis[index] = entry.isIntersecting;
							break;
						}
					}
				}
				childVisibilities.update(vis);
			}, {
				root: contentElement,
				threshold: 1
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
				.add(xnode.element("div.carousel__control")
					.on("click", async () => {
						if (canScrollLast.getState()) {
							let content = await contentElement.ref() as HTMLElement;
							let index = Math.max(0, childrenBefore.getState() - childrenVisible.getState());
							let child = children.getState()[index];
							let ref = await child.ref() as HTMLElement;
							content.scrollTo({ left: ref.offsetLeft - content.offsetLeft, behavior: "smooth" });
						}
					})
					.add(xnode.element("div.icon-button")
						.bind("data-enabled", canScrollLast.addObserver((canScrollLast) => `${canScrollLast}`))
						.add(this.iconFactory.makeChevron({ direction: "left" }))
					)
				)
				.add(xnode.element("div.carousel__control")
					.on("click", async () => {
						if (canScrollNext.getState()) {
							let content = await contentElement.ref() as HTMLElement;
							let index = Math.min(childLength.getState() - 1, childrenBefore.getState() + childrenVisible.getState());
							let child = children.getState()[index];
							let ref = await child.ref() as HTMLElement;
							content.scrollTo({ left: ref.offsetLeft - content.offsetLeft, behavior: "smooth" });
						}
					})
					.add(xnode.element("div.icon-button")
						.bind("data-enabled", canScrollNext.addObserver((canScrollNext) => `${canScrollNext}`))
						.add(this.iconFactory.makeChevron())
					)
				)
			);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
