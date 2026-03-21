// ==UserScript==
// @name         Media Stream Constraints Overrider (Max Quality)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Forces 1080p60 Screen Capture and Filterless Raw Audio
// @author       Partner
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Brainstorming Logic: 
    // 1. We use "ideal" for resolution to avoid hardware mismatch errors.
    // 2. We use "exact: false" for filters to tell Chromium "DO NOT PROCESS THIS."
    // 3. We include legacy 'goog' flags because Chrome's internal engine still references them.

    const RAW_AUDIO_CONSTRAINTS = {
        echoCancellation: { daily: false, exact: false },
        noiseSuppression: { daily: false, exact: false },
        autoGainControl: { daily: false, exact: false },
        channelCount: { ideal: 2 },
        // Chromium Internal Overrides
        googAudioMirroring: true,
        googAutoGainControl: false,
        googAutoGainControl2: false,
        googEchoCancellation: false,
        googHighpassFilter: false,
        googNoiseSuppression: false,
        googTypingNoiseDetection: false,
        googNoiseReduction: false,
        latency: 0,
        sampleRate: 48000,
        sampleSize: 16
    };

    const HQ_VIDEO_CONSTRAINTS = {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 60, max: 60 },
        aspectRatio: { ideal: 1.7777777778 }
    };

    const patchConstraints = (constraints, isDisplay) => {
        const modified = JSON.parse(JSON.stringify(constraints || {}));

        // Force Mic to be filterless
        if (modified.audio) {
            if (typeof modified.audio === 'boolean') {
                modified.audio = RAW_AUDIO_CONSTRAINTS;
            } else {
                Object.assign(modified.audio, RAW_AUDIO_CONSTRAINTS);
            }
        }

        // Force Screen/Video to 1080p60
        if (isDisplay) {
            if (!modified.video || typeof modified.video === 'boolean') {
                modified.video = HQ_VIDEO_CONSTRAINTS;
            } else {
                Object.assign(modified.video, HQ_VIDEO_CONSTRAINTS);
            }
        }

        return modified;
    };

    // --- EXECUTION ---

    if (navigator.mediaDevices) {
        // Handle Screen Share (getDisplayMedia)
        const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = async function(c) {
            console.log('%c[MediaOverride] Forcing 1080p60 Screen Capture...', 'color: #00d4ff');
            try {
                return await originalGetDisplayMedia(patchConstraints(c, true));
            } catch (e) {
                console.warn('[MediaOverride] Max settings failed, falling back to default.', e);
                return originalGetDisplayMedia(c);
            }
        };

        // Handle Mic/Cam (getUserMedia)
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async function(c) {
            console.log('%c[MediaOverride] Forcing Raw Filterless Audio...', 'color: #00ff00');
            try {
                return await originalGetUserMedia(patchConstraints(c, false));
            } catch (e) {
                console.warn('[MediaOverride] Filter removal failed, falling back to default.', e);
                return originalGetUserMedia(c);
            }
        };
    }

    console.log('%c[MediaOverride] Partner Script Loaded. Targets: getDisplayMedia & getUserMedia.', 'background: #222; color: #bada55');
})();

