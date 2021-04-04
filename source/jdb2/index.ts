/*
[v1]
	latency shows: 160 ms
	files table: 6191 kB + 431 kB
	indices: 9 MB
	tables: 15 MB

[8bit branch, 32bit pointers]
	latency shows: 290 ms
	files table: 10272 kB + 747 kB
	indices: 178 MB
	tables: 35 MB

[4bit branch, 32bit pointers]
	latency shows: 240 ms
	files table: 6482 kB + 807 kB
	indices: 23 MB
	tables: 20 MB

[4bit branch, 32bit pointers + rhh]
	latency shows: 230 ms
	files table: 6482 kB + 807 kB
	indices: 14 MB
	tables: 20 MB
*/

import * as libcrypto from "crypto";
import * as libfs from "fs";
import * as autoguard from "@joelek/ts-autoguard";
import * as stdlib from "@joelek/ts-stdlib";
import * as is from "../is";
import { IntegerAssert } from "./asserts/integer";
import { StreamIterable } from "../jdb";
import { sorters } from "../jsondb";

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
	static SIZE = 4;

	get count(): number {
		return this.buffer.readUInt32BE(0);
	}

	set count(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 0);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Counter.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Counter.SIZE);
		super(buffer);
	}
};

export class Pointer extends Chunk {
	static SIZE = 4;

	get index(): number {
		return this.buffer.readUInt32BE(0);
	}

	set index(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
		this.buffer.writeUInt32BE(value, 0);
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Pointer.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Pointer.SIZE);
		super(buffer);
	}
};

export class Entry extends Chunk {
	static SIZE = 16;

	get offset(): number {
		return Number(this.buffer.readBigUInt64BE(0));
	}

	set offset(value: number) {
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFFFFFF);
		this.buffer.writeBigUInt64BE(BigInt(value), 0);
	}

	get deleted(): boolean {
		return this.buffer.readUInt8(8) === 0x80;
	}

	set deleted(value: boolean) {
		this.buffer.writeUInt8(value ? 0x80 : 0x00, 8);
	}

	get length(): number {
		return Number(this.buffer.readBigUInt64BE(8) & BigInt(0xFFFFFFFFFFFF)) + 1;
	}

	set length(value: number) {
		value = value - 1;
		if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFFFFFF);
		let deleted = this.deleted;
		this.buffer.writeBigUInt64BE(BigInt(value), 8);
		this.deleted = deleted;
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Entry.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Entry.SIZE);
		super(buffer);
	}
};

export type WeightProvider<A> = (value: A) => number;
export type Value = boolean | string | number | null | undefined;

export class Cache<A extends Value, B> {
	private map: Map<A, B>;
	private weightProvider: WeightProvider<B>;
	private maxWeight?: number;
	private weight: number;

	private purge(): void {
		if (is.present(this.maxWeight)) {
			for (let [key, last] of this.map.entries()) {
				if (this.weight <= this.maxWeight) {
					break;
				}
				this.weight -= this.weightProvider(last);
				this.map.delete(key);
			}
		}
	}

	constructor(weightProvider: WeightProvider<B>, maxWeight?: number) {
		this.map = new Map<A, B>();
		this.weightProvider = weightProvider;
		this.maxWeight = maxWeight;
		this.weight = 0;
	}

	insert(key: A, value: B | undefined): void {
		this.remove(key);
		if (is.present(value)) {
			this.weight += this.weightProvider(value);
			this.map.set(key, value);
			this.purge();
		}
	}

	lookup(key: A): B | undefined {
		return this.map.get(key);
	}

	remove(key: A): B | undefined {
		let value = this.map.get(key);
		if (is.present(value)) {
			this.weight -= this.weightProvider(value);
			this.map.delete(key);
		}
		return value;
	}
};

export class BlockHandler {
	static FIRST_APPLICATION_BLOCK = 64;

