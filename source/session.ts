// @ts-nocheck

export interface MediaImage {
	src?: string,
	sizes?: string,
	type?: string
}

export interface MediaMetadata {
	title?: string,
	artist?: string,
	album?: string,
	artwork?: Array<MediaImage>
}

export function setMetadata(metadata: MediaMetadata) {
	if (navigator.mediaSession) {
		navigator.mediaSession.metadata = new globalThis.MediaMetadata(metadata);
	}
}

export interface MediaHandler {
	(): void
}

export interface MediaHandlers {
	play?: MediaHandler,
	pause?: MediaHandler,
	seekbackward?: MediaHandler,
	seekforward?: MediaHandler,
	previoustrack?: MediaHandler,
	nexttrack?: MediaHandler
}

export function setHandlers(handlers: MediaHandlers) {
	if (navigator.mediaSession) {
		for (let type in handlers) {
			navigator.mediaSession.setActionHandler(type, handlers[type]);
		}
	}
}
