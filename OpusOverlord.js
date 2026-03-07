// ==UserScript==
// @name         Opus Overlord v10.7: Pure-Stream (No FEC)
// @namespace    http://tampermonkey.net/
// @version      10.7
// @description  Disables FEC/RED, Forces Stereo, and Locks 256kbps for Scarlett 2i2.
// @author       JavaScript Einstein
// @match        *://*.instagram.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const BITRATE = 256000; 

    const forcePureStereo = (sdp) => {
        if (!sdp || !sdp.includes('opus')) return sdp;

        let lines = sdp.split('\r\n');
        
        // 1. Remove FEC and RED (Redundancy) payloads from the mapping
        // This stops the browser from even negotiating error correction.
        lines = lines.filter(line => !line.includes('transport-cc') && !line.includes('goog-remb'));

        return lines.map(line => {
            if (line.includes('a=fmtp:')) {
                // Remove existing constraints
                let m = line.replace(/stereo=\d;?/, '')
                           .replace(/sprop-stereo=\d;?/, '')
                           .replace(/maxaveragebitrate=\d+;?/, '')
                           .replace(/useinbandfec=\d;?/, '') // Remove FEC if present
                           .replace(/usedtx=\d;?/, '');    // Remove DTX (Discontinuous Transmission)

                // FORCE: Stereo, No FEC (0), No DTX (0), High Bitrate, and 48kHz
                m += `;stereo=1;sprop-stereo=1;maxaveragebitrate=${BITRATE};cbr=1;useinbandfec=0;usedtx=0;maxplaybackrate=48000`;
                return m;
            }
            if (line.startsWith('m=audio')) {
                return line + `\r\nb=AS:${Math.floor(BITRATE / 1000)}`;
            }
            return line;
        }).join('\r\n');
    };

    // --- HIJACK THE NEGOTIATION ---
    const pcProto = RTCPeerConnection.prototype;
    const wrap = (fn) => function(desc) {
        if (desc && desc.sdp) {
            desc.sdp = forcePureStereo(desc.sdp);
            console.log("%c[v10.7]%c FEC Disabled | Stereo Locked.", "color:#ff00ff;font-weight:bold", "color:white");
        }
        return fn.call(this, desc);
    };

    pcProto.setLocalDescription = wrap(pcProto.setLocalDescription);
    pcProto.setRemoteDescription = wrap(pcProto.setRemoteDescription);

    // --- HARDWARE PURITY ---
    navigator.mediaDevices.getUserMedia = (orig => function(c) {
        if (c.audio) {
            c.audio = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                googHighpassFilter: false,
                channelCount: { exact: 2 }, 
                sampleRate: 48000
            };
        }
        return orig.call(this, c);
    })(navigator.mediaDevices.getUserMedia);

})();
