'use strict';
var ws;
var room;
var stream;
var video;
var transport;
var producers = {};

function maybeStream() {
    // Actually begin the stream if we can.
    if (!room || !video) {
        return;
    }
    if (!stream && video.captureStream) {
        stream = video.captureStream();
    }
    if (!stream && video.mozCaptureStream) {
        stream = video.mozCaptureStream();
    }
    if (!stream) {
        return;
    }

    function connectProducer(type, track) {
        if (producers[type]) {
            if (track) {
                producers[type].replaceTrack(track);
            }
            else {
                producers[type].close();
                delete producers[type];
            }
        }
        else if (track) {
            producers[type] = room.createProducer(track);
            producers[type].send(transport);
        }
    }

    connectProducer('audio', stream.getAudioTracks()[0]);
    connectProducer('video', stream.getVideoTracks()[0]);
}

function maybePlay() {
    video.style.background = 'black';
    if (video.srcObject || video.src) {
        video.play()
            .then(maybeStream)
            .catch(function playError(e) {
                console.log('Cannot play video', e);
            });
    }
}

function switchVideo(sel) {
    stopVideo(video);

    // We need to swap video tags for Safari 12 on MacOS, which
    // refuses to change from a getUserMedia srcObject back to
    // a regular src stream.
    video.style.display = 'none';
    video = document.querySelector(sel);
    
    // Mute everywhere except Firefox, which mutes when we start streaming
    // and won't stream audio if we mute it manually.
    if (!video.mozCaptureStream) {
        video.volume = 0;
    }
    video.style.display = 'block';
}

function captureClick() {
    var srcs = document.querySelectorAll('input[name="src"]');
    var src;
    for (var i = 0; i < srcs.length; i ++) {
        if (srcs[i].checked) {
            src = srcs[i];
        }
    }

    if (!src) {
        alert('You must select a capture source');
        return;
    }

    if (src.id.match(/^cam/i)) {
        switchVideo('.mainVideo.cam');
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        })
        .then(function successCallback(stream) {
                // Send the output of the media to the video.
                setVideoSource(video, stream);
                maybePlay();
            })
        .catch(function errorCallback(error) {
            alert('Error getting media (error code ' + error.code + ')');
        });
    }
    else if (src.id.match(/^url/i)) {
        switchVideo('.mainVideo.url');
        var url = document.querySelector('input#url').value;
        video.src = url;
        video.load();
        if (video.readyState >= 3) {
            maybePlay();
        }
    }
    else {
        alert('Unrecognized capture source ' + src.id);
        return;
    }
}

function stopCaptureClick() {
    stopVideo(video);
}

function publishClick() {
    stopPublishClick();

    var channel = document.querySelector('#pubChannel').value;
    var password = document.querySelector('#pubPassword').value;

    pubsubClient(channel, password, true)
        .then(function havePubsub(ps) {
            ws = ps.ws;
            room = ps.room;
            producers = {};

            // Now actually stream the selected video to the output.
            transport = room.createTransport('send');
            maybeStream();
        })
        .catch(function onError(err) {
            alert('Cannot publish to channel: ' + err);
        });
}

function stopPublishClick() {
    if (ws) {
        ws.close();
        ws = undefined;
    }
}

function publisherLoad() {
    var capture = document.querySelector('button#capture');
    var stopCapture = document.querySelector('button#stopCapture');
    var publish = document.querySelector('button#publish');
    var stopPublish = document.querySelector('button#stopPublish');
    capture.addEventListener('click', captureClick);
    stopCapture.addEventListener('click', stopCaptureClick);
    publish.addEventListener('click', publishClick);
    stopPublish.addEventListener('click', stopPublishClick);
    video = document.querySelector('.mainVideo.url');
    video.oncanplay = maybePlay;
    if (video.readyState >= 3) {
        maybePlay();
    }
}
