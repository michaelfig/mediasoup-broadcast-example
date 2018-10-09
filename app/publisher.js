var video;

function maybePlay() {
    video.style.background = 'black';
    if (video.srcObject || video.src) {
        video.play().catch(function playError(e) {
            console.log('Cannot play video', e);
        });
    }
}

function stopVideo() {
    if (!video.paused) {
        video.pause();
    }
    video.style.background = 'blue';
    try {
        if (video.srcObject && video.srcObject.stop) {
            video.srcObject.stop();
        }
        else if (video.srcObject && video.srcObject.getTracks) {
            var tracks = video.srcObject.getTracks();
            for (var i = 0; i < tracks.length; i ++) {
                tracks[i].stop();
            }
        }
        video.srcObject = null;
    }
    catch (e) {
        console.log('Error stopping srcObject', e);
    }
    video.removeAttribute('src');
    video.currentTime = 0;
    video.load();
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
        stopVideo();
        // We need to swap video tags for Safari 12 on MacOS, which
        // refuses to change from a getUserMedia srcObject back to
        // a regular src stream.
        video.style.display = 'none';
        video = document.querySelector('.mainVideo.cam');
        video.style.display = 'block';
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        })
        .then(function successCallback(stream) {
                // Send the output of the media to the video.
                try {
                    video.srcObject = stream;
                }
                catch (e) {
                    var url = (window.URL || window.webkitURL);
                    video.src = url ? url.createObjectURL(stream) : stream;
                }
                maybePlay();
            })
        .catch(function errorCallback(error) {
            alert('Error getting media (error code ' + error.code + ')');
        });
    }
    else if (src.id.match(/^url/i)) {
        stopVideo();
        video.style.display = 'none';
        video = document.querySelector('.mainVideo.url');
        video.style.display = 'block';
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
    stopVideo();
}

function publishClick() {
    alert('would publish');
}

function stopPublishClick() {
    alert('would stop publishing');
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