	private bin: number;
	private toc: number;
	private blockCache: Cache<number, Buffer>;
	private entryCache: Cache<number, Entry>;

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
		let cached = this.entryCache.lookup(index);
		if (is.absent(cached)) {
			cached = new Entry();
			read(this.toc, cached.buffer, index * Entry.SIZE);
			this.entryCache.insert(index, cached);
		}
		cached.buffer.copy(entry.buffer, 0, 0);
		return entry;
	}

	private writeEntry(index: number, entry: Entry): Entry {
		if (DEBUG) IntegerAssert.between(0, index, this.getCount() - 1);
		write(this.toc, entry.buffer, index * Entry.SIZE);
		let cached = new Entry();
		entry.buffer.copy(cached.buffer, 0, 0);
		this.entryCache.insert(index, cached);
		return entry;
	}

	constructor(path: Array<string>) {
		this.bin = open([...path, "bin"]);
		this.toc = open([...path, "toc"]);
		this.blockCache = new Cache<number, Buffer>((value) => value.length, 512 * 1024 * 1024);
		this.entryCache = new Cache<number, Entry>((value) => 1, 1 * 1000 * 1000);
		if (this.getCount() === 0) {
			for (let i = 0; i < BlockHandler.FIRST_APPLICATION_BLOCK; i++) {
				this.createNewBlock(16);
			}
		}
	}

	clearBlock(index: number): void {
		this.writeBlock(index, Buffer.alloc(0));
	}

	createBlock(minLength: number): number {
		if (minLength === 0) {
			return 0xFFFFFFFF;
		}
		try {
			return this.createOldBlock(minLength);
		} catch (error) {}
		try {
			return this.createNewBlock(minLength);
		} catch (error) {}
		throw `Unable to create block with length ${minLength}!`;
	}

	deleteBlock(index: number): void {
		if (index === 0xFFFFFFFF) {
			return;
		}
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
		this.blockCache.remove(index);
	}

	getBlockSize(index: number): number {
		if (index === 0xFFFFFFFF) {
			return 0;
		}
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
		if (index === 0xFFFFFFFF) {
			return Buffer.alloc(0);
		}
		let entry = new Entry();
		this.readEntry(index, entry);
		buffer = buffer ?? Buffer.alloc(entry.length);
		let offset = skipLength ?? 0;
		let length = buffer.length;
		if (DEBUG) IntegerAssert.between(0, offset, entry.length - 1);
		if (DEBUG) IntegerAssert.between(0, length, entry.length - offset);
		let cached = this.blockCache.lookup(index);
		if (is.absent(cached)) {
			cached = Buffer.alloc(entry.length);
			read(this.bin, cached, entry.offset);
			this.blockCache.insert(index, cached);
		}
		cached.copy(buffer, 0, offset);
		return buffer;
	}

	resizeBlock(index: number, minLength: number): void {
		if (index === 0xFFFFFFFF) {
			return;
		}
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
		this.writeBlock(indexTwo, buffer, 0);
		this.swapBlocks(index, indexTwo);
		this.deleteBlock(indexTwo);
	}

	swapBlocks(indexOne: number, indexTwo: number): void {
		let entryOne = new Entry();
		this.readEntry(indexOne, entryOne);
		let entryTwo = new Entry();
		this.readEntry(indexTwo, entryTwo);
		this.writeEntry(indexOne, entryTwo);
		this.writeEntry(indexTwo, entryOne);
		let blockOne = this.blockCache.remove(indexOne);
		let blockTwo = this.blockCache.remove(indexTwo);
		this.blockCache.insert(indexOne, blockTwo);
		this.blockCache.insert(indexTwo, blockOne);
	}

	writeBlock(index: number, buffer?: Buffer, skipLength?: number): Buffer {
		if (index === 0xFFFFFFFF) {
			return Buffer.alloc(0);
		}
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
		let cached = this.blockCache.lookup(index);
		if (is.present(cached)) {
			cached.set(buffer, offset);
			if (is.absent(skipLength)) {
				cached.set(Buffer.alloc(entry.length - buffer.length), buffer.length);
			}
		}
		return buffer
	}
};

export class Node extends Chunk {
	static MAX_NIBBLES = 15;
	static SIZE = 8 + 8;

	prefix(value?: Buffer): Buffer {
		if (is.present(value)) {
			let length = value.length;
			if (DEBUG) IntegerAssert.between(0, length, Node.MAX_NIBBLES);
			let bytes = bytesFromNibbles(Buffer.of(length, ...value));
			this.buffer.set(bytes, 0);
			this.buffer.fill(0, bytes.length, 8);
			return this.buffer;
		} else {
			let bytes = this.buffer.slice(0, 8);
			let nibbles = nibblesFromBytes(bytes);
			let length = nibbles[0];
			return nibbles.slice(1, 1 + length);
		}
	}

