import * as http from "./http";

export function play(outgoing_socket: http.OutboundSocket, session_id: string, url: string, progress_factor: number): Promise<http.Response> {
	return outgoing_socket.request({
		method: "POST",
		path: `/play`,
		headers: [
			{ key: "Content-Type", value: "text/parameters" },
			{ key: "X-Apple-Session-ID", value: session_id },
		],
		body: Buffer.from([
			`Content-Location: ${url}`,
			`Start-Position: ${progress_factor}`,
			``
		].join("\n"))
	});
};

export function rate(outgoing_socket: http.OutboundSocket, session_id: string, factor: number): Promise<http.Response> {
	return outgoing_socket.request({
		method: "POST",
		path: `/rate?value=${factor}`,
		headers: [
			{ key: "X-Apple-Session-ID", value: session_id },
		]
	});
};

export function scrub(outgoing_socket: http.OutboundSocket, session_id: string, seconds: number): Promise<http.Response> {
	return outgoing_socket.request({
		method: "POST",
		path: `/scrub?position=${seconds}`,
		headers: [
			{ key: "X-Apple-Session-ID", value: session_id },
		]
	});
};

export function stop(outgoing_socket: http.OutboundSocket, session_id: string): Promise<http.Response> {
	return outgoing_socket.request({
		method: "POST",
		path: `/stop`,
		headers: [
			{ key: "X-Apple-Session-ID", value: session_id },
		]
	});
};

export function getServerInfo(outgoing_socket: http.OutboundSocket, session_id: string): Promise<http.Response> {
	return outgoing_socket.request({
		method: "GET",
		path: `/server-info`,
		headers: [
			{ key: "X-Apple-Session-ID", value: session_id },
		]
	});
};
