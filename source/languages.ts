const db: { [key: string]: undefined | { title: string, iso639_1: string } } = {
	eng: {
		title: "English",
		iso639_1: "en"
	},
	swe: {
		title: "Swedish",
		iso639_1: "sv"
	},
	jpn: {
		title: "Japanese",
		iso639_1: "ja"
	}
};

export {
	db
};
