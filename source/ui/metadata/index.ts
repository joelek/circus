export function formatSize(b: number): string {
	let kb = b / 1024**1;
	let mb = b / 1024**2;
	let gb = b / 1024**3;
	let tb = b / 1024**4;
	if (tb > 1) {
		return `${tb.toFixed(2)}TB`;
	} else if (gb > 1) {
		return `${gb.toFixed(2)}GB`;
	} else if (mb > 1) {
		return `${mb.toFixed(2)}MB`;
	} else if (kb > 1) {
		return `${kb.toFixed(2)}kB`;
	} else {
		return `${b}B`;
	}
};

type Duration = {
	ms: number,
	s: number,
	m: number,
	h: number,
	d: number
};

export function computeDuration(ms: number): Duration {
	let s = Math.floor(ms / 1000);
	ms -= s * 1000;
	let m = Math.floor(s / 60);
	s -= m * 60;
	let h = Math.floor(m / 60);
	m -= h * 60;
	let d = Math.floor(h / 24);
	h -= d * 24;
	return {
		ms,
		s,
		m,
		h,
		d
	};
};

export function formatDuration(ms: number): string {
	let duration = computeDuration(ms);
	if (duration.d >= 10) {
		return `${duration.d}d`;
	} else if (duration.d >= 1) {
		return `${duration.d}d ${duration.h}h`;
	} else if (duration.h >= 10) {
		return `${duration.h}h`;
	} else if (duration.h >= 1) {
		return `${duration.h}h ${duration.m}m`;
	} else if (duration.m >= 10) {
		return `${duration.m}m`;
	} else if (duration.m >= 1) {
		return `${duration.m}m ${duration.s}s`;
	} else {
		return `${duration.s}s`;
	}
};
