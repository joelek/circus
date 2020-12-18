import * as api from "../api/schema/objects";
import * as is from "../is";
import * as xnode from "../xnode";
import { IconFactory } from "./Icon";
import { EntityLinkFactory } from "./EntityLink";

const CSS = `
	.entity-nav-link {
		display: grid;
		gap: 16px;
		grid-template-columns: max(120px) max(120px);
		justify-content: center;
	}

	.entity-nav-link__last,
	.entity-nav-link__next {
		display: grid;
		gap: 8px;
		justify-items: center;
	}

	.entity-nav-link__title {
		color: rgb(159, 159, 159);
		font-size: 16px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export class EntityNavLinkFactory {
	private iconFactory: IconFactory;
	private entityLinkFactory: EntityLinkFactory;

	constructor(iconFactory: IconFactory, entityLinkFactory: EntityLinkFactory) {
		this.iconFactory = iconFactory;
		this.entityLinkFactory = entityLinkFactory;
	}

	make(last: api.EntityBase | undefined, next: api.EntityBase | undefined): xnode.XElement {
		let lastLink = is.absent(last) ? xnode.element("span") : this.entityLinkFactory.forEntity(last);
		let nextLink = is.absent(next) ? xnode.element("span") : this.entityLinkFactory.forEntity(next);
		return xnode.element("div.entity-nav-link")
			.add(lastLink.add(
				xnode.element("div.entity-nav-link__last")
					.add(xnode.element("div.icon-button")
						.set("data-enabled", `${is.present(last)}`)
						.add(this.iconFactory.makeChevron()
							.set("style", "transform: scale(-1.0, 1.0);")
						)
					)
					.add(xnode.element("div.entity-nav-link__title")
						.add(xnode.text("View last"))
					)
				)
			)
			.add(nextLink.add(
				xnode.element("div.entity-nav-link__next")
					.add(xnode.element("div.icon-button")
						.set("data-enabled", `${is.present(next)}`)
						.add(this.iconFactory.makeChevron())
							.set("style", "transform: scale(1.0, 1.0);")
					)
					.add(xnode.element("div.entity-nav-link__title")
						.add(xnode.text("View next"))
					)
				)
			);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
