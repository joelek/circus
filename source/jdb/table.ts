import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";

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

	get marker(): string {
		return this.buffer.slice(0, 8).toString("binary");
	}

	get major(): number {
		return this.buffer.readUInt8(8);
	}

	get minor(): number {
		return this.buffer.readUInt8(9);
	}

	get chunk_size(): number {
		return this.buffer.readUInt16BE(10);
	}

	set chunk_size(value: number) {
		this.buffer.writeUInt16BE(value, 10);
	}

	get entries(): number {
		return this.buffer.readUInt32BE(12);
	}

	set entries(value: number) {
		this.buffer.writeUInt32BE(value, 12);
	}

	constructor() {
		let buffer = Buffer.alloc(16);
		buffer.write("\x23\x52\xdb\x07\xec\x77\x30\x61", 0, "binary");
		buffer.writeUInt8(1, 8);
		buffer.writeUInt8(0, 9);
		buffer.writeUInt16BE(256, 10);
		buffer.writeUInt32BE(0, 12);
		this.buffer = buffer;
	}

	read(fd: number, position: number): void {
		let buffer = readBuffer(fd, Buffer.alloc(16), position ?? 0);
		let marker = buffer.slice(0, 8).toString("binary");
		if (marker !== this.marker) {
			throw `Unsupported file format!`;
		}
		let major = buffer.readUInt8(8);
		if (major !== this.major) {
			throw `Unsupported file format!`;
		}
		this.buffer = buffer;
	}

	write(fd: number, position: number): void {
		writeBuffer(fd, this.buffer, position ?? 0);
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

	get bytes_used(): number {
		return this.buffer.readUInt32BE(4);
	}

	set bytes_used(value: number) {
		this.buffer.writeUInt32BE(value, 4);
	}

	get bytes_free(): number {
		return this.buffer.readUInt32BE(8);
	}

	set bytes_free(value: number) {
		this.buffer.writeUInt32BE(value, 8);
	}

	get bytes_size(): number {
		return this.bytes_used + this.bytes_free;
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

type KeyProvider<A> = (record: A) => string;

export class Table<A extends Record<string, undefined | null | string | number | boolean>> {
	private toc: number;
	private bin: number;
	private header: RecordIndexHeader;
	private entries: Array<RecordIndexEntry>;
	private key_hash_indices: Map<number, Set<number>>;
	private router: stdlib.routing.MessageRouter<RecordIndexEventMap<A>>;
	private guard: autoguard.serialization.MessageGuard<A>;
	private getKey: KeyProvider<A>;
	private cache: Map<number, A>;
	private free_chunk_index: number;

	private computeKeyHash(key: string): number {
		let buffer = libcrypto.createHash("sha256")
			.update(key)
			.digest();
		return buffer.readUInt32BE(0);
	}

	private getRecord(index: number): A {
		let record = this.cache.get(index);
		if (is.present(record)) {
			return record;
		}
		let entry = this.entries[index];
		if (entry.bytes_used === 0) {
			throw `Expected ${index} to match a record!`;
		}
		let position = entry.chunk_offset * this.header.chunk_size;
		let buffer = readBuffer(this.bin, Buffer.alloc(entry.bytes_used), position);
		let string = buffer.toString();
		let json = JSON.parse(string);
		record = this.guard.as(json);
		this.cache.set(index, record);
		return record;
	}

	private insertOrUpdate(next: A): void {
		let serialized = Buffer.from(JSON.stringify(next));
		let chunks = Math.ceil(serialized.length / this.header.chunk_size);
		let buffer = Buffer.alloc(chunks * this.header.chunk_size);
		buffer.set(serialized, 0);
		let key = this.getKey(next);
		let key_hash = this.computeKeyHash(key);
		let indices = this.key_hash_indices.get(key_hash);
		if (is.absent(indices)) {
			indices = new Set<number>();
			this.key_hash_indices.set(key_hash, indices);
		}
		for (let index of indices) {
			let last = this.getRecord(index);
			if (this.getKey(last) === key) {
				let entry = this.entries[index];
				if (serialized.length <= entry.bytes_size) {
					entry.bytes_free = buffer.length - serialized.length;
					entry.bytes_used = serialized.length;
					entry.write(this.toc, 16 + index * 16);
					let position = entry.chunk_offset * this.header.chunk_size;
					writeBuffer(this.bin, buffer, position);
				} else {
					{
						let buffer = Buffer.alloc(entry.bytes_size);
						let position = entry.chunk_offset * this.header.chunk_size;
						writeBuffer(this.bin, buffer, position);
						indices.delete(index);
						entry.bytes_free += entry.bytes_used;
						entry.bytes_used = 0;
						entry.key_hash = 0;
						entry.write(this.toc, 16 + index * 16);
					}
					{
						let index = this.free_chunk_index;
						let entry = new RecordIndexEntry();
						entry.bytes_used = serialized.length;
						entry.bytes_free = buffer.length - serialized.length;
						entry.chunk_offset = index;
						entry.key_hash = key_hash;
						entry.write(this.toc, 16 + index * 16);
						let position = entry.chunk_offset * this.header.chunk_size;
						writeBuffer(this.bin, buffer, position);
						this.free_chunk_index += chunks;
						indices.add(index);
						this.header.entries += 1;
						this.header.write(this.toc, 0);
					}
				}
				this.router.route("update", {
					last: last,
					next: next
				});
				return;
			}
		}
		let index = this.free_chunk_index;
		let entry = new RecordIndexEntry();
		entry.bytes_used = serialized.length;
		entry.bytes_free = buffer.length - serialized.length;
		entry.chunk_offset = index;
		entry.key_hash = key_hash;
		entry.write(this.toc, 16 + index * 16);
		let position = entry.chunk_offset * this.header.chunk_size;
		writeBuffer(this.bin, buffer, position);
		this.free_chunk_index += chunks;
		indices.add(index);
		this.header.entries += 1;
		this.header.write(this.toc, 0);
		this.router.route("insert", {
			next: next
		});
	}

	constructor(root: Array<string>, table_name: string, guard: autoguard.serialization.MessageGuard<A>, getKey: KeyProvider<A>) {
		let directory = [...root, table_name];
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
			for (let index = 0; index < header.entries; index++) {
				let entry = new RecordIndexEntry();
				entry.read(toc, 16 + index * 16);
				let chunks = entry.bytes_size / header.chunk_size;
				free_chunk_index = Math.max(entry.chunk_offset + chunks, free_chunk_index);
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
		this.getKey = getKey;
		this.cache = new Map<number, A>();
		this.free_chunk_index = free_chunk_index;
	}

	destroy(): void {
		libfs.closeSync(this.toc);
		libfs.closeSync(this.bin);
	}

	[Symbol.iterator](): Iterator<A> {
		let index = 0;
		return {
			next: () => {
				if (index >= this.entries.length) {
					return {
						done: true,
						value: undefined as unknown as A
					};
				}
				let entry = this.entries[index];
				if (entry.bytes_used === 0) {
					return {
						done: true,
						value: undefined as unknown as A
					};
				}
				let value = this.getRecord(index);
				index += 1;
				return {
					done: false,
					value: value
				};
			}
		}
	}

	insert(record: A): void {
		this.insertOrUpdate(record);
	}

	lookup(key: string): A {
		let key_hash = this.computeKeyHash(key);
		let indices = this.key_hash_indices.get(key_hash);
		if (is.present(indices)) {
			for (let index of indices) {
				let record = this.getRecord(index);
				if (this.getKey(record) === key) {
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

	remove(key: string): void {
		let key_hash = this.computeKeyHash(key);
		let indices = this.key_hash_indices.get(key_hash);
		if (is.present(indices)) {
			for (let index of indices) {
				let last = this.getRecord(index);
				if (this.getKey(last) === key) {
					let entry = this.entries[index];
					this.cache.delete(index);
					indices.delete(index);
					entry.bytes_free += entry.bytes_used;
					entry.bytes_used = 0;
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

type Person = {
	person_id: string,
	name: string
};

let Person = autoguard.guards.Object.of<Person>({
	person_id: autoguard.guards.String,
	name: autoguard.guards.String
});

let table = new Table<Person>([".", "private", "tables2"], "persons", Person, (record) => record.person_id);

table.on("insert", (message) => {
	console.log("insert", message);
});
table.on("update", (message) => {
	console.log("update", message);
});
table.on("remove", (message) => {
	console.log("remove", message);
});
