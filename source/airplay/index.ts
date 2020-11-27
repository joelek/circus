import * as mdns from "../mdns/";
import * as is from "../is";
import { Device } from "./device";

const devices = new Map<string, Device>();

export function observe(wss: boolean): void {
	mdns.observe("_airplay._tcp.local", async (ipv4) => {
		try {
			let device = devices.get(ipv4);
			if (is.absent(device)) {
				let device = await new Device(ipv4, wss);
				devices.set(ipv4, device);
				device.addObserver("close", function onclose() {
					device.removeObserver("close", onclose);
					devices.delete(ipv4);
				});
			}
		} catch (error) {
			console.log(error);
		}
	});
};
