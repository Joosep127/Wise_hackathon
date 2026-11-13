<?php

declare(strict_types=1);

require_once __DIR__ . '/connections.php';

/**
 * SQLite example. Call initializeDatabase() during setup before queries.
 * Callers are responsible for authentication and authorisation.
 */

/** Create the table if it does not yet exist. Does not migrate old tables. */
function initializeDatabase(PDO $pdo): void
{
    $sql = 'CREATE TABLE IF NOT EXISTS policy_versions (
        public_code TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1),
        title TEXT NOT NULL,
        base_mode TEXT NOT NULL CHECK (base_mode IN (\'A0\', \'A1\', \'A2\', \'A3\', \'A4\')),
        restrictions_json TEXT NOT NULL,
        PRIMARY KEY (public_code, version)
    )';
    $pdo->exec($sql);
}

/**
 * Save a new policy version. Existing versions are not updated.
 *
 * @param string[] $restrictions
 */
function savePolicyVersion(
    PDO $pdo,
    string $publicCode,
    int $version,
    string $title,
    string $baseMode,
    array $restrictions
): void {
    if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/D', $publicCode)) {
        throw new InvalidArgumentException('Invalid policy code.');
    }
    if ($version < 1 || trim($title) === '') {
        throw new InvalidArgumentException('A positive version and a title are required.');
    }
    if (!in_array($baseMode, ['A0', 'A1', 'A2', 'A3', 'A4'], true)) {
        throw new InvalidArgumentException('Invalid TAAS level.');
    }
    foreach ($restrictions as $restriction) {
        if (!is_string($restriction) || trim($restriction) === '') {
            throw new InvalidArgumentException('Each restriction must be a non-empty string.');
        }
    }

    $sql = 'INSERT INTO policy_versions
        (public_code, version, title, base_mode, restrictions_json)
        VALUES (:code, :version, :title, :mode, :restrictions)';

    $statement = $pdo->prepare($sql);
    $statement->execute([
        'code' => $publicCode,
        'version' => $version,
        'title' => trim($title),
        'mode' => $baseMode,
        'restrictions' => json_encode(array_values($restrictions), JSON_THROW_ON_ERROR),
    ]);
}

/** Return one stored version, or null when the code/version is not found. */
function getPolicyVersion(PDO $pdo, string $publicCode, int $version): ?array
{
    $sql = 'SELECT public_code, version, title, base_mode, restrictions_json
        FROM policy_versions
        WHERE public_code = :code AND version = :version';

    $statement = $pdo->prepare($sql);
    $statement->execute(['code' => $publicCode, 'version' => $version]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        return null;
    }

    $row['version'] = (int) $row['version'];
    $row['restrictions'] = json_decode($row['restrictions_json'], true, 512, JSON_THROW_ON_ERROR);
    unset($row['restrictions_json']);

    return $row;
}
