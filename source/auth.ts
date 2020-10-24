import * as libcrypto from "crypto";
import * as data from "./data";
import * as passwords from "./passwords";

function generate_token(username: string): string {
	let selector = libcrypto.randomBytes(16);
	let validator = libcrypto.randomBytes(16);
	let hash = libcrypto.createHash('sha256');
	hash.update(validator);
	let validator_hash = hash.digest('hex');
	data.createToken({
		username: username,
		selector: selector.toString('hex'),
		validator_hash: validator_hash,
		expires_ms: Date.now() + (7 * 24 * 60 * 60 * 1000)
	});
	return `${selector.toString('hex')}${validator.toString('hex')}`;
}

export function createToken(username: string, password: string): string {
	let user = data.getUserFromUsername.lookup(username);
	if (!passwords.verify(password, user.password)) {
		throw `Expected a valid password!`;
	}
	return generate_token(username);
}

export function getUsername(chunk: string): string {
	let parts = /^([0-9a-f]{32})([0-9a-f]{32})$/.exec(chunk);
	if (!parts) {
		throw new Error();
	}
	let selector = parts[1];
	let validator = parts[2];
	let token = data.getTokenFromTokenId.lookup(selector);
	if (token.expires_ms < Date.now()) {
		throw `Token has expired!`;
	}
	let hash = libcrypto.createHash('sha256');
	hash.update(Buffer.from(validator, 'hex'));
	let validator_hash = hash.digest();
	if (!libcrypto.timingSafeEqual(Buffer.from(token.validator_hash, 'hex'), validator_hash)) {
		throw new Error();
	}
	let expires_ms = Date.now() + (7 * 24 * 60 * 60 * 1000);
	data.updateToken({
		...token,
		expires_ms
	});
	return token.username;
}
