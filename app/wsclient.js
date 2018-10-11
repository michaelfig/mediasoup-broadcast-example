'use strict';
var ms = window.mediasoupClient;

function pubsubClient(channel, password, isPublisher) {
    return new Promise(function executor(resolve, reject) {
        var kind = isPublisher ? 'publish' : 'subscribe';
        if (!ms.isDeviceSupported()) {
            alert('Sorry, WebRTC is not supported on this device');
            return;
        }

        var room = new ms.Room({
            requestTimeout: 8000,
        });

        var reqid = 0;
        var pending = {};
        var errors = {};

        var wsurl = window.location.href.replace(/^http/, 'ws').replace(/^(wss?:\/\/[^\/]*).*/, '$1/pubsub');
        var ws = new WebSocket(wsurl);
        var connected = false;
        var peerName = isPublisher ? 'publisher' : '' + Math.random();
        ws.onopen = function onOpen() {
            connected = true;
            pending[++reqid] = function onPubsub(payload) {
                room.join(peerName)
                    .then(function (peers) {
                        console.log('Channel', channel, 'joined with peers', peers);
                        resolve({ws: ws, room: room, peers: peers});
                    })
                    .catch(reject);
            };
            errors[reqid] = function onError(payload) {
                alert('Cannot ' + kind + ' channel: ' + payload);
            };
            ws.send(JSON.stringify({type: 'MS_SEND', payload: {kind: kind, password: password}, meta: {id: reqid, channel: channel}}));
        };
        ws.onclose = function onClose(event) {
            if (!connected) {
                reject(Error('Connection closed'));
            }
        };
        ws.onmessage = function onMessage(event) {
            try {
                var action = JSON.parse(event.data);
                switch (action.type) {
                    case 'MS_RESPONSE': {
                        var cb = pending[action.meta.id];
                        delete pending[action.meta.id];
                        delete errors[action.meta.id];
                        if (cb) {
                            cb(action.payload);
                        }
                        break;
                    }

                    case 'MS_ERROR': {
                        var errb = errors[action.meta.id];
                        delete pending[action.meta.id];
                        delete errors[action.meta.id];
                        if (errb) {
                            errb(action.payload);
                        }
                    }

                    case 'MS_NOTIFY': {
                        room.receiveNotification(action.payload);
                        break;
                    }
                }
            }
            catch (e) {
                console.log('Error', e, 'handling', JSON.stringify(event.data));
            }
        }

        room.on('request', function onRequest(request, callback, errback) {
            if (ws.readyState !== ws.OPEN) {
                return errback(Error('WebSocket is not open'));
            }

            pending[++ reqid] = callback;
            errors[reqid] = errback;
            ws.send(JSON.stringify({type: 'MS_SEND', payload: request, meta: {id: reqid, channel: channel}}));
        });
        room.on('notify', function onNotification(notification) {
            if (ws.readyState !== ws.OPEN) {
                console.log(Error('WebSocket is not open'));
                return;
            }
            ws.send(JSON.stringify({type: 'MS_SEND', payload: notification, meta: {channel: channel, notification: true}}));
        });
    });
}
