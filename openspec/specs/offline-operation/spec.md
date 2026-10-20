# offline-operation Specification

## Purpose

Core TISCK geospatial, situational awareness, and communication workflows function reliably in austere and disconnected network environments without relying on external internet CDNs, external map servers, or third-party cloud APIs.

## Requirements

### Requirement: Self-hosted basemap and geospatial tiles
The map viewer and tiles service SHALL serve raster and vector basemaps locally via PMTiles without contacting external tile providers (Mapbox, OpenStreetMap, Maptiler).

#### Scenario: PMTiles serving from local Garage bucket
- **WHEN** a client navigates to the map viewer in an air-gapped environment
- **THEN** vector and raster tiles are retrieved from local PMTiles files stored in Garage via the tiles service (`/api/tiles/...`)

#### Scenario: Bounding box coverage for Horn of Africa
- **WHEN** PMTiles archives are loaded for Ethiopia and the Horn of Africa (32.9°E, 3.3°N to 48.0°E, 15.0°N)
- **THEN** the basemap renders all designated zoom levels without HTTP 404 or external DNS queries

### Requirement: Self-hosted client assets and dependencies
Web UI assets (fonts, icons, stylesheets, scripts) SHALL be bundled and served locally from the web application container.

#### Scenario: Air-gapped UI rendering
- **WHEN** a web browser opens the TISCK application without internet access
- **THEN** the UI loads completely with all fonts, icons, and UI components rendered correctly with zero failed outbound requests to external CDNs
