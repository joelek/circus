function join(...parameters: any): string {
	return parameters.map((parameter: any) => {
		return String(parameter);
	}).join("");
}

export {
	join
};
