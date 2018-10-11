'use strict';
const mediasoup = require('mediasoup');

const msOptions = {
    rtcIPv4: true,
    rtcIPv6: false,
};
if (process.env.RTC_ANNOUNCE_IP) {
    // This is the external IP address that routes to the current
    // instance.  For cloud providers or Kubernetes, this
    // will be a different address than the connected network
    // interface will use.
    msOptions.rtcAnnouncedIPv4 = process.env.RTC_ANNOUNCE_IP;
}
const ms = mediasoup.Server(msOptions);

const PUBLISHER_PEER = 'publisher';
const rooms = {};
const MEDIA_CODECS = [
    {
      kind        : "audio",
      name        : "opus",
      clockRate   : 48000,
      channels    : 2,
      parameters  :
      {
        useinbandfec : 1
      }
    },
    {
      kind       : "video",
      name       : "H264",
      clockRate  : 90000,
      parameters :
      {
        "packetization-mode"      : 1,
        "profile-level-id"        : "42e01f",
        "level-asymmetry-allowed" : 1
      }
    },
    {
        // Put VP8 last, since it's nice but iOS doesn't support it.
        kind      : "video",
        name      : "VP8",
        clockRate : 90000
    },
  ];

function publish(addr, channel, ws) {
    handlePubsub(addr, channel, ws, true);
}

function subscribe(addr, channel, ws) {
    handlePubsub(addr, channel, ws, false);
}

function handlePubsub(addr, channel, ws, isPublisher) {
    var room = rooms[channel];
    if (!room) {
        room = rooms[channel] = ms.Room(MEDIA_CODECS);
    }
    var peer;
    function sendAction(obj) {
        if (ws.readyState !== ws.OPEN) {
            return;
        }
        ws.send(JSON.stringify(obj));
    }
    var oldClose = ws.onclose;
    ws.onclose = function onClose(event) {
        if (peer) {
            peer.close();
        }
        oldClose.call(this, event);
    };
    ws.onmessage = function onMessage(event) {
        console.log(addr, 'got message', event.data);
        const action = JSON.parse(event.data);
        switch (action.type) {
            case 'MS_SEND': {
                var target;
                switch (action.payload.target) {
                    case 'room':
                        target = room;
                        break;
                    case 'peer':
                        target = peer;
                        break;
                }
                if (action.meta.notification) {
                    if (!target) {
                        console.log(addr, 'unknown notification target', action.payload.target);
                        break;
                    }
                    target.receiveNotification(action.payload);
                    break;
                }

                if (!target) {
                    console.log(addr, 'unknown request target', action.payload.target);
                    sendAction({type: 'MS_ERROR', payload: 'unknown request target', meta: action.meta});
                    return;
                }
                if (action.payload.method === 'join') {
                    if (isPublisher) {
                        // Kick out the old publisher.
                        action.payload.peerName = PUBLISHER_PEER;
                        var oldPeer = room.getPeerByName(action.payload.peerName);
                        if (oldPeer) {
                            oldPeer.close();
                        }
                    }
                    else if (action.payload.peerName === PUBLISHER_PEER) {
                        action.payload.peerName = 'pseudo' + PUBLISHER_PEER;
                    }
                }
                target.receiveRequest(action.payload)
                    .then(function onResponse(response) {
                        if (action.payload.method === 'join') {
                            // Detected a join request, so get the peer.
                            var peerName = action.payload.peerName;
                            peer = room.getPeerByName(peerName);
                            peer.on('notify', function onNotify(notification) {
                                if (notification.method === 'newPeer') {
                                    if (!isPublisher && notification.name !== PUBLISHER_PEER) {
                                        // Skip the notification to hide all but the publisher.
                                        return;
                                    }
                                }
                                console.log(addr, 'sending notification', notification);
                                sendAction({type: 'MS_NOTIFY', payload: notification});
                            });
                            console.log(addr, 'new peer joined the room', peerName);
                            if (!isPublisher) {
                                // Filter out all but the publisher.
                                response = Object.assign({}, response,
                                    {peers: response.peers.filter(function (peer) {
                                        return (peer.name === PUBLISHER_PEER);
                                    })});
                            }
                        }
                        console.log(addr, 'sending response', response);
                        sendAction({type: 'MS_RESPONSE', payload: response, meta: action.meta});
                    })
                    .catch(function onError(err) {
                        sendAction({type: 'MS_ERROR', payload: err, meta: action.meta});
                    });
                break;
            }

            default:
                throw Error('Unrecognized action type ' + action.type);
        }
    };
}

module.exports = {
    publish,
    subscribe,
};
