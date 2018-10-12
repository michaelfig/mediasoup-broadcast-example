* Publisher disconnects, change input source, stream before inputs, etc.  Generate a new video element when we change peer for subscriber or sources for publisher, because that seems to be the only way to clear the browser state.  Simplify the APIs accordingly.

* Retry failed websocket.

* Edge VP8 debugging https://github.com/versatica/mediasoup/issues/192
H.264 had better work, since we don't want to choose between Edge and Safari.

* Have a more robust protocol filter to limit what the subscriber can do.  Maybe it is okay now... they can send consumers so that the publisher can contact an individual subscriber.

* Do we really need to video.play()?  I don't think so, if we set autoplay and playsinline.

* publish.html - put a big caption over the video to indicate when we are not publishing.

* RTC_ANNOUNCE_IPV4, RTC_ANNOUNCE_IPV6 -> RTC_ANNOUNCED_IPV4, RTC_ANNOUNCED_IPV6.

* Write a compelling README.md.

* Review and comment all the code.
