import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";
import * as sorters from "./sorters";

export class CollectionIndex<A extends Record<string, any>> {
	private map: Map<string | undefined, Set<A>>;
	private getKey: (record: A) => string | undefined;

	constructor(getKey: (record: A) => string | undefined) {
		this.map = new Map<string | undefined, Set<A>>();
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

	lookup(key: string | undefined): Array<A> {
		let set = this.map.get(key);
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

	update(last: A, next: A): void {
		this.remove(last);
		this.insert(next);
	}

	static from<A>(records: Iterable<A>, getKey: (record: A) => string | undefined): CollectionIndex<A> {
		let index = new CollectionIndex<A>(getKey);
		for (let record of records) {
			index.insert(record);
		}
		return index;
	}

	static fromIndex<A, B>(parent: RecordIndex<A>, child: RecordIndex<B>, getParentKey: (record: A) => string | undefined, getChildKey: (record: B) => string | undefined): CollectionIndex<B> {
		let index = new CollectionIndex<B>(getChildKey);
		child.on("insert", (event) => {
			index.insert(event.next);
		});
		child.on("remove", (event) => {
			index.remove(event.last);
		});
		child.on("update", (event) => {
			index.update(event.last, event.next);
		});
		parent.on("remove", (event) => {
			let key = getParentKey(event.last);
			for (let record of index.lookup(key)) {
				child.remove(record);
			}
		});
		return index;
	}
};

type RecordIndexEventMap<A> = {
	"*": {},
	"insert": {
		next: A
	},
	"remove": {
		last: A
	},
	"update": {
		last: A,
		next: A
	}
};

export class RecordIndex<A extends Record<string, any>> {
	private map: Map<string | undefined, A>;
	private getKey: (record: A) => string | undefined;
	private router: stdlib.routing.MessageRouter<RecordIndexEventMap<A>>;

	private insertOrUpdate(next: A, action: "combine" | "replace" = "replace"): void {
		let key = this.getKey(next);
		let last = this.map.get(key);
		if (is.present(last)) {
			if (action === "combine") {
				for (let key in last) {
					let lastValue = last[key];
					let nextValue = next[key];
					if (is.present(lastValue) && is.absent(nextValue)) {
						next[key] = last[key];
					}
				}
			}
			this.map.set(key, next);
			this.router.route("update", { last, next });
			this.router.route("*", {});
		} else {
			this.map.set(key, next);
			this.router.route("insert", { next });
			this.router.route("*", {});
		}
	}

	constructor(getKey: (record: A) => string | undefined) {
		this.map = new Map<string | undefined, A>();
		this.getKey = getKey;
		this.router = new stdlib.routing.MessageRouter<RecordIndexEventMap<A>>();
	}

	[Symbol.iterator](): Iterator<A> {
		return this.map.values();
	}

	insert(record: A, action: "combine" | "replace" = "replace"): void {
		this.insertOrUpdate(record, action);
	}

	length(): number {
		return this.map.size;
	}

	lookup(key: string | undefined): A {
		let record = this.map.get(key);
		if (is.absent(record)) {
			throw `Expected "${key}" to match a record!`;
		}
		return record;
	}

	on<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
		if (type === "insert") {
			for (let record of this.map.values()) {
				(listener as stdlib.routing.MessageObserver<RecordIndexEventMap<A>["insert"]>)({ next: record });
			}
		}
	}

	off<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
	}

	remove(record: A): void {
		let key = this.getKey(record);
		if (this.map.has(key)) {
			this.map.delete(key);
			this.router.route("remove", { last: record });
			this.router.route("*", {});
		}
	}

	update(record: A, action: "combine" | "replace" = "replace"): void {
		this.insertOrUpdate(record, action);
	}

	static from<A>(records: Iterable<A>, getKey: (record: A) => string | undefined): RecordIndex<A> {
		let index = new RecordIndex<A>(getKey);
		for (let record of records) {
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
	normalized = normalized.normalize("NFKD");
	normalized = normalized.replace(/[\p{M}]/gu, "");
	return Array.from(normalized.match(/(\p{L}+|\p{N}+)/gu) ?? [])
		.filter((value) => value.length >= 2);
};

export class SearchIndex<A extends Record<string, any>> {
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

	update(last: A, next: A): void {
		this.remove(last);
		this.insert(next);
	}

	static from<A>(records: Iterable<A>, getFields: (record: A) => Array<string>): SearchIndex<A> {
		let searchIndex = new SearchIndex<A>(getFields);
		for (let record of records) {
			searchIndex.insert(record);
		}
		return searchIndex;
	}

	static fromIndex<A>(records: RecordIndex<A>, getFields: (record: A) => Array<string>): SearchIndex<A> {
		let index = new SearchIndex<A>(getFields);
		records.on("insert", (event) => {
			index.insert(event.next);
		});
		records.on("remove", (event) => {
			index.remove(event.last);
		});
		records.on("update", (event) => {
			index.update(event.last, event.next);
		});
		return index;
	}
};
