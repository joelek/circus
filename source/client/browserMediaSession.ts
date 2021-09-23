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
	play?: (() => void) | null,
	pause?: (() => void) | null,
	seekbackward?: ((details: { seekOffset?: number }) => void) | null,
	seekforward?: ((details: { seekOffset?: number }) => void) | null,
	seekto?: ((details: { fastSeek?: boolean, seekTime: number }) => void) | null,
	previoustrack?: (() => void) | null,
	nexttrack?: (() => void) | null
}

export function setHandlers(handlers: MediaHandlers) {
	if (navigator.mediaSession) {
		for (let type in handlers) {
			navigator.mediaSession.setActionHandler(type, handlers[type]);
		}
	}
}
