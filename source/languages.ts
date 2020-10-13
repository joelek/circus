const db: { [key: string]: { title: string, iso639_1: string, iso3166_1: string } } = {
	eng: {
		title: "English",
		iso639_1: "en",
		iso3166_1: "US"
	},
	swe: {
		title: "Swedish",
		iso639_1: "sv",
		iso3166_1: "SE"
	},
	jpn: {
		title: "Japanese",
		iso639_1: "ja",
		iso3166_1: "JP"
	}
};

const pref = [
	"swe",
	"eng",
	"jpn"
];

export {
	db,
	pref
};
