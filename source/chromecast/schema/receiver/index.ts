// This file was auto-generated by @joelek/autoguard. Edit at own risk.

import * as autoguard from "@joelek/autoguard/dist/lib-shared";

export const LAUNCH: autoguard.serialization.MessageGuard<LAUNCH> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("LAUNCH"),
	"requestId": autoguard.guards.Number,
	"appId": autoguard.guards.String
}, {});

export type LAUNCH = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"LAUNCH">,
	"requestId": autoguard.guards.Number,
	"appId": autoguard.guards.String
}, {}>;

export const STOP: autoguard.serialization.MessageGuard<STOP> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("STOP"),
	"requestId": autoguard.guards.Number,
	"sessionId": autoguard.guards.String
}, {});

export type STOP = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"STOP">,
	"requestId": autoguard.guards.Number,
	"sessionId": autoguard.guards.String
}, {}>;

export const GET_STATUS: autoguard.serialization.MessageGuard<GET_STATUS> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("GET_STATUS"),
	"requestId": autoguard.guards.Number
}, {});

export type GET_STATUS = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"GET_STATUS">,
	"requestId": autoguard.guards.Number
}, {}>;

export const GET_APP_AVAILABILITY: autoguard.serialization.MessageGuard<GET_APP_AVAILABILITY> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("GET_APP_AVAILABILITY"),
	"requestId": autoguard.guards.Number,
	"appId": autoguard.guards.Array.of(autoguard.guards.String)
}, {});

export type GET_APP_AVAILABILITY = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"GET_APP_AVAILABILITY">,
	"requestId": autoguard.guards.Number,
	"appId": autoguard.guards.Array<autoguard.guards.String>
}, {}>;

export const SET_VOLUME: autoguard.serialization.MessageGuard<SET_VOLUME> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("SET_VOLUME"),
	"requestId": autoguard.guards.Number,
	"volume": autoguard.guards.Group.of(autoguard.guards.Union.of(
		autoguard.guards.Object.of({
			"level": autoguard.guards.Number
		}, {}),
		autoguard.guards.Object.of({
			"muted": autoguard.guards.Boolean
		}, {})
	))
}, {});

export type SET_VOLUME = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"SET_VOLUME">,
	"requestId": autoguard.guards.Number,
	"volume": autoguard.guards.Group<autoguard.guards.Union<[
		autoguard.guards.Object<{
			"level": autoguard.guards.Number
		}, {}>,
		autoguard.guards.Object<{
			"muted": autoguard.guards.Boolean
		}, {}>
	]>>
}, {}>;

export const RECEIVER_STATUS: autoguard.serialization.MessageGuard<RECEIVER_STATUS> = autoguard.guards.Object.of({
	"type": autoguard.guards.StringLiteral.of("RECEIVER_STATUS"),
	"requestId": autoguard.guards.Number,
	"status": autoguard.guards.Object.of({
		"userEq": autoguard.guards.Object.of({}, {}),
		"volume": autoguard.guards.Object.of({
			"controlType": autoguard.guards.String,
			"level": autoguard.guards.Number,
			"muted": autoguard.guards.Boolean,
			"stepInterval": autoguard.guards.Number
		}, {})
	}, {
		"applications": autoguard.guards.Array.of(autoguard.guards.Object.of({
			"appId": autoguard.guards.String,
			"displayName": autoguard.guards.String,
			"iconUrl": autoguard.guards.String,
			"isIdleScreen": autoguard.guards.Boolean,
			"launchedFromCloud": autoguard.guards.Boolean,
			"namespaces": autoguard.guards.Array.of(autoguard.guards.Object.of({
				"name": autoguard.guards.String
			}, {})),
			"sessionId": autoguard.guards.String,
			"statusText": autoguard.guards.String,
			"transportId": autoguard.guards.String
		}, {}))
	})
}, {});

export type RECEIVER_STATUS = autoguard.guards.Object<{
	"type": autoguard.guards.StringLiteral<"RECEIVER_STATUS">,
	"requestId": autoguard.guards.Number,
	"status": autoguard.guards.Object<{
		"userEq": autoguard.guards.Object<{}, {}>,
		"volume": autoguard.guards.Object<{
			"controlType": autoguard.guards.String,
			"level": autoguard.guards.Number,
			"muted": autoguard.guards.Boolean,
			"stepInterval": autoguard.guards.Number
		}, {}>
	}, {
		"applications": autoguard.guards.Array<autoguard.guards.Object<{
			"appId": autoguard.guards.String,
			"displayName": autoguard.guards.String,
			"iconUrl": autoguard.guards.String,
			"isIdleScreen": autoguard.guards.Boolean,
			"launchedFromCloud": autoguard.guards.Boolean,
			"namespaces": autoguard.guards.Array<autoguard.guards.Object<{
				"name": autoguard.guards.String
			}, {}>>,
			"sessionId": autoguard.guards.String,
			"statusText": autoguard.guards.String,
			"transportId": autoguard.guards.String
		}, {}>>
	}>
}, {}>;

export namespace Autoguard {
	export const Guards = {
		"LAUNCH": autoguard.guards.Reference.of(() => LAUNCH),
		"STOP": autoguard.guards.Reference.of(() => STOP),
		"GET_STATUS": autoguard.guards.Reference.of(() => GET_STATUS),
		"GET_APP_AVAILABILITY": autoguard.guards.Reference.of(() => GET_APP_AVAILABILITY),
		"SET_VOLUME": autoguard.guards.Reference.of(() => SET_VOLUME),
		"RECEIVER_STATUS": autoguard.guards.Reference.of(() => RECEIVER_STATUS)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
