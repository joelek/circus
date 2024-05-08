import * as xnode from "../xnode";

const CSS = `
	.grid {
		align-items: baseline;
		display: grid;
		gap: 24px;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	}

	.grid--mini {
		align-items: start;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
	}
`;

type Options = Partial<{
	mini: boolean
}>;

export class GridFactory {
	constructor() {

	}

	make(options?: Options): xnode.XElement {
		let mini = options?.mini ?? false;
		return xnode.element(`div.grid${mini ? ".grid--mini" : ""}`);
	}

	static makeStyle(): xnode.XElement {
		return xnode.element("style")
			.add(xnode.text(CSS));
	}
};
