'use strict';
var ms = window.mediasoupClient;

function setVideoSource(video, stream) {
    window.stream = stream;
    try {
        video.srcObject = stream;
    }
    catch (e) {
        var url = (window.URL || window.webkitURL);
        video.src = url ? url.createObjectURL(stream) : stream;
    }
}


function stopVideo(video) {
    if (!video) {
        return;
    }
    if (!video.paused) {
        video.pause();
    }
    video.style.background = 'blue';
    try {
        if (video.srcObject && video.srcObject.stop) {
            video.srcObject.stop();
        }
        else if (video.srcObject && video.srcObject.getTracks) {
            var tracks = video.srcObject.getTracks();
            for (var i = 0; i < tracks.length; i ++) {
                tracks[i].stop();
            }
        }
        video.srcObject = null;
    }
    catch (e) {
        console.log('Error stopping srcObject', e);
    }
    video.removeAttribute('src');
    video.currentTime = 0;
    video.load();
}


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
            console.log('received', event.data);
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
                        break;
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
