-- ==============================================================================
-- TISCK: Authentik Dedicated Logical Database & Role Initialization
-- ==============================================================================

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = 'authentik') THEN

      CREATE ROLE authentik WITH LOGIN PASSWORD 'authentik';
   END IF;
END
$do$;

SELECT 'CREATE DATABASE authentik OWNER authentik'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'authentik')\gexec

GRANT ALL PRIVILEGES ON DATABASE authentik TO authentik;
ALTER DATABASE authentik OWNER TO authentik;
