# ADR 0002: Upstream MediaMTX Container Replacement for Tactical Video Streaming

- **Status**: Accepted
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

CloudTAK's upstream `docker-compose.yml` referenced `ghcr.io/dfpc-coe/media-infra:v9.10.0` for tactical drone, bodycam, and RTSP video ingestion and redistribution. This image was part of an excluded private repository ecosystem (`dfpc-coe/media-infra`). In field, air-gapped, or independent deployments, this external image is unavailable and creates an unauthorized dependency on third-party infrastructure.

Furthermore, upstream `media-infra` is a thin wrapper around [MediaMTX](https://github.com/bluenviron/mediamtx) (formerly rtsp-simple-server) with FFmpeg support.

---

## Decision

1. **Replace Container Image**: Replace `ghcr.io/dfpc-coe/media-infra:v9.10.0` in `cloudtak/docker-compose.yml` with the official upstream MediaMTX image.
2. **Pin Image Version**: Pin `bluenviron/mediamtx:1.11.3-ffmpeg` to prevent runtime regressions or breaking configuration changes introduced by floating tags such as `latest`.
3. **Mount Local Configuration**: Mount `cloudtak/config/mediamtx.yml` directly into `/mediamtx.yml` in the container.
4. **Internal Authentication**: In `mediamtx.yml`, define internal credentials (`authInternalUsers`) matching the API streaming credentials so video publishers and viewers authenticate against MediaMTX without external callbacks.
5. **Port Forwarding**: Expose tactical streaming ports (RTSP `:8554`, WebRTC `:8889`, RTMP `:1935`, HLS `:8888`) on `0.0.0.0` while restricting the MediaMTX management API (`:9997`) to `127.0.0.1`.

---

## Consequences

### Positive
- Completely removes external dependency on `dfpc-coe/media-infra`.
- Uses a well-maintained, battle-tested open-source media routing server.
- Supports ultra-low latency WebRTC streaming to browser-based operators alongside RTSP/RTMP drone feeds.
- Pinned version ensures deterministic builds and air-gapped image export/import.

### Negative / Neutral
- Configuration format changes in future MediaMTX releases must be audited before upgrading the pinned image.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/external-dependency-removal/spec.md`:
    - Requirement: `Independent media streaming service`
    - Scenario: `Video stream ingestion and distribution`
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/self-hosted-deployment/spec.md`:
    - Requirement: `No dependency on excluded infrastructure repositories`
    - Scenario: `Media service uses upstream image`
- **Tasks**: Task 2.1 in `tasks.md`.

---

## Verification Evidence

1. **Image Pinning**: Verified `cloudtak/docker-compose.yml` uses:
   ```yaml
   image: bluenviron/mediamtx:1.11.3-ffmpeg
   ```
2. **Container Execution**: Launched `cloudtak-media-1` via Docker Compose; container reported healthy and running.
3. **Listener Verification**: Port checks confirmed active listeners on:
   - RTSP: `0.0.0.0:8554` (TCP/UDP)
   - RTMP: `0.0.0.0:1935` (TCP)
   - HLS: `0.0.0.0:8888` (TCP)
   - WebRTC: `0.0.0.0:8889` (TCP/UDP)
   - SRT: `0.0.0.0:8890` (UDP)
   - REST API: `127.0.0.1:9997` (or host-remapped port)
4. **API Response**: Verified via `curl http://127.0.0.1:<PORT>/v3/paths/list` returning HTTP 200:
   ```json
   {"pageCount":0,"items":[]}
   ```
