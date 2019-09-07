let config = require('../../store/config.json');

function pathify(string: string): string {
	return encodeURIComponent(string.split('/').join('_').split(' ').join('_').split('-').join('_').split('ñ').join('n').split(':').join('').toLowerCase());
}

export {
	config,
	pathify
}
