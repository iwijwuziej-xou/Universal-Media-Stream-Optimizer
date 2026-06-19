// ==UserScript==
// @name         Microphone Optimizer
// @namespace    http://tampermonkey.net/
// @version      16.2
// @description  Global WebRTC/Opus optimizer: 48kHz, 384kbps CBR, 24-bit ideal, filters off, hardened patching.
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
    const DEBUG = false;
    const log = (...a) => { if (DEBUG) console.log('[IronBlock]', ...a); };
    const PATCHED = Symbol('ironBlockPatched');

    const forceAudioFilterFlags = (o) => {
        if (!o || typeof o !== 'object') return o;
        o.echoCancellation = false;
        o.noiseSuppression = false;
        o.autoGainControl = false;
        o.voiceIsolation = false;
        o.googEchoCancellation = false;
        o.googAutoGainControl = false;
        o.googAutoGainControl2 = false;
        o.googNoiseSuppression = false;
        o.googHighpassFilter = false;
        o.googTypingNoiseDetection = false;
        o.googNoiseReduction = false;
        o.googAudioMirroring = false;
        return o;
    };

    const OPUS_TARGET_BITRATE = 384000;
    const OPUS_SAMPLE_RATE = 48000;

    const upgradeSDP = (sdp) => {
        if (!sdp || typeof sdp !== 'string') return sdp;
        const lines = sdp.split('\r\n');
        const opusPT = new Set();

        for (const l of lines) {
            if (l.startsWith('a=rtpmap:') && /opus\/48000/i.test(l)) {
                const pt = l.split(' ')[0].split(':')[1];
                if (pt) opusPT.add(pt);
            }
        }
        if (!opusPT.size) return sdp;

        const out = lines.map((l) => {
            if (!l.startsWith('a=fmtp:')) return l;
            const m = l.match(/^a=fmtp:(\d+)\s+(.*)$/);
            if (!m) return l;
            const pt = m[1];
            let p = m[2] || '';
            if (!opusPT.has(pt)) return l;

            p = p
                .replace(/maxaveragebitrate=\d+;?/gi, '')
                .replace(/maxplaybackrate=\d+;?/gi, '')
                .replace(/sprop-maxcapturerate=\d+;?/gi, '')
                .replace(/stereo=\d+;?/gi, '')
                .replace(/sprop-stereo=\d+;?/gi, '')
                .replace(/useinbandfec=\d+;?/gi, '')
                .replace(/usedtx=\d+;?/gi, '')
                .replace(/cbr=\d+;?/gi, '')
                .replace(/ptime=\d+;?/gi, '')
                .replace(/;+$/g, '')
                .trim();

            if (p && !p.endsWith(';')) p += ';';

            const o = [
                'stereo=1',
                'sprop-stereo=1',
                `maxaveragebitrate=${OPUS_TARGET_BITRATE}`,
                'cbr=1',
                'useinbandfec=0',
                'usedtx=0',
                `maxplaybackrate=${OPUS_SAMPLE_RATE}`,
                `sprop-maxcapturerate=${OPUS_SAMPLE_RATE}`,
                'ptime=20'
            ];

            return `a=fmtp:${pt} ${p}${o.join(';')}`;
        });

        return out.join('\r\n');
    };

    const patchPeerConnection = () => {
        const PC = win.RTCPeerConnection || win.webkitRTCPeerConnection || win.mozRTCPeerConnection;
        if (!PC || !PC.prototype) return;

        ['setLocalDescription', 'setRemoteDescription'].forEach((n) => {
            const orig = PC.prototype[n];
            if (typeof orig !== 'function' || orig[PATCHED]) return;

            PC.prototype[n] = function (desc) {
                try {
                    if (desc && typeof desc.sdp === 'string') {
                        const u = upgradeSDP(desc.sdp);
                        if (u !== desc.sdp) {
                            desc = new desc.constructor({ type: desc.type, sdp: u });
                        }
                    }
                } catch {}
                return orig.apply(this, arguments);
            };

            PC.prototype[n][PATCHED] = true;
        });
    };

    const mergeAudioConstraints = (t, b) => {
        if (!t || typeof t !== 'object') return b;
        const o = Object.assign({}, t);
        if (!o.channelCount) o.channelCount = {};
        if (!o.sampleRate) o.sampleRate = {};
        if (!o.sampleSize) o.sampleSize = {};
        if (o.channelCount.ideal == null) o.channelCount.ideal = b.channelCount.ideal;
        if (o.sampleRate.ideal == null) o.sampleRate.ideal = b.sampleRate.ideal;
        if (o.sampleSize.ideal == null) o.sampleSize.ideal = b.sampleSize.ideal;
        forceAudioFilterFlags(o);
        return o;
    };

    const patchGetUserMedia = () => {
        if (!win.navigator?.mediaDevices?.getUserMedia) return;
        const md = win.navigator.mediaDevices;
        const orig = md.getUserMedia.bind(md);
        if (orig[PATCHED]) return;

        md.getUserMedia = (c) => {
            try {
                if (!c) c = {};
                if (c.audio) {
                    const base = {
                        channelCount: { ideal: 2 },
                        sampleRate: { ideal: OPUS_SAMPLE_RATE },
                        sampleSize: { ideal: 24 }
                    };
                    forceAudioFilterFlags(base);

                    if (typeof c.audio === 'boolean') {
                        c.audio = base;
                    } else if (typeof c.audio === 'object') {
                        c.audio = mergeAudioConstraints(c.audio, base);
                    }
                }
            } catch {}
            return orig(c);
        };

        md.getUserMedia[PATCHED] = true;
    };

    const patchApplyConstraints = () => {
        const MT = win.MediaStreamTrack;
        if (!MT?.prototype?.applyConstraints) return;

        const orig = MT.prototype.applyConstraints;
        if (orig[PATCHED]) return;

        MT.prototype.applyConstraints = function (c) {
            try {
                if (this.kind === 'audio' && c && typeof c === 'object') {
                    if (c.audio && typeof c.audio === 'object') {
                        forceAudioFilterFlags(c.audio);
                    } else {
                        forceAudioFilterFlags(c);
                    }
                }
            } catch {}
            return orig.apply(this, arguments);
        };

        MT.prototype.applyConstraints[PATCHED] = true;
    };

    const patchRtpSender = () => {
        const RS = win.RTCRtpSender;
        if (!RS?.prototype?.setParameters) return;

        const orig = RS.prototype.setParameters;
        if (orig[PATCHED]) return;

        RS.prototype.setParameters = function (p) {
            try {
                if (p && Array.isArray(p.encodings)) {
                    p.encodings.forEach((e) => {
                        if (!e) return;
                        e.dtx = 'disabled';
                        e.maxBitrate = OPUS_TARGET_BITRATE;
                        e.priority = 'high';
                        e.networkPriority = 'high';
                    });
                }
            } catch {}
            return orig.apply(this, arguments);
        };

        RS.prototype.setParameters[PATCHED] = true;
    };

    try {
        patchPeerConnection();
        patchGetUserMedia();
        patchApplyConstraints();
        patchRtpSender();
    } catch {}
})();
