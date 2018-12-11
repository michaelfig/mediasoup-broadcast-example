'use strict';
var ws;
var room;
var stream;
var transport;
var video;
var bufVideo;
var producers = {};
var sendStream;

function connectProducer(type, track) {
    if (producers[type]) {
        console.log('stop producing', type, producers[type].track.id);
        producers[type].close();
        delete producers[type];
    }
    if (room && track) {
        console.log('producing', type, track.id);
        var opts = type === 'video' ? {simulcast: true} : {};
        producers[type] = room.createProducer(track, opts);
        producers[type].on('stats', showStats);
        producers[type].enableStats(1000);
        producers[type].send(transport);
        producers[type].on('close', function closeProducer() {
            clearStats(type);
        });
    }
}

function maybeStream(stream) {
    // Actually begin the stream if we can.
    if (!stream) {
        console.log('no sending stream yet');
        return;
    }
    sendStream = stream;

    console.log('streaming');
    function doConnects() {
        if (!stream) {
            return;
        }
        var atrack = stream.getAudioTracks();
        var vtrack = stream.getVideoTracks();
        function notEnded(track) {
            if (track.readyState === 'ended' && stream.removeTrack) {
                stream.removeTrack(track);
                return false;
            }
            return true;
        }
        connectProducer('audio', atrack.find(notEnded));
        connectProducer('video', vtrack.find(notEnded));
    }
    whenStreamIsActive(function getStream() { return stream }, doConnects);
}

var capturing = {};
function hookup(capturing, newStream, newVideoStream) {
    var vtrack = capturing.stream.getVideoTracks();
    if (capturing.video && vtrack.length > 0) {
        for (var track of newStream.getVideoTracks()) {
            track.stop();
        }
        newStream.addTrack(vtrack[0]);
        if (newVideoStream) {
            for (var track of newVideoStream.getVideoTracks()) {
                track.stop();
            }
            newVideoStream.addTrack(vtrack[0]);
        }
    }
    var atrack = capturing.stream.getAudioTracks();
    if (capturing.audio && atrack.length > 0) {
        for (var track of newStream.getAudioTracks()) {
            track.stop();
        }
        newStream.addTrack(atrack[0]);
    }
    maybeStream(newStream);
}

function stopCaptureStreams() {
    for (var src in capturing) {
        var stream = capturing[src].stream;
        for (var track of stream.getAudioTracks()) {
            track.stop();
        }
        for (var track of stream.getVideoTracks()) {
            track.stop();
        }
    }
    capturing = {};
    connectProducer('audio');
    connectProducer('video');
}

function captureStreams() {
    stopCaptureStreams();
    var aud = document.querySelector('#aud');
    var vid = document.querySelector('#vid');

    sendStream = sendStream || new MediaStream();
    var newVideoStream = new MediaStream();

    // Reflect our new streams in the source.
    setVideoSource(video, newVideoStream);

    var gumAudio = aud.value === 'mic';
    var gumVideo = ['user', 'env'].find(function (val) { return val === vid.value });
    if (gumAudio || gumVideo) {
        var constraints = {};
        if (gumAudio) {
            constraints.audio = true;
        }
        if (gumVideo) {
            constraints.video = {facingMode: gumVideo === 'env' ? 'environment' : gumVideo};
        }
        
        navigator.mediaDevices.getUserMedia(constraints)
        .then(function successCallback(stream) {
            capturing.gum = {
                stream: stream,
                audio: gumAudio,
                video: gumVideo,
            };
            hookup(capturing.gum, sendStream, newVideoStream);
        })
        .catch(function errorCallback(error) {
            alert('Error getting media (error code ' + error.code + ')');
        });
    }

    var newSrc = document.querySelector('#tagUrl').value;
    var tagAudio = aud.value === 'tag' ? newSrc : false;
    var tagVideo = vid.value === 'tag' ? newSrc : false;

    if (tagAudio || tagVideo) {
        function captureTag() {
            bufVideo.src = newSrc;
            capturing.tag = {
                video: tagVideo,
                audio: tagAudio,
                restart: captureTag
            };
            if (bufVideo.captureStream) {
                capturing.tag.stream = bufVideo.captureStream();
            }
            else if (bufVideo.mozCaptureStream) {
                capturing.tag.stream = bufVideo.mozCaptureStream();
            }
            else {
                alert('Cannot capture video stream!');
                delete capturing.tag;
            }
            if (capturing.tag) {
                function hookupTag() {
                    hookup(capturing.tag, sendStream, newVideoStream);
                }
                whenStreamIsActive(function getTagStream() { return capturing.tag.stream }, hookupTag);
            }
        };
        captureTag();
    }
    else {
        bufVideo.src = null;
    }

    var newUrl = document.querySelector('#mjpegUrl').value;
    var mjpegVideo = vid.value === 'mjpeg' ? newUrl : false;
    if (mjpegVideo) {
        alert('would mjpeg stream ' + newUrl);
    }
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
            maybeStream(sendStream);
        })
        .catch(function onError(err) {
            alert('Cannot publish to channel: ' + err);
        });
}

function stopPublishClick() {
    clearStats();
    if (ws) {
        ws.close();
        ws = undefined;
    }
}

function publisherLoad() {
    var publish = document.querySelector('input#publish');
    video = document.querySelector('video#pubVideo');
    bufVideo = document.querySelector('video#bufVideo');

    bufVideo.onended = function loopStreams() {
        if (capturing.tag && capturing.tag.restart) {
            bufVideo.src = null;
            capturing.tag.restart();
        }
    };

    // Mute everywhere except Firefox, which mutes when we start streaming
    // and won't stream audio if we mute it manually.
    if (!video.mozCaptureStream) {
        video.volume = 0;
    }

    publish.addEventListener('click', function togglePublish(event) {
        if (event.target.checked) {
            publishClick();
        }
        else {
            stopPublishClick();
        }
    });

    onEnterPerform(document.querySelector('#pubChannel'), publishClick);
    onEnterPerform(document.querySelector('#pubPassword'), publishClick);

    var capture = document.querySelector('#capture');
    capture.addEventListener('click', function toggleCapture(event) {
        if (event.target.checked) {
            captureStreams();
        }
        else {
            stopCaptureStreams();
        }
    });
    if (document.querySelector('#capture').checked) {
        captureStreams();
    }
    if (document.querySelector('#publish').checked) {
        publishClick();
    }
}

function onOptionClick(el, cb) {
    var opts = el.querySelectorAll('option');
    for (var i = 0; i < opts.length; i ++) {
        opts[i].addEventListener('click', cb);
    }
}