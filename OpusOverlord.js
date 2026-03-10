// ==UserScript==
// @name         Opus Overlord v12.0: Universal God-Mode
// @namespace    http://tampermonkey.net/
// @version      12.0
// @description  Universal 384kbps Stereo + 1080p 60fps Screenshare + Total Filter Annihilation.
// @author       JavaScript Einstein
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const AUDIO_BITRATE = 384000;
    const VIDEO_BITRATE = 8000000; // 8Mbps for 1080p60 Motion Clarity

    // --- 1. GLOBAL STUDIO HARDWARE LOCK ---
    // Targets both Mic (getUserMedia) and Screenshare (getDisplayMedia)
    const applyStudioConstraints = (c) => {
        // AUDIO: Killing all processing discovered in the IG dump
        if (c.audio) {
            const studioAudio = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                googTypingNoiseDetection: false,
                googAudioMirroring: false,
                channelCount: { exact: 2 }, // Force Scarlett Stereo
                sampleRate: { exact: 48000 }, // Force Studio Hz
                latency: 0
            };
            c.audio = typeof c.audio === 'object' ? Object.assign(c.audio, studioAudio) : studioAudio;
        }
        
        // VIDEO/SCREENSHARE: Deleting the 15FPS cap and forcing 1080p60
        if (c.video) {
            const studioVideo = {
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 60, min: 60 },
                aspectRatio: 1.777777778, // 16:9
                displaySurface: "monitor"
            };
            c.video = typeof c.video === 'object' ? Object.assign(c.video, studioVideo) : studioVideo;
        }
        return c;
    };

    // Hijack the capture methods
    navigator.mediaDevices.getUserMedia = (orig => function(c) {
        return orig.call(this, applyStudioConstraints(c));
    })(navigator.mediaDevices.getUserMedia);

    navigator.mediaDevices.getDisplayMedia = (orig => function(c) {
        return orig.call(this, applyStudioConstraints(c));
    })(navigator.mediaDevices.getDisplayMedia);

    // --- 2. THE SDP BITRATE & STEREO JUGGERNAUT ---
    const mungeSDP = (sdp) => {
        if (!sdp) return sdp;
        let lines = sdp.split('\r\n');

        return lines.map(line => {
            // AUDIO: Force 384k, Stereo, No FEC, No DTX, Full Range
            if (line.includes('a=fmtp:') && line.includes('opus')) {
                let m = line.replace(/maxaveragebitrate=\d+/, `maxaveragebitrate=${AUDIO_BITRATE}`)
                            .replace(/maxplaybackrate=\d+/, `maxplaybackrate=48000`);
                
                // sprop-stereo=1 is the king flag for Scarlett users
                if (!m.includes('stereo=1')) {
                    m += `;stereo=1;sprop-stereo=1;cbr=1;useinbandfec=0;usedtx=0;minptime=10`;
                }
                return m;
            }
            // VIDEO: Force 8Mbps Bandwidth pipe for Screenshare
            if (line.startsWith('m=video')) {
                return line + `\r\nb=AS:${Math.floor(VIDEO_BITRATE / 1000)}`;
            }
            return line;
        }).join('\r\n');
    };

    // --- 3. THE SILENT ENGINE HIJACK ---
    const pcProto = RTCPeerConnection.prototype;
    const wrapSDP = (fn) => function(desc) {
        if (desc && desc.sdp) {
            desc.sdp = mungeSDP(desc.sdp);
            console.log("%c[v12.0]%c Universal Studio Parameters Injected.", "color:gold;font-weight:bold", "color:white");
        }
        return fn.call(this, desc);
    };

    pcProto.setLocalDescription = wrapSDP(pcProto.setLocalDescription);
    pcProto.setRemoteDescription = wrapSDP(pcProto.setRemoteDescription);

})();
