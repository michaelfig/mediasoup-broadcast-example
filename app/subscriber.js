var viewer;

function maybeShowBlack() {
    viewer.style.background = 'black';
}

function subscriberLoad() {
    viewer = document.querySelector('#mainViewer');
    viewer.oncanplay = maybeShowBlack;
    if (viewer.readyState >= 3) {
        maybeShowBlack();
    }
}
