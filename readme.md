# @joelek/castaway

## CC

curl -H "Content-Type: application/json" http://192.168.1.111:8008/apps/00000000-0000-0000-0000-000000000000 -X POST -i -d '{}'
HTTP/1.1 201 Created
Location:http://192.168.1.111:8008/apps/00000000-0000-0000-0000-000000000000/a61642fd-0ced-4c66-b438-57046478df45
Content-Length:0

{
	"resolution_height": 0,
	"uses_ipc": true,
	"background_mode_enabled": true,
	"display_name": "Default Media Receiver",
	"app_id": "CC1AD845",
	"url": "https://www.gstatic.com/eureka/player/player.html?skin\u003dhttps://www.gstatic.com/eureka/player/0000/skins/cast/skin.css"
}

ws://localhost:8008/v2/ipc
protobuf wrapped json on: 8009


## Iterations

* Create new typed REST-API that re-uses the context entities.
* Rewrite the indexer to support delta updates.
* Add playlisting functionality for audio content.

## Improvements

* Ingest actors for video content and add actor entity.
* Ingest music genres and create music genre pages.
