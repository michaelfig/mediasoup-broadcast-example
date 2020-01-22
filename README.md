# Mediasoup Broadcast Example

[Mediasoup](https://mediasoup.org/) is a Javascript library that provides a WebRTC SFU (Selective Forwarding Unit), which enables modern browsers on all platforms (Chrome, Edge, Firefox, and Safari, desktop and mobile) to use Real Time Communications for sending and receiving audio/video streams with just a single publically-accessible server (no need for transcoding or direct connections between peers as is necessary for other WebRTC setups).

This project is a vanilla Javascript example of how to use Mediasoup to support the specific case of one-to-many broadcast audio/video on individual "channels".  I prefer writing Typescript, but I wanted to demonstrate a minimal implementation for learning purposes.

There are no techniques borrowed from other code, just the docs.  Accordingly, the ISC license (simple, permissive) is used for this code to encourage you to derive your own software from it without legal worries.  Pull requests are welcome!  I don't want to add more features, but polishing and simplifying this example are important to me.  See the [TODO.md](TODO.md) for suggested contributions.

## Quickstart

For simple tests, run:

```
$ PORT=8080 node server/index.js
```

and connect subscribers to:

http://localhost:8080/

and a publisher (one per channel) to:

http://localhost:8080/publish.html

Click "Capture" and then "Publish" to send the A/V stream to any attached subscribers.  A subscriber can "Subscribe" at any time.  The default passwords in the interfaces will work out-of-the-box.  Read the browser console log and Node.js output when you want to learn more about what's happening.

If you have problems with black screens or choppiness/delays, it is probably due to your network/firewall configuration.  First try to get things working with simply localhost, then reread the below notes on `RTC_ANNOUNCED_IPV4` before you log an issue.

I deliberately chose Opus and H.264 for the only supported A/V codecs, because that's the only combination that will work for both modern Safari and Edge (Chrome and Firefox are much more tolerant).  There are still some problems with Edge that I'm working with the Mediasoup folks to resolve, but my default settings seem to work well enough.

### Simulcast

If you want to experiment with Simulcast (publishing multiple resolutions at a time, so that subscribers can choose between them), currently only Chrome publishers support it for H264, and only then if you specify the `--force-fieldtrials=WebRTC-H264Simulcast/Enabled/` command-line option when you start Chrome for the first time.

### MJPEG

If you have access to an MJPEG IP camera, you can specify it in the publisher.  Note that most cameras don't set the CORS headers to allow cross-origin access, and their content can't even be accessed from HTTPS pages since they are not on localhost, so you may have to use a localhost proxy or browser extension such as [Cacao](https://github.com/michaelfig/cacao) in order to allow access.

# Architecture

Read the following sections to understand more about what you will need to change when you build your own broadcast system.

## app/

This directory contains the subscriber (`index.html`) and publisher (`publish.html`) for the server.  It uses the Mediasoup Client library to handle the protocol requests to and from the Mediasoup server.  The manipulation of the video and stream objects was the hardest to get right for all browsers, so I encourage you to crib the techniques I used.

Until I have a chance to refactor, you should know that I tend to write code from bottom to top... the more high-level code comes at the end of each file.  Also, more inline documentation will be added in the future.

* `common.js` - Look for the `FIXME`s to see what may need to change, specifically the authentication process.

## server/

This directory contains the Node.js server-side code that coordinates interaction between the publisher, the subscriber, and Mediasoup itself.  Mediasoup does not specify a signalling protocol, so this server uses plain WebSocket (via the ws module) with JSON-formatted messages.

NOTE: In order to run this example, the `server/index.js` must be running either on localhost, or a publically-accessible IP address.  Note that private IP ranges and VPN connections are filtered out by some browser WebRTC implementations (notably Safari), so your streams will probably not be forwarded correctly if you run locally.

Note the following environment variables affect the server:

* `HOST`, `PORT` - IP address, TCP port to listen on for HTTP connections (default: `0.0.0.0 80`).  Connect to `http://<HOST>:<PORT>/` for the subscriber, `http://<HOST>:<PORT>/publish.html` for the publisher.

* `RTC_ANNOUNCED_IPV4`, `RTC_ANNOUNCED_IPV6` - Default, autodetect.  These are IP addresses that the publisher and subscriber can use to connect to the Mediasoup worker (running as a subprocess of the Node.js server).  Make sure your firewalls allow inbound TCP and UDP ports 10000-59999 to this address, as well as no limits on outbound connections.

* `SEND_PASSWORD`, `RECV_PASSWORD` - plaintext passwords used for authentication.

* `auth.js` - replace this file with your own implementation of authentication for your publisher and subscriber.

## Running under Docker

For extra credit, you can run the server under Docker, see [example repository](https://hub.docker.com/r/michaelfig/mediasoup-broadcast-example/).  You will need host networking (`--network host`, which doesn't work on Windows or MacOS versions of Docker, since they are actually running in a VM) to allow the Docker instance to access all the TCP and UDP ports it needs (see above `RTC_ANNOUNCED_IPV4`).  Docker doesn't allow exposing port ranges.

## Bonus: Kubernetes

If you like Kubernetes, there is a Helm chart in `charts/mediasoup-broadcast-example`.  See the `values.yaml` in that directory for instructions on using `hostNetworkIP`.  In short, you will need to schedule the `mediasoup-broadcast-example` pod (single replica only) to run on a node that has an external IP that meets the requirements of `RTC_ANNOUNCED_IPV4`.  To accomplish this, you will use `hostNetworkIP: <MY-IP>` in your Helm yaml settings, and then label the node that receives traffic for that public IP with:

```
$ kubectl label node <MY-NODE> hostNetworkIP=<MY-IP>
```

Refer to `build.sh` and `charts/example.yaml` for rudimentary hints on how to install it.

## Credits

Thanks a lot to Iñaki Baz Castillo for the wonderful Mediasoup software, and quick and responsive support of it.

I, Michael FIG, implemented the first working version of this example within a week, from scratch, using only the Mediasoup and Mediasoup Client API documentation and publically-accessible Web API documentation as references.  I hope this helps you jumpstart your own projects!

Have fun!

Michael FIG <michael+ms@fig.org>, 2018-10-13