	resident(value?: number): number {
		let offset = 8;
		if (is.present(value)) {
			if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
			this.buffer.writeUInt32BE(value, offset);
			return value;
		} else {
			return this.buffer.readUInt32BE(offset);
		}
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(Node.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, Node.SIZE);
		super(buffer);
	}
};

export class NodeTable extends Chunk {
	static LENGTH = 16;
	static SIZE = NodeTable.LENGTH * 4;

	subtree(index: number, value?: number): number {
		if (DEBUG) IntegerAssert.between(0, index, NodeTable.LENGTH - 1);
		let offset = index * 4;
		if (is.present(value)) {
			if (DEBUG) IntegerAssert.between(0, value, 0xFFFFFFFF);
			this.buffer.writeUInt32BE(value, offset);
			return value;
		} else {
			return this.buffer.readUInt32BE(offset);
		}
	}

	constructor(buffer?: Buffer) {
		buffer = buffer ?? Buffer.alloc(NodeTable.SIZE);
		if (DEBUG) IntegerAssert.exactly(buffer.length, NodeTable.SIZE);
		super(buffer);
	}
};

export type ValueProvider<A> = (record: A) => Value;
export type ValuesProvider<A> = (record: A) => Array<Value>;
export type RecordParser<A> = (json: any) => A;
export type Tokenizer = (value: Value) => Array<Value>;

export type SearchResult<A> = {
	keyBytes: Buffer,
	rank: number;
	lookup: () => A;
};

export type TableEventMap<A> = {
	"insert": {
		key: Value,
		index: number,
		record: A | undefined
	},
	"remove": {
		key: Value,
		index: number,
		record: A | undefined
	},
	"update": {
		key: Value,
		index: number,
		last: A | undefined,
		next: A | undefined
	}
};

export function computeCommonPrefixLength(prefixBytes: Buffer, keyBytes: Buffer, keyByteIndex: number): number {
	let length = Math.min(prefixBytes.length, keyBytes.length - keyByteIndex);
	for (let i = 0; i < length; i++) {
		let prefixByte = prefixBytes[i];
		let keyByte = keyBytes[keyByteIndex + i];
		if (prefixByte !== keyByte) {
			return i;
		}
	}
	return length;
};

export function nibblesFromBytes(bytes: Buffer): Buffer {
	let nibbles = new Array<number>();
	for (let byte of bytes) {
		nibbles.push((byte >> 4) & 0x0F, (byte >> 0) & 0x0F);
	}
	return Buffer.from(nibbles);
};

export function bytesFromNibbles(nibbles: Buffer): Buffer {
	let bytes = new Array<number>();
	for (let i = 0; i < nibbles.length; i += 2) {
		bytes.push((nibbles[i + 0] << 4) | (nibbles[i + 1] << 0));
	}
	return Buffer.from(bytes);
};

export function serializeKey(key: Value): Buffer {
	let bytes = (() => {
		if (typeof key === "boolean") {
			return Buffer.of(key ? 1 : 0);
		}
		if (typeof key === "number") {
			return Buffer.from(`${key}`);
		}
		if (typeof key === "string") {
			if (/^[0-9a-f]{8,}$/i.test(key)) {
				return Buffer.from(key, "hex");
			} else {
				return Buffer.from(key, "binary");
			}
		}
		return Buffer.alloc(0);
	})();
	return nibblesFromBytes(bytes);
};

export function deserializeKey(nibbles: Buffer): Value {
	return bytesFromNibbles(nibbles).toString("binary");
};

export class Table<A> extends stdlib.routing.MessageRouter<TableEventMap<A>> {
	static ROOT_NODE_INDEX = BlockHandler.FIRST_APPLICATION_BLOCK;

	private recordCache: Cache<Value, A>;
	private blockHandler: BlockHandler;
	private recordParser: RecordParser<A>;
	private keyProvider?: ValueProvider<A>;

	getRecord(index: number): A {
		let block = this.blockHandler.readBlock(index);
		let string = block.toString().replace(/[\0]*$/, "");
		let json = JSON.parse(string);
		let record = this.recordParser(json);
		return record;
	}

