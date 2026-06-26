-- Runs once on first container init. pgvector ships in the pgvector/pgvector
-- image; this just enables it for the maven_ai database.
CREATE EXTENSION IF NOT EXISTS vector;
