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


let children = new jdb.Index<Person>(
	[".", "private", "tables2"],
	"children",
	(key) => persons.lookup(key),
	(record) => record.parent_person_id,
	(record) => record.person_id
);

persons.on("insert", (message) => {
	//console.log("insert", message);
	children.insert(message.next);
});
persons.on("update", (message) => {
	//console.log("update", message);
	children.update(message.last, message.next);
});
persons.on("remove", (message) => {
	//console.log("remove", message);
	children.insert(message.last);
});


persons.insert({
	person_id: "0000000000000001",
	name: "Parent 1",
})
persons.insert({
	person_id: "0000000000000002",
	name: "Parent 2",
})
persons.insert({
	person_id: "0000000000000003",
	name: "Child 3",
	parent_person_id: "0000000000000001"
})
persons.insert({
	person_id: "0000000000000004",
	name: "Child 4",
	parent_person_id: "0000000000000001"
})
persons.insert({
	person_id: "0000000000000005",
	name: "Child 5",
	parent_person_id: "0000000000000002"
})
console.log(children);

console.log(Array.from(children.lookup(undefined)));
console.log(Array.from(children.lookup("0000000000000001")));
console.log(Array.from(children.lookup("0000000000000002")));

/*
array of uint16 cannot have type information for every entry, must be encoded in array array of bool?
field size cannot be explicit for tiny types
type-id is varlen?
varlen must be minimally coded for cryptographic uses
what about unions or intersections? might not be the right place, array of bool
type info must encode length of data for forward compatibility
position-independent coding
array of strings, variable length, need total length
records with repeated fields allow appending


					   null: 0, 0 add, 0 byte of data
					sint1le: 1, 0 add, 1 byte of data
					uint1le: 2, 0 add, 1 byte of data
 masked unsigned int little, 3, 1 byte of additional data, 1 byte of data

length: 3 bits, signedness: 1 bit, endianness: 1 bit, masking, 1 bit







type info, data

00000000: 1 byte integer, no complement
10000000 00000000: invalid encoding, var


varlen codes at most 28 bits of data (268 435 455)
all future type datas start with a varlen

variable length utf8-encoded string: (95) (1_0000001 0_0000010) (258 bytes)


fixed-length 4 byte chunk:
fixed-length 8 byte chunk:
fixed-length 16 byte chunk:
fixed-length 32 byte chunk:
fixed-length 64 byte chunk:
fixed-length 128 byte chunk:
fixed-length 256 byte chunk:

*/
