# ADR 0005: Offline Geospatial Asset Bundling and PMTiles Basemap Provisioning

- **Status**: Partially Implemented
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

Standard web mapping applications frequently download glyphs, vector tiles, stylesheets, and icon libraries from public internet CDNs (e.g. Mapbox, OpenStreetMap, Google Fonts, UNPKG). In tactical and air-gapped environments in the Horn of Africa, no internet connectivity exists. Any asset request to an external domain will either hang until browser timeout or produce broken UI components and missing basemaps.

---

## Decision

1. **Self-Contained Frontend Asset Bundling**:
   - Build all Vue 3 / Vite client assets directly into the `api` container image served via embedded Nginx.
   - Bundle all fonts, SVG icons, and MapLibre GL styles locally.
   - Eliminate external CDN URLs from `index.html` and Vue components.
2. **Local Vector & Raster Basemaps via PMTiles**:
   - Deploy `cloudtak-tiles-1` (`tasks/pmtiles`), an HTTP server that queries PMTiles archives directly from the Garage S3 object store using HTTP byte-range requests.
   - Expose tiles on `0.0.0.0:5002` for both the web map viewer and external ATAK/WinTAK field clients.
3. **Horn of Africa Geospatial Coverage**:
   - Designate the primary operational bounding box for Horn of Africa coverage: `32.9°E, 3.3°N` (Southwest) to `48.0°E, 15.0°N` (Northeast).
   - Support uploading regional PMTiles archives (e.g. `ethiopia.pmtiles`, `horn-of-africa.pmtiles`) into Garage bucket `cloudtak`.

---

## Consequences

### Positive
- Web application loads completely and renders cleanly in air-gapped environments.
- Zero outbound DNS or HTTP requests to public CDNs.
- Single-file PMTiles format allows simple field transfer and updating of massive regional map datasets via USB or local network upload.

### Negative / Neutral
- Large PMTiles archives (several GBs) must be provisioned onto the deployment host prior to disconnected field operations.

---

## Conflict / Implementation Gap

> [!NOTE]
> **Status Classification**:
> - **Accepted**: Offline web client asset bundling and local PMTiles server operation are fully verified.
> - **Proposed**: Pre-seeding a complete Horn of Africa `.pmtiles` archive into the production Garage container image or default volume is **Proposed** as an operational packaging step; currently, the system expects the operator to upload the archive or place it in the volume.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/offline-operation/spec.md`:
    - Requirement: `Self-hosted basemap and geospatial tiles`
    - Requirement: `Self-hosted client assets and dependencies`
- **Tasks**: Tasks 4.1 and 4.2 in `tasks.md`.

---

## Verification Evidence

1. **Frontend Asset Audit**: Queried `http://localhost:5000/` from the live container.
   - Inspected response HTML and JS bundles.
   - Verified all script and stylesheet tags point to `/assets/index-[hash].js`, `/assets/vendor-[hash].js`, and `/assets/index-[hash].css`.
   - Verified zero external script tags (`cdn.jsdelivr.net`, `fonts.googleapis.com`, `api.mapbox.com`).
2. **PMTiles Service Verification**:
   - Built and ran `cloudtak-tiles-1`.
   - Executed container unit tests: all 17 tests passed cleanly.
   - Verified service listening on port `5002`.
3. **Byte-Range Storage Verification**: Confirmed via ADR 0003 that Garage v2.4.1 responds to byte-range requests with HTTP 206 Partial Content, enabling PMTiles header and directory parsing.
