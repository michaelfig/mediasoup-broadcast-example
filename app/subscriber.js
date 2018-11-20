'use strict';
var ws;
var room;
var transport;
var video;

function startStream(peer, profile) {
    var stream = new MediaStream();
    function addConsumer(consumer) {
        if (!consumer.supported) {
            console.log('consumer', consumer.id, 'not supported');
            return;
        }
        consumer.setPreferredProfile(profile);
        consumer.on('stats', showStats);
        consumer.enableStats(1000);
        consumer.receive(transport)
            .then(function receiveTrack(track) {
                stream.addTrack(track);
                consumer.on('close', function closeConsumer() {
                    // Remove the old track.
                    console.log('removing the old track', track.id);
                    clearStats(consumer.kind);
                    stream.removeTrack(track);
                    if (stream.getTracks().length === 0) {
                        // Replace the stream.
                        console.log('replacing stream');
                        stream = new MediaStream();
                        setVideoSource(video, stream);
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
        setVideoSource(video);
    });
    // ... as well as the ones that were already present.
    for (var i = 0; i < peer.consumers.length; i ++) {
        addConsumer(peer.consumers[i]);
    }
    return stream;
}

function subscribeClick() {
    stopSubscribeClick();

    var channel = document.querySelector('#subChannel').value;
    var password = document.querySelector('#subPassword').value;
    var profile = document.querySelector('input[name="prof"]:checked').value;

    pubsubClient(channel, password, false)
        .then(function havePubsub(ps) {
            ws = ps.ws;
            room = ps.room;
            transport = room.createTransport('recv');
            // The server will only ever send us a single publisher.
            // Stream it if it is new...
            room.on('newpeer', function newPeer(peer) {
                console.log('New peer detected:', peer.name);
                setVideoSource(video, startStream(peer, profile));
            });
            // ... or if it already exists.
            if (ps.peers[0]) {
                console.log('Existing peer detected:', ps.peers[0].name);
                setVideoSource(video, startStream(ps.peers[0], profile));
            }
            else {
                video.style.background = '#202020';
            }
        })
        .catch(function onError(err) {
            alert('Cannot subscribe to channel: ' + err);
        });
}

function stopSubscribeClick() {
    clearStats();
    setVideoSource(video);
    transport = undefined;
    room = undefined;
    if (ws) {
        ws.close();
        ws = undefined;
    }
}

function subscriberLoad() {
    var subscribe = document.querySelector('button#subscribe');
    var stopSubscribe = document.querySelector('button#stopSubscribe');
    video = document.querySelector('video#subVideo');
    subscribe.addEventListener('click', subscribeClick);
    stopSubscribe.addEventListener('click', stopSubscribeClick);
    onEnterPerform(document.querySelector('#subChannel'), subscribeClick);
    onEnterPerform(document.querySelector('#subPassword'), subscribeClick);
}
