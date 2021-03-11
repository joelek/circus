import * as libfs from "fs";
import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";
import { IntegerAssert } from "./asserts";
import { StreamIterable } from "../jdb";
import { Cue, Directory, File, Key, Year } from "../database/schema";

const DEBUG = false;

export function open(path: Array<string>): number {
	let filename = path.join("/");
	let exists = libfs.existsSync(filename);
	libfs.mkdirSync(path.slice(0, -1).join("/"), { recursive: true });
	let fd = libfs.openSync(filename, exists ? "r+" : "w+");
	return fd;
};

export function read(fd: number, buffer: Buffer, offset: number): Buffer {
	let length = buffer.length;
	let bytes = libfs.readSync(fd, buffer, {
		position: offset
	});
	if (bytes !== length) {
		throw `Expected to read ${length} bytes but read ${bytes}!`;
	}
	return buffer;
};

export function size(fd: number): number {
	return libfs.fstatSync(fd).size;
};

export function write(fd: number, buffer: Buffer, offset: number): Buffer {
	let length = buffer.length;
	let bytes = libfs.writeSync(fd, buffer, 0, length, offset);
	if (bytes !== length) {
		throw `Expected to write ${length} bytes but wrote ${bytes}!`;
	}
	return buffer;
};

export class Chunk {
	readonly buffer: Buffer;

	constructor(buffer: Buffer) {
		this.buffer = buffer;
	}

	load(fd: number, offset: number): void {
		read(fd, this.buffer, offset);
	}

	save(fd: number, offset: number): void {
		write(fd, this.buffer, offset);
	}
};

export class Counter extends Chunk {
	static SIZE = 8;

	get count(): number {
		return this.buffer.readUInt32BE(4);
	}

	set count(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 4);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Counter.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Counter.SIZE);
		super(buffer);
	}
};

export class Pointer extends Chunk {
	static SIZE = 8;

	get index(): number {
		return this.buffer.readUInt32BE(4);
	}

	set index(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 4);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Pointer.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Pointer.SIZE);
		super(buffer);
	}
};

export class Entry extends Chunk {
	static SIZE = 16;

	get deleted(): boolean {
		return this.buffer.readUInt8(0) === 0x80;
	}

	set deleted(value: boolean) {
		this.buffer.writeUInt8(value ? 0x80 : 0x00, 0);
	}

	get offset(): number {
		return this.buffer.readUInt32BE(4);
	}

	set offset(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 4);
	}

	get length(): number {
		return this.buffer.readUInt32BE(12) + 1;
	}

	set length(value: number) {
		value = value - 1;
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 12);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Entry.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Entry.SIZE);
		super(buffer);
	}
};

export class BlockHandler {
	static FIRST_APPLICATION_BLOCK = 64;

	private bin: number;
	private toc: number;
	private blockCache: Map<number, Buffer>;
	private entryCache: Map<number, Entry>;

	private computePool(minLength: number): number {
		if (DEBUG) IntegerAssert.atLeast(0, minLength);
		let lengthLog2 = Math.ceil(Math.log2(Math.max(1, minLength)));
		return lengthLog2;
	}

	private createNewBlock(minLength: number): number {
		let entry = new Entry();
		entry.offset = size(this.bin);
		entry.length = Math.pow(2, this.computePool(minLength));
		write(this.bin, Buffer.alloc(entry.length), entry.offset);
		write(this.toc, entry.buffer, size(this.toc));
		return this.getCount() - 1;
	}

	private createOldBlock(minLength: number): number {
		let pool = this.computePool(minLength);
		let counter = new Counter();
		this.readBlock(pool, counter.buffer, 0);
		if (counter.count === 0) {
			throw ``;
		}
		let pointer = new Pointer();
		this.readBlock(pool, pointer.buffer, Counter.SIZE + (counter.count - 1) * Pointer.SIZE);
		let index = pointer.index;
		pointer.index = 0;
		this.writeBlock(pool, pointer.buffer, Counter.SIZE + (counter.count - 1) * Pointer.SIZE);
		counter.count -= 1;
		this.writeBlock(pool, counter.buffer, 0);
		let entry = new Entry();
		this.readEntry(index, entry);
		entry.deleted = false;
		this.writeEntry(index, entry);
		return index;
	}

