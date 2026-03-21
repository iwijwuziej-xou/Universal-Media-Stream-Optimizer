// ==UserScript==
// @name         Global Media Overrider (Stereo & Mirroring)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Forces 1080p60, Raw Stereo Audio, and googAudioMirroring
// @author       Partner
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Brainstorming the "Enforcement" Targets:
    // We disable all 'goog' filters and force channelCount to 2 for Stereo.
    const AUDIO_RAW_STEREO = {
        // Standard W3C
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2, min: 2 },
        
        // Chromium Internal (The "Secret Sauce")
        googAudioMirroring: true, // Forces 1:1 hardware mirroring
        googAutoGainControl: false,
        googAutoGainControl2: false,
        googEchoCancellation: false,
        googNoiseSuppression: false,
        googHighpassFilter: false,
        googTypingNoiseDetection: false,
        googNoiseReduction: false,
        
        // Quality parameters
        latency: 0,
        sampleRate: 48000,
        sampleSize: 16
    };

    const VIDEO_HQ = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60 },
        aspectRatio: { ideal: 1.7777777778 }
    };

    const patch = (constraints, isScreen) => {
        if (!constraints) return constraints;
        const c = JSON.parse(JSON.stringify(constraints));

        // Force Stereo & Mirroring
        if (c.audio) {
            if (typeof c.audio === 'boolean' || typeof c.audio === 'object') {
                c.audio = typeof c.audio === 'object' ? { ...c.audio, ...AUDIO_RAW_STEREO } : AUDIO_RAW_STEREO;
            }
        }

        // Force 1080p60
        if (c.video) {
            const videoBase = isScreen ? VIDEO_HQ : { frameRate: { ideal: 60 } };
            c.video = typeof c.video === 'object' ? { ...c.video, ...videoBase } : videoBase;
        }

        return c;
    };

    // --- PROXY INTERCEPTION ---

    if (navigator.mediaDevices) {
        // Intercept Mic/Cam
        const originalGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async function(c) {
            console.log('%c[MediaOverride] Mic/Cam -> Forcing Raw Stereo & Mirroring', 'color: #00ff00; font-weight: bold;');
            return originalGUM(patch(c, false));
        };

        // Intercept Screen Share
        const originalGDM = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = async function(c) {
            console.log('%c[MediaOverride] Screen Share -> Forcing 1080p60 & Stereo', 'color: #00d4ff; font-weight: bold;');
            return originalGDM(patch(c, true));
        };
    }

    console.log('%c[Partner] v1.7 Active: Stereo Support + Mirroring Enabled Globally.', 'color: #fff; background: #222; padding: 3px; border-radius: 4px;');
})();

