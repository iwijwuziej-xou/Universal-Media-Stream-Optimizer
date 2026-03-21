// ==UserScript==
// @name         Pure Filterless Mic & DisplayMedia
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Strictly patches getUserMedia and getDisplayMedia for raw, filterless, mirrored stereo.
// @author       Coder
// @match        *://*/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Accessing the real window to ensure our patch hits the browser's native code
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    /**
     * BRAINSTORMING THE CORE CONSTRAINTS:
     * To ensure "Filterless" operation while maintaining stereo integrity:
     * - We disable all standard processing (EC, NS, AGC).
     * - We disable all Chromium-specific processing (Highpass, Typing detection).
     * - We force 'googAudioMirroring' to TRUE to protect the stereo field.
     */
    const getFilterlessConstraints = (constraints) => {
        if (!constraints || !constraints.audio) return constraints;

        const rawAudioSettings = {
            // Disable all standard WebIDL filters
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,

            // Disable all internal Chromium filters
            googEchoCancellation: false,
            googAutoGainControl: false,
            googAutoGainControl2: false,
            googNoiseSuppression: false,
            googHighpassFilter: false,
            googTypingNoiseDetection: false,
            googNoiseReduction: false,

            // Maintain Stereo/Raw integrity
            googAudioMirroring: true, 
            channelCount: { ideal: 2, exact: 2 },
            sampleRate: { ideal: 48000 },
            
            // Performance/Latency
            latency: 0
        };

        // If audio was just 'true', replace with our object. 
        // If it was an object, merge our raw settings over their requests.
        if (typeof constraints.audio === 'boolean') {
            constraints.audio = rawAudioSettings;
        } else {
            Object.assign(constraints.audio, rawAudioSettings);
        }

        return constraints;
    };

    // --- PATCH 1: Modern MediaDevices API ---
    if (win.navigator.mediaDevices) {
        // Patching Microphone/Camera access
        const originalGUM = win.navigator.mediaDevices.getUserMedia.bind(win.navigator.mediaDevices);
        win.navigator.mediaDevices.getUserMedia = function(constraints) {
            const patched = getFilterlessConstraints(constraints);
            console.log('[FILTERLESS] getUserMedia (Mic) triggered:', patched);
            return originalGUM(patched);
        };

        // Patching Screen Share/System Audio access
        const originalGDM = win.navigator.mediaDevices.getDisplayMedia.bind(win.navigator.mediaDevices);
        win.navigator.mediaDevices.getDisplayMedia = function(constraints) {
            const patched = getFilterlessConstraints(constraints);
            console.log('[FILTERLESS] getDisplayMedia (Display) triggered:', patched);
            return originalGDM(patched);
        };
    }

    // --- PATCH 2: Legacy Navigator methods (Webkit support) ---
    const legacyMethods = ['getUserMedia', 'webkitGetUserMedia', 'mozGetUserMedia'];
    legacyMethods.forEach(method => {
        if (win.navigator[method]) {
            const original = win.navigator[method].bind(win.navigator);
            win.navigator[method] = function(constraints, success, failure) {
                const patched = getFilterlessConstraints(constraints);
                return original(patched, success, failure);
            };
        }
    });

    console.log('[FILTERLESS] Initialization complete. Mic and DisplayMedia are now raw.');

})();