	private readEntry(index: number, entry: Entry): Entry {
		if (DEBUG) IntegerAssert.between(0, index, this.getCount() - 1);
		let cached = this.entryCache.get(index);
		if (is.absent(cached)) {
			cached = new Entry();
			read(this.toc, cached.buffer, index * Entry.SIZE);
			this.entryCache.set(index, cached);
		}
		cached.buffer.copy(entry.buffer, 0, 0);
		return entry;
	}

	private writeEntry(index: number, entry: Entry): Entry {
		if (DEBUG) IntegerAssert.between(0, index, this.getCount() - 1);
		write(this.toc, entry.buffer, index * Entry.SIZE);
		this.entryCache.delete(index);
		return entry;
	}

	constructor(path: Array<string>) {
		this.bin = open([...path, "bin"]);
		this.toc = open([...path, "toc"]);
		this.blockCache = new Map<number, Buffer>();
		this.entryCache = new Map<number, Entry>();
		if (this.getCount() === 0) {
			for (let i = 0; i < BlockHandler.FIRST_APPLICATION_BLOCK; i++) {
				this.createNewBlock(16);
			}
		}
	}

	clearBlock(index: number): void {
		this.writeBlock(index);
		this.blockCache.delete(index);
	}

	createBlock(minLength: number): number {
		try {
			return this.createOldBlock(minLength);
		} catch (error) {}
		try {
			return this.createNewBlock(minLength);
		} catch (error) {}
		throw `Unable to create block with length ${minLength}!`;
	}

	deleteBlock(index: number): void {
		let entry = new Entry();
		this.readEntry(index, entry);
		if (entry.deleted) {
			return;
		}
		let pool = this.computePool(entry.length);
		let counter = new Counter();
		this.readBlock(pool, counter.buffer, 0);
		let minLength = Counter.SIZE + (counter.count + 1) * Pointer.SIZE;
		let length = this.readEntry(pool, new Entry()).length;
		if (minLength > length) {
			this.resizeBlock(pool, minLength);
			this.readBlock(pool, counter.buffer, 0); // Resize can in theory consume one block.
		}
		let pointer = new Pointer();
		pointer.index = index;
		this.writeBlock(pool, pointer.buffer, Counter.SIZE + (counter.count * Pointer.SIZE));
		counter.count += 1;
		this.writeBlock(pool, counter.buffer, 0);
		let buffer = Buffer.alloc(entry.length);
		this.writeBlock(index, buffer, 0);
		entry.deleted = true;
		this.writeEntry(index, entry);
		this.blockCache.delete(index);
	}

	getBlockSize(index: number): number {
		let entry = new Entry();
		this.readEntry(index, entry);
		return entry.length;
	}

	getCount(): number {
		let count = size(this.toc) / Entry.SIZE;
		if (DEBUG) IntegerAssert.atLeast(0, count);
		return count;
	}

	readBlock(index: number, buffer?: Buffer, skipLength?: number): Buffer {
		let entry = new Entry();
		this.readEntry(index, entry);
		buffer = buffer ?? Buffer.alloc(entry.length);
		let offset = skipLength ?? 0;
		let length = buffer.length;
		if (DEBUG) IntegerAssert.between(0, offset, entry.length - 1);
		if (DEBUG) IntegerAssert.between(0, length, entry.length - offset);
		let cached = this.blockCache.get(index);
		if (is.absent(cached)) {
			cached = Buffer.alloc(entry.length);
			read(this.bin, cached, entry.offset);
			this.blockCache.set(index, cached);
		}
		cached.copy(buffer, 0, offset);
		return buffer;
	}

