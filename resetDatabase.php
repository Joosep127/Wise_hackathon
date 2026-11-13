<?php

require_once __DIR__ . '/connection.php';

function resetDatabase(): void
{
    $pdo = getConnection();

    $sql = file_get_contents(__DIR__ . '/schema.sql');

    $pdo->exec($sql);
}

resetDatabase();
