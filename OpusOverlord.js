// ==UserScript==
// @name         Opus Overlord v12.1: Zero-Gate Universal
// @namespace    http://tampermonkey.net/
// @version      12.1
// @description  Disables all Thresholds, Gates, and filters found in the dump. Global 1080p60.
// @author       JavaScript Einstein
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const AUDIO_BITRATE = 384000;
    const VIDEO_BITRATE = 8000000;

    // --- 1. THE THRESHOLD ANNIHILATOR ---
    const annihilateThresholds = (c) => {
        if (c.audio) {
            const noGate = {
                // Hard-disabling the "Ideal" flags found in your dump
                echoCancellation: { ideal: false },
                noiseSuppression: { ideal: false },
                autoGainControl: { ideal: false },
                // Killing internal Chromium "goog" thresholds
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                googTypingNoiseDetection: false,
                googAudioMirroring: false,
                googNoiseReduction: false,
                // Setting audio path to raw/zero-latency
                channelCount: { exact: 2 },
                sampleRate: { exact: 48000 },
                latency: 0,
                // Voice Isolation is a Windows 11 / MacOS system-level gate
                voiceIsolation: 'none'
            };
            c.audio = typeof c.audio === 'object' ? Object.assign(c.audio, noGate) : noGate;
        }

        if (c.video) {
            c.video = {
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 60, min: 60 },
                displaySurface: "monitor"
            };
        }
        return c;
    };

    // Hijack capture
    navigator.mediaDevices.getUserMedia = (orig => function(c) {
        return orig.call(this, annihilateThresholds(c));
    })(navigator.mediaDevices.getUserMedia);

    navigator.mediaDevices.getDisplayMedia = (orig => function(c) {
        return orig.call(this, annihilateThresholds(c));
    })(navigator.mediaDevices.getDisplayMedia);

    // --- 2. BITRATE & HANDSHAKE FORCE ---
    const mungeSDP = (sdp) => {
        if (!sdp) return sdp;
        return sdp.split('\r\n').map(line => {
            if (line.includes('a=fmtp:') && line.includes('opus')) {
                // Delete FEC/DTX thresholds to prevent quality drops
                let m = line.replace(/maxaveragebitrate=\d+/, `maxaveragebitrate=${AUDIO_BITRATE}`)
                            .replace(/maxplaybackrate=\d+/, `maxplaybackrate=48000`);
                if (!m.includes('stereo=1')) {
                    m += `;stereo=1;sprop-stereo=1;cbr=1;useinbandfec=0;usedtx=0`;
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

    console.log("%c[v12.1]%c ALL THRESHOLDS DELETED. Raw Studio Stream Active.", "color:orange;font-weight:bold", "color:white");
})();
