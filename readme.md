# @joelek/circus

Progressive web app and system for streaming audio and video content.

![](./public/images/start.png)

> The start page.

Example application running at https://circus.joelek.se.

## Device support

* Devices with a modern web browser
* Devices visible to the server implementing the Cast protocol
* Devices visible to the server implementing the AirPlay (v1) protocol

## Media support

### Playback

Circus delivers streaming media through HTTP range requests and as such, media support will essentially be determined by the device of the user. The following containers and stream formats are recommended for optimal support.

```
Audio: MP4 (AAC)
Video: MP4 (H264 + AAC)
```

### Indexing

Circus features a blazingly fast, custom engine for probing and indexing of content. The engine supports the file formats listed below.

* FLAC
* JPEG
* JSON
* MP3
* MP4
* OGG
* VTT
* WAV

Stream information and metadata is extracted from all supported files. The information is stored and indexed into a custom database system.

External image and metadata files may be used to supply additional information that cannot be stored within a specific container. The external metadata files must use one of the structures listed below.

```
{
	"type": "show",
	"title": "Show title",
	"summary"?: "Show summary.",
	"genres": [
		"Genre name"
	],
	"actors": [
		"Actor name"
	],
	"imdb"?: "tt0000000"
}
```

```
{
	"type": "episode",
	"title": "Episode title",
	"season": 1,
	"season": {
		"number": 1,
		"title"?: "Season title"
	},
	"episode": 1,
	"year"?: 2000,
	"summary"?: "Episode summary.",
	"show": {
		"title": "Show title",
		"summary"?: "Show summary.",
		"genres": [
			"Genre name"
		],
		"actors": [
			"Actor name"
		],
		"imdb"?: "tt0000000"
	},
	"copyright"?: "Copyright information",
	"imdb"?: "tt0000000"
}
```

```
{
	"type": "movie",
	"title": "Movie title",
	"year"?: 2000,
	"summary"?: "Movie summary.",
	"genres": [
		"Genre name"
	],
	"actors": [
		"Actor name"
	],
	"copyright"?: "Copyright information",
	"imdb"?: "tt0000000"
}
```

```
{
	"type": "track",
	"title": "Track title",
	"disc": 1,
	"disc": {
		"number": 1,
		"title"?: "Disc title"
	},
	"track": 1,
	"album": {
		"title": "Album title",
		"year"?: 2000,
		"artists": [
			"Artist name"
		],
		"tidal"?: 12345,
		"genres"?: [
			"Genre name"
		]
	},
	"artists": [
		"Artist name"
	],
	"copyright"?: "Copyright information"
}
```

```
{
	"type": "album",
	"title": "Album title",
	"disc": 1,
	"disc": {
		"number": 1,
		"title"?: "Disc title"
	},
	"year"?: 2000,
	"artists": [
		"Artist name"
	],
	"tracks": [
		{
			"title": "Track title",
			"artists": [
				"Artist name"
			],
			"copyright"?: "Copyright information"
		}
	],
	"copyright"?: "Copyright information",
	"tidal"?: 12345,
	"genres"?: [
		"Genre name"
	]
}
```

```
{
	"type": "artist",
	"name": "Artist name",
	"tidal"?: 12345
}
```

The media probing system associates metadata on a folder basis meaning that external image and metadata files associate with every media file contained in the same directory.

## Playback protocol

Circus features a custom playback protocol for playback and synchronization between devices. The protocol is simplistically designed and built using websocket technology.

This allows using one device for playback while using another device for controlling the playback.

## Sponsorship

The continued development of this software depends on your sponsorship. Please consider sponsoring this project if you find that the software creates value for you and your organization.

The sponsor button can be used to view the different sponsoring options. Contributions of all sizes are welcome.

Thank you for your support!

### Ethereum

Ethereum contributions can be made to address `0xf1B63d95BEfEdAf70B3623B1A4Ba0D9CE7F2fE6D`.

![](./eth.png)

## Installation

Circus can be installed on a wide range of server infrastructure since it's built almost entirely using NodeJS. Extra features such as preview images become available when the FFMPEG tool suite is installed on the server.

Download the latest release package from https://github.com/joelek/circus/tags and unpack it. Advanced users may clone the repository using git and gain a convenient way of upgrading whenever new releases become available.

The server is started using `node .` and should ideally be configured to run automatically as a background service. The command launches an HTTP server as well as an HTTPS server if a certificate file and a certificate key file can be located.

Visit the domain or IP-address of the server in any web browser and register your user using the registration key displayed when launching the server. The registration key is consumed upon successful registration.

Circus generates additional registration keys as soon as all registration keys have been consumed. You may use additional registration keys to register mutiple users.

Ports, paths and other settings can be configured through altering the config file located in the "./private/config/" directory. The config file is written to disk as Circus is launched.

## Roadmap

* Make color scheme and project name configurable.
* Structure code using subprojects.
* Clear player state when the user logs out.
* Add account tiers to keys and users.
* Implement user admin for admin accounts.
* Allow admin accounts to re-index content through the user interface.
* Create full screen player with additional controls and graphics.
* Create and use layout components with standard spacing.
* Add support for language preferences for audio and subtitles.
* Improve stream detection algorithm.
* Index generated images.
* Move authentication to typesockets.
* Add synchronization (latency estimation) to playback protocol.
* Change line heights to prevent the truncation of capital letters with umlauts.
* Index keyframes and create movie and episode subpage with list.
* Add setting for controlling local device discovery.
