// ==UserScript==
// @name         Opus Overlord v4.0: SFU-Resistant Raw Audio
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Fixed syntax, engine-level bitrate enforcement, and triple-layer filter removal.
// @author       JavaScript Einstein
// @match        *://*/*
// @grant        unsafeWindow
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_BITRATE = 384000; // 384 kbps

    /**
     * FIX 1: THE CLEAN CONSTRAINTS ARRAY
     * Added the missing filter list to prevent the SyntaxError.
     */
    const forceRawConstraints = (c) => {
        if (!c ||!c.audio) return c;
        
        // Comprehensive list of standard and proprietary Google/Chrome filters
        const filters =;

        if (typeof c.audio === 'boolean') c.audio = {};
        
        const target = c.audio;
        filters.forEach(f => {
            target[f] = false;
            if (target.mandatory) target.mandatory[f] = false;
            if (target.optional && Array.isArray(target.optional)) {
                target.optional.forEach(opt => { if (opt[f]!== undefined) opt[f] = false; });
            }
        });

        // Enforce high-res hardware requests
        target.channelCount = { exact: 2 };
        target.sampleRate = { exact: 48000 };
        return c;
    };

    // Proxy the source request APIs
    const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => origGUM(forceRawConstraints(c));

    const origApply = MediaStreamTrack.prototype.applyConstraints;
    MediaStreamTrack.prototype.applyConstraints = function(c) {
        return (this.kind === 'audio')? origApply.call(this, forceRawConstraints({audio: c}).audio) : origApply.call(this, c);
    };

    /**
     * FIX 2: ENGINE-LEVEL BITRATE ENFORCEMENT (The "Overlord" Counter)
     * RTCRtpSender.setParameters tells the browser's engine to ignore SDP hints 
     * and use a specific bitrate for the encoding process itself.
     */
    const origSetParameters = RTCRtpSender.prototype.setParameters;
    RTCRtpSender.prototype.setParameters = function(params) {
        if (this.track && this.track.kind === 'audio') {
            if (params && params.encodings && params.encodings.length > 0) {
                params.encodings.maxBitrate = TARGET_BITRATE;
            }
        }
        return origSetParameters.call(this, params);
    };

    /**
     * FIX 3: REDUNDANT SDP INJECTION
     * Rewriting the network handshake contract to request 384kbps + Stereo.
     */
    const mungeSDP = (sdp) => {
        let lines = sdp.split('\r\n');
        const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/);
        if (!opusMatch) return sdp;

        const payloadType = opusMatch[1];
        lines = lines.map(line => {
            if (line.startsWith(`a=fmtp:${payloadType}`)) {
                // Remove existing limits and inject our high-fidelity string
                return `a=fmtp:${payloadType} minptime=10;useinbandfec=1;maxaveragebitrate=${TARGET_BITRATE};stereo=1;sprop-stereo=1;cbr=1`;
            }
            // Inject Bandwidth Modifier (b=AS) directly under audio section
            if (line.startsWith('a=mid:audio')) {
                return line + `\r\nb=AS:${Math.floor(TARGET_BITRATE / 1000)}`;
            }
            return line;
        });
        return lines.join('\r\n');
    };

    // Hijack the PeerConnection to use our munged SDP
    const origSetLocal = RTCPeerConnection.prototype.setLocalDescription;
    RTCPeerConnection.prototype.setLocalDescription = function(desc) {
        if (desc && desc.sdp) { desc.sdp = mungeSDP(desc.sdp); }
        return origSetLocal.call(this, desc);
    };

    console.log(`[Opus Overlord v4.0] Engine Primed. Bitrate set to ${TARGET_BITRATE/1000}kbps.`);
})();
