# Changelog

## v16.2 — Hardened WebRTC Audio Engine Upgrade
**Release Date:** 2026-06-19

### Improvements
- Fully hardened patching using Symbol-based markers (prevents collisions and site overrides)
- Rewritten SDP optimizer with cleaner fmtp rebuilding and multi‑payload Opus support
- Improved Opus parameter enforcement (384kbps CBR, stereo, ptime=20, FEC/DTX off)
- Smarter constraint merging that preserves app-required constraints and deviceId
- Safer getUserMedia handling for boolean and object audio constraints
- Improved RTCRtpSender.setParameters patch (preserves scalabilityMode, rid, simulcast)
- Safer applyConstraints patch (audio-only, non-destructive)
- More resilient RTCPeerConnection patching (idempotent, stealth)
- Optional DEBUG mode for live inspection

### Notes
This update focuses entirely on internal engine stability, stealth, and compatibility.  
No UI changes. No behavioral regressions.  
All improvements are backward-compatible with v16.0.
