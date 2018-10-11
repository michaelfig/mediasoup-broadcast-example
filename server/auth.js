'use strict';
const querystring = require('querystring');
const url = require('url');

const SEND_PASSWORD = process.env.SEND_PASSWORD || 'ChangeMe';
const RECV_PASSWORD = process.env.RECV_PASSWORD || 'NotSecret';

function authorize(addr, channel, request) {
    if (request.kind === 'subscribe') {
        console.log(addr, `Authorizing subscriber to ${channel}`);
        if (request.password === RECV_PASSWORD) {
            return Promise.resolve('subscribe');
        }
    }
    else if (request.kind === 'publish') {
        console.log(addr, `Authorizing publisher to ${channel}`);
        if (request.password === SEND_PASSWORD) {
            return Promise.resolve('publish');
        }
    }
    else {
        return Promise.reject(Error(addr + ' Unknown kind ' + request.kind));
    }
    return Promise.reject(Error(addr + ' Invalid authorization for ' + request.kind));
}

module.exports = {
    authorize,
};
