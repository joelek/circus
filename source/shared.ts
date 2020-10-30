import * as is from "./is";

export type Deferred<A> = A | undefined;

type Comparator<A> = (one: A, two: A) => number;

export const CombinedSort = {
	of<A>(...comparators: Comparator<A>[]): Comparator<A> {
		return (one, two) => {
			for (let comparator of comparators) {
				let rank = comparator(one, two);
				if (rank !== 0) {
					return rank;
				}
			}
			return 0;
		};
	}
};

export const LexicalSort = {
	decreasing<A>(getter: (value: A) => string | null | undefined): Comparator<A> {
		return (one, two) => {
			let o = getter(one);
			let t = getter(two);
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
	increasing<A>(getter: (value: A) => string | null | undefined): Comparator<A> {
		return (one, two) => {
			let o = getter(one);
			let t = getter(two);
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
	decreasing<A>(getter: (value: A) => number | null | undefined): Comparator<A> {
		return (one, two) => {
			let o = getter(one);
			let t = getter(two);
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
	increasing<A>(getter: (value: A) => number | null | undefined): Comparator<A> {
		return (one, two) => {
			let o = getter(one);
			let t = getter(two);
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
