* Retry failed websocket.

* Help work on better Edge compatibility for Mediasoup.

* app/*.html - Style the inputs better and have them be a modal over the video display (with a little floating action button to pop them up).

* Review and comment all the code.  Reorder to provide better top-to-bottom understanding.

* The "connect to channel" packet (not the Mediasoup client-initiated "join" packet) in app/common.js and server/index.js should be better formatted to guarantee no conflicts with Mediasoup protocol.

* app/common.js and server/index.js need to separate the WebSocket connection process from connecting to individual channels/rooms.  That would make it possible to have multiple channels/rooms supported by a single connection.
