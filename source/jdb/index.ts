import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";
import { sorters } from "../jsondb";

function computeHash(value: boolean | null | number | string | undefined): string {
	if (is.absent(value)) {
		return "0000000000000000";
	}
	return libcrypto.createHash("sha256")
		.update(String(value))
		.digest("hex")
		.slice(0, 16);
}

function* filter<A>(iterable: Iterable<A>, predicate: (value: A, index: number) => boolean): Iterable<A> {
	let index = 0;
	for (let value of iterable) {
		if (predicate(value, index++)) {
			yield value;
		}
	}
}

function* include<A, B extends A>(iterable: Iterable<A>, predicate: (value: A, index: number) => value is B): Iterable<B> {
	let index = 0;
	for (let value of iterable) {
		if (predicate(value, index++)) {
			yield value;
		}
	}
}

function* map<A, B>(iterable: Iterable<A>, transform: (value: A, index: number) => B): Iterable<B> {
	let index = 0;
	for (let value of iterable) {
		yield transform(value, index++);
	}
}

class StreamIterable<A> {
	private values: Iterable<A>;

	private constructor(values: Iterable<A>) {
		this.values = values;
	}

	[Symbol.iterator](): Iterator<A> {
		return this.values[Symbol.iterator]();
	}

	collect(): Array<A> {
		return Array.from(this.values);
	}

	filter(predicate: (value: A, index: number) => boolean): StreamIterable<A> {
		return new StreamIterable<A>(filter(this.values, predicate));
	}

	find(predicate: (value: A, index: number) => boolean): A | undefined {
		let index = 0;
		for (let value of this.values) {
			if (predicate(value, index++)) {
				return value;
			}
		}
	}

	include<B extends A>(predicate: (value: A, index: number) => value is B): StreamIterable<B> {
		return new StreamIterable<B>(include(this.values, predicate));
	}

	includes(predicate: (value: A, index: number) => boolean): boolean {
		let index = 0;
		for (let value of this.values) {
			if (predicate(value, index++)) {
				return true;
			}
		}
		return false;
	}

	map<B>(transform: (value: A, index: number) => B): StreamIterable<B> {
		return new StreamIterable(map(this.values, transform));
	}

	slice(start?: number, end?: number): StreamIterable<A> {
		let array = this.collect().slice(start, end);
		return new StreamIterable(array);
	}

	sort(comparator?: (one: A, two: A) => number): StreamIterable<A> {
		let array = this.collect().sort(comparator);
		return new StreamIterable(array);
	}

	unique(): StreamIterable<A> {
		return new StreamIterable(new Set(this.values));
	}

	static of<A>(values: Iterable<A> | undefined): StreamIterable<A> {
		return new StreamIterable<A>(values ?? new Array<A>());
	}
}

function readBuffer(fd: number, buffer: Buffer, position?: number): Buffer {
	let bytes = libfs.readSync(fd, buffer, 0, buffer.length, position ?? null);
	if (bytes !== buffer.length) {
		throw `Expected to read ${buffer.length} bytes but read ${bytes}!`;
	}
	return buffer;
}

function writeBuffer(fd: number, buffer: Buffer, position?: number): Buffer {
	let bytes = libfs.writeSync(fd, buffer, 0, buffer.length, position ?? null);
	if (bytes !== buffer.length) {
		throw `Expected to write ${buffer.length} bytes but wrote ${bytes}!`;
	}
	return buffer;
}

export class RecordIndexHeader {
	private buffer: Buffer;

	get identifier(): string {
		return this.buffer.slice(0, 8).toString("binary");
	}

	get chunk_size_minus_one(): number {
		return this.buffer.readUInt32BE(8);
	}

	set chunk_size_minus_one(value: number) {
		this.buffer.writeUInt32BE(value, 8);
	}

	get chunk_size(): number {
		return this.chunk_size_minus_one + 1;
	}

