import * as libfs from "fs";
import * as libdb from "./database";

let media = JSON.parse(libfs.readFileSync(('./private/db/media.json'), "utf8")) as libdb.MediaDatabase;
let lists = JSON.parse(libfs.readFileSync(('./private/db/lists.json'), "utf8")) as libdb.ListDatabase;

export {
	media,
	lists
};
