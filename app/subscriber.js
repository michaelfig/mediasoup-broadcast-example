'use strict';
var ws;
var room;
var transport;

function startStream(peer) {
    var stream = new MediaStream();
    function addConsumer(consumer) {
        if (!consumer.supported) {
            console.log('consumer', consumer.id, 'not supported');
            return;
        }
        consumer.receive(transport)
            .then(function receiveTrack(track) {
                stream.addTrack(track);
                consumer.on('close', function closeConsumer() {
                    // Remove the old track.
                    stream.removeTrack(track);
                    if (stream.getTracks().length === 0) {
                        // Replace the stream.
                        stream = new MediaStream();
                        setVideoSource(stream);
                    }
                });
            })
            .catch(function onError(e) {
                console.log('Cannot add track', e);
            });
    }
    
    // Add consumers that are added later...
    peer.on('newconsumer', addConsumer);
    peer.on('closed', function closedPeer() {
        setVideoSource();
    });
    // ... as well as the ones that were already present.
    for (var i = 0; i < peer.consumers.length; i ++) {
        addConsumer(peer.consumers[i]);
    }
    return stream;
}

function subscribeClick() {
    stopSubscribeClick();
    placeVideo(document.querySelector('#videoPlacement'));

    var channel = document.querySelector('#subChannel').value;
    var password = document.querySelector('#subPassword').value;

    pubsubClient(channel, password, false)
        .then(function havePubsub(ps) {
            ws = ps.ws;
            room = ps.room;
            transport = room.createTransport('recv');
            // The server will only ever send us a single publisher.
            // Stream it if it is new...
            room.on('newpeer', function newPeer(peer) {
                console.log('New peer detected:', peer.name);
                setVideoSource(startStream(peer));
            });
            // ... or if it already exists.
            if (ps.peers[0]) {
                console.log('Existing peer detected:', ps.peers[0].name);
                setVideoSource(startStream(ps.peers[0]));
            }
        })
        .catch(function onError(err) {
            alert('Cannot subscribe to channel: ' + err);
        });
}

function stopSubscribeClick() {
    setVideoSource();
    unplaceVideo();
    if (transport) {
        transport.close();
        transport = undefined;
    }
    if (room) {
        room.leave();
        room = undefined;
    }
    if (ws) {
        ws.close();
        ws = undefined;
    }
}

function subscriberLoad() {
    var subscribe = document.querySelector('button#subscribe');
    var stopSubscribe = document.querySelector('button#stopSubscribe');
    subscribe.addEventListener('click', subscribeClick);
    stopSubscribe.addEventListener('click', stopSubscribeClick);
}
