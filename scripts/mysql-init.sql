-- Mesh Enterprise Platform — MySQL Initialisation Script
-- Enterprise Certification Sprint — CR-2
-- Runs automatically on first docker compose up

-- Ensure the database exists (Docker creates it from MYSQL_DATABASE env var,
-- but this is a safety net for manual installs)
CREATE DATABASE IF NOT EXISTS mesh_enterprise
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Grant all privileges to the application user
GRANT ALL PRIVILEGES ON mesh_enterprise.* TO 'meshapp'@'%';
FLUSH PRIVILEGES;
