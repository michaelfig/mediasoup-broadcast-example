var video;

function maybeShowBlack() {
    video.style.background = 'black';
}

function stopVideo() {
    video.pause();
    video.style.background = 'blue';
    try {
        if (video.srcObject && video.srcObject.getTracks) {
            var tracks = video.srcObject.getTracks();
            for (var i = 0; i < tracks.length; i ++) {
                tracks[i].stop();
            }
        }
        video.srcObject = null;
    }
    catch {}
    video.removeAttribute('src');
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
                
                video.play();
            })
        .catch(function errorCallback(error) {
            alert('Error getting media (error code ' + error.code + ')');
        });
    }
    else if (src.id.match(/^url/i)) {
        stopVideo();
        var url = document.querySelector('input#url').value;
        video.src = url;
        video.play();
        if (video.readyState >= 3) {
            maybeShowBlack();
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
    video = document.querySelector('#mainVideo');
    video.oncanplay = maybeShowBlack;
    if (video.readyState >= 3) {
        maybeShowBlack();
    }
}
