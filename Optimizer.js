// ==UserScript==
// @name         Universal Iron-Block v16: 384kbps / 24-bit / No Filters
// @namespace    http://tampermonkey.net/
// @version      16.0
// @description  Global WebRTC/Opus optimizer: 48kHz, 384kbps CBR, 24-bit ideal, DTX/FEC off, all Chromium mic filters and goog flags forced false at every layer.
// @author       Coder
// @match        *://*/*
// @grant        unsafeWindow
// @run-at       document-start
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/iwijwuziej-xou/Universal-Media-Stream-Optimizer/refs/heads/main/Optimizer.js
// @downloadURL  https://raw.githubusercontent.com/iwijwuziej-xou/Universal-Media-Stream-Optimizer/refs/heads/main/Optimizer.js
// ==/UserScript==

(function () {
    'use strict';

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    const forceAudioFilterFlags = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        obj.echoCancellation = false;
        obj.noiseSuppression = false;
        obj.autoGainControl = false;
        obj.voiceIsolation = false;
        obj.googEchoCancellation = false;
        obj.googAutoGainControl = false;
        obj.googAutoGainControl2 = false;
        obj.googNoiseSuppression = false;
        obj.googHighpassFilter = false;
        obj.googTypingNoiseDetection = false;
        obj.googNoiseReduction = false;
        obj.googAudioMirroring = false;
        return obj;
    };

    const upgradeSDP = (sdp) => {
        if (!sdp || typeof sdp !== 'string') return sdp;

        const lines = sdp.split('\r\n');
        const opusPayloadTypes = new Set();

        for (const line of lines) {
            if (line.startsWith('a=rtpmap:') && /opus\/48000/i.test(line)) {
                const pt = line.split(' ')[0].split(':')[1];
                opusPayloadTypes.add(pt);
            }
        }

        if (opusPayloadTypes.size === 0) return sdp;

        const newLines = lines.map((line) => {
            if (!line.startsWith('a=fmtp:')) return line;

            const match = line.match(/^a=fmtp:(\d+)\s+(.*)$/);
            if (!match) return line;

            const pt = match[1];
            let params = match[2];

            if (!opusPayloadTypes.has(pt)) return line;

            params = params
                .replace(/maxaveragebitrate=\d+;?/gi, '')
                .replace(/maxplaybackrate=\d+;?/gi, '')
                .replace(/sprop-maxcapturerate=\d+;?/gi, '')
                .replace(/stereo=\d+;?/gi, '')
                .replace(/sprop-stereo=\d+;?/gi, '')
                .replace(/useinbandfec=\d+;?/gi, '')
                .replace(/usedtx=\d+;?/gi, '')
                .replace(/cbr=\d+;?/gi, '')
                .replace(/;+$/g, '')
                .trim();

            if (params && !params.endsWith(';')) params += ';';

            const overrides = [
                'stereo=1',
                'sprop-stereo=1',
                'maxaveragebitrate=384000',
                'cbr=1',
                'useinbandfec=0',
                'usedtx=0',
                'maxplaybackrate=48000',
                'sprop-maxcapturerate=48000'
            ];

            return `a=fmtp:${pt} ${params}${overrides.join(';')}`;
        });

        return newLines.join('\r\n');
    };

    const patchPeerConnection = () => {
        const PC = win.RTCPeerConnection || win.webkitRTCPeerConnection || win.mozRTCPeerConnection;
        if (!PC || !PC.prototype) return;

        ['setLocalDescription', 'setRemoteDescription'].forEach((name) => {
            const orig = PC.prototype[name];
            if (typeof orig !== 'function') return;
            if (orig.__ironBlockPatched) return;
            orig.__ironBlockPatched = true;

            PC.prototype[name] = function (desc) {
                try {
                    if (desc && typeof desc.sdp === 'string') {
                        desc = new desc.constructor({
                            type: desc.type,
                            sdp: upgradeSDP(desc.sdp)
                        });
                    }
                } catch (e) {}
                return orig.apply(this, arguments);
            };
        });
    };

    const patchGetUserMedia = () => {
        if (!win.navigator || !win.navigator.mediaDevices || !win.navigator.mediaDevices.getUserMedia) return;

        const md = win.navigator.mediaDevices;
        const originalGUM = md.getUserMedia.bind(md);
        if (originalGUM.__ironBlockPatched) return;
        originalGUM.__ironBlockPatched = true;

        md.getUserMedia = (constraints) => {
            try {
                if (!constraints) constraints = {};
                if (constraints.audio) {
                    const base = {
                        channelCount: { ideal: 2 },
                        sampleRate: { ideal: 48000 },
                        sampleSize: { ideal: 24 }
                    };
                    forceAudioFilterFlags(base);

                    if (typeof constraints.audio === 'boolean') {
                        constraints.audio = base;
                    } else if (typeof constraints.audio === 'object') {
                        constraints.audio = Object.assign({}, constraints.audio, base);
                        forceAudioFilterFlags(constraints.audio);
                    }
                }
            } catch (e) {}
            return originalGUM(constraints);
        };
    };

    const patchApplyConstraints = () => {
        const MT = win.MediaStreamTrack;
        if (!MT || !MT.prototype || typeof MT.prototype.applyConstraints !== 'function') return;

        const orig = MT.prototype.applyConstraints;
        if (orig.__ironBlockPatched) return;
        orig.__ironBlockPatched = true;

        MT.prototype.applyConstraints = function (constraints) {
            try {
                if (constraints && typeof constraints === 'object') {
                    if (constraints.audio && typeof constraints.audio === 'object') {
                        forceAudioFilterFlags(constraints.audio);
                    } else {
                        forceAudioFilterFlags(constraints);
                    }
                }
            } catch (e) {}
            return orig.apply(this, arguments);
        };
    };

    const patchRtpSender = () => {
        const RS = win.RTCRtpSender;
        if (!RS || !RS.prototype || typeof RS.prototype.setParameters !== 'function') return;

        const origSetParams = RS.prototype.setParameters;
        if (origSetParams.__ironBlockPatched) return;
        origSetParams.__ironBlockPatched = true;

        RS.prototype.setParameters = function (params) {
            try {
                if (params && Array.isArray(params.encodings)) {
                    params.encodings.forEach((enc) => {
                        if (!enc) return;
                        enc.dtx = 'disabled';
                        enc.maxBitrate = 384000;
                        enc.priority = 'high';
                        enc.networkPriority = 'high';
                    });
                }
            } catch (e) {}
            return origSetParams.apply(this, arguments);
        };
    };

    try {
        patchPeerConnection();
        patchGetUserMedia();
        patchApplyConstraints();
        patchRtpSender();
    } catch (e) {}
})();