	private *createIterable(nodeIndex: number, options?: Partial<{ path: Array<Buffer>, rank: number, recursive: boolean }>): Iterable<{ keyBytes: Buffer, index: number, rank: number }> {
		let rank = options?.rank ?? 0;
		let recursive = options?.recursive ?? false;
		let path = options?.path?.slice() ?? new Array<Buffer>();
		let node = new Node();
		this.blockHandler.readBlock(nodeIndex, node.buffer);
		path.push(node.prefix());
		if (node.resident() !== 0) {
			yield {
				keyBytes: Buffer.concat(path),
				index: node.resident(),
				rank: rank
			};
		}
		if (recursive) {
			if (this.blockHandler.getBlockSize(nodeIndex) >= Node.SIZE + NodeTable.SIZE) {
				let table = new NodeTable();
				this.blockHandler.readBlock(nodeIndex, table.buffer, Node.SIZE);
				for (let i = 0; i < NodeTable.LENGTH; i++) {
					if (table.subtree(i) !== 0) {
						yield* this.createIterable(table.subtree(i), {
							...options,
							path: [...path, Buffer.of(i)],
							rank: rank - 1
						});
					}
				}
			}
		}
	}

	constructor(blockHandler: BlockHandler, recordParser: RecordParser<A>, keyProvider?: ValueProvider<A>) {
		super();
		this.recordCache = new Cache<Value, A>((record) => 1, 1 * 1000 * 1000);
		this.blockHandler = blockHandler;
		this.recordParser = recordParser;
		this.keyProvider = keyProvider;
		if (blockHandler.getCount() === Table.ROOT_NODE_INDEX) {
			blockHandler.createBlock(Node.SIZE);
		}
	}

	*[Symbol.iterator](): Iterator<A> {
		yield* StreamIterable.of(this.createIterable(Table.ROOT_NODE_INDEX, { recursive: true }))
			.map((node) => this.getRecord(node.index))
			.slice();
	}

	debug(index: number = Table.ROOT_NODE_INDEX, depth: number = 0): void {
		let node = new Node();
		this.blockHandler.readBlock(index, node.buffer);
		console.log("\t".repeat(depth), `${node.prefix().toString("hex")}`);
		if (node.resident() !== 0) {
			console.log("\t".repeat(depth),`@ => #${node.resident()} (${JSON.stringify(this.getRecord(node.resident()))})`);
		}
		if (this.blockHandler.getBlockSize(index) >= Node.SIZE + NodeTable.SIZE) {
			let table = new NodeTable();
			this.blockHandler.readBlock(index, table.buffer, Node.SIZE);
			for (let i = 0; i < NodeTable.LENGTH; i++) {
				if (table.subtree(i) !== 0) {
					console.log("\t".repeat(depth), `${Buffer.of(i).toString("hex")} => #${table.subtree(i)}`);
					this.debug(table.subtree(i), depth + 1);
				}
			}
		}
	}

	entries(): Iterable<[Value, number, A]> {
		return StreamIterable.of(this.createIterable(Table.ROOT_NODE_INDEX, { recursive: true }))
			.map<[Value, number, A]>((node) => [deserializeKey(node.keyBytes), node.index, this.getRecord(node.index)])
			.slice();
	}

