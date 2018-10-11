'use strict';
var ws;
var room;
var video;
var stream;
var transport;

function maybePlay() {
    video.style.background = 'black';
    if (video.srcObject || video.src) {
        video.play()
            .catch(function playError(e) {
                console.log('Cannot play video', e);
            });
    }
}

var toAdd = [];
function dequeueConsumers() {
    if (!transport || transport.connectionState === 'closed') {
        if (!room) {
            transport = undefined;
            return;
        }
        transport = room.createTransport('recv');
        transport.on('connectionstatechange', dequeueConsumers);
    }
    while (toAdd.length) {
        var consumer = toAdd.shift();
        consumer.receive(transport)
            .then(function receiveTrack(track) {
                stream.addTrack(track);
            })
            .catch(function onError(e) {
                console.log('Cannot add track', e);
            });
    }
}

function startStream(peer) {
    function addConsumer(consumer) {
        if (!consumer.supported) {
            console.log('consumer', consumer.id, 'not supported');
            return;
        }
        consumer.receive(transport)
            .then(function receiveTrack(track) {
                stream.addTrack(track);
            })
            .catch(function onError(e) {
                console.log('Cannot add track', e);
            });
    }
    
    // Add consumers that are added later...
    peer.on('newconsumer', addConsumer);
    // ... as well as the ones that were already present.
    for (var i = 0; i < peer.consumers.length; i ++) {
        addConsumer(peer.consumers[i]);
    }
}

function subscribeClick() {
    stopSubscribeClick();

    setVideoSource(video, new MediaStream());
    maybePlay();

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
                stopVideo(video);
                setVideoSource(video, new MediaStream());
                maybePlay();
                startStream(peer);
            });
            // ... or if it already exists.
            if (ps.peers[0]) {
                startStream(ps.peers[0]);
            }
        })
        .catch(function onError(err) {
            alert('Cannot subscribe to channel: ' + err);
        });
}

function stopSubscribeClick() {
    stopVideo(video);
    if (ws) {
        ws.close();
        ws = undefined;
    }
}

function subscriberLoad() {
    video = document.querySelector('.mainVideo.rtc');
    video.oncanplay = maybePlay;
    if (video.readyState >= 3) {
        maybePlay();
    }

    var subscribe = document.querySelector('button#subscribe');
    var stopSubscribe = document.querySelector('button#stopSubscribe');
    subscribe.addEventListener('click', subscribeClick);
    stopSubscribe.addEventListener('click', stopSubscribeClick);
}
