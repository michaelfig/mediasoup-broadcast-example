'use strict';
var ws;
var room;
var stream;
var transport;
var video;
var producers = {};

function connectProducer(type, track) {
    if (producers[type]) {
        console.log('stop producing', type, producers[type].track.id);
        producers[type].close();
        delete producers[type];
    }
    if (room && track) {
        console.log('producing', type, track.id);
        producers[type] = room.createProducer(track);
        producers[type].send(transport);
    }
}

function maybeStream(kind) {
    // Actually begin the stream if we can.
    if (!stream) {
        console.log('no', kind, 'stream yet');
        return;
    }

    console.log('streaming', kind);
    function doConnects() {
        if (!stream) {
            return;
        }
        connectProducer('audio', stream.getAudioTracks()[0]);
        connectProducer('video', stream.getVideoTracks()[0]);
    }
    whenStreamIsActive(function getStream() { return stream }, doConnects);
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
        stopCaptureClick();
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        })
        .then(function successCallback(stream) {
                // Send the output of the media to the video.
                setVideoSource(video, stream);
                maybeStream('cam');
            })
        .catch(function errorCallback(error) {
            alert('Error getting media (error code ' + error.code + ')');
        });
    }
    else if (src.id.match(/^url/i)) {
        stopCaptureClick();
        var url = document.querySelector('input#url').value;
        setVideoSource(video, url);
        maybeStream(url);
    }
    else {
        alert('Unrecognized capture source ' + src.id);
        return;
    }
}

function stopCaptureClick() {
    setVideoSource(video);
    connectProducer('audio');
    connectProducer('video');
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
            maybeStream('cam');
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
    video = document.querySelector('video#pubVideo');

    // Mute everywhere except Firefox, which mutes when we start streaming
    // and won't stream audio if we mute it manually.
    if (!video.mozCaptureStream) {
        video.volume = 0;
    }

    capture.addEventListener('click', captureClick);
    stopCapture.addEventListener('click', stopCaptureClick);
    publish.addEventListener('click', publishClick);
    stopPublish.addEventListener('click', stopPublishClick);

    onEnterPerform(document.querySelector('#pubChannel'), publishClick);
    onEnterPerform(document.querySelector('#pubPassword'), publishClick);
}
