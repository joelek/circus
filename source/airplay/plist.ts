import * as xml from "../xml/";

type JSON = undefined | number | string | boolean | JSON[] | { [key: string]: JSON };

function parseArray(element: xml.XMLElement): JSON[] {
	element.tag("array");
	let children = element.children();
	let array: JSON[] = [];
	for (let i = 0; i < children.length(); i += 1) {
		let value = children.get(i + 0).asElement();
		array.push(parseJSON(value));
	}
	return array;
}

function parseFalse(element: xml.XMLElement): boolean {
	element.tag("false");
	let children = element.children();
	if (children.length() !== 0) {
		throw `Expected exactly zero children!`;
	}
	return false;
}

function parseTrue(element: xml.XMLElement): boolean {
	element.tag("true");
	let children = element.children();
	if (children.length() !== 0) {
		throw `Expected exactly zero children!`;
	}
	return true;
}

function parseBoolean(element: xml.XMLElement): boolean {
	try {
		return parseFalse(element);
	} catch (error) {}
	try {
		return parseTrue(element);
	} catch (error) {}
	throw `Expected a boolean!`;
}

function parseInteger(element: xml.XMLElement): number {
	element.tag("integer");
	let children = element.children();
	if (children.length() !== 1) {
		throw `Expected exactly one child!`;
	}
	let text = children.get(0).asText().value();
	let number = Number.parseInt(text);
	if (Number.isNaN(number)) {
		throw `Expected an integer number!`;
	}
	return number;
}

function parseReal(element: xml.XMLElement): number {
	element.tag("real");
	let children = element.children();
	if (children.length() !== 1) {
		throw `Expected exactly one child!`;
	}
	let text = children.get(0).asText().value();
	let number = Number.parseFloat(text);
	if (Number.isNaN(number)) {
		throw `Expected a real-valued number!`;
	}
	return number;
}

function parseNumber(element: xml.XMLElement): number {
	try {
		return parseInteger(element);
	} catch (error) {}
	try {
		return parseReal(element);
	} catch (error) {}
	throw `Expected a number!`;
}

function parseKey(element: xml.XMLElement): string {
	element.tag("key");
	let children = element.children();
	if (children.length() !== 1) {
		throw `Expected exactly one child!`;
	}
	let text = children.get(0).asText().value();
	return text;
}

function parseObject(element: xml.XMLElement): { [key: string]: JSON } {
	element.tag("dict");
	let children = element.children();
	let object: { [key: string]: JSON } = {};
	for (let i = 0; i < children.length(); i += 2) {
		let key = children.get(i + 0).asElement();
		let value = children.get(i + 1).asElement();
		object[parseKey(key)] = parseJSON(value);
	}
	return object;
}

function parseString(element: xml.XMLElement): string {
	element.tag("string");
	let children = element.children();
	if (children.length() !== 1) {
		throw `Expected exactly one child!`;
	}
	let text = children.get(0).asText().value();
	return text;
}

function parseJSON(node: xml.XMLElement): JSON {
	try {
		return parseArray(node);
	} catch (error) {}
	try {
		return parseBoolean(node);
	} catch (error) {}
	try {
		return parseNumber(node);
	} catch (error) {}
	try {
		return parseObject(node);
	} catch (error) {}
	try {
		return parseString(node);
	} catch (error) {}
	throw `Expected a type!`;
}

export function parseFromString(string: string): any {
	let document = xml.parse(string);
	let root = document.root;
	root.tag("plist");
	let children = root.children();
	if (children.length() !== 1) {
		throw `Expected exactly one child!`;
	}
	return parseJSON(children.get(0).asElement());
};
