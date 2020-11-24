import * as is from "../is";
import * as xml from "../xml";

type JSON = undefined | number | string | boolean | JSON[] | { [key: string]: JSON };

function parseArray(node: xml.XMLNode): JSON[] {
	throw ``;
}

function parseBoolean(node: xml.XMLNode): boolean {
	throw ``;
}

function parseNumber(node: xml.XMLNode): number {
	throw ``;
}

function parseObject(node: xml.XMLNode): { [key: string]: JSON } {
	throw ``;
}

function parseString(node: xml.XMLNode): string {
	throw ``;
}

function parseJSON(node: xml.XMLNode): JSON {
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

export function parse(string: string): any {
	let document = xml.parse(string);
	let root = document.root;
	root.tag("plist");
	return parseJSON(root.children().get(0));
};
