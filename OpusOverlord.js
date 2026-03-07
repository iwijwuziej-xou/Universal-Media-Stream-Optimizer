// ==UserScript==
// @name         Opus Overlord v10.6: Stereo Lock
// @namespace    http://tampermonkey.net/
// @version      10.6
// @description  Bypasses Instagram's Mono Downmix. Forces Stereo for Scarlett 2i2.
// @author       JavaScript Einstein
// @match        *://*.instagram.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const BITRATE = 256000; 

    const forceStereoSDP = (sdp) => {
        if (!sdp || !sdp.includes('opus')) return sdp;

        let lines = sdp.split('\r\n');
        return lines.map(line => {
            if (line.includes('a=fmtp:')) {
                // Remove all existing stereo/bitrate flags to start clean
                let m = line.replace(/stereo=\d;?/, '').replace(/sprop-stereo=\d;?/, '').replace(/maxaveragebitrate=\d+;?/, '');
                
                // FORCE the stereo flags at the START of the parameters
                // stereo=1: "I want to receive stereo"
                // sprop-stereo=1: "I am SENDING stereo"
                m += `;stereo=1;sprop-stereo=1;maxaveragebitrate=${BITRATE};cbr=1`;
                return m;
            }
            if (line.startsWith('m=audio')) return line + `\r\nb=AS:${Math.floor(BITRATE / 1000)}`;
            return line;
        }).join('\r\n');
    };

    // --- HIJACK THE NEGOTIATION ---
    const pcProto = RTCPeerConnection.prototype;
    
    // We must hack BOTH setLocal and setRemote because Chrome/Brave 
    // will downmix if either side says "0".
    const wrap = (fn) => function(desc) {
        if (desc && desc.sdp) {
            desc.sdp = forceStereoSDP(desc.sdp);
            console.log("%c[v10.6]%c Stereo Handshake Injected.", "color:#00ffcc;font-weight:bold", "color:white");
        }
        return fn.call(this, desc);
    };

    pcProto.setLocalDescription = wrap(pcProto.setLocalDescription);
    pcProto.setRemoteDescription = wrap(pcProto.setRemoteDescription);

    // --- HARDWARE LOCK ---
    navigator.mediaDevices.getUserMedia = (orig => function(c) {
        if (c.audio) {
            c.audio = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: { exact: 2 }, // Tells Brave to pull 2 channels from the Scarlett
                sampleRate: 48000
            };
        }
        return orig.call(this, c);
    })(navigator.mediaDevices.getUserMedia);

})();
