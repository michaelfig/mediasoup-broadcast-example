'use strict';
var ms = window.mediasoupClient;
var stream;

var onActiveTimeout;
function setVideoSource(video, streamOrUrl) {
    if (stream) {
        try {
            if (stream.stop) {
                stream.stop();
            }
            else if (stream.getTracks) {
                var tracks = stream.getTracks();
                for (var i = 0; i < tracks.length; i ++) {
                    tracks[i].stop();
                }
            }
        }
        catch (e) {
            console.log('Error stopping stream', e);
        }
        stream = undefined;
    }

    if (onActiveTimeout) {
        clearTimeout(onActiveTimeout);
        onActiveTimeout = undefined;
    }

    if (!streamOrUrl) {
        if (video) {
            video.removeAttribute('src');
            try {
                video.srcObject = null;
            }
            catch (e) {}
            video.style.background = 'blue';
            video.load();
        }
        return;
    }

    if (typeof streamOrUrl === 'string') {
        // Just a regular URL.
        video.style.background = 'black';
        video.src = streamOrUrl;
        if (video.captureStream) {
            stream = video.captureStream();
        }
        else if (video.mozCaptureStream) {
            stream = video.mozCaptureStream();
        }
        else {
            alert('Cannot capture video stream!');
            return;
        }
    }
    else {
        // We have an actual MediaStream.
        stream = streamOrUrl;
        whenStreamIsActive(function getStream() { return stream }, setSrc);
        function setSrc() {
            console.log('adding active video stream');
            video.style.background = 'black';
            try {
                video.srcObject = stream;
            }
            catch (e) {
                var url = (window.URL || window.webkitURL);
                video.src = url ? url.createObjectURL(stream) : stream;
            }
        }
    }
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

            // FIXME: Send your own connection-initiation packet.
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

var streamActiveTimeout = {};
function whenStreamIsActive(getStream, callback) {
    var stream = getStream();
    if (!stream) {
        return;
    }
    var id = stream.id;
    if (stream.active) {
        callback();
    }
    else if ('onactive' in stream) {
        stream.onactive = maybeCallback;
    }
    else if (!streamActiveTimeout[id]) {
        maybeCallback();
    }
    function maybeCallback() {
        delete streamActiveTimeout[id];
        var stream = getStream();
        if (!stream) {
            return;
        }
        if (stream.onactive === maybeCallback) {
            stream.onactive = null;
        }
        if (!stream.active) {
            // Safari needs a timeout to try again.
            // console.log('try again');
            streamActiveTimeout[id] = setTimeout(maybeCallback, 500);
            return;
        }
        callback();
    }
}
