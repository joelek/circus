import * as mdns from "../mdns";

export function observe(): void {
	mdns.observe("_airplay._tcp.local", (host) => {
		console.log(`AirPlay device detected at ${host}.`);
	});
};