	insert(record: A | undefined, options?: Partial<{ key: Value, index: number }>): void {
		let serializedRecord = Buffer.from(JSON.stringify(record) ?? "");
		let key = (is.present(record) ? this.keyProvider?.(record) : undefined) ?? options?.key;
		let keyBytes = serializeKey(key);
		let keyByteIndex = 0;
		let currentNodeIndex = options?.index ?? Table.ROOT_NODE_INDEX;
		let currentNode = new Node();
		let newNodeIndex = 0;
		let newNode = new Node();
		let table = new NodeTable();
		while (true) {
			this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
			let prefixBytes = currentNode.prefix();
			let commonPrefixLength = computeCommonPrefixLength(prefixBytes, keyBytes, keyByteIndex);
			if (commonPrefixLength < prefixBytes.length) {
				newNodeIndex = this.blockHandler.createBlock(Node.SIZE);
				newNode.buffer.set(currentNode.buffer, 0);
				newNode.prefix(prefixBytes.slice(commonPrefixLength + 1));
				this.blockHandler.writeBlock(newNodeIndex, newNode.buffer, 0);
				currentNode.buffer.fill(0);
				currentNode.prefix(prefixBytes.slice(0, commonPrefixLength));
				this.blockHandler.writeBlock(currentNodeIndex, currentNode.buffer, 0);
				if (this.blockHandler.getBlockSize(currentNodeIndex) < Node.SIZE + NodeTable.SIZE) {
					this.blockHandler.resizeBlock(currentNodeIndex, Node.SIZE + NodeTable.SIZE);
				} else {
					this.blockHandler.readBlock(currentNodeIndex, table.buffer, Node.SIZE);
					this.blockHandler.resizeBlock(newNodeIndex, Node.SIZE + NodeTable.SIZE);
					this.blockHandler.writeBlock(newNodeIndex, table.buffer, Node.SIZE);
				}
				table.buffer.fill(0);
				table.subtree(prefixBytes[commonPrefixLength], newNodeIndex);
				this.blockHandler.writeBlock(currentNodeIndex, table.buffer, Node.SIZE);
			}
			let keyBytesLeft = keyBytes.length - keyByteIndex;
			if (keyBytesLeft === commonPrefixLength) {
				break;
			}
			keyByteIndex += commonPrefixLength;
			if (this.blockHandler.getBlockSize(currentNodeIndex) < Node.SIZE + NodeTable.SIZE) {
				this.blockHandler.resizeBlock(currentNodeIndex, Node.SIZE + NodeTable.SIZE);
			}
			this.blockHandler.readBlock(currentNodeIndex, table.buffer, Node.SIZE);
			if (table.subtree(keyBytes[keyByteIndex]) === 0) {
				newNodeIndex = this.blockHandler.createBlock(Node.SIZE);
				newNode.buffer.fill(0);
				newNode.prefix(keyBytes.slice(keyByteIndex + 1, keyByteIndex + 1 + Node.MAX_NIBBLES));
				this.blockHandler.writeBlock(newNodeIndex, newNode.buffer, 0);
				table.subtree(keyBytes[keyByteIndex], newNodeIndex);
				this.blockHandler.writeBlock(currentNodeIndex, table.buffer, Node.SIZE);
			}
			currentNodeIndex = table.subtree(keyBytes[keyByteIndex]);
			keyByteIndex += 1;
		}
		this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
		let index = currentNode.resident();
		if (index === 0) {
			let recordIndex = this.blockHandler.createBlock(serializedRecord.length);
			this.blockHandler.writeBlock(recordIndex, serializedRecord);
			index = currentNode.resident(recordIndex);
			this.blockHandler.writeBlock(currentNodeIndex, currentNode.buffer, 0);
			this.recordCache.insert(key, record);
			this.route("insert", {
				key: key,
				index: index,
				record: record
			});
		} else {
			let last = this.getRecord(index);
			this.blockHandler.resizeBlock(index, serializedRecord.length);
			this.blockHandler.writeBlock(index, serializedRecord);
			this.recordCache.insert(key, record);
			this.route("update", {
				key: key,
				index: index,
				next: record,
				last: last
			});
		}
	}

	lookup(key: Value, options?: Partial<{ index: number }>): A {
		let record = this.recordCache.lookup(key);
		if (is.present(record)) {
			return record;
		}
		let results = this.search(key, options);
		for (let result of results) {
			let record = result.lookup();
			if (result.keyBytes.equals(serializeKey(key))) {
				this.recordCache.insert(key, record);
				return record;
			}
			break;
		}
		throw `Expected a record for ${key}!`;
	}

	remove(record: A | undefined, options?: Partial<{ key: Value, index: number }>): void {
		let key = (is.present(record) ? this.keyProvider?.(record) : undefined) ?? options?.key;
		let keyBytes = serializeKey(key);
		let keyByteIndex = 0;
		let currentNodeIndex = options?.index ?? Table.ROOT_NODE_INDEX;
		let currentNode = new Node();
		let table = new NodeTable();
		while (true) {
			this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
			let prefixBytes = currentNode.prefix();
			let commonPrefixLength = computeCommonPrefixLength(prefixBytes, keyBytes, keyByteIndex);
			if (commonPrefixLength < prefixBytes.length) {
				return;
			}
			let keyBytesLeft = keyBytes.length - keyByteIndex;
			if (keyBytesLeft === commonPrefixLength) {
				break;
			}
			keyByteIndex += commonPrefixLength;
			if (this.blockHandler.getBlockSize(currentNodeIndex) < Node.SIZE + NodeTable.SIZE) {
				return;
			}
			this.blockHandler.readBlock(currentNodeIndex, table.buffer, Node.SIZE);
			if (table.subtree(keyBytes[keyByteIndex]) === 0) {
				return;
			}
			currentNodeIndex = table.subtree(keyBytes[keyByteIndex]);
			keyByteIndex += 1;
		}
		this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
		if (currentNode.resident() !== 0) {
			let index = currentNode.resident();
			this.blockHandler.deleteBlock(index);
			currentNode.resident(0);
			this.blockHandler.writeBlock(currentNodeIndex, currentNode.buffer, 0);
			this.recordCache.remove(key);
			this.route("remove", {
				key: key,
				index: index,
				record: record
			});
		}
	}

