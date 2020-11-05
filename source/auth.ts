import * as libcrypto from "crypto";
import * as indexer from "./indexer";
import * as passwords from "./passwords";

function generate_token(user_id: string): string {
	let selector = libcrypto.randomBytes(16);
	let validator = libcrypto.randomBytes(16);
	let hash = libcrypto.createHash('sha256');
	hash.update(validator);
	let validator_hash = hash.digest('hex');
	indexer.tokens.insert({
		token_id: selector.toString('hex'),
		user_id: user_id,
		hash: validator_hash,
		expires_ms: Date.now() + (7 * 24 * 60 * 60 * 1000)
	});
	return `${selector.toString('hex')}${validator.toString('hex')}`;
}

export function createToken(username: string, password: string): string {
	let users = indexer.getUsersFromUsername.lookup(username);
	let user = users.shift();
	if (!user) {
		throw ``;
	}
	if (!passwords.verify(password, user.password)) {
		throw `Expected a valid password!`;
	}
	return generate_token(user.user_id);
}

export function getUserId(chunk: string): string {
	let parts = /^([0-9a-f]{32})([0-9a-f]{32})$/.exec(chunk);
	if (!parts) {
		throw new Error();
	}
	let selector = parts[1];
	let validator = parts[2];
	let token = indexer.tokens.lookup(selector);
	if (token.expires_ms < Date.now()) {
		throw `Token has expired!`;
	}
	let hash = libcrypto.createHash('sha256');
	hash.update(Buffer.from(validator, 'hex'));
	let validator_hash = hash.digest();
	if (!libcrypto.timingSafeEqual(Buffer.from(token.hash, 'hex'), validator_hash)) {
		throw new Error();
	}
	let expires_ms = Date.now() + (7 * 24 * 60 * 60 * 1000);
	indexer.tokens.update({
		...token,
		expires_ms
	});
	return token.user_id;
}
