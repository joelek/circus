import * as libfs from "fs";
import * as schema from "./schema";

const ROOT = [
	".",
	"private",
	"config"
];

if (!libfs.existsSync(ROOT.join("/"))) {
	libfs.mkdirSync(ROOT.join("/"));
}

const PATH = [...ROOT, "config.json"].join("/");

if (!libfs.existsSync(PATH)) {
	let config: schema.Config = {};
	libfs.writeFileSync(PATH, JSON.stringify(config, null , "\t"));
}

let string = libfs.readFileSync(PATH, "utf-8");
let json = JSON.parse(string);
let config = schema.Config.as(json);

export default config;
