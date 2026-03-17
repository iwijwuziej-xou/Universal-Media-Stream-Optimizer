// ==UserScript==
// @name         Universal Media Stream Optimizer
// @namespace    http://tampermonkey.net/
// @version      14.0
// @description  Adaptive Hardware-Aware Optimization for Professional Audio/Video Interfaces.
// @author       JavaScript Einstein
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const VIDEO_BITRATE_PPS = 8000000;
    const AUDIO_BITRATE_ULTRA = 384000;
    const AUDIO_BITRATE_STANDARD = 64000;

    const applyHardwareConstraints = (c) => {
        if (c.audio) {
            const p = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
                googTypingNoiseDetection: false,
                channelCount: { exact: 2 },
                sampleRate: { ideal: 48000, min: 16000 },
                latency: 0,
                voiceIsolation: 'none'
            };
            c.audio = typeof c.audio === 'object' ? Object.assign(c.audio, p) : p;
        }
        if (c.video) {
            const v = {
                width: { ideal: 1920, max: 3840 },
                height: { ideal: 1080, max: 2160 },
                frameRate: { ideal: 60, min: 60 },
                aspectRatio: 1.777777778
            };
            c.video = typeof c.video === 'object' ? Object.assign(c.video, v) : v;
        }
        return c;
    };

    navigator.mediaDevices.getUserMedia = (o => function(c) { return o.call(this, applyHardwareConstraints(c)); })(navigator.mediaDevices.getUserMedia);
    navigator.mediaDevices.getDisplayMedia = (o => function(c) { return o.call(this, applyHardwareConstraints(c)); })(navigator.mediaDevices.getDisplayMedia);

    const optimizeSDP = (s) => {
        if (!s) return s;
        let l = s.split('\r\n');
        const v = l.findIndex(x => x.startsWith('m=video'));
        if (v !== -1) {
            let m = l[v].split(' ');
            let t = m.slice(3);
            t.sort((a, b) => (a === '114' || a === '98') ? -1 : 1);
            l[v] = m.slice(0, 3).concat(t).join(' ');
            l.splice(v + 1, 0, `b=AS:${Math.floor(VIDEO_BITRATE_PPS / 1000)}`);
        }
        l = l.map(x => {
            if (x.includes('a=fmtp:') && x.includes('opus')) {
                const h = x.includes('maxplaybackrate=48000') || s.includes('48000');
                const b = h ? AUDIO_BITRATE_ULTRA : AUDIO_BITRATE_STANDARD;
                const r = h ? 48000 : 16000;
                let res = x.replace(/maxaveragebitrate=\d+/, `maxaveragebitrate=${b}`).replace(/maxplaybackrate=\d+/, `maxplaybackrate=${r}`);
                if (!res.includes('stereo=1')) res += `;stereo=1;sprop-stereo=1;cbr=1;useinbandfec=0;usedtx=0;sprop-maxcapturerate=${r}`;
                return res;
            }
            return x;
        });
        return l.join('\r\n');
    };

    const p = RTCPeerConnection.prototype;
    const i = (m) => function(d) {
        if (d && d.sdp) d.sdp = optimizeSDP(d.sdp);
        return m.call(this, d);
    };
    p.setLocalDescription = i(p.setLocalDescription);
    p.setRemoteDescription = i(p.setRemoteDescription);

    const a = p.addTrack;
    p.addTrack = function() {
        const r = a.apply(this, arguments);
        this.getReceivers().forEach(rc => { if (rc.playoutDelayHint !== undefined) rc.playoutDelayHint = 0; });
        return r;
    };

    console.log("%c[System]%c Universal Media Stream Optimizer: Operational.", "color:#2ecc71;font-weight:bold", "color:default");
})();