	resizeBlock(index: number, minLength: number): void {
		let entry = new Entry();
		this.readEntry(index, entry);
		if (this.computePool(minLength) === this.computePool(entry.length)) {
			return;
		}
		let indexTwo = this.createBlock(minLength);
		let entryTwo = new Entry();
		this.readEntry(indexTwo, entryTwo);
		let length = Math.min(entry.length, entryTwo.length);
		let buffer = Buffer.alloc(length);
		this.readBlock(index, buffer);
		this.writeBlock(index, buffer);
		this.writeEntry(index, entryTwo);
		this.writeEntry(indexTwo, entry);
		this.deleteBlock(indexTwo);
		this.blockCache.delete(index);
	}

	swapBlocks(indexOne: number, indexTwo: number): void {
		let entryOne = new Entry();
		this.readEntry(indexOne, entryOne);
		let entryTwo = new Entry();
		this.readEntry(indexTwo, entryTwo);
		this.writeEntry(indexOne, entryTwo);
		this.writeEntry(indexTwo, entryOne);
		this.blockCache.delete(indexOne);
		this.blockCache.delete(indexTwo);
	}

	writeBlock(index: number, buffer?: Buffer, skipLength?: number): Buffer {
		let entry = new Entry();
		this.readEntry(index, entry);
		buffer = buffer ?? Buffer.alloc(entry.length);
		let offset = skipLength ?? 0;
		let length = buffer.length;
		if (DEBUG) IntegerAssert.between(0, offset, entry.length - 1);
		if (DEBUG) IntegerAssert.between(0, length, entry.length - offset);
		write(this.bin, buffer, entry.offset + offset);
		if (is.absent(skipLength)) {
			write(this.bin, Buffer.alloc(entry.length - buffer.length), entry.offset + buffer.length);
		}
		this.blockCache.delete(index);
		return buffer
	}
};

export type Keys = Array<string | undefined>;
export type KeysProvider<A> = (record: A) => Keys;
export type RecordParser<A> = (json: any) => A;

