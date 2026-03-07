// ==UserScript==
// @name         Opus Overlord v10.4: Smooth Stereo HD
// @namespace    http://tampermonkey.net/
// @version      10.4
// @description  Stable 256kbps Stereo Force. Optimized for Scarlett 2i2/NT1.
// @author       JavaScript Einstein
// @match        *://*.instagram.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 256kbps is the "Golden Ratio" for High-Def Stereo without encoder lag.
    const STABLE_BITRATE = 256000;

    const applyStudioConstraints = (c) => {
        const studioSettings = {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            googHighpassFilter: false,
            channelCount: { exact: 2 }, // HARD FORCE STEREO
            sampleRate: { exact: 48000 },
            latency: 0
        };
        if (c.audio) {
            if (typeof c.audio === 'object') Object.assign(c.audio, studioSettings);
            else c.audio = studioSettings;
        }
        return c;
    };

    navigator.mediaDevices.getUserMedia = (orig => function(c) {
        return orig.call(this, applyStudioConstraints(c));
    })(navigator.mediaDevices.getUserMedia);

    const forceHDBitrate = (sdp) => {
        if (!sdp || !sdp.includes('opus')) return sdp;

        return sdp.split('\r\n').map(line => {
            if (line.includes('a=fmtp:')) {
                // Erase the 20k limit from your dump and set to Stable 256k
                let m = line.replace(/maxaveragebitrate=\d+/, `maxaveragebitrate=${STABLE_BITRATE}`);
                m = m.replace(/maxplaybackrate=\d+/, `maxplaybackrate=48000`);
                
                // Force Stereo=1 and sprop-stereo=1 to ensure you aren't in mono
                if (!m.includes('maxaveragebitrate')) {
                    m += `;maxaveragebitrate=${STABLE_BITRATE};stereo=1;sprop-stereo=1;cbr=1`;
                } else {
                    // Ensure stereo flags are present even if bitrate was already there
                    if (!m.includes('stereo=1')) m += ';stereo=1;sprop-stereo=1';
                }
                return m;
            }
            if (line.startsWith('m=audio')) {
                return line + `\r\nb=AS:${Math.floor(STABLE_BITRATE / 1000)}`;
            }
            return line;
        }).join('\r\n');
    };

    const pcProto = RTCPeerConnection.prototype;
    const wrapSDP = (fn) => function(description) {
        if (description && description.sdp) {
            description.sdp = forceHDBitrate(description.sdp);
        }
        return fn.call(this, description);
    };

    pcProto.setLocalDescription = wrapSDP(pcProto.setLocalDescription);
    pcProto.setRemoteDescription = wrapSDP(pcProto.setRemoteDescription);

    console.log("%c[v10.4]%c Stable Stereo 256kbps Enforced. No Encoder Lag.", "color:green;font-weight:bold", "color:white");
})();
