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

    var channel = subChannel.value;
    var password = subPassword.value;

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

var cHeight, cWidth;
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
        
        var profiles = ['low', 'medium', 'high'];
        var initialAutoProfile = profiles[0];
        if (declaredProfile !== desiredProfile) {
            // Set the value directly.
            declaredProfile = desiredProfile;
            if (desiredProfile === 'auto') {
                // Start with the initial profile.
                videoConsumer.setPreferredProfile(initialAutoProfile);
            }
            else {
                videoConsumer.setPreferredProfile(desiredProfile);
            }
        }

        if (desiredProfile !== 'auto' || !width || !height) {
            // No auto-adjust.
            return;
        }

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
                radios[i].checked = radios[i].value === pprof;
            }
        }
        
        if (pprof !== eprof) {
            // Not settled yet on latest profile change.
            return;
        }

        var ratio = Math.min(cWidth / width, cHeight / height);
        var dindex = eindex;
        var factor = 1;
        if (ratio < 1) {
            factor /= 2;
            while (ratio <= factor) {
                if (dindex <= 0) {
                    // No way to shrink further.
                    break;
                }
                dindex --;
                factor /= 2;
            }
        }
        else if (ratio > 1) {
            while (ratio > factor) {
                if (dindex >= profiles.length - 1) {
                    // No way to grow further.
                    break;
                }
                dindex ++;
                factor *= 2;
            }
        }

        // Attempt to shrink or grow.
        var dprof = profiles[dindex];
        if (dprof !== undefined && dindex !== eindex && dprof !== pprof) {
            videoConsumer.setPreferredProfile(dprof);
        }
    };

    videoConsumer.on('effectiveprofilechange', function onProfileChange(prof) {
        var radios = document.querySelectorAll('input[name="prof"]');
        for (var i = 0; i < radios.length; i ++) {
            radios[i].checked = radios[i].value === prof;
        }
    });
    return doAutoAdjustProfile;
}


function doAdjust() {
    if (autoAdjustProfile) {
        autoAdjustProfile(video.videoWidth, video.videoHeight);
    }
}

function manualDoAdjust() {
    profAuto.checked = false;
    doAdjust();
}

function cacheVideoDimensions() {
    // Just set the variables to be used by autoAdjustProfile.
    cWidth = video.clientWidth;
    cHeight = video.clientHeight;
}

function subscriberLoad() {
    video = subVideo;
    window.addEventListener('resize', cacheVideoDimensions);
    cacheVideoDimensions();
    var radios = document.querySelectorAll('input[name="prof"]');
    for (var i = 0; i < radios.length; i ++) {
        radios[i].onclick = manualDoAdjust;
    }
    profAuto.onclick = doAdjust;
    function subscribeToggle() {
        if (subscribe.checked) {
            subscribeClick();
        }
        else {
            stopSubscribeClick();
        }
    }
    subscribe.addEventListener('click', subscribeToggle);
    if (subscribe.checked) {
        subscribeClick();
    }
    function subscribeCheck() {
        subscribe.checked = true;
        subscribeToggle();
    }
    onEnterPerform(subChannel, subscribeCheck);
    onEnterPerform(subPassword, subscribeCheck);

    function mutedToggle() {
        video.muted = muted.checked;
    }
    muted.addEventListener('click', mutedToggle);

    if (window.location.search.match(/(\?|&)sub=1(&|$)/)) {
        // Autosubscribe.
        subscribeCheck();
    }
    else {
        // Unmute in preparation for subscribe toggle.
        muted.checked = video.muted = false;
    }
}
