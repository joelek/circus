import * as mdns from "../mdns/";
import * as is from "../is";
import { Device } from "./device";

const devices = new Map<string, Device>();

function getDeviceName(service_info: Array<string>): string {
	let last = service_info[service_info.length - 1] as string | undefined;
	if (is.present(last)) {
		let parts = /^([^.]+)[.]_airplay[.]_tcp[.]local$/.exec(last);
		if (is.present(parts)) {
			return parts[1];
		}
	}
	return "AirPlay";
}

function getDeviceType(service_info: Array<string>): string {
	for (let entry of service_info) {
		let parts = entry.split("=");
		if (parts.length >= 2) {
			let key = parts[0];
			if (key === "model") {
				return parts.slice(1).join("=");
			}
		}
	}
	return "Generic AirPlay Device";
}

function isProtocolSupported(service_info: Array<string>): boolean {
	for (let entry of service_info) {
		let parts = entry.split("=");
		if (parts.length >= 2) {
			let key = parts[0];
			if (key === "protovers") {
				return parts.slice(1).join("=") === "1.0";
			}
		}
	}
	return true;
}

export function observe(wss: boolean, media_server_host: string): void {
	mdns.observe("_airplay._tcp.local", async (service_device) => {
		try {
			let { hostname, service_info } = { ...service_device };
			let device = devices.get(hostname);
			if (is.absent(device) && isProtocolSupported(service_info ?? [])) {
				let device_name = getDeviceName(service_info ?? []);
				let device_type = getDeviceType(service_info ?? []);
				let device = new Device(hostname, wss, media_server_host, device_name, device_type);
				devices.set(hostname, device);
				device.addObserver("close", function onclose() {
					device.removeObserver("close", onclose);
					devices.delete(hostname);
				});
			}
		} catch (error) {
			console.log(error);
		}
	});
};

export function discover(): void {
	mdns.sendDiscoveryPacket("_airplay._tcp.local");
};
