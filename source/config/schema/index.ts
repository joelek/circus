// This file was auto-generated by @joelek/autoguard. Edit at own risk.

import * as autoguard from "@joelek/autoguard/dist/lib-shared";

export const Config: autoguard.serialization.MessageGuard<Config> = autoguard.guards.Object.of({
	"certificate_key_path": autoguard.guards.Array.of(autoguard.guards.String),
	"certificate_path": autoguard.guards.Array.of(autoguard.guards.String),
	"http_port": autoguard.guards.Number,
	"https_port": autoguard.guards.Number,
	"media_path": autoguard.guards.Array.of(autoguard.guards.String),
	"use_demo_mode": autoguard.guards.Boolean,
	"use_registration_keys": autoguard.guards.Boolean
}, {});

export type Config = autoguard.guards.Object<{
	"certificate_key_path": autoguard.guards.Array<autoguard.guards.String>,
	"certificate_path": autoguard.guards.Array<autoguard.guards.String>,
	"http_port": autoguard.guards.Number,
	"https_port": autoguard.guards.Number,
	"media_path": autoguard.guards.Array<autoguard.guards.String>,
	"use_demo_mode": autoguard.guards.Boolean,
	"use_registration_keys": autoguard.guards.Boolean
}, {}>;

export namespace Autoguard {
	export const Guards = {
		"Config": autoguard.guards.Reference.of(() => Config)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
