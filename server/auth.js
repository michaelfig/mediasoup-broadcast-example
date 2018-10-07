const querystring = require('querystring');
const url = require('url');

const SEND_PASSWORD = process.env.SEND_PASSWORD || 'ChangeMe';
const RECV_PASSWORD = process.env.RECV_PASSWORD || 'NotSecret';

function authSender(req, callback, errback) {
    const u = url.parse(req.url);
    const q = querystring.parse(u.query);
    console.log(`Authenticating sender to ${q.channel}`);
    if (Buffer.from(q.access_token, 'base64').toString('ascii') === SEND_PASSWORD) {
        console.log('Success!');
        return callback(q.channel);
    }
    console.log('Error!');
    return errback(Error('Cannot authenticate sender'));
}

function authReceiver(req, callback, errback) {
    const u = url.parse(req.url);
    const q = querystring.parse(u.query);
    console.log(`Authenticating receiver to ${q.channel}`);
    if (Buffer.from(q.access_token, 'base64').toString('ascii') === RECV_PASSWORD) {
        console.log('Success!');
        return callback(q.channel);
    }
    console.log('Error!');
    return errback(Error('Cannot authenticate receiver'));
}

module.exports = {
    authSender,
    authReceiver,
};
