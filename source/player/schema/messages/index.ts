// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard";
import { Context } from ".././objects";
import { Device } from ".././objects";

export const SetContext = autoguard.guards.Object.of({
	"context": autoguard.guards.Union.of(
		autoguard.guards.Undefined,
		autoguard.guards.Reference.of(() => Context)
	)
});

export type SetContext = ReturnType<typeof SetContext["as"]>;

export const SetDevice = autoguard.guards.Object.of({
	"device": autoguard.guards.Union.of(
		autoguard.guards.Undefined,
		autoguard.guards.Reference.of(() => Device)
	)
});

export type SetDevice = ReturnType<typeof SetDevice["as"]>;

export const SetDevices = autoguard.guards.Object.of({
	"devices": autoguard.guards.Array.of(autoguard.guards.Reference.of(() => Device))
});

export type SetDevices = ReturnType<typeof SetDevices["as"]>;

export const SetIndex = autoguard.guards.Object.of({
	"index": autoguard.guards.Union.of(
		autoguard.guards.Undefined,
		autoguard.guards.Number
	)
});

export type SetIndex = ReturnType<typeof SetIndex["as"]>;

export const SetLocalDevice = autoguard.guards.Object.of({
	"device": autoguard.guards.Reference.of(() => Device)
});

export type SetLocalDevice = ReturnType<typeof SetLocalDevice["as"]>;

export const SetPlayback = autoguard.guards.Object.of({
	"playback": autoguard.guards.Boolean
});

export type SetPlayback = ReturnType<typeof SetPlayback["as"]>;

export const SetProgress = autoguard.guards.Object.of({
	"progress": autoguard.guards.Union.of(
		autoguard.guards.Undefined,
		autoguard.guards.Number
	)
});

export type SetProgress = ReturnType<typeof SetProgress["as"]>;

export const SetToken = autoguard.guards.Object.of({
	"token": autoguard.guards.Union.of(
		autoguard.guards.Undefined,
		autoguard.guards.String
	)
});

export type SetToken = ReturnType<typeof SetToken["as"]>;

export namespace Autoguard {
	export const Guards = {
		"SetContext": autoguard.guards.Reference.of(() => SetContext),
		"SetDevice": autoguard.guards.Reference.of(() => SetDevice),
		"SetDevices": autoguard.guards.Reference.of(() => SetDevices),
		"SetIndex": autoguard.guards.Reference.of(() => SetIndex),
		"SetLocalDevice": autoguard.guards.Reference.of(() => SetLocalDevice),
		"SetPlayback": autoguard.guards.Reference.of(() => SetPlayback),
		"SetProgress": autoguard.guards.Reference.of(() => SetProgress),
		"SetToken": autoguard.guards.Reference.of(() => SetToken)
	};

	export type Guards = { [A in keyof typeof Guards]: ReturnType<typeof Guards[A]["as"]>; };

	export const Requests = {};

	export type Requests = { [A in keyof typeof Requests]: ReturnType<typeof Requests[A]["as"]>; };

	export const Responses = {};

	export type Responses = { [A in keyof typeof Responses]: ReturnType<typeof Responses[A]["as"]>; };
};
