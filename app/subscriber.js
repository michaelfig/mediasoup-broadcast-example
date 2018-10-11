'use strict';
var video;
var ws;

function maybePlay() {
    video.style.background = 'black';
}

function subscribeClick() {
    stopSubscribeClick();

    var channel = document.querySelector('#subChannel').value;
    var password = document.querySelector('#subPassword').value;

    pubsubClient(channel, password, false)
        .then(function havePubsub(ps) {
            ws = ps.ws;
            alert('would start subscribing');
        })
        .catch(function onError(err) {
            alert('Cannot subscribe to channel: ' + err);
        });
}

function stopSubscribeClick() {
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
