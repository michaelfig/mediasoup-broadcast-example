const fs = require('fs');
const url = require('url');

const express = require('express');
const WebSocket = require('ws');

const auth = require('./auth');
const wsServer = require('./wsserver');

const app = express();
let server;

if (process.env.HTTPS_HOST) {
    // HTTPS server.
    const base = process.env.HTTPS_HOST;
    const PORT = Number(process.env.PORT) || 443;
    server = require('https').createServer({
        cert: fs.readFileSync(`${__dirname}/certs/${base}.crt`),
        key: fs.readFileSync(`${__dirname}/certs/${base}.key`),
    }, app);
    console.log(`Listening for HTTPS on ${process.env.HTTPS_HOST || '0.0.0.0'}:${PORT}`);
    server.listen(PORT, process.env.HTTPS_HOST);
}
else {
    // HTTP server.
    const PORT = Number(process.env.PORT) || 80;
    server = require('http').createServer(app);
    console.log(`Listening for HTTP on ${process.env.HOST || '0.0.0.0'}:${PORT}`);
    server.listen(PORT, process.env.HOST);
}

app.use(express.static(`${__dirname}/../app`));

const wss = new WebSocket.Server({noServer: true});

server.on('upgrade', function upgrade(req, socket, head) {
    const pathname = url.parse(req.url).pathname;
    function dontUpgrade() {
        socket.destroy();
    }

    try {
        if (pathname === '/publish') {
            function upgradePublisher(channel) {
                wss.handleUpgrade(req, socket, head, function done(ws) {
                    wsServer.publish(channel, ws);
                });
            }
            auth.authSender(req, upgradePublisher, dontUpgrade);
        }
        else if (pathname === '/subscribe') {
            function upgradeSubscriber(channel) {
                wss.handleUpgrade(req, socket, head, function done(ws) {
                    wsServer.subscribe(channel, ws);
                });
            }
            auth.authReceiver(req, upgradeSubscriber, dontUpgrade);
        }
        else {
            dontUpgrade();
        }
    }
    catch (e) {
        console.log('Got error authenticating', e);
        dontUpgrade();
    }
});
