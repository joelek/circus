import * as jdb from "./index";
import * as autoguard from "@joelek/ts-autoguard";

type Person = {
	person_id: string,
	name: string,
	parent_person_id?: string
};

let Person = autoguard.guards.Object.of<Person>({
	person_id: autoguard.guards.String,
	name: autoguard.guards.String,
	parent_person_id: autoguard.guards.Union.of(
		autoguard.guards.String,
		autoguard.guards.Undefined
	)
});

let persons = new jdb.Table<Person>([".", "private", "tables2"], "persons", Person, (record) => record.person_id);

persons.on("insert", (message) => {
	console.log("insert", message);
});
persons.on("update", (message) => {
	console.log("update", message);
});
persons.on("remove", (message) => {
	console.log("remove", message);
});
