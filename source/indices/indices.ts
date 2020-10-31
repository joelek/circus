import * as is from "../is";
import * as sorters from "./sorters";

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

export class CollectionIndex<A> {
	private map: Map<string, Set<A>>;
	private getKey: (record: A) => string;

	constructor(getKey: (record: A) => string) {
		this.map = new Map<string, Set<A>>();
		this.getKey = getKey;
	}

	insert(record: A): void {
		let key = this.getKey(record);
		let set = this.map.get(key);
		if (is.absent(set)) {
			set = new Set<A>();
			this.map.set(key, set);
		}
		set.add(record);
	}

	lookup(query: string): Array<A> {
		let set = this.map.get(query);
		if (is.present(set)) {
			return Array.from(set);
		}
		return new Array<A>();
	}

	remove(record: A): void {
		let key = this.getKey(record);
		let set = this.map.get(key);
		if (is.present(set)) {
			set.delete(record);
			if (set.size === 0) {
				this.map.delete(key);
			}
		}
	}

	static from<A>(collection: Iterable<A>, getKey: (record: A) => string): CollectionIndex<A> {
		let index = new CollectionIndex<A>(getKey);
		for (let record of collection) {
			index.insert(record);
		}
		return index;
	}
};

export class RecordIndex<A> {
	private map: Map<string, A>;
	private getKey: (record: A) => string;

	constructor(getKey: (record: A) => string) {
		this.map = new Map<string, A>();
		this.getKey = getKey;
	}

	insert(record: A): void {
		let key = this.getKey(record);
		this.map.set(key, record);
	}

	lookup(query: string): A {
		let record = this.map.get(query);
		if (is.absent(record)) {
			throw `Expected "${query}" to match a record!`;
		}
		return record;
	}

	remove(record: A): void {
		let key = this.getKey(record);
		this.map.delete(key);
	}

	static from<A>(collection: Iterable<A>, getKey: (record: A) => string): RecordIndex<A> {
		let index = new RecordIndex<A>(getKey);
		for (let record of collection) {
			index.insert(record);
		}
		return index;
	}
};

export type SearchResult<A> = {
	record: A,
	rank: number
};

export function getTokens(query: string): Array<string> {
	let normalized = query;
	normalized = normalized.toLowerCase();
	normalized = normalized.normalize("NFC");
	return Array.from(normalized.match(/(\p{L}+|\p{N}+)/gu) ?? [])
		.filter((value) => value.length >= 2);
};

export class SearchIndex<A> {
	private map: Map<string, Set<A>>;
	private getFields: (record: A) => Array<string>;

	constructor(getFields: (record: A) => Array<string>) {
		this.map = new Map<string, Set<A>>();
		this.getFields = getFields;
	}

	insert(record: A): void {
		for (let value of this.getFields(record)) {
			let tokens = getTokens(value);
			for (let token of tokens) {
				let set = this.map.get(token);
				if (is.absent(set)) {
					set = new Set<A>();
					this.map.set(token, set);
				}
				set.add(record);
			}
		}
	}

	lookup(query: string): Array<SearchResult<A>> {
		let tokens = getTokens(query);
		let sets = tokens.map((token) => {
			return this.map.get(token);
		}).filter(is.present);
		let map = new Map<A, number>();
		for (let set of sets) {
			for (let id of set) {
				let rank = map.get(id) ?? (0 - tokens.length);
				map.set(id, rank + 2);
			}
		}
		return Array.from(map.entries())
			.filter((entry) => entry[1] >= 0)
			.sort(sorters.NumericSort.increasing((entry) => entry[1]))
			.map((entry) => ({
				record: entry[0],
				rank: entry[1]
			}));
	}

	remove(record: A): void {
		for (let value of this.getFields(record)) {
			let tokens = getTokens(value);
			for (let token of tokens) {
				let set = this.map.get(token);
				if (is.present(set)) {
					set.delete(record);
					if (set.size === 0) {
						this.map.delete(token);
					}
				}
			}
		}
	}

	static from<A>(collection: Iterable<A>, getFields: (record: A) => Array<string>): SearchIndex<A> {
		let searchIndex = new SearchIndex<A>(getFields);
		for (let record of collection) {
			searchIndex.insert(record);
		}
		return searchIndex;
	}
};
