-- ==============================================================================
-- TAK Server Database Initialization Script
-- ==============================================================================

\connect takserver

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure user tak has all necessary privileges on public schema
GRANT ALL ON SCHEMA public TO tak;