	search(key: Value, options?: Partial<{ index: number, prefix: boolean }>): StreamIterable<SearchResult<A>> {
		let keyBytes = serializeKey(key);
		let keyByteIndex = 0;
		let currentNodeIndex = options?.index ?? Table.ROOT_NODE_INDEX;
		let currentNode = new Node();
		let table = new NodeTable();
		while (true) {
			this.blockHandler.readBlock(currentNodeIndex, currentNode.buffer);
			let prefixBytes = currentNode.prefix();
			let commonPrefixLength = computeCommonPrefixLength(prefixBytes, keyBytes, keyByteIndex);
			if (commonPrefixLength < prefixBytes.length) {
				return StreamIterable.of([]);
			}
			let keyBytesLeft = keyBytes.length - keyByteIndex;
			if (keyBytesLeft === commonPrefixLength) {
				break;
			}
			keyByteIndex += commonPrefixLength;
			if (this.blockHandler.getBlockSize(currentNodeIndex) < Node.SIZE + NodeTable.SIZE) {
				return StreamIterable.of([]);
			}
			this.blockHandler.readBlock(currentNodeIndex, table.buffer, Node.SIZE);
			if (table.subtree(keyBytes[keyByteIndex]) === 0) {
				return StreamIterable.of([]);
			}
			currentNodeIndex = table.subtree(keyBytes[keyByteIndex]);
			keyByteIndex += 1;
		}
		let prefix = options?.prefix ?? false;
		return StreamIterable.of(this.createIterable(currentNodeIndex, { path: [keyBytes.slice(0, keyByteIndex)], recursive: prefix }))
			.map((node) => ({
				...node,
				lookup: () => this.getRecord(node.index)
			}));
	}

	update(record: A): void {
		this.insert(record);
	}
};

export class RobinHoodHash {
	private blockHandler: BlockHandler;
	private blockIndex: number;

	private readHeader(): { occupiedSlots: number } {
		let buffer = Buffer.alloc(16);
		this.blockHandler.readBlock(this.blockIndex, buffer, 0);
		let occupiedSlots = Number(buffer.readBigUInt64BE(0));
		return {
			occupiedSlots
		};
	}

	private writeHeader(header: { occupiedSlots: number }): void {
		let buffer = Buffer.alloc(16);
		buffer.writeBigUInt64BE(BigInt(header.occupiedSlots), 0);
		this.blockHandler.writeBlock(this.blockIndex, buffer, 0);
	}

	private getSlotCount(): number {
		let blockSize = this.blockHandler.getBlockSize(this.blockIndex);
		return (blockSize - 16) / 8;
	}

	private computeOptimalSlot(key: Buffer): number {
		let hash = libcrypto.createHash("sha256")
			.update(key)
			.digest();
		let slotCount = this.getSlotCount();
		let optimalSlot = Number(hash.readBigUInt64BE(0) % BigInt(slotCount));
		return optimalSlot;
	}

	private loadSlot(slot: number): { probeDistance: number, isOccupied: boolean, value: number } {
		let buffer = Buffer.alloc(8);
		this.blockHandler.readBlock(this.blockIndex, buffer, 16 + slot * 8);
		let probeDistance = buffer.readUInt8(0);
		let isOccupied = buffer.readUInt8(1) === 0x01;
		let value = Number(buffer.readBigUInt64BE(0) & 0x0000FFFFFFFFFFFFn);
		return {
			probeDistance,
			isOccupied,
			value
		};
	}

	private saveSlot(slot: number, value: number, probeDistance: number, isOccupied: boolean): void {
		let buffer = Buffer.alloc(8);
		buffer.writeBigUInt64BE(BigInt(value), 0);
		buffer.writeUInt8(probeDistance, 0);
		buffer.writeUInt8(isOccupied ? 0x01 : 0x00, 1);
		this.blockHandler.writeBlock(this.blockIndex, buffer, 16 + slot * 8);
	}

