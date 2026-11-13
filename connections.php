<?php

declare(strict_types=1);

/**
 * Connect to a SQLite file. Keep this file and the storage directory outside
 * the web server's public document root. Set DB_PATH to an absolute path to
 * use a different database file; otherwise storage/accord.sqlite is used.
 * The PDO SQLite driver must be installed.
 */
function getConnection(): PDO
{
    $configuredPath = getenv('DB_PATH');
    $path = ($configuredPath !== false && $configuredPath !== '')
        ? $configuredPath
        : __DIR__ . '/storage/accord.sqlite';

    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not create the database directory.');
    }

    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');

    return $pdo;
}
