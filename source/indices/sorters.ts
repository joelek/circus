import * as is from "../is";

type Ranker<A> = (one: A, two: A) => number;

export const CombinedSort = {
	of<A>(...rankers: Ranker<A>[]): Ranker<A> {
		return (one, two) => {
			for (let ranker of rankers) {
				let rank = ranker(one, two);
				if (rank !== 0) {
					return rank;
				}
			}
			return 0;
		};
	}
};

export const LexicalSort = {
	decreasing<A>(getField: (value: A) => string | null | undefined): Ranker<A> {
		return (one, two) => {
			let o = getField(one);
			let t = getField(two);
			if (is.absent(o)) {
				if (is.absent(t)) {
					return 0;
				} else {
					return -1;
				}
			}
			if (is.absent(t)) {
				if (is.absent(o)) {
					return 0;
				} else {
					return 1;
				}
			}
			return t.localeCompare(o);
		};
	},
	increasing<A>(getField: (value: A) => string | null | undefined): Ranker<A> {
		return (one, two) => {
			let o = getField(one);
			let t = getField(two);
			if (is.absent(o)) {
				if (is.absent(t)) {
					return 0;
				} else {
					return 1;
				}
			}
			if (is.absent(t)) {
				if (is.absent(o)) {
					return 0;
				} else {
					return -1;
				}
			}
			return o.localeCompare(t);
		};
	}
};

export const NumericSort = {
	decreasing<A>(getField: (value: A) => number | null | undefined): Ranker<A> {
		return (one, two) => {
			let o = getField(one);
			let t = getField(two);
			if (is.absent(o)) {
				if (is.absent(t)) {
					return 0;
				} else {
					return -1;
				}
			}
			if (is.absent(t)) {
				if (is.absent(o)) {
					return 0;
				} else {
					return 1;
				}
			}
			return t - o;
		};
	},
	increasing<A>(getField: (value: A) => number | null | undefined): Ranker<A> {
		return (one, two) => {
			let o = getField(one);
			let t = getField(two);
			if (is.absent(o)) {
				if (is.absent(t)) {
					return 0;
				} else {
					return 1;
				}
			}
			if (is.absent(t)) {
				if (is.absent(o)) {
					return 0;
				} else {
					return -1;
				}
			}
			return o - t;
		};
	}
};