	private resizeIfNeccessary(): void {
		let slotCount = this.getSlotCount();
		let occupiedSlots = this.readHeader().occupiedSlots;
		let currentLoadFactor = occupiedSlots / slotCount;
		let desiredSlotCount = slotCount;
		if (currentLoadFactor <= 0.25) {
			desiredSlotCount = Math.ceil(slotCount / 2);
		}
		if (currentLoadFactor >= 0.75) {
			desiredSlotCount = slotCount * 2;
		}
		if (desiredSlotCount === slotCount) {
			return;
		}
		let values = StreamIterable.of(this).collect();
		let minLength = 16 + desiredSlotCount * 8;
		this.blockHandler.resizeBlock(this.blockIndex, minLength);
		let newSlotCount = this.getSlotCount();
		if (newSlotCount === slotCount) {
			return;
		}
		this.blockHandler.clearBlock(this.blockIndex);
		for (let value of values) {
			this.insertWithoutResize(value);
		}
	}

	private insertWithoutResize(valueToInsert: number): void {
		let key = Buffer.alloc(8);
		key.writeBigUInt64BE(BigInt(valueToInsert), 0);
		let optimalSlot = this.computeOptimalSlot(key);
		let slotCount = this.getSlotCount();
		let currentSlot = optimalSlot;
		let currentProbeDistance = 0;
		for (let i = 0; i < slotCount; i++) {
			let { probeDistance, isOccupied, value } = this.loadSlot(currentSlot);
			if (!isOccupied) {
				this.saveSlot(currentSlot, valueToInsert, currentProbeDistance, true);
				let header = this.readHeader();
				header.occupiedSlots += 1;
				this.writeHeader(header);
				break;
			}
			if (value === valueToInsert) {
				return;
			}
			if (currentProbeDistance > probeDistance) {
				this.saveSlot(currentSlot, valueToInsert, currentProbeDistance, true);
				valueToInsert = value;
				currentProbeDistance = probeDistance;
			}
			currentSlot = (currentSlot + 1) % slotCount;
			currentProbeDistance += 1;
		}
	}

	constructor(blockHandler: BlockHandler, blockIndex: number) {
		this.blockHandler = blockHandler;
		this.blockIndex = blockIndex;
	}

	*[Symbol.iterator](): Iterator<number> {
		let slotCount = this.getSlotCount();
		for (let slot = 0; slot < slotCount; slot++) {
			let { isOccupied, value } = this.loadSlot(slot);
			if (isOccupied) {
				yield value;
			}
		}
	}

	insert(valueToInsert: number): void {
		this.insertWithoutResize(valueToInsert);
		this.resizeIfNeccessary();
	}

	remove(valueToRemove: number): void {
		if (DEBUG) IntegerAssert.atLeast(0, valueToRemove);
		let key = Buffer.alloc(8);
		key.writeBigUInt64BE(BigInt(valueToRemove), 0);
		let optimalSlot = this.computeOptimalSlot(key);
		let slotCount = this.getSlotCount();
		let currentSlot = optimalSlot;
		let currentProbeDistance = 0;
		for (let i = 0; i < slotCount; i++) {
			let { probeDistance, isOccupied, value } = this.loadSlot(currentSlot);
			if (value === valueToRemove) {
				this.saveSlot(currentSlot, 0, 0, false);
				let header = this.readHeader();
				header.occupiedSlots -= 1;
				this.writeHeader(header);
				break;
			}
			if (probeDistance > currentProbeDistance) {
				return;
			}
			currentSlot = (currentSlot + 1) % slotCount;
			currentProbeDistance += 1;
		}
		for (let i = 0; i < slotCount; i++) {
			let { probeDistance, value } = this.loadSlot((currentSlot + 1) % slotCount);
			if (probeDistance === 0) {
				break;
			}
			this.saveSlot(currentSlot, value, probeDistance - 1, true);
			this.saveSlot((currentSlot + 1) % slotCount, 0, 0, false);
			currentSlot = (currentSlot + 1) % slotCount;
		}
		this.resizeIfNeccessary();
	}
};

