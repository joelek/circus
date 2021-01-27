import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";

function computeKeyHash(key: string | undefined): number {
	if (is.absent(key)) {
		return 0;
	}
	let buffer = libcrypto.createHash("sha256")
		.update(key)
		.digest();
	return buffer.readUInt32BE(0);
}

function makeIterator<A>(provider: () => A): Iterator<A> {
	return {
		next: () => {
			try {
				return {
					done: false,
					value: provider()
				};
			} catch (error) {}
			return {
				done: true,
				value: undefined as unknown as A
			};
		}
	};
}

function filterIterator<A>(iterator: Iterator<A>, predicate: (value: A) => boolean): Iterator<A> {
	return makeIterator(() => {
		while (true) {
			let { done, value } = iterator.next();
			if (done) {
				throw ``;
			}
			if (predicate(value)) {
				return value;
			}
		}
	});
}

function mapIterator<A, B>(iterator: Iterator<A>, transform: (value: A) => B): Iterator<B> {
	return makeIterator(() => {
		let { done, value } = iterator.next();
		if (done) {
			throw ``;
		}
		return transform(value);
	});
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
		let buffer = readBuffer(fd, Buffer.alloc(16), position);
		let identifier = buffer.slice(0, 8).toString("binary");
		if (identifier !== this.identifier) {
			throw `Unsupported file format!`;
		}
		this.buffer = buffer;
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

export class RecordIndexEntry {
	private buffer: Buffer;

	get chunk_offset(): number {
		return this.buffer.readUInt32BE(0);
	}

	set chunk_offset(value: number) {
		this.buffer.writeUInt32BE(value, 0);
	}

	get chunk_length_minus_one(): number {
		return this.buffer.readUInt32BE(4);
	}

	set chunk_length_minus_one(value: number) {
		this.buffer.writeUInt32BE(value, 4);
	}

	get chunk_length(): number {
		return this.chunk_length_minus_one + 1;
	}

	set chunk_length(value: number) {
		this.chunk_length_minus_one = value - 1;
	}

	get is_occupied(): boolean {
		return this.buffer.readUInt32BE(8) === 1;
	}

	set is_occupied(value: boolean) {
		this.buffer.writeUInt32BE(value ? 1 : 0, 8);
	}

	get key_hash(): number {
		return this.buffer.readUInt32BE(12);
	}

	set key_hash(value: number) {
		this.buffer.writeUInt32BE(value, 12);
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		let buffer = readBuffer(fd, Buffer.alloc(16), position);
		this.buffer = buffer;
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

type RecordIndexEventMap<A> = {
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

type KeyProvider<A> = (record: A) => string | undefined;

export class Table<A extends Record<string, any>> {
	private toc: number;
	private bin: number;
	private header: RecordIndexHeader;
	private entries: Array<RecordIndexEntry>;
	private key_hash_indices: Map<number, Set<number>>;
	private router: stdlib.routing.MessageRouter<RecordIndexEventMap<A>>;
	private guard: autoguard.serialization.MessageGuard<A>;
	private key_provider: KeyProvider<A>;
	private cache: Map<number, A>;
	private free_chunk_index: number;

	private getRecord(index: number): A {
		let record = this.cache.get(index);
		if (is.present(record)) {
			return record;
		}
		let entry = this.entries[index];
		if (!entry.is_occupied) {
			throw `Expected ${index} to match a record!`;
		}
		let position = entry.chunk_offset * this.header.chunk_size;
		let buffer = readBuffer(this.bin, Buffer.alloc(entry.chunk_length * this.header.chunk_size), position);
		let string = buffer.toString().replace(/[\0]+$/, "");
		let json = JSON.parse(string);
		record = this.guard.as(json);
		this.cache.set(index, record);
		return record;
	}

	private insertOrUpdate(next: A): void {
		let serialized = Buffer.from(JSON.stringify(next));
		let chunks = Math.max(1, Math.ceil(serialized.length / this.header.chunk_size));
		let key = this.key_provider(next);
		let key_hash = computeKeyHash(key);
		let indices = this.key_hash_indices.get(key_hash);
		if (is.absent(indices)) {
			indices = new Set<number>();
			this.key_hash_indices.set(key_hash, indices);
		}
		for (let index of indices) {
			let last = this.getRecord(index);
			if (this.key_provider(last) === key) {
				let entry = this.entries[index];
				if (chunks <= entry.chunk_length) {
					let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
					buffer.set(serialized, 0);
					let position = entry.chunk_offset * this.header.chunk_size;
					writeBuffer(this.bin, buffer, position);
				} else {
					{
						let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
						let position = entry.chunk_offset * this.header.chunk_size;
						writeBuffer(this.bin, buffer, position);
						indices.delete(index);
						entry.is_occupied = false;
						entry.key_hash = 0;
						entry.write(this.toc, 16 + index * 16);
					}
					{
						let chunk_offset = this.free_chunk_index;
						let entry = new RecordIndexEntry();
						entry.chunk_offset = chunk_offset;
						entry.chunk_length = chunks;
						entry.is_occupied = true;
						entry.key_hash = key_hash;
						entry.write(this.toc, 16 + chunk_offset * 16);
						let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
						buffer.set(serialized, 0);
						let position = entry.chunk_offset * this.header.chunk_size;
						writeBuffer(this.bin, buffer, position);
						this.free_chunk_index += chunks;
						indices.add(chunk_offset);
					}
				}
				this.cache.set(index, next);
				this.router.route("update", {
					last: last,
					next: next
				});
				return;
			}
		}
		let chunk_offset = this.free_chunk_index;
		let entry = new RecordIndexEntry();
		entry.chunk_offset = chunk_offset;
		entry.chunk_length = chunks;
		entry.is_occupied = true;
		entry.key_hash = key_hash;
		entry.write(this.toc, 16 + chunk_offset * 16);
		let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
		buffer.set(serialized, 0);
		let position = entry.chunk_offset * this.header.chunk_size;
		writeBuffer(this.bin, buffer, position);
		this.free_chunk_index += chunks;
		indices.add(chunk_offset);
		this.entries.push(entry);
		this.router.route("insert", {
			next: next
		});
	}

	constructor(root: Array<string>, table_name: string, guard: autoguard.serialization.MessageGuard<A>, key_provider: KeyProvider<A>) {
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
		let entries = new Array<RecordIndexEntry>();
		let key_hash_indices = new Map<number, Set<number>>();
		let free_chunk_index = 0;
		let header = new RecordIndexHeader();
		if (toc_exists) {
			header.read(toc, 0);
			let entry_count = libfs.fstatSync(toc).size / 16 - 1;
			if (!Number.isInteger(entry_count)) {
				throw `Expected an even number of entries!`;
			}
			for (let index = 0; index < entry_count; index++) {
				let entry = new RecordIndexEntry();
				entry.read(toc, 16 + index * 16);
				free_chunk_index = Math.max(entry.chunk_offset + entry.chunk_length, free_chunk_index);
				let indices = key_hash_indices.get(entry.key_hash);
				if (is.absent(indices)) {
					indices = new Set<number>();
					key_hash_indices.set(entry.key_hash, indices);
				}
				indices.add(index);
				entries.push(entry);
			}
		} else {
			header.write(toc, 0);
		}
		this.toc = toc;
		this.bin = bin;
		this.header = header;
		this.entries = entries;
		this.key_hash_indices = key_hash_indices;
		this.router = new stdlib.routing.MessageRouter<RecordIndexEventMap<A>>();
		this.guard = guard;
		this.key_provider = key_provider;
		this.cache = new Map<number, A>();
		this.free_chunk_index = free_chunk_index;
	}

	destroy(): void {
		libfs.closeSync(this.toc);
		libfs.closeSync(this.bin);
	}

	[Symbol.iterator](): Iterator<A> {
		let index = -1;
		return makeIterator(() => {
			while (true) {
				index += 1;
				if (index >= this.entries.length) {
					throw ``;
				}
				try {
					return this.getRecord(index);
				} catch (error) {}
			}
		});
	}

	insert(record: A): void {
		this.insertOrUpdate(record);
	}

	keyof(record: A): string | undefined {
		return this.key_provider(record);
	}

	length(): number {
		return this.entries.length;
	}

	lookup(key: string | undefined): A {
		let key_hash = computeKeyHash(key);
		let indices = this.key_hash_indices.get(key_hash);
		if (is.present(indices)) {
			for (let index of indices) {
				let record = this.getRecord(index);
				if (this.key_provider(record) === key) {
					return record;
				}
			}
		}
		throw `Expected ${key} to match a record!`;
	}

	on<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
		if (type === "insert") {
			for (let record of this) {
				(listener as stdlib.routing.MessageObserver<RecordIndexEventMap<A>["insert"]>)({ next: record });
			}
		}
	}

	off<B extends keyof RecordIndexEventMap<A>>(type: B, listener: stdlib.routing.MessageObserver<RecordIndexEventMap<A>[B]>): void {
		this.router.addObserver(type, listener);
	}

	remove(record: A): void {
		let key = this.key_provider(record);
		let key_hash = computeKeyHash(key);
		let indices = this.key_hash_indices.get(key_hash);
		if (is.present(indices)) {
			for (let index of indices) {
				let last = this.getRecord(index);
				if (this.key_provider(last) === key) {
					let entry = this.entries[index];
					let buffer = Buffer.alloc(entry.chunk_length * this.header.chunk_size);
					let position = entry.chunk_offset * this.header.chunk_size;
					writeBuffer(this.bin, buffer, position);
					this.cache.delete(index);
					indices.delete(index);
					entry.is_occupied = false;
					entry.key_hash = 0;
					entry.write(this.toc, 16 + index * 16);
					this.router.route("remove", {
						last: last
					});
					return;
				}
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

	get entries(): number {
		return this.buffer.readUInt32BE(12);
	}

	set entries(value: number) {
		this.buffer.writeUInt32BE(value, 12);
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		buffer.write("\x01\xfb\x2e\x28\x8a\xa7\x98\x76", 0, "binary");
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		let buffer = readBuffer(fd, Buffer.alloc(16), position);
		let identifier = buffer.slice(0, 8).toString("binary");
		if (identifier !== this.identifier) {
			throw `Unsupported file format!`;
		}
		this.buffer = buffer;
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

export class IndexEntry {
	private buffer: Buffer;

	get active(): boolean {
		return this.buffer.readUInt8(0) === 1;
	}

	set active(value: boolean) {
		this.buffer.writeUInt8(value ? 1 : 0, 0);
	}

	get key_hash(): number {
		return this.buffer.readUInt32BE(4);
	}

	set key_hash(value: number) {
		this.buffer.writeUInt32BE(value, 4);
	}

	get record_index(): number {
		return this.buffer.readUInt32BE(12);
	}

	set record_index(value: number) {
		this.buffer.writeUInt32BE(value, 12);
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		let buffer = readBuffer(fd, Buffer.alloc(16), position);
		this.buffer = buffer;
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position);
	}
};

type RecordProvider<A> = (record_index: number) => A;

class Index<A> {
	private map: number;
	private entry_indices_from_key_hash: Map<number, Set<number>>;
	private entries: Array<IndexEntry>;
	private key_provider: KeyProvider<A>;
	private record_provider: RecordProvider<A>;

	constructor(root: Array<string>, table_name: string, key_provider: KeyProvider<A>, record_provider: RecordProvider<A>) {
		let directory = [...root, table_name];
		if (!libfs.existsSync(directory.join("/"))) {
			libfs.mkdirSync(directory.join("/"), { recursive: true });
		}
		let map_filename = [...directory, "map"];
		let map_exists = libfs.existsSync(map_filename.join("/"));
		let map = libfs.openSync(map_filename.join("/"), map_exists ? "r+" : "w+");
		let header = new IndexHeader();
		header.read(map, 0);
		let entry_indices_from_key_hash = new Map<number, Set<number>>();
		let entries = new Array<IndexEntry>();
		for (let index = 0; index < header.entries; index++) {
			let entry = new IndexEntry();
			entry.read(map, 16 + index * 16);
			entries.push(entry);
			let indices = entry_indices_from_key_hash.get(entry.key_hash);
			if (is.absent(indices)) {
				indices = new Set<number>();
				entry_indices_from_key_hash.set(entry.key_hash, indices);
			}
			indices.add(index);
		}
		this.map = map;
		this.entry_indices_from_key_hash = entry_indices_from_key_hash;
		this.entries = entries;
		this.key_provider = key_provider;
		this.record_provider = record_provider;
	}

	destroy(): void {
		libfs.closeSync(this.map);
	}

	insert(record_index: number): void {
		let record = this.record_provider(record_index);
		let key = this.key_provider(record);
		let key_hash = computeKeyHash(key);
		let entry_indices = this.entry_indices_from_key_hash.get(key_hash);
		if (is.absent(entry_indices)) {
			entry_indices = new Set<number>();
			this.entry_indices_from_key_hash.set(key_hash, entry_indices);
		}
		for (let entry_index of entry_indices) {
			let entry = this.entries[entry_index];
			let record = this.record_provider(entry.record_index);
			if (this.key_provider(record) === key) {
				return;
			}
		}
		// insert and write to disk
	}

	lookup(key: string): Iterator<A> {
		let key_hash = computeKeyHash(key);
		let entry_indices = this.entry_indices_from_key_hash.get(key_hash);
		if (is.absent(entry_indices)) {
			return [][Symbol.iterator]();
		}
		return filterIterator(mapIterator(entry_indices[Symbol.iterator](), (entry_index) => {
			let entry = this.entries[entry_index];
			return this.record_provider(entry.record_index);
		}), (record) => {
			return this.key_provider(record) === key;
		});
	}

	remove(record: A): void {

	}

	update(last: A, next: A): void {
		this.remove(last);
		//this.insert(next);
	}
}
