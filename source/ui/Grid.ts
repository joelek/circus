import * as xnode from "../xnode";

const CSS = `
	.grid {
		align-items: start;
		display: grid;
		gap: 24px;
		grid-template-columns: repeat(auto-fill, minmax(240px, auto));
	}
`;

export class GridFactory {
	constructor() {

	}

	make(): xnode.XElement {
		return xnode.element("div.grid");
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
