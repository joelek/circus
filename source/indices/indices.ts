import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";
import * as sorters from "./sorters";

export class CollectionIndex<A> {
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

	lookup(query: string | undefined): Array<A> {
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

	static from<A>(records: Iterable<A>, getKey: (record: A) => string | undefined): CollectionIndex<A> {
		let index = new CollectionIndex<A>(getKey);
		for (let record of records) {
			index.insert(record);
		}
		return index;
	}

	static fromIndex<A>(records: RecordIndex<A>, getKey: (record: A) => string | undefined): CollectionIndex<A> {
		let index = new CollectionIndex<A>(getKey);
		records.on("insert", (record) => {
			index.insert(record);
		});
		records.on("remove", (record) => {
			index.remove(record);
		})
		return index;
	}
};

type RecordIndexEventMap<A> = {
	"insert": A,
	"remove": A,
	"update": A
};

export class RecordIndex<A> {
	private map: Map<string | undefined, A>;
	private getKey: (record: A) => string | undefined;
	private router: stdlib.routing.MessageRouter<RecordIndexEventMap<A>>;

	constructor(getKey: (record: A) => string | undefined) {
		this.map = new Map<string | undefined, A>();
		this.getKey = getKey;
		this.router = new stdlib.routing.MessageRouter<RecordIndexEventMap<A>>();
	}

	[Symbol.iterator](): Iterator<A> {
		return this.map.values();
	}

	insert(record: A): void {
		let key = this.getKey(record);
		if (this.map.has(key)) {
			this.map.set(key, record);
			this.router.route("update", record);
		} else {
			this.map.set(key, record);
			this.router.route("insert", record);
		}
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
				listener(record);
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
			this.router.route("remove", record);
		}
	}

	update(record: A): void {
		let key = this.getKey(record);
		if (this.map.has(key)) {
			this.map.set(key, record);
			this.router.route("update", record);
		} else {
			this.map.set(key, record);
			this.router.route("insert", record);
		}
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

	static from<A>(records: Iterable<A>, getFields: (record: A) => Array<string>): SearchIndex<A> {
		let searchIndex = new SearchIndex<A>(getFields);
		for (let record of records) {
			searchIndex.insert(record);
		}
		return searchIndex;
	}

	static fromIndex<A>(records: RecordIndex<A>, getFields: (record: A) => Array<string>): SearchIndex<A> {
		let index = new SearchIndex<A>(getFields);
		records.on("insert", (record) => {
			index.insert(record);
		});
		records.on("remove", (record) => {
			index.remove(record);
		});
		return index;
	}
};
