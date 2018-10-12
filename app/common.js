'use strict';
var ms = window.mediasoupClient;
var video;
var stream;

var onActiveTimeout;
function setVideoSource(streamOrUrl) {
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
        return;
    }

    if (typeof streamOrUrl === 'string') {
        // Just a regular URL.
        video.setAttribute('loop', 'loop');
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
        if (stream.active) {
            setSrc();
        }
        else if ('onactive' in stream) {
            stream.onactive = setSrc;
        }
        else if (!onActiveTimeout) {
            setSrc();
        }
        function setSrc() {
            onActiveTimeout = undefined;
            if (!stream) {
                return;
            }
            if (!stream.active) {
                // Safari needs a timeout to try again.
                console.log('try again');
                onActiveTimeout = setTimeout(setSrc, 500);
                return;
            }
            console.log('adding active video stream');
            try {
                video.srcObject = stream;
            }
            catch (e) {
                var url = (window.URL || window.webkitURL);
                video.src = url ? url.createObjectURL(stream) : stream;
            }
        };
    }
}


function placeVideo(videoPlacement) {
    // Place a new video tag.
    var v = document.createElement('video');
    v.playsInline = true;
    v.autoplay = true;
    videoPlacement.appendChild(v);
    video = v;

    // Mute everywhere except Firefox, which mutes when we start streaming
    // and won't stream audio if we mute it manually.
    if (!video.mozCaptureStream) {
        video.volume = 0;
    }
}


function unplaceVideo() {
    if (!video) {
        return false;
    }
    video.parentElement.removeChild(video);
    video = undefined;
    return true;
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
