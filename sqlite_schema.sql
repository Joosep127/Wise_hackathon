-- Schema for the SQLite version of connections.php and database.php.
-- database.php's initializeDatabase() creates the same table.
CREATE TABLE IF NOT EXISTS policy_versions (
    public_code TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    title TEXT NOT NULL,
    base_mode TEXT NOT NULL CHECK (base_mode IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D')),
    restrictions_json TEXT NOT NULL,
    PRIMARY KEY (public_code, version)
);
