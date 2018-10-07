const ms = require('mediasoup');

const msOptions = {};
if (process.env.RTC_ANNOUNCE_IP) {
    // This is the external IP address that routes to the current
    // instance.  For cloud providers or Kubernetes, this
    // will be a different address than the connected network
    // interface will use.
    msOptions.rtcAnnouncedIPv4 = process.env.RTC_ANNOUNCE_IP;
}
const msServer = ms.Server(msOptions);

function publish(channel, ws) {
    ws.send(`publishing to ${channel}`);
    ws.close();
}

function subscribe(channel, ws) {
    ws.send(`subscribing to ${channel}`);
    ws.close();
}

module.exports = {
    publish,
    subscribe,
};