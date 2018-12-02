'use strict';
var ws;
var room;
var transport;
var video;

function startStream(peer) {
    var stream = new MediaStream();
    function addConsumer(consumer) {
        if (!consumer.supported) {
            console.log('consumer', consumer.id, 'not supported');
            return;
        }
        if (consumer.kind === 'video') {
            autoAdjustProfile = makeAutoAdjustProfile(consumer);
            autoAdjustProfile();
        }
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

    pubsubClient(channel, password, false)
        .then(function havePubsub(ps) {
            ws = ps.ws;
            room = ps.room;
            transport = room.createTransport('recv');
            // The server will only ever send us a single publisher.
            // Stream it if it is new...
            room.on('newpeer', function newPeer(peer) {
                console.log('New peer detected:', peer.name);
                setVideoSource(video, startStream(peer));
            });
            // ... or if it already exists.
            if (ps.peers[0]) {
                console.log('Existing peer detected:', ps.peers[0].name);
                setVideoSource(video, startStream(ps.peers[0]));
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
    autoAdjustProfile = undefined;
    clearStats();
    setVideoSource(video);
    transport = undefined;
    room = undefined;
    if (ws) {
        ws.close();
        ws = undefined;
    }
}

function makeAutoAdjustProfile(videoConsumer) {
    var declaredProfile;
    function doAutoAdjustProfile(width, height) {
        var desiredProfile;
        if (document.querySelector('input[name="autoProf"]:checked')) {
            desiredProfile = 'auto';
        }
        else {
            desiredProfile = document.querySelector('input[name="prof"]:checked').value;
        }
        
        if (desiredProfile !== 'auto') {
            if (declaredProfile !== desiredProfile) {
                // Set the value directly.
                declaredProfile = desiredProfile;
                videoConsumer.setPreferredProfile(desiredProfile);
            }
            return;
        }

        if (!width || !height) {
            return;
        }

        var profiles = ['low', 'medium', 'high'];
        var eprof = videoConsumer.effectiveProfile;
        var eindex = profiles.indexOf(eprof);
        if (eindex < 0) {
            // No effective profile detected yet.
            return;
        }

        var pprof = videoConsumer.preferredProfile;
        if (pprof === 'default') {
            pprof = eprof;
            var radios = document.querySelectorAll('input[name="prof"]');
            for (var i = 0; i < radios.length; i ++) {
                radios[i].checked = radios[i].value === eprof;
            }
        }
        
        if (pprof !== eprof) {
            // Not settled yet on our specific profile.
            return;
        }

        var dprof;
        var ratio = Math.min(video.clientWidth / width, video.clientHeight / height);
        if (ratio <= 0.5) {
            if (eindex - 1 < 0) {
                // No way to shrink.
                return;
            }

            // Do shrink!
            dprof = profiles[eindex - 1];
        }
        else if (ratio > 1) {
            if (eindex + 1 > profiles.length) {
                // No way to grow bigger.
                return;
            }
            
            // Do grow!
            dprof = profiles[eindex + 1];
        }

        if (dprof && dprof !== pprof) {
            videoConsumer.setPreferredProfile(dprof);
            var radios = document.querySelectorAll('input[name="prof"]');
            for (var i = 0; i < radios.length; i ++) {
                radios[i].checked = radios[i].value === dprof;
            }
        }
    };
    return doAutoAdjustProfile;
}


function doAdjust() {
    if (autoAdjustProfile) {
        autoAdjustProfile(video.videoWidth, video.videoHeight);
    }
}

function subscriberLoad() {
    var subscribe = document.querySelector('button#subscribe');
    var stopSubscribe = document.querySelector('button#stopSubscribe');
    video = document.querySelector('video#subVideo');
    window.onresize = doAdjust;
    var radios = document.querySelectorAll('input[name="prof"]');
    for (var i = 0; i < radios.length; i ++) {
        radios[i].onclick = doAdjust;
    }
    document.querySelector('input#profAuto').onclick = doAdjust;
    subscribe.addEventListener('click', subscribeClick);
    stopSubscribe.addEventListener('click', stopSubscribeClick);
    onEnterPerform(document.querySelector('#subChannel'), subscribeClick);
    onEnterPerform(document.querySelector('#subPassword'), subscribeClick);
}
