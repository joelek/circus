import * as libcrypto from "crypto";
import * as passwords from "./passwords";
import * as atlas from "../database/atlas";
import { ReadableQueue, WritableQueue } from "@joelek/atlas";
import { binid, hexid } from "../utils";

// TODO: Move to handler.

async function generate_token(queue: WritableQueue, user_id: string): Promise<string> {
	let selector = libcrypto.randomBytes(8);
	let validator = libcrypto.randomBytes(8);
	let hash = libcrypto.createHash("sha256");
	hash.update(validator);
	let validator_hash = hash.digest();
	await atlas.stores.tokens.insert(queue, {
		token_id: Uint8Array.from(selector),
		user_id: binid(user_id),
		hash: Uint8Array.from(validator_hash),
		expires_ms: Date.now() + (7 * 24 * 60 * 60 * 1000)
	});
	return `${selector.toString("hex")}${validator.toString("hex")}`;
};

export async function createToken(queue: WritableQueue, username: string, password: string): Promise<string> {
	let users = await atlas.queries.getUsersFromUsername.filter(queue, { username });
	let user = users.pop();
	if (!user) {
		throw 401;
	}
	if (!passwords.verify(password, user.password)) {
		throw 401;
	}
	return generate_token(queue, hexid(user.user_id));
};

export function parseToken(chunk: string): { selector: string, validator: string } {
	let parts = /^([0-9a-f]{16})([0-9a-f]{16})$/.exec(chunk);
	if (!parts) {
		throw 400;
	}
	let selector = parts[1];
	let validator = parts[2];
	return {
		selector,
		validator
	};
};

export async function refreshToken(queue: WritableQueue, chunk: string): Promise<void> {
	let { selector } = { ...parseToken(chunk) };
	let token = await atlas.stores.tokens.lookup(queue, { token_id: binid(selector) });
	token.expires_ms = Date.now() + (7 * 24 * 60 * 60 * 1000);
	await atlas.stores.tokens.update(queue, token);
};

export async function getUserId(queue: ReadableQueue, chunk: string): Promise<string> {
	let { selector, validator } = { ...parseToken(chunk) };
	let token = await atlas.stores.tokens.lookup(queue, { token_id: binid(selector) });
	if (token.expires_ms < Date.now()) {
		throw 401;
	}
	let hash = libcrypto.createHash("sha256");
	hash.update(Buffer.from(validator, "hex"));
	let validator_hash = hash.digest();
	if (!libcrypto.timingSafeEqual(token.hash, validator_hash)) {
		throw 401;
	}
	return hexid(token.user_id);
};
