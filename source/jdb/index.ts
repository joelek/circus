import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/autoguard";
import * as stdlib from "@joelek/stdlib";
import * as is from "../is";
import { sorters } from "../jsondb";

export function computeHash(value: boolean | null | number | string | undefined): string {
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

export class StreamIterable<A> {
	private values: Iterable<A>;

	private constructor(values: Iterable<A>) {
		this.values = values;
	}

	*[Symbol.iterator](): Iterator<A> {
		//yield* this.values;
		for (let value of this.values) {
			yield value;
		}
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

	shift(): A | undefined {
		for (let value of this.values) {
			return value;
		}
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
};

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
		buffer.writeUInt32BE(63, 8);
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
	private indexFromKey: Record<string, number | undefined>; // 70k elements tar 5mb, 2195857 elements tar 170mb
	private router: stdlib.routing.MessageRouter<RecordIndexEventMap<A>>;
	private guard: autoguard.serialization.MessageGuard<A>;
	private key_provider: RecordKeyProvider<A>;
	private cache: Map<number, A>;
	private free_entries: Set<number>;

	private getNumberOfEntries(): number {
		let entry_count = libfs.fstatSync(this.toc).size / 16 - 1;
		if (!Number.isInteger(entry_count)) {
			throw `Expected a non-fractional number of entries!`;
		}
		return entry_count;
	}

	private readEntry(index: number, entry: RecordIndexEntry): RecordIndexEntry {
		entry.read(this.toc, 16 + index * 16);
		return entry;
	}

	private getEntryFor(chunk_length: number, key: string): number {
		let entry = new RecordIndexEntry();
		for (let entry_index of this.free_entries) {
			this.readEntry(entry_index, entry);
			if (entry.chunk_length >= chunk_length || entry_index === this.getNumberOfEntries() - 1) {
				this.free_entries.delete(entry_index);
				entry.key = key;
				entry.chunk_length = Math.max(entry.chunk_length, chunk_length);
				entry.write(this.toc, 16 + entry_index * 16);
				return entry_index;
			}
		}
		let entry_index = this.getNumberOfEntries();
		entry.chunk_offset = Math.ceil(libfs.fstatSync(this.bin).size / this.header.chunk_size);
		entry.chunk_length = chunk_length;
		entry.key = key;
		entry.write(this.toc, 16 + entry_index * 16);
		return entry_index;
	}

	private getRecord(index: number): A {
		let record = this.cache.get(index);
		if (is.present(record)) {
			this.cache.delete(index);
			this.cache.set(index, record);
			return record;
		}
		let entry = new RecordIndexEntry();
		this.readEntry(index, entry);
		if (entry.key === "0000000000000000") {
			throw `Expected ${index} to match a record!`;
		}
		let position = entry.chunk_offset * this.header.chunk_size;
		let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
		readBuffer(this.bin, buffer, position);
		let end = buffer.length;
		while (end > 0) {
			if (buffer[end-1] !== 0) {
				break;
			}
			end -= 1;
		}
		let string = buffer.toString("utf8", 0, end);
		let json = JSON.parse(string);
		record = this.guard.as(json);
		this.cache.set(index, record);
		if (this.cache.size > 10000) {
			for (let idx of this.cache.keys()) {
				this.cache.delete(idx);
				break;
			}
		}
		return record;
	}

	private insertOrUpdate(next: A): void {
		let key = this.key_provider(next);
		let string = JSON.stringify(next);
		let binary = new TextEncoder().encode(string);
		let chunks = Math.max(1, Math.ceil(binary.length / this.header.chunk_size));
		let index = this.indexFromKey[key];
		if (is.present(index)) {
			let last = this.getRecord(index);
			let entry = this.readEntry(index, new RecordIndexEntry());
			if (chunks <= entry.chunk_length) {
				let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
				buffer.set(binary, 0);
				writeBuffer(this.bin, buffer, entry.chunk_offset * this.header.chunk_size);
			} else {
				let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
				writeBuffer(this.bin, buffer, entry.chunk_offset * this.header.chunk_size);
				delete this.indexFromKey[key];
				entry.key = "0000000000000000";
				entry.write(this.toc, 16 + index * 16);
				this.free_entries.add(index);
				index = this.getEntryFor(chunks * 2, key);
				entry = this.readEntry(index, new RecordIndexEntry());
				let buffer2 = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
				buffer2.set(binary, 0);
				writeBuffer(this.bin, buffer2, entry.chunk_offset * this.header.chunk_size);
				this.indexFromKey[key] = index;
			}
			this.cache.delete(index);
			this.cache.set(index, next);
			this.router.route("update", {
				last: last,
				next: next
			});
			return;
		}
		index = this.getEntryFor(chunks, key);
		let entry = this.readEntry(index, new RecordIndexEntry());
		let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
		buffer.set(binary, 0);
		writeBuffer(this.bin, buffer, entry.chunk_offset * this.header.chunk_size);
		this.indexFromKey[key] = index;
		this.cache.set(index, next);
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
		let free_entries = new Set<number>();
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
					free_entries.add(index);
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
		this.free_entries = free_entries;
	}

	destroy(): void {
		libfs.closeSync(this.toc);
		libfs.closeSync(this.bin);
	}

	*[Symbol.iterator](): Iterator<A> {
		for (let index = 0; index < this.getNumberOfEntries(); index++) {
			try {
				yield this.getRecord(index);
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
				let entry = this.readEntry(index, new RecordIndexEntry());
				let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
				let position = entry.chunk_offset * this.header.chunk_size;
				writeBuffer(this.bin, buffer, position);
				this.cache.delete(index);
				delete this.indexFromKey[key];
				entry.key = Buffer.alloc(8).toString("hex");
				entry.write(this.toc, 16 + index * 16);
				this.free_entries.add(index);
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

export type SearchResult = {
	id: string;
	rank: number;
};

export type IndexRecord = {
	id: string,
	keys: Array<string>
};

export const IndexRecord = autoguard.guards.Object.of<IndexRecord>({
	id: autoguard.guards.String,
	keys: autoguard.guards.Array.of(autoguard.guards.String)
});

function computePosition(key: string, keys: Array<string>, lower: number = 0, upper: number = keys.length - 1): number {
	let length = upper - lower + 1;
	let index = lower + Math.floor(length / 2);
	if (length > 0) {
		let compareKey = keys[index];
		if (key < compareKey) {
			return computePosition(key, keys, lower, index - 1);
		}
		if (key > compareKey) {
			return computePosition(key, keys, index + 1, upper);
		}
	}
	return index;
}

function insert(key: string, keys: Array<string>): void {
	let position = computePosition(key, keys);
	if (keys[position] !== key) {
		keys.splice(position, 0, key);
	}
}
function remove(key: string, keys: Array<string>): void {
	let position = computePosition(key, keys);
	if (keys[position] === key) {
		keys.splice(position, 1);
	}
}

export class Index<A> {
	private table: Table<IndexRecord>;
	private getRecordFromKey: RecordProvider<A>;
	private getValues: GroupKeyProvider<A>;
	private getKey: RecordKeyProvider<A>;
	private getTokensFromValue: TokenProvider;
	private maxGroupSize?: number;

	constructor(root: Array<string>, index_name: string, getRecordFromKey: RecordProvider<A>, getValues: GroupKeyProvider<A>, getRecordKey: RecordKeyProvider<A>, getQueryTokens: TokenProvider, maxGroupSize?: number) {
		this.table = new Table<IndexRecord>(root, index_name, IndexRecord, (record) => record.id);
		this.getRecordFromKey = getRecordFromKey;
		this.getValues = getValues;
		this.getKey = getRecordKey;
		this.getTokensFromValue = getQueryTokens;
		this.maxGroupSize = maxGroupSize;
	}

	insert(record: A): void {
		let key = this.getKey(record);
		for (let value of this.getValues(record)) {
			for (let token of this.getTokensFromValue(value)) {
				let hash = computeHash(token);
				let record: IndexRecord | undefined;
				try {
					record = this.table.lookup(hash);
				} catch (error) {}
				if (is.absent(record)) {
					record = {
						id: hash,
						keys: []
					};
				}
				let keys = record.keys;
				if (is.present(this.maxGroupSize) && keys.length >= this.maxGroupSize) {
					continue;
				}
				let position = computePosition(key, keys);
				if (keys[position] !== key) {
					keys.splice(position, 0, key);
					this.table.update(record);
				}
			}
		}
	}

	length(): number {
		return this.table.length();
	}

	lookup(value: boolean | null | number | string | undefined): StreamIterable<A> {
		return this.search(value).map((result) => this.getRecordFromKey(result.id));
	}

	remove(record: A): void {
		let key = this.getKey(record);
		for (let value of this.getValues(record)) {
			for (let token of this.getTokensFromValue(value)) {
				let hash = computeHash(token);
				let keys = new Array<string>();
				try {
					let record = this.table.lookup(hash);
					keys = record.keys;
				} catch (error) {}
				let position = computePosition(key, keys);
				if (keys[position] === key) {
					keys.splice(position, 1);
					if (keys.length > 0) {
						this.table.update({
							id: hash,
							keys: keys
						});
					} else {
						this.table.remove({
							id: hash,
							keys: keys
						});
					}
				}
			}
		}
	}

	search(value: boolean | null | number | string | undefined): StreamIterable<SearchResult> {
		let tokens = this.getTokensFromValue(value);
		let records = tokens
			.map((token) => computeHash(token))
			.map((hash) => {
				try {
					return this.table.lookup(hash);
				} catch (error) {}
			})
			.filter(is.present);
		let map = new Map<string, number>();
		for (let record of records) {
			for (let key of record.keys) {
				let rank = map.get(key) ?? (0 - tokens.length);
				map.set(key, rank + 2);
			}
		}
		return StreamIterable.of(map.entries())
			.filter((entry) => entry[1] >= 0)
			.sort(sorters.NumericSort.decreasing((entry) => entry[1]))
			.map((entry) => ({
				id: entry[0],
				rank: entry[1]
			}));
	}

	update(last: A, next: A): void {
		this.remove(last);
		this.insert(next);
	}

	static NUMBER_TOKENIZER: TokenProvider = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		return Array.from(normalized.match(/(\p{N}+)/gu) ?? []);
	};

	static QUERY_TOKENIZER: TokenProvider = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		return Array.from(normalized.match(/(\p{L}+|\p{N}+)/gu) ?? []);
	};

	static VALUE_TOKENIZER: TokenProvider = (value) => {
		return [ value ];
	};

	static WORD_TOKENIZER: TokenProvider = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		return Array.from(normalized.match(/(\p{L}+)/gu) ?? []);
	};
};