export type TableEventMap<A> = {
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

export class Table<A> extends stdlib.routing.MessageRouter<TableEventMap<A>> {
	static ROOT_NODE_INDEX = BlockHandler.FIRST_APPLICATION_BLOCK;
	static NODE_SIZE = Pointer.SIZE * 2;
	static TABLE_SIZE = Pointer.SIZE * 256;

	private blockHandler: BlockHandler;
	private keysProvider: KeysProvider<A>;
	private recordParser: RecordParser<A>;
	private recordCache: Map<number, A>;
	private keyCache: Map<string, number>;

	private serializeKeys(keys: Keys): Buffer {
		let buffers = new Array<Buffer>();
		for (let key of keys) {
			if (typeof key === "string") {
				if (/^[0-9a-fA-F]{8,}$/.test(key)) {
					buffers.push(Buffer.from(key, "hex"));
				} else {
					buffers.push(Buffer.from(key));
				}
			} else {
				buffers.push(Buffer.alloc(1));
			}
		}
		return Buffer.concat(buffers);
	}

	private compareKeys(one: Keys, two: Keys): boolean {
		if (one.length !== two.length) {
			return false;
		}
		for (let i = 0; i < one.length; i++) {
			if (one[i] !== two[i]) {
				return false;
			}
		}
		return true;
	}

	private getRecord(index: number): A {
		let record = this.recordCache.get(index);
		if (is.present(record)) {
			this.recordCache.delete(index);
			this.recordCache.set(index, record);
			return record;
		}
		let block = this.blockHandler.readBlock(index);
		let string = block.toString().replace(/[\0]*$/, "");
		let json = JSON.parse(string);
		record = this.recordParser(json);
		this.recordCache.set(index, record);
		if (this.recordCache.size > 10000) {
			for (let idx of this.recordCache.keys()) {
				this.recordCache.delete(idx);
				break;
			}
		}
		return record;
	}
/*
load s

without asserts: 340ms
with asserts, with cache: 580ms
with asserts, without cache: 670ms
with noop asserts, without cache: 670 ms  => performance hit is from function calls
with deactivated asserts, without cache: 400ms
with deactivated asserts, with cache: 340ms
+ with key cache: 100 ms
+ with block cache: 80ms
+ with entry cache: 50ms

V1:
string => number => (cache) (30ms)

V2:
string => bytes => traversion => number => (cache)

disk access is really slow
lookup traversion is slow

 */
	private *createIterable(nodeIndex: number): Iterable<A> {
		let resident = new Pointer();
		this.blockHandler.readBlock(nodeIndex, resident.buffer, 0 * Pointer.SIZE);
		if (resident.index !== 0) {
			yield this.getRecord(resident.index);
		}
		let table = new Pointer();
		this.blockHandler.readBlock(nodeIndex, table.buffer, 1 * Pointer.SIZE);
		if (table.index !== 0) {
			let node = new Pointer();
			for (let i = 0; i < 256; i++) {
				this.blockHandler.readBlock(table.index, node.buffer, i * Pointer.SIZE);
				if (node.index !== 0) {
					yield* this.createIterable(node.index);
				}
			}
		}
	}

	constructor(blockHandler: BlockHandler, keysProvider: KeysProvider<A>, recordParser: RecordParser<A>) {
		super();
		this.blockHandler = blockHandler;
		this.keysProvider = keysProvider;
		this.recordParser = recordParser;
		this.recordCache = new Map<number, A>();
		this.keyCache = new Map<string, number>();
		if (blockHandler.getCount() === Table.ROOT_NODE_INDEX) {
			blockHandler.createBlock(Table.NODE_SIZE);
		}
	}

	*[Symbol.iterator](): Iterator<A> {
		yield* this.createIterable(Table.ROOT_NODE_INDEX);
	}

	insert(next: A): void {
		let serializedRecord = Buffer.from(JSON.stringify(next));
		let keys = this.keysProvider(next);
		let keyBytes = this.serializeKeys(keys);
		let currentNodeIndex = Table.ROOT_NODE_INDEX;
		let resident = new Pointer();
		let table = new Pointer();
		let node = new Pointer();
		let zero = new Pointer();
		for (let [index, keyByte] of keyBytes.entries()) {
			this.blockHandler.readBlock(currentNodeIndex, table.buffer, 1 * Pointer.SIZE);
			if (table.index === 0) {
				this.blockHandler.readBlock(currentNodeIndex, resident.buffer, 0 * Pointer.SIZE);
				if (resident.index === 0) {
					break;
				} else {
					let residentRecord = this.getRecord(resident.index);
					let residentKeys = this.keysProvider(residentRecord);
					let residentKeyBytes = this.serializeKeys(residentKeys);
					if (residentKeyBytes.equals(keyBytes)) {
						break;
					}
					table.index = this.blockHandler.createBlock(Table.TABLE_SIZE);
					this.blockHandler.writeBlock(currentNodeIndex, table.buffer, 1 * Pointer.SIZE);
					let residentKeyByte = residentKeyBytes[index] as number | undefined;
					if (is.present(residentKeyByte)) {
						node.index = this.blockHandler.createBlock(Table.NODE_SIZE);
						this.blockHandler.writeBlock(node.index, resident.buffer, 0 * Pointer.SIZE);
						this.blockHandler.writeBlock(table.index, node.buffer, residentKeyByte * Pointer.SIZE);
						this.blockHandler.writeBlock(currentNodeIndex, zero.buffer, 0 * Pointer.SIZE);
						this.keyCache.delete(residentKeyBytes.toString("binary"));
					}
				}
			}
			this.blockHandler.readBlock(table.index, node.buffer, keyByte * Pointer.SIZE);
			if (node.index === 0) {
				node.index = this.blockHandler.createBlock(Table.NODE_SIZE);
				this.blockHandler.writeBlock(table.index, node.buffer, keyByte * Pointer.SIZE);
			}
			currentNodeIndex = node.index;
		}
		this.blockHandler.readBlock(currentNodeIndex, resident.buffer, 0 * Pointer.SIZE);
		if (resident.index === 0) {
			resident.index = this.blockHandler.createBlock(serializedRecord.length);
			this.blockHandler.writeBlock(resident.index, serializedRecord);
			this.blockHandler.writeBlock(currentNodeIndex, resident.buffer, 0 * Pointer.SIZE);
			this.route("insert", {
				next: next
			});
		} else {
			let last = this.getRecord(resident.index);
			this.blockHandler.resizeBlock(resident.index, serializedRecord.length);
			this.blockHandler.writeBlock(resident.index, serializedRecord);
			this.recordCache.delete(resident.index);
			this.route("update", {
				last: last,
				next: next
			});
		}
	}

	// TODO: Remove when indices are built using new database table.
	keyof(record: A): string {
		return this.keysProvider(record).map((value) => String(value)).join("");
	}

	lookup(...keys: Keys): A {
		let records = this.search(...keys);
		for (let record of records) {
			let keysTwo = this.keysProvider(record);
			if (this.compareKeys(keys, keysTwo)) {
				return record;
			}
			break;
		}
		throw `Expected a record for ${keys}!`;
	}

	remove(last: A): void {
		let keys = this.keysProvider(last);
		let keyBytes = this.serializeKeys(keys);
		let currentNodeIndex = Table.ROOT_NODE_INDEX;
		let node = new Pointer();
		let table = new Pointer();
		let resident = new Pointer();
		for (let keyByte of keyBytes) {
			this.blockHandler.readBlock(currentNodeIndex, table.buffer, 1 * Pointer.SIZE);
			if (table.index === 0) {
				this.blockHandler.readBlock(currentNodeIndex, resident.buffer, 0 * Pointer.SIZE);
				if (resident.index === 0) {
					return;
				} else {
					break;
				}
			}
			this.blockHandler.readBlock(table.index, node.buffer, keyByte * Pointer.SIZE);
			if (node.index === 0) {
				return;
			}
			currentNodeIndex = node.index;
		}
		this.blockHandler.readBlock(currentNodeIndex, resident.buffer, 0 * Pointer.SIZE);
		if (resident.index !== 0) {
			let record = this.getRecord(resident.index);
			let keysTwo = this.keysProvider(record);
			if (this.compareKeys(keys, keysTwo)) {
				this.blockHandler.deleteBlock(resident.index);
				resident.index = 0;
				this.blockHandler.writeBlock(currentNodeIndex, resident.buffer, 0 * Pointer.SIZE);
				let keyString = keyBytes.toString("binary");
				this.keyCache.delete(keyString);
				this.route("remove", {
					last: last
				});
			}
		}
	}

	search(...keys: Keys): StreamIterable<A> {
		let keyBytes = this.serializeKeys(keys);
		let keyString = keyBytes.toString("binary");
		let currentNodeIndex = this.keyCache.get(keyString);
		if (is.absent(currentNodeIndex)) {
			currentNodeIndex = Table.ROOT_NODE_INDEX;
			let node = new Pointer();
			let table = new Pointer();
			let resident = new Pointer();
			for (let keyByte of keyBytes) {
				this.blockHandler.readBlock(currentNodeIndex, table.buffer, 1 * Pointer.SIZE);
				if (table.index === 0) {
					this.blockHandler.readBlock(currentNodeIndex, resident.buffer, 0 * Pointer.SIZE);
					if (resident.index === 0) {
						return StreamIterable.of([]);
					} else {
						let record = this.getRecord(resident.index);
						let keysTwo = this.keysProvider(record);
						if (this.compareKeys(keys, keysTwo)) {
							this.keyCache.set(keyBytes.toString("binary"), currentNodeIndex);
						}
						break;
					}
				}
				this.blockHandler.readBlock(table.index, node.buffer, keyByte * Pointer.SIZE);
				if (node.index === 0) {
					return StreamIterable.of([]);
				}
				currentNodeIndex = node.index;
			}
		}
		return StreamIterable.of(this.createIterable(currentNodeIndex));
	}

	update(next: A): void {
		this.insert(next);
	}
};
