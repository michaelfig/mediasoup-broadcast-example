var video;

function maybeShowBlack() {
    video.style.background = 'black';
}

function subscriberLoad() {
    video = document.querySelector('#mainVideo');
    video.oncanplay = maybeShowBlack;
    if (video.readyState >= 3) {
        maybeShowBlack();
    }
}
