import { guards as autoguard } from "@joelek/ts-autoguard";
import * as libfs from "fs";
import * as schema from "./schema";

const ROOT = [
	".",
	"private",
	"config"
];

const PATH = [...ROOT, "config.json"].join("/");

let config: schema.Config = {
	certificate_path: [ ".", "private", "certs", "full_chain.pem" ],
	certificate_key_path: [ ".", "private", "certs", "certificate_key.pem" ],
	http_port: 80,
	https_port: 443,
	media_path: [ ".", "private", "media" ],
	use_demo_mode: false
};

try {
	let string = libfs.readFileSync(PATH, "utf-8");
	let json = JSON.parse(string);
	if (autoguard.Record.of(autoguard.Any).is(json)) {
		if (autoguard.Array.of(autoguard.String).is(json.certificate_key_path)) {
			config.certificate_key_path = json.certificate_key_path;
		}
		if (autoguard.Array.of(autoguard.String).is(json.certificate_path)) {
			config.certificate_path = json.certificate_path;
		}
		if (autoguard.Number.is(json.http_port)) {
			config.http_port = json.http_port;
		}
		if (autoguard.Number.is(json.https_port)) {
			config.https_port = json.https_port;
		}
		if (autoguard.Array.of(autoguard.String).is(json.media_path)) {
			config.media_path = json.media_path;
		}
		if (autoguard.Boolean.is(json.use_demo_mode)) {
			config.use_demo_mode = json.use_demo_mode;
		}
	}
} catch (error) {}

if (!libfs.existsSync(ROOT.join("/"))) {
	libfs.mkdirSync(ROOT.join("/"));
}

libfs.writeFileSync(PATH, JSON.stringify(config, null , "\t"));

export default config;
