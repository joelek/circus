import * as jdb from "./index";
import * as autoguard from "@joelek/autoguard";

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

let persons = new jdb.Table<Person>(
	new jdb.BlockHandler([".", "private", "testtables", "persons"]),
	Person.as,
	(record) => record.person_id
);
let children = new jdb.Index<Person, Person>(
	new jdb.BlockHandler([".", "private", "testtables", "children"]),
	persons,
	persons,
	(record) => [record.parent_person_id]
);
let search = new jdb.Index<Person, Person>(
	new jdb.BlockHandler([".", "private", "testtables", "search"]),
	persons,
	persons,
	(record) => [record.name],
	jdb.Index.QUERY_TOKENIZER
);

persons.insert({
	person_id: "1",
	name: "Parent A",
});
persons.insert({
	person_id: "2",
	name: "Parent B",
});
persons.insert({
	person_id: "3",
	name: "Child A",
	parent_person_id: "1"
});
persons.insert({
	person_id: "4",
	name: "Child B",
	parent_person_id: "1"
});
persons.insert({
	person_id: "5",
	name: "Child C",
	parent_person_id: "2"
});
persons.remove({
	person_id: "1",
	name: "Parent A",
});

console.log(persons.lookup("5"));
console.log(children.lookup(undefined).collect());
console.log(children.lookup("1").collect());
console.log(children.lookup("2").collect());
console.log(search.lookup("parent").collect());
console.log(search.lookup("child").collect());
console.log(search.lookup("a").collect());


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

let bh = new jdb.BlockHandler([".", "private", "testtables", "robin"]);
let index = jdb.BlockHandler.FIRST_APPLICATION_BLOCK;
if (bh.getCount() === jdb.BlockHandler.FIRST_APPLICATION_BLOCK) {
	bh.createBlock(jdb.RobinHoodHash.INITIAL_SIZE);
}
let rhh = new jdb.RobinHoodHash(bh, index, (index) => index);

rhh.insert(7, 7);
rhh.insert(5, 5);
rhh.insert(9, 9);
rhh.insert(8, 8);
rhh.insert(8, 8);
rhh.insert(3, 3);
rhh.remove(10);
rhh.remove(5);
rhh.remove(8);

for (let value of rhh) {
	console.log(value);
}
