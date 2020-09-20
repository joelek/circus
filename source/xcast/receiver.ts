// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import { guards as autoguard } from "@joelek/ts-autoguard";

export type Launch = {
	"type": "LAUNCH",
	"appId": string
};

export const Launch = autoguard.Object.of({
	"type": autoguard.StringLiteral.of("LAUNCH"),
	"appId": autoguard.String
});

export type Stop = {
	"type": "STOP",
	"sessionId": string
};

export const Stop = autoguard.Object.of({
	"type": autoguard.StringLiteral.of("STOP"),
	"sessionId": autoguard.String
});

export type GetStatus = {
	"type": "GET_STATUS"
};

export const GetStatus = autoguard.Object.of({
	"type": autoguard.StringLiteral.of("GET_STATUS")
});

export type GetAppAvailability = {
	"type": "GET_APP_AVAILABILITY",
	"appId": string[]
};

export const GetAppAvailability = autoguard.Object.of({
	"type": autoguard.StringLiteral.of("GET_APP_AVAILABILITY"),
	"appId": autoguard.Array.of(autoguard.String)
});

export type SetVolume = {
	"type": "SET_VOLUME",
	"volume": ({
		"level": number
	} | {
		"muted": boolean
	})
};

export const SetVolume = autoguard.Object.of({
	"type": autoguard.StringLiteral.of("SET_VOLUME"),
	"volume": autoguard.Union.of(
		autoguard.Object.of({
			"level": autoguard.Number
		}),
		autoguard.Object.of({
			"muted": autoguard.Boolean
		})
	)
});

export type ReceiverStatus = {
	"type": "RECEIVER_STATUS",
	"requestId": number,
	"status": {
		"applications": [
			{
				"appId": string,
				"displayName": string,
				"namespaces": string[],
				"sessionId": string,
				"statusText": string,
				"transportId": string
			}
		],
		"isActiveInput": boolean,
		"volume": {
			"level": number,
			"muted": boolean
		}
	}
};

export const ReceiverStatus = autoguard.Object.of({
	"type": autoguard.StringLiteral.of("RECEIVER_STATUS"),
	"requestId": autoguard.Number,
	"status": autoguard.Object.of({
		"applications": autoguard.Tuple.of(
			autoguard.Object.of({
				"appId": autoguard.String,
				"displayName": autoguard.String,
				"namespaces": autoguard.Array.of(autoguard.String),
				"sessionId": autoguard.String,
				"statusText": autoguard.String,
				"transportId": autoguard.String
			})
		),
		"isActiveInput": autoguard.Boolean,
		"volume": autoguard.Object.of({
			"level": autoguard.Number,
			"muted": autoguard.Boolean
		})
	})
});

export type Autoguard = {
	"Launch": Launch,
	"Stop": Stop,
	"GetStatus": GetStatus,
	"GetAppAvailability": GetAppAvailability,
	"SetVolume": SetVolume,
	"ReceiverStatus": ReceiverStatus
};

export const Autoguard = {
	"Launch": Launch,
	"Stop": Stop,
	"GetStatus": GetStatus,
	"GetAppAvailability": GetAppAvailability,
	"SetVolume": SetVolume,
	"ReceiverStatus": ReceiverStatus
};