export class Index<A, B> {
	static NUMBER_TOKENIZER: Tokenizer = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		normalized = normalized.replace(/['"`´]+/g, "");
		return Array.from(normalized.match(/(\p{N}+)/gu) ?? []);
	};
	static QUERY_TOKENIZER: Tokenizer = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		normalized = normalized.replace(/['"`´]+/g, "");
		return Array.from(normalized.match(/(\p{L}+|\p{N}+)/gu) ?? []);
	};
	static VALUE_TOKENIZER: Tokenizer = (value) => {
		return [value];
	};
	static WORD_TOKENIZER: Tokenizer = (value) => {
		let normalized = String(value);
		normalized = normalized.toLowerCase();
		normalized = normalized.normalize("NFC");
		normalized = normalized.replace(/['"`´]+/g, "");
		return Array.from(normalized.match(/(\p{L}+)/gu) ?? []);
	};

	private tokenTable: Table<number>;
	private parentTable: Table<A>;
	private childTable: Table<B>;
	private getIndexedValues: ValuesProvider<B>;
	private getTokens: Tokenizer;
	private blockHandler: BlockHandler;

	constructor(blockHandler: BlockHandler, parentTable: Table<A>, childTable: Table<B>, getIndexedValues: ValuesProvider<B>, getTokens: Tokenizer = Index.VALUE_TOKENIZER) {
		let tokenTable = new Table<number>(blockHandler, autoguard.guards.Number.as);
		function insert(key: Value, index: number, record: B | undefined) {
			let values = is.present(record) ? getIndexedValues(record) : [];
			for (let value of values) {
				let tokens = getTokens(value);
				for (let token of tokens) {
					let rhIndex: number | undefined;
					try {
						rhIndex = tokenTable.lookup(token);
					} catch (error) {}
					if (is.absent(rhIndex)) {
						rhIndex = blockHandler.createBlock(64);
						tokenTable.insert(rhIndex, {
							key: token
						});
					}
					let rhh = new RobinHoodHash(blockHandler, rhIndex);
					rhh.insert(index);
				}
			}
		}
		function remove(key: Value, index: number, record: B | undefined) {
			let values = is.present(record) ? getIndexedValues(record) : [];
			for (let value of values) {
				let tokens = getTokens(value);
				for (let token of tokens) {
					let rhIndex: number | undefined;
					try {
						rhIndex = tokenTable.lookup(token);
					} catch (error) {
						continue;
					}
					let rhh = new RobinHoodHash(blockHandler, rhIndex);
					rhh.remove(index);
				}
			}
		}
		childTable.addObserver("insert", (event) => {
			insert(event.key, event.index, event.record)
		});
		childTable.addObserver("remove", (event) => {
			remove(event.key, event.index, event.record);
		});
		childTable.addObserver("update", (event) => {
			remove(event.key, event.index, event.last);
			insert(event.key, event.index, event.next);
		});
		parentTable.addObserver("remove", (event) => {
			let token = event.key;
			let results = tokenTable.search(token);
			for (let result of results) {
				let rhIndex = result.lookup();
				let rhh = new RobinHoodHash(this.blockHandler, rhIndex);
				for (let index of rhh) {
					try {
						let record = childTable.getRecord(index);
						childTable.remove(record);
					} catch (error) {}
				}
			}
		});
		if (blockHandler.getCount() === Table.ROOT_NODE_INDEX + 1) {
			for (let [key, index, record] of childTable.entries()) {
				insert(key, index, record);
			}
		}
		this.blockHandler = blockHandler;
		this.tokenTable = tokenTable;
		this.parentTable = parentTable;
		this.childTable = childTable;
		this.getIndexedValues = getIndexedValues;
		this.getTokens = getTokens;
	}

	debug(): void {
		for (let [key, index, record] of this.tokenTable.entries()) {
			let rhh = new RobinHoodHash(this.blockHandler, record);
			console.log(`${key} => ${index}`);
			for (let index of rhh) {
				console.log(`\t${index}`);
			}
		}
	}

	lookup(query: Value): StreamIterable<B> {
		return this.search(query)
			.map((result) => result.lookup())
			.slice();
	}

	search(query: Value): StreamIterable<SearchResult<B>> {
		let tokens = this.getTokens(query);
		let map = new Map<number, number>();
		for (let token of tokens) {
			let results = this.tokenTable.search(token);
			for (let result of results) {
				let rhIndex = result.lookup();
				let rhh = new RobinHoodHash(this.blockHandler, rhIndex);
				for (let index of rhh) {
					let key = index;
					let rank = map.get(key) ?? (0 - tokens.length);
					map.set(key, rank + 2);
				}
			}
		}
		return StreamIterable.of(map.entries())
			.filter((result) => result[1] >= 0)
			.sort(sorters.NumericSort.decreasing((result) => result[1]))
			.map((entry) => ({
				keyBytes: Buffer.alloc(0),
				rank: entry[1],
				lookup: () => this.childTable.getRecord(entry[0])
			}));
	}
};
