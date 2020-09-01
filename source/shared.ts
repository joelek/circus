export const NumericSort = {
	decreasing<A extends { [key in B]: number | null | undefined }, B extends keyof A>(key: B): { (one: A, two: A): number } {
		return (one, two) => {
			let o = one[key] as number | null | undefined;
			let t = two[key] as number | null | undefined;
			if (o == null) {
				if (t == null) {
					return 0;
				} else {
					return -1;
				}
			}
			if (t == null) {
				if (o == null) {
					return 0;
				} else {
					return 1;
				}
			}
			return t - o;
		};
	},
	increasing<A extends { [key in B]: number | null | undefined }, B extends keyof A>(key: B): { (one: A, two: A): number } {
		return (one, two) => {
			let o = one[key] as number | null | undefined;
			let t = two[key] as number | null | undefined;
			if (o == null) {
				if (t == null) {
					return 0;
				} else {
					return 1;
				}
			}
			if (t == null) {
				if (o == null) {
					return 0;
				} else {
					return -1;
				}
			}
			return o - t;
		};
	}
};
