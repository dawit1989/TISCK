# ADR 0008: Horn of Africa Operational Geospatial Baseline and Tactical Groups

- **Status**: Accepted
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

Upstream CloudTAK was configured for North American environments (defaulting to coordinates centered in Colorado, USA, with imperial measurement units such as `mph`). TISCK is customized for field situational awareness, counter-terrorism, border security, and disaster response operations in **Ethiopia and the greater Horn of Africa**.

Operating in this theater requires:
1. Default map view centered over Addis Ababa and the Ethiopian plateau.
2. Bounding limits encompassing the entire Horn of Africa (Eritrea, Djibouti, Somalia, Eastern South Sudan, Northern Kenya).
3. Metric measurement units standard in regional military and civilian operations (`km/h`, meters).
4. Pre-configured tactical organizational groups reflecting military, border defense, and interagency mission profiles.

---

## Decision

1. **Map Center & Zoom**:
   - Set default map center coordinates to Addis Ababa: **`38.7578°E, 9.0222°N`**.
   - Set default zoom level to **`6`**, providing immediate regional coverage of Ethiopia and neighboring border zones.
2. **Operational Bounding Box**:
   - Define theater operational limits:
     - **Southwest Corner**: `32.9°E, 3.3°N` (South Sudan / Kenya / Ethiopia tri-border region)
     - **Northeast Corner**: `48.0°E, 15.0°N` (Red Sea coast, Eritrea, Djibouti, Gulf of Aden, Somalia)
3. **Metric Unit System**:
   - Set default speed display units to **`km/h`** in `.env` and application configuration (`TAK_SPEED_UNIT=km/h`).
4. **Tactical Organizational Groups**:
   - Pre-populate database organizational groups for mission command:
     - `National Defense / Ground Forces`
     - `Air & Reconnaissance Wing`
     - `Federal Police & Border Security`
     - `Interagency Crisis Response`

---

## Consequences

### Positive
- Browser and ATAK operators are immediately positioned over the operational theater upon login without manual panning or zooming from North America.
- Metric telemetry aligns with standard Ethiopian military and aviation operating procedures.
- Pre-populated tactical groups accelerate unit onboarding and role-based access control.

### Negative / Neutral
- Operations outside East Africa require updating coordinates in configuration or environment variables.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/offline-operation/spec.md`:
    - Requirement: `Self-hosted basemap and geospatial tiles`
    - Scenario: `Bounding box coverage for Horn of Africa`
- **Tasks**: Task 4.2 in `tasks.md`.

---

## Verification Evidence

1. **API Configuration Endpoint Verification**: Issued an authenticated request `GET http://127.0.0.1:5000/api/config` using a valid JWT token signed with `SigningSecret`.
2. **Response Inspection**:
   ```json
   {
     "version": "13.102.4",
     "center": [38.7578, 9.0222],
     "zoom": 6,
     "speed_unit": "km/h",
     "groups": [
       "National Defense / Ground Forces",
       "Air & Reconnaissance Wing",
       "Federal Police & Border Security",
       "Interagency Crisis Response"
     ]
   }
   ```
3. **Database Verification**: Verified in PostgreSQL `groups` and `server_config` tables that these baseline records are persisted and returned to connected tactical clients.
