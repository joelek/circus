// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard";

export const PING = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("PING")
});

export type PING = ReturnType<typeof PING["as"]>;

export const PONG = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("PONG")
});

export type PONG = ReturnType<typeof PONG["as"]>;

export namespace Autoguard {
	export const Guards = {
		"PING": autoguard.guards.Reference.of(() => PING),
		"PONG": autoguard.guards.Reference.of(() => PONG)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};