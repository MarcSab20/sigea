-- Initialisation PostgreSQL SIGEA
-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Variables de session pour RLS (valeurs par défaut inoffensives)
ALTER DATABASE sigea SET app.current_base_id = '';
ALTER DATABASE sigea SET app.current_role    = '';
