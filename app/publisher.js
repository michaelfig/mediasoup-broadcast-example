'use strict';
var ws;
var room;
var stream;
var transport;
var video;
var producers = {};
var sendStream;

var lastProduced = {};
function connectProducer(type, track) {
    if (producers[type]) {
        if (room && track && lastProduced[type] === track.id) {
            return;
        }
        console.log('stop producing', type, producers[type].track.id);
        producers[type].close();
        delete producers[type];
        delete lastProduced[type];
    }
    if (room && track) {
        console.log('producing', type, track.id);
        lastProduced[type] = track.id;
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
    setVideoSource(video);
    for (var src in capturing) {
        if (capturing[src].cancel) {
            capturing[src].cancel();
        }
        var stream = capturing[src].stream;
        if (stream) {
        for (var track of stream.getAudioTracks()) {
            track.stop();
        }
        for (var track of stream.getVideoTracks()) {
            track.stop();
        }
    }
    }
    capturing = {};
    connectProducer('audio');
    connectProducer('video');
}

function captureStreams() {
    stopCaptureStreams();

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

    var newSrc = tagUrl.value;
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
        // Stop the bufVideo from playing.
        bufVideo.src = '';
    }

    var newUrl = mjpegUrl.value;
    var mjpegVideo = vid.value === 'mjpeg' ? newUrl : false;
    if (mjpegVideo) {
        capturing.mjpeg = {
            video: mjpegVideo,
            audio: false,
        };
        mjpegFetch(mjpegVideo, newVideoStream);
    }
}

function publishClick() {
    stopPublishClick();

    var channel = pubChannel.value;
    var password = pubPassword.value;

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
    video = document.querySelector('video#pubVideo');

    bufVideo.onended = function loopStreams() {
        if (capturing.tag && capturing.tag.restart) {
            bufVideo.src = null;
            capturing.tag.restart();
        }
    };

    // Mute everywhere except Firefox, which mutes when we start streaming
    // and won't stream audio if we mute it manually.
    if (!bufVideo.mozCaptureStream) {
        bufVideo.volume = 0;
    }

    function togglePublish(event) {
        if (publish.checked) {
            publishClick();
        }
        else {
            stopPublishClick();
        }
    }
    publish.addEventListener('click', togglePublish);

    function publishCheck() {
        publish.checked = true;
        togglePublish();
    }
    onEnterPerform(pubChannel, publishCheck);
    onEnterPerform(pubPassword, publishCheck);

    capture.addEventListener('click', captureStreams);
    stopCapture.addEventListener('click', stopCaptureStreams);
    if (capture.checked) {
        captureStreams();
    }
    if (publish.checked) {
        publishClick();
    }

    mjpegUrl.addEventListener('click', function selectMjpeg() {
        vid.value = 'mjpeg';
    });
    tagUrl.addEventListener('click', function selectTag() {
        vid.value = 'tag';
        aud.value = 'tag';
    });
}

function onOptionClick(el, cb) {
    var opts = el.querySelectorAll('option');
    for (var i = 0; i < opts.length; i ++) {
        opts[i].addEventListener('click', cb);
    }
}

var TYPE_JPEG = 'image/jpeg';

function mjpegFetch(src, newVideoStream) {
    // This function adapted from: https://github.com/aruntj/mjpeg-readable-stream/blob/master/index.html
    // MIT License.
    var ctx = mjpegCanvas.getContext('2d');
    var stopCapture = false;
    var controller = window.AbortController && new window.AbortController();

    var fetchFlags = {};
    if (controller) {
        fetchFlags.signal = controller.signal;
    }

    var mjpegImage = new Image();
    capturing.mjpeg.cancel = function doCancelFetch() {
        stopCapture = true;
        mjpegImage = null;
        ctx.clearRect(0, 0, mjpegCanvas.width, mjpegCanvas.height);
        mjpegCanvas.height = 0;
        mjpegCanvas.width = 0;
        if (controller) {
            controller.abort();
        }
    };

    fetch(src, fetchFlags)
    .then(function fetchComplete(response) {
        if (stopCapture) {
            return;
        }
        if (!response.ok) {
            var reason = response.status+' '+response.statusText;
            alert('Cannot fetch ' + src + ': ' + reason);
            throw Error(reason);
        }
        if (!response.body) {
            alert('ReadableStream not supported.\n' +
              'If you are using Firefox, go to about:config and set:\n' +
              'dom.streams.enabled and javascript.options.streams');
            throw Error('ReadableStream not yet supported in this browser.');
        }
        
        try {
            capturing.mjpeg.stream = mjpegCanvas.captureStream();
            function hookupTag() {
                hookup(capturing.mjpeg, sendStream, newVideoStream);
            }
            whenStreamIsActive(function getMjpegStream() { return capturing.mjpeg.stream }, hookupTag);
        }
        catch (e) {
            alert('Cannot mjpegCanvas.captureStream: ' + e);
            return;
        }

        var reader = response.body.getReader();
        var headers = '';
        var contentLength = -1;
        var imageBuffer = null;
        var bytesRead = 0;

        function pushRead() {
            reader.read().then(function readChunk(attrs) {
                if (attrs.done || stopCapture) {
                    return;
                }

                var value = attrs.value;
                for (let index =0; index < value.length; index++) {
                    
                    // we've found start of the frame. Everything we've read till now is the header.
                    if (value[index] === 0xff && value[index+1] === 0xd8) {
                        // console.log('header found : ' + newHeader);
                        contentLength = getLength(headers);
                        // console.log("Content Length : " + newContentLength);
                        imageBuffer = new Uint8Array(new ArrayBuffer(contentLength));
                    }
                    // we're still reading the header.
                    if (contentLength <= 0) {
                        headers += String.fromCharCode(value[index]);
                        // console.log('headers sofar : ' + headers);
                    }
                    // we're now reading the jpeg. 
                    else if (bytesRead < contentLength){
                        imageBuffer[bytesRead++] = value[index];
                    }
                    // we're done reading the jpeg. Time to render it. 
                    else {
                        // console.log("jpeg read with bytes : " + bytesRead);
                        mjpegImage.src = URL.createObjectURL(new Blob([imageBuffer], {type: TYPE_JPEG}));
                        contentLength = 0;
                        bytesRead = 0;
                        headers = '';
                        imageBuffer = null;
                        mjpegImage.onload = function imgLoad() {
                            mjpegImage.onload = null;
                            mjpegCanvas.height = mjpegImage.naturalHeight;
                            mjpegCanvas.width = mjpegImage.naturalWidth;
                            ctx.drawImage(mjpegImage, 0, 0);
                        };
                    }
                }
                pushRead();
            }).catch(function onError(error) {
                console.error('Error reading MJPEG stream:', error);
                alert('Error reading MJPEG stream: ' + error);
            })
        }
                
        pushRead();
    }).catch(function onError(error) {
        console.error('Error fetching MJPEG stream:', error);
        alert('Error fetching MJPEG stream: ' + error);
    });
}

function getLength(headers) {
    // Most MJPEG streams send "Content-Length: 9389986".
    var match = headers.match(/^content-length: *(\d+)$/mi);
    if (match) {
        return Number(match[1]);
    }
    // At least Sony SNC CH110 sends "DataLen: 00938696".
    var match2 = headers.match(/^datalen: *(\d+)$/mi);
    if (match2) {
        return Number(match2[1]);
    }
    return -1;
}