	set chunk_size(value: number) {
		this.chunk_size_minus_one = value - 1;
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		buffer.write("\x23\x52\xDB\x07\xEC\x77\x30\x61", 0, "binary");
		buffer.writeUInt32BE(255, 8);
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		readBuffer(fd, this.buffer, position);
		let identifier = this.buffer.slice(0, 8).toString("binary");
		if (identifier !== this.identifier) {
			throw `Unsupported file format!`;
		}
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

export class RecordIndexEntry {
	private buffer: Buffer;

	get key(): string {
		return this.buffer.slice(0, 8).toString("hex");
	}

	set key(value: string) {
		if (!/^[0-9a-f]{16}$/.test(value)) {
			throw `Invalid key, ${value}!`;
		}
		this.buffer.set(Buffer.from(value, "hex"), 0);
	}

	get chunk_offset(): number {
		return this.buffer.readUInt32BE(8);
	}

	set chunk_offset(value: number) {
		this.buffer.writeUInt32BE(value, 8);
	}

	get chunk_length_minus_one(): number {
		return this.buffer.readUInt32BE(12);
	}

	set chunk_length_minus_one(value: number) {
		this.buffer.writeUInt32BE(value, 12);
	}

	get chunk_length(): number {
		return this.chunk_length_minus_one + 1;
	}

	set chunk_length(value: number) {
		this.chunk_length_minus_one = value - 1;
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		readBuffer(fd, this.buffer, position);
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

export type RecordIndexEventMap<A> = {
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

export type RecordKeyProvider<A> = (record: A) => string;

export class Table<A extends Record<string, any>> {
	private toc: number;
	private bin: number;
	private header: RecordIndexHeader;
	private indexFromKey: Record<string, number | undefined>;
	private router: stdlib.routing.MessageRouter<RecordIndexEventMap<A>>;
	private guard: autoguard.serialization.MessageGuard<A>;
	private key_provider: RecordKeyProvider<A>;
	private cache: Map<number, A>;
	private cache_list: Set<number>;
	private free_entries: Map<number, Set<number>>;

	private getNumberOfEntries(): number {
		let entry_count = libfs.fstatSync(this.toc).size / 16 - 1;
		if (!Number.isInteger(entry_count)) {
			throw `Expected a non-fractional number of entries!`;
		}
		return entry_count;
	}

	private readEntry(index: number, entry: RecordIndexEntry = new RecordIndexEntry()): RecordIndexEntry {
		entry.read(this.toc, 16 + index * 16);
		return entry;
	}

	private getEntryFor(chunk_length: number, key: string): number {
		let free_entry_set = this.free_entries.get(chunk_length);
		if (is.present(free_entry_set)) {
			for (let entry_index of free_entry_set) {
				let entry = this.readEntry(entry_index);
				entry.key = key;
				entry.write(this.toc, 16 + entry_index * 16);
				free_entry_set.delete(entry_index);
				return entry_index;
			}
		}
		let entry_index = this.getNumberOfEntries();
		let entry = new RecordIndexEntry();
		entry.chunk_offset = Math.ceil(libfs.fstatSync(this.bin).size / this.header.chunk_size);
		entry.chunk_length = chunk_length;
		entry.key = key;
		entry.write(this.toc, 16 + entry_index * 16);
		return entry_index;
	}

	private getRecord(index: number): A {
		let record = this.cache.get(index);
		if (is.present(record)) {
			this.cache_list.delete(index);
			this.cache_list.add(index);
			return record;
		}
		let entry = this.readEntry(index);
		if (entry.key === "0000000000000000") {
			throw `Expected ${index} to match a record!`;
		}
		let position = entry.chunk_offset * this.header.chunk_size;
		let buffer = readBuffer(this.bin, Buffer.alloc(entry.chunk_length * this.header.chunk_size), position);
		let string = buffer.toString().replace(/[\0]+$/, "");
		let json = JSON.parse(string);
		record = this.guard.as(json);
		this.cache.set(index, record);
		this.cache_list.add(index);
		if (this.cache_list.size > 100000) {
			for (let idx of this.cache_list) {
				this.cache.delete(idx);
				this.cache_list.delete(idx);
				break;
			}
		}
		return record;
	}

	private insertOrUpdate(next: A): void {
		let serialized = Buffer.from(JSON.stringify(next));
		let chunks = Math.max(1, Math.ceil(serialized.length / this.header.chunk_size));
		let key = this.key_provider(next);
		let index = this.indexFromKey[key];
		if (is.present(index)) {
			let last = this.getRecord(index);
			let entry = this.readEntry(index);
			if (chunks <= entry.chunk_length) {
				let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
				buffer.set(serialized, 0);
				writeBuffer(this.bin, buffer, entry.chunk_offset * this.header.chunk_size);
			} else {
				{
					let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
					writeBuffer(this.bin, buffer, entry.chunk_offset * this.header.chunk_size);
					delete this.indexFromKey[key];
					entry.key = "0000000000000000";
					entry.write(this.toc, 16 + index * 16);
					let free_entry_set = this.free_entries.get(entry.chunk_length);
					if (is.absent(free_entry_set)) {
						free_entry_set = new Set<number>();
						this.free_entries.set(entry.chunk_length, free_entry_set);
					}
					free_entry_set.add(index);
				}
				{
					let entry_index = this.getEntryFor(chunks, key);
					let entry = this.readEntry(entry_index);
					let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
					buffer.set(serialized, 0);
					writeBuffer(this.bin, buffer, entry.chunk_offset * this.header.chunk_size);
					this.indexFromKey[key] = entry_index;
				}
			}
			this.cache.set(index, next);
			this.router.route("update", {
				last: last,
				next: next
			});
			return;
		}
		let entry_index = this.getEntryFor(chunks, key);
		let entry = this.readEntry(entry_index);
		let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
		buffer.set(serialized, 0);
		writeBuffer(this.bin, buffer, entry.chunk_offset * this.header.chunk_size);
		this.indexFromKey[key] = entry_index;
		this.router.route("insert", {
			next: next
		});
	}

	constructor(root: Array<string>, table_name: string, guard: autoguard.serialization.MessageGuard<A>, key_provider: RecordKeyProvider<A>) {
		let directory = [ ...root, table_name ];
		if (!libfs.existsSync(directory.join("/"))) {
			libfs.mkdirSync(directory.join("/"), { recursive: true });
		}
		let toc_filename = [...directory, "toc"];
		let toc_exists = libfs.existsSync(toc_filename.join("/"));
		let toc = libfs.openSync(toc_filename.join("/"), toc_exists ? "r+" : "w+");
		let bin_filename = [...directory, "bin"];
		let bin_exists = libfs.existsSync(bin_filename.join("/"));
		let bin = libfs.openSync(bin_filename.join("/"), bin_exists ? "r+" : "w+");
		let indexFromKey = {} as Record<string, number | undefined>;
		let header = new RecordIndexHeader();
		let free_entries = new Map<number, Set<number>>();
		if (toc_exists) {
			header.read(toc, 0);
			let entry_count = libfs.fstatSync(toc).size / 16 - 1;
			if (!Number.isInteger(entry_count)) {
				throw `Expected a non-fractional number of entries!`;
			}
			let entry = new RecordIndexEntry();
			for (let index = 0; index < entry_count; index++) {
				entry.read(toc, 16 + index * 16);
				if (entry.key !== "0000000000000000") {
					indexFromKey[entry.key] = index;
				} else {
					let free_entry_set = free_entries.get(entry.chunk_length);
					if (is.absent(free_entry_set)) {
						free_entry_set = new Set<number>();
						free_entries.set(entry.chunk_length, free_entry_set);
					}
					free_entry_set.add(index);
				}
			}
		} else {
			header.write(toc, 0);
		}
		this.toc = toc;
		this.bin = bin;
		this.header = header;
		this.indexFromKey = indexFromKey;
		this.router = new stdlib.routing.MessageRouter<RecordIndexEventMap<A>>();
		this.guard = guard;
		this.key_provider = key_provider;
		this.cache = new Map<number, A>();
		this.cache_list = new Set<number>();
		this.free_entries = free_entries;
	}

	destroy(): void {
		libfs.closeSync(this.toc);
		libfs.closeSync(this.bin);
	}

	*[Symbol.iterator](): Iterator<A> {
		let index = 0;
		while (index < this.getNumberOfEntries()) {
			try {
				yield this.getRecord(index++);
			} catch (error) {}
		}
	}

	insert(record: A): void {
		this.insertOrUpdate(record);
	}

	keyof(record: A): string {
		return this.key_provider(record);
	}

	length(): number {
		return this.getNumberOfEntries();
	}

	lookup(key: string | undefined): A {
		let index = this.indexFromKey[key ?? "0000000000000000"];
		if (is.present(index)) {
			let record = this.getRecord(index);
			if (this.key_provider(record) === key) {
				return record;
			}
		}
		throw `Expected ${key} to match a record!`;
	}

	on<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
	}

	off<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
	}

	remove(record: A): void {
		let key = this.key_provider(record);
		let index = this.indexFromKey[key];
		if (is.present(index)) {
			let last = this.getRecord(index);
			if (this.key_provider(last) === key) {
				let entry = this.readEntry(index);
				let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
				let position = entry.chunk_offset * this.header.chunk_size;
				writeBuffer(this.bin, buffer, position);
				this.cache.delete(index);
				this.cache_list.delete(index);
				delete this.indexFromKey[key];
				entry.key = Buffer.alloc(8).toString("hex");
				entry.write(this.toc, 16 + index * 16);
				let free_entry_set = this.free_entries.get(entry.chunk_length);
				if (is.absent(free_entry_set)) {
					free_entry_set = new Set<number>();
					this.free_entries.set(entry.chunk_length, free_entry_set);
				}
				free_entry_set.add(index);
				this.router.route("remove", {
					last: last
				});
			}
		}
	}

	update(record: A): void {
		this.insertOrUpdate(record);
	}
};

export class IndexHeader {
	private buffer: Buffer;

	get identifier(): string {
		return this.buffer.slice(0, 8).toString("binary");
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		buffer.write("\x01\xfb\x2e\x28\x8a\xa7\x98\x76", 0, "binary");
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		readBuffer(fd, this.buffer, position);
		let identifier = this.buffer.slice(0, 8).toString("binary");
		if (identifier !== this.identifier) {
			throw `Unsupported file format!`;
		}
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

export class IndexEntry {
	private buffer: Buffer;

	get hash(): string {
		return this.buffer.slice(0, 8).toString("hex");
	}

	set hash(value: string) {
		if (!/^[0-9a-f]{16}$/.test(value)) {
			throw `Invalid group key, ${value}!`;
		}
		this.buffer.set(Buffer.from(value, "hex"), 0);
	}

	get key(): string {
		return this.buffer.slice(8, 8 + 8).toString("hex");
	}

	set key(value: string) {
		if (!/^[0-9a-f]{16}$/.test(value)) {
			throw `Invalid key, ${value}!`;
		}
		this.buffer.set(Buffer.from(value, "hex"), 8);
	}

	get is_free(): boolean {
		return /^[0]{16}$/.test(this.buffer.toString("hex"));
	}

	set is_free(value: boolean) {
		if (value) {
			this.buffer.fill(0);
		}
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		readBuffer(fd, this.buffer, position);
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

export type GroupKeyProvider<A> = (record: A) => Array<boolean | null | number | string | undefined>;
export type RecordProvider<A> = (key: string) => A;
export type TokenProvider = (value: boolean | null | number | string | undefined) => Array<boolean | null | number | string | undefined>;

export type SearchResult<A> = {
	id: string;
	rank: number;
};

export class Index<A> {
	private fd: number;
	private getKeysFromHash: Map<string, Set<string>>;
	private getRecordFromKey: RecordProvider<A>;
	private getValues: GroupKeyProvider<A>;
	private getKey: RecordKeyProvider<A>;
	private getTokensFromValue: TokenProvider;
	private freeSlots: Array<number>;
	private getIndexFromHashAndKey: Map<string, number>;

	constructor(root: Array<string>, index_name: string, getRecordFromKey: RecordProvider<A>, getValues: GroupKeyProvider<A>, getRecordKey: RecordKeyProvider<A>, getQueryTokens: TokenProvider) {
		let directory = [...root, index_name];
		if (!libfs.existsSync(directory.join("/"))) {
			libfs.mkdirSync(directory.join("/"), { recursive: true });
		}
		let setFilename = [...directory, "set"];
		let setExists = libfs.existsSync(setFilename.join("/"));
		let fd = libfs.openSync(setFilename.join("/"), setExists ? "r+" : "w+");
		let getRecordKeysFromGroupKey = new Map<string, Set<string>>();
		let freeSlots = new Array<number>();
		let getIndexFromKeys = new Map<string, number>();
		let header = new IndexHeader();
		if (setExists) {
			header.read(fd, 0);
			let length = (libfs.fstatSync(fd).size - 16) / 16;
			if (!Number.isInteger(length)) {
				throw `Expected an integer length!`;
			}
			for (let index = 0; index < length; index++) {
				let entry = new IndexEntry();
				entry.read(fd, 16 + index * 16);
				if (entry.is_free) {
					freeSlots.push(index);
				} else {
					let groupKey = entry.hash;
					let recordKey = entry.key;
					let recordKeys = getRecordKeysFromGroupKey.get(groupKey);
					if (is.absent(recordKeys)) {
						recordKeys = new Set<string>();
						getRecordKeysFromGroupKey.set(groupKey, recordKeys);
					}
					recordKeys.add(recordKey);
					getIndexFromKeys.set(groupKey + recordKey, index);
				}
			}
		} else {
			header.write(fd, 0);
		}
		this.fd = fd;
		this.getKeysFromHash = getRecordKeysFromGroupKey;
		this.getRecordFromKey = getRecordFromKey;
		this.getValues = getValues;
		this.getKey = getRecordKey;
		this.getTokensFromValue = getQueryTokens;
		this.freeSlots = freeSlots;
		this.getIndexFromHashAndKey = getIndexFromKeys;
	}

	destroy(): void {
		libfs.closeSync(this.fd);
	}

	insert(record: A): void {
		for (let value of this.getValues(record)) {
			for (let token of this.getTokensFromValue(value)) {
				let hash = computeHash(token);
				let keys = this.getKeysFromHash.get(hash);
				if (is.absent(keys)) {
					keys = new Set<string>();
					this.getKeysFromHash.set(hash, keys);
				}
				let key = this.getKey(record);
				if (!keys.has(key)) {
					let index = this.freeSlots.pop() ?? this.length();
					let entry = new IndexEntry();
					entry.hash = hash;
					entry.key = key;
					entry.write(this.fd, 16 + index * 16);
					keys.add(key);
					this.getIndexFromHashAndKey.set(hash + key, index);
				}
			}
		}
	}

	length(): number {
		let size = libfs.fstatSync(this.fd).size;
		let length = (size - 16) / 16;
		if (!Number.isInteger(length)) {
			throw `Expected an integer length!`;
		}
		return length;
	}

	lookup(value: boolean | null | number | string | undefined): StreamIterable<A> {
		return this.search(value).map((result) => this.getRecordFromKey(result.id));
	}

	remove(record: A): void {
		for (let value of this.getValues(record)) {
			for (let token of this.getTokensFromValue(value)) {
				let hash = computeHash(token);
				let keys = this.getKeysFromHash.get(hash);
				if (is.present(keys)) {
					let key = this.getKey(record);
					if (keys.has(key)) {
						let index = this.getIndexFromHashAndKey.get(hash + key);
						if (is.absent(index)) {
							throw `Expected an index!`;
						}
						let entry = new IndexEntry();
						entry.is_free = true;
						entry.write(this.fd, 16 + index * 16);
						keys.delete(key);
						if (keys.size === 0) {
							this.getKeysFromHash.delete(hash);
						}
						this.getIndexFromHashAndKey.delete(hash + key);
						this.freeSlots.push(index);
					}
				}
			}
		}
	}

	search(value: boolean | null | number | string | undefined): StreamIterable<SearchResult<A>> {
		let sets = this.getTokensFromValue(value)
			.map((token) => computeHash(token))
			.map((hash) => this.getKeysFromHash.get(hash))
			.filter(is.present);
		let map = new Map<string, number>();
		for (let keys of sets) {
			for (let key of keys) {
				let rank = map.get(key) ?? (0 - sets.length);
				map.set(key, rank + 2);
			}
		}
		return StreamIterable.of(map.entries())
			.filter((entry) => entry[1] >= 0)
			.sort(sorters.NumericSort.decreasing((entry) => entry[1]))
			.map((entry) => ({
				id: entry[0],
				rank:  entry[1]
			}));
	}

	update(last: A, next: A): void {
		this.remove(last);
		this.insert(next);
	}

	static QUERY_TOKENIZER: TokenProvider = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFKD");
		normalized = normalized.replace(/[\p{M}]/gu, "");
		return Array.from(normalized.match(/(\p{L}+|\p{N}+)/gu) ?? []);
	};

	static VALUE_TOKENIZER: TokenProvider = (value) => {
		return [ value ];
	};
};
