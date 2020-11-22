import * as libhttp from "http";
import * as mdns from "../mdns";
import * as is from "../is";

namespace api {
	type ServerInfo = {
		device_id: string
	};

	export function getServerInfo(host: string): Promise<ServerInfo> {
		return new Promise((resolve, reject) => {
			let request = libhttp.request({
				method: "GET",
				protocol: "http:",
				hostname: host,
				port: 7000,
				path: "/server-info"
			}, (response) => {
				let chunks = new Array<Buffer>();
				response.on("data", (chunk) => {
					chunks.push(chunk);
				});
				response.on("end", () => {
					let buffer = Buffer.concat(chunks);
					let string = buffer.toString();
					let parts = /<key>deviceid<[/]key>\s*<string>([^<]*)<[/]string>/s.exec(string);
					if (is.present(parts)) {
						let device_id = parts[1];
						resolve({
							device_id
						});
					} else {
						reject();
					}
				});
				response.on("error", reject);
			});
			request.end();
		});
	}
}

class Device {
	constructor() {

	}
}

async function makeDevice(host: string): Promise<Device> {
	let info = await api.getServerInfo(host);
	console.log(info);
	return new Device();
}

const devices = new Map<string, Device>();

export function observe(): void {
	mdns.observe("_airplay._tcp.local", async (host) => {
		try {
			let device = devices.get(host);
			if (is.absent(device)) {
				console.log(`AirPlay device detected at ${host}. Attemping to connect...`);
				device = await makeDevice(host);
				devices.set(host, device);
			}
		} catch (error) {
			console.log(`Expected a successful connection to the AirPlay device at ${host}!`);
			console.log(error);
		}
	});
};
