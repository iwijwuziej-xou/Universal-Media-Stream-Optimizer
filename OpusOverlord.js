// ==UserScript==
// @name         Opus Overlord v12.2: Pure Math Edition
// @namespace    http://tampermonkey.net/
// @version      12.2
// @description  Uses exact Opus logic (stereo=1) to force 2-channel Scarlett audio.
// @author       JavaScript Einstein
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const AUDIO_BITRATE = 384000;
    const VIDEO_BITRATE = 8000000;

    const applyStudioLogic = (c) => {
        if (c.audio) {
            c.audio = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                googHighpassFilter: false,
                // THE NUMBER 2 GOES HERE: Telling Windows to pull 2 channels
                channelCount: { exact: 2 }, 
                sampleRate: { exact: 48000 },
                latency: 0
            };
        }
        if (c.video) {
            c.video = {
                width: 1920, height: 1080, frameRate: { min: 60, ideal: 60 }
            };
        }
        return c;
    };

    navigator.mediaDevices.getUserMedia = (orig => function(c) { return orig.call(this, applyStudioLogic(c)); })(navigator.mediaDevices.getUserMedia);
    navigator.mediaDevices.getDisplayMedia = (orig => function(c) { return orig.call(this, applyStudioLogic(c)); })(navigator.mediaDevices.getDisplayMedia);

    const mungeSDP = (sdp) => {
        if (!sdp) return sdp;
        return sdp.split('\r\n').map(line => {
            if (line.includes('a=fmtp:') && line.includes('opus')) {
                // THE NUMBER 1 GOES HERE: Enabling the Stereo switch
                let m = line.replace(/maxaveragebitrate=\d+/, `maxaveragebitrate=${AUDIO_BITRATE}`)
                            .replace(/maxplaybackrate=\d+/, `maxplaybackrate=48000`);
                if (!m.includes('stereo=1')) {
                    m += `;stereo=1;sprop-stereo=1;cbr=1;useinbandfec=0;usedtx=0;sprop-maxcapturerate=48000`;
                }
                return m;
            }
            if (line.startsWith('m=video')) return line + `\r\nb=AS:${Math.floor(VIDEO_BITRATE / 1000)}`;
            return line;
        }).join('\r\n');
    };

    const pcProto = RTCPeerConnection.prototype;
    const wrap = (fn) => function(desc) {
        if (desc && desc.sdp) desc.sdp = mungeSDP(desc.sdp);
        return fn.call(this, desc);
    };

    pcProto.setLocalDescription = wrap(pcProto.setLocalDescription);
    pcProto.setRemoteDescription = wrap(pcProto.setRemoteDescription);

    console.log("%c[v12.2]%c Logic Applied: ChannelCount(2) + Stereo(1).", "color:#00ffcc;font-weight:bold", "color:white");
})();
