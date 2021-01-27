import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";
import * as sorters from "./sorters";

export class CollectionIndex<A extends Record<string, any>> {
	private getPrimaryKeysFromIndexedValue: Map<string | undefined, Set<string | undefined>>;
	private lookupRecord: (key: string | undefined) => A;
	private getPrimaryKey: (record: A) => string | undefined;
	private getIndexedValue: (record: A) => string | undefined;

	constructor(lookupRecord: (key: string | undefined) => A, getPrimaryKey: (record: A) => string | undefined, getIndexedValue: (record: A) => string | undefined) {
		this.getPrimaryKeysFromIndexedValue = new Map<string | undefined, Set<string | undefined>>();
		this.lookupRecord = lookupRecord;
		this.getPrimaryKey = getPrimaryKey;
		this.getIndexedValue = getIndexedValue;
	}

	insert(record: A): void {
		let indexedValue = this.getIndexedValue(record);
		let primaryKeys = this.getPrimaryKeysFromIndexedValue.get(indexedValue);
		if (is.absent(primaryKeys)) {
			primaryKeys = new Set<string | undefined>();
			this.getPrimaryKeysFromIndexedValue.set(indexedValue, primaryKeys);
		}
		let primaryKey = this.getPrimaryKey(record);
		primaryKeys.add(primaryKey);
	}

	lookup(key: string | undefined): Array<A> {
		let primaryKeys = this.getPrimaryKeysFromIndexedValue.get(key);
		if (is.present(primaryKeys)) {
			return Array.from(primaryKeys).map(this.lookupRecord);
		}
		return new Array<A>();
	}

	remove(record: A): void {
		let indexedValue = this.getIndexedValue(record);
		let primaryKeys = this.getPrimaryKeysFromIndexedValue.get(indexedValue);
		if (is.present(primaryKeys)) {
			let primaryKey = this.getPrimaryKey(record);
			primaryKeys.delete(primaryKey);
			if (primaryKeys.size === 0) {
				this.getPrimaryKeysFromIndexedValue.delete(indexedValue);
			}
		}
	}

	update(last: A, next: A): void {
		this.remove(last);
		this.insert(next);
	}

	static fromIndex<A, B>(parent: RecordIndex<A>, child: RecordIndex<B>, getIndexedValue: (record: B) => string | undefined): CollectionIndex<B> {
		let index = new CollectionIndex<B>((key) => child.lookup(key), (record) => child.keyof(record), getIndexedValue);
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
			let key = parent.keyof(event.last);
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
	private getRecordFromKey: Map<string | undefined, A>;
	private getKey: (record: A) => string | undefined;
	private router: stdlib.routing.MessageRouter<RecordIndexEventMap<A>>;

	private insertOrUpdate(next: A, action: "combine" | "replace" = "replace"): void {
		let key = this.getKey(next);
		let last = this.getRecordFromKey.get(key);
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
			this.getRecordFromKey.set(key, next);
			this.router.route("update", { last, next });
			this.router.route("*", {});
		} else {
			this.getRecordFromKey.set(key, next);
			this.router.route("insert", { next });
			this.router.route("*", {});
		}
	}

	constructor(getKey: (record: A) => string | undefined) {
		this.getRecordFromKey = new Map<string | undefined, A>();
		this.getKey = getKey;
		this.router = new stdlib.routing.MessageRouter<RecordIndexEventMap<A>>();
	}

	[Symbol.iterator](): Iterator<A> {
		return this.getRecordFromKey.values();
	}

	insert(record: A, action: "combine" | "replace" = "replace"): void {
		this.insertOrUpdate(record, action);
	}

	keyof(record: A): string | undefined {
		return this.getKey(record);
	}

	length(): number {
		return this.getRecordFromKey.size;
	}

	lookup(key: string | undefined): A {
		let record = this.getRecordFromKey.get(key);
		if (is.absent(record)) {
			throw `Expected "${key}" to match a record!`;
		}
		return record;
	}

	on<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
		if (type === "insert") {
			for (let record of this.getRecordFromKey.values()) {
				(listener as stdlib.routing.MessageObserver<RecordIndexEventMap<A>["insert"]>)({ next: record });
			}
		}
	}

	off<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
	}

	remove(record: A): void {
		let key = this.getKey(record);
		if (this.getRecordFromKey.has(key)) {
			this.getRecordFromKey.delete(key);
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
	private getPrimaryKeysFromToken: Map<string | undefined, Set<string | undefined>>;
	private lookupRecord: (key: string | undefined) => A;
	private getPrimaryKey: (record: A) => string | undefined;
	private getIndexedValues: (record: A) => Array<string>;

	constructor(lookupRecord: (key: string | undefined) => A, getPrimaryKey: (record: A) => string | undefined, getIndexedValues: (record: A) => Array<string>) {
		this.getPrimaryKeysFromToken = new Map<string, Set<string | undefined>>();
		this.lookupRecord = lookupRecord;
		this.getPrimaryKey = getPrimaryKey;
		this.getIndexedValues = getIndexedValues;
	}

	insert(record: A): void {
		for (let value of this.getIndexedValues(record)) {
			let tokens = getTokens(value);
			for (let token of tokens) {
				let primaryKeys = this.getPrimaryKeysFromToken.get(token);
				if (is.absent(primaryKeys)) {
					primaryKeys = new Set<string | undefined>();
					this.getPrimaryKeysFromToken.set(token, primaryKeys);
				}
				let primaryKey = this.getPrimaryKey(record);
				primaryKeys.add(primaryKey);
			}
		}
	}

	lookup(query: string): Array<SearchResult<A>> {
		let tokens = getTokens(query);
		let primaryKeySets = tokens.map((token) => {
			return this.getPrimaryKeysFromToken.get(token);
		}).filter(is.present);
		let map = new Map<string | undefined, number>();
		for (let primaryKeys of primaryKeySets) {
			for (let primaryKey of primaryKeys) {
				let rank = map.get(primaryKey) ?? (0 - tokens.length);
				map.set(primaryKey, rank + 2);
			}
		}
		return Array.from(map.entries())
			.filter((entry) => entry[1] >= 0)
			.sort(sorters.NumericSort.increasing((entry) => entry[1]))
			.map((entry) => ({
				record: this.lookupRecord(entry[0]),
				rank: entry[1]
			}));
	}

	remove(record: A): void {
		for (let value of this.getIndexedValues(record)) {
			let tokens = getTokens(value);
			for (let token of tokens) {
				let primaryKeys = this.getPrimaryKeysFromToken.get(token);
				if (is.present(primaryKeys)) {
					let primaryKey = this.getPrimaryKey(record);
					primaryKeys.delete(primaryKey);
					if (primaryKeys.size === 0) {
						this.getPrimaryKeysFromToken.delete(token);
					}
				}
			}
		}
	}

	update(last: A, next: A): void {
		this.remove(last);
		this.insert(next);
	}

	static fromIndex<A>(records: RecordIndex<A>, getIndexedValues: (record: A) => Array<string>): SearchIndex<A> {
		let index = new SearchIndex<A>((key) => records.lookup(key), (record) => records.keyof(record), getIndexedValues);
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
