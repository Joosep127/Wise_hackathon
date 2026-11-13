<?php
require_once "repository.php";

$defaults = Get_defaults();
$errors   = [];
$name     = '';
$class    = '';
$rules    = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name  = Cut(trim((string)($_POST['name'] ?? '')), MAX_NAME_LEN);
    $class = (string)($_POST['class'] ?? '');
    $rules = Clean_rules($_POST['rules'] ?? []);

    if ($name === '') {
        $errors[] = 'Please give your policy a name.';
    }
    if (!isset($defaults[$class])) {
        $errors[] = 'Please choose a restriction class.';
    }

    if (!$errors) {
        $id = Save_policy($name, $class, $rules);
        if ($id) {
            Add_to_history($id, $name);
            header('Location: index.php?ie=' . $id . '&open=policy&created=1');
            exit;
        }
        $errors[] = 'Could not save the policy. Check that the data/ folder is writable.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create policy – AI Restriction Classes</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<header class="site-header">
    <h1>Create policy</h1>
    <nav><a class="btn" href="index.php">&larr; Back</a></nav>
</header>

<main>
    <section class="panel">
        <?php foreach ($errors as $err): ?>
            <p class="notice error"><?= e($err) ?></p>
        <?php endforeach; ?>

        <form method="post" action="create.php" id="policy-form">
            <label for="name">Name</label>
            <input type="text" id="name" name="name" maxlength="<?= MAX_NAME_LEN ?>" value="<?= e($name) ?>" placeholder="e.g. Intro to Python – Homework" required>

            <label for="class">Restriction class</label>
            <select id="class" name="class" required>
                <option value="" disabled <?= $class === '' ? 'selected' : '' ?>>Choose a class…</option>
                <?php foreach (Get_rank_groups() as $letter => $g): ?>
                    <optgroup label="<?= e('Rank ' . $letter . ' – ' . $g['title']) ?>">
                        <?php foreach ($defaults as $key => $d): ?>
                            <?php if ($d['group'] !== $letter) continue; ?>
                            <option value="<?= e($key) ?>" <?= $class === $key ? 'selected' : '' ?>><?= e($d['name']) ?></option>
                        <?php endforeach; ?>
                    </optgroup>
                <?php endforeach; ?>
            </select>

            <label for="rule-input">Additional restrictions</label>
            <div class="inline-form">
                <input type="text" id="rule-input" maxlength="<?= MAX_RULE_LEN ?>" placeholder="e.g. Do not use AI to write code comments">
                <button type="button" class="btn" id="add-rule">Add restriction</button>
            </div>

            <ol id="rule-list" class="rule-list" data-max="<?= MAX_RULES ?>">
                <?php foreach ($rules as $r): ?>
                    <li>
                        <input type="hidden" name="rules[]" value="<?= e($r) ?>">
                        <span><?= e($r) ?></span>
                        <button type="button" class="remove-rule" aria-label="Remove restriction">&times;</button>
                    </li>
                <?php endforeach; ?>
            </ol>

            <button type="submit" class="btn btn-primary btn-wide">Create policy</button>
        </form>
    </section>
</main>

<script src="script.js"></script>
</body>
</html>
