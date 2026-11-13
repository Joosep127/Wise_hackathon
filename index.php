<?php require_once "repository.php"; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI Usage Standard</title>
    <meta name="description" content="A common language for stating how AI may be used in a piece of work: four ranks, two tiers, one clear label.">
    <link rel="stylesheet" href="style.css">
</head>
<body>
<?php
$defaults = Get_defaults();
$groups   = Get_rank_groups();
$history  = Get_history();
$policy   = null;
$error    = '';
$lookup   = isset($_GET['ie']) ? trim((string)$_GET['ie']) : '';

if ($lookup !== '') {
    $id     = Extract_policy_id($lookup);
    $policy = $id ? Load_policy($id) : null;
    if (!$policy) {
        $error = 'No policy found for that link or code.';
    }
}
?>
<header class="site-header">
    <div class="wordmark">AI Usage Standard <span>v1.0</span></div>
    <nav>
        <button type="button" class="btn" data-open-modal="history-modal">History</button>
        <a class="btn btn-primary" href="create.php">Create policy</a>
    </nav>
</header>

<section class="hero">
    <p class="eyebrow">Standard &middot; Version 1.0</p>
    <h1>How may AI be used in this work?</h1>
    <p class="lead">A common language for stating the answer. Four ranks, two tiers and one short label, so everyone involved knows exactly where the line is.</p>
</section>

<main>
    <section class="principles" aria-label="How the standard works">
        <div class="principle">
            <h3>Ranks</h3>
            <ol class="ladder">
                <?php foreach ($groups as $letter => $g): ?>
                    <li><b><?= e($letter) ?></b> <?= e($g['title']) ?></li>
                <?php endforeach; ?>
            </ol>
            <p>From most to least permissive. A rank allows the kinds of use of every rank below it.</p>
        </div>
        <div class="principle">
            <h3>Tiers</h3>
            <p><b>Tier 1</b> adds no further condition.<br><b>Tier 2</b> requires that you understand what is going on and can explain it.<br>Rank D has no tiers.</p>
        </div>
        <div class="principle">
            <h3>Policies</h3>
            <p>A policy is a class plus any additional restrictions, published under a short link. State it like this: <code>AI usage: B2</code>.</p>
        </div>
    </section>

    <section class="panel">
        <h2>Look up a policy</h2>
        <p class="panel-note">Paste a policy link or code to see which class it declares and what extra restrictions it adds.</p>
        <form method="get" action="" class="inline-form">
            <input type="text" name="ie" value="<?= e($lookup) ?>" placeholder="Paste a policy link or code, e.g. 5ab94c" aria-label="Policy link or code" required>
            <button type="submit" class="btn btn-primary">View</button>
        </form>
        <?php if ($error): ?>
            <p class="notice error"><?= e($error) ?></p>
        <?php endif; ?>
        <?php if (!empty($_GET['created']) && $policy): ?>
            <p class="notice success">Policy published. Open the policy box below to copy its share link.</p>
        <?php endif; ?>

        <?php if ($policy):
            $class     = $defaults[$policy['class']] ?? null;
            $className = $class['name'] ?? 'Unknown class';
            $fullPrompt = Build_prompt($policy['class'], $policy['rules']);
            $policyDesc = 'Class: ' . $className
                . ($class ? "\n\n" . $class['description'] : '')
                . (count($policy['rules']) ? "\n\nThis policy adds " . count($policy['rules']) . ' additional restriction(s).' : "\n\nThis policy adds no additional restrictions.");
        ?>
            <h3 class="subhead">Policy: <?= e($policy['name']) ?> <span class="muted">(<?= e($className) ?>)</span></h3>
            <div class="grid">
                <?php Render_box('policy', 'Policy: ' . $policy['name'], $policyDesc, $fullPrompt, Policy_url($policy['id'], 'policy')); ?>
                <?php foreach ($policy['rules'] as $i => $rule): ?>
                    <?php Render_box(
                        'rule-' . ($i + 1),
                        'Additional restriction ' . ($i + 1),
                        $rule,
                        'Additional restriction: ' . $rule,
                        Policy_url($policy['id'], 'rule-' . ($i + 1))
                    ); ?>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </section>

    <section aria-labelledby="classes-title">
        <h2 id="classes-title">The classes</h2>
        <?php foreach ($groups as $letter => $g): ?>
            <div class="rank">
                <div class="rank-head">
                    <span class="rank-letter"><?= e($letter) ?></span>
                    <div>
                        <h3>Rank <?= e($letter) ?> &mdash; <?= e($g['title']) ?></h3>
                        <p><?= e($g['summary']) ?></p>
                    </div>
                </div>
                <div class="grid">
                    <?php foreach ($defaults as $key => $d): ?>
                        <?php if ($d['group'] !== $letter) continue; ?>
                        <?php Render_box($key, $d['name'], $d['description'], $d['prompt'], Base_url() . '?open=' . rawurlencode($key)); ?>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </section>
</main>

<footer class="site-footer">
    AI Usage Standard v1.0 &middot; <a href="create.php">Publish your own policy</a>
</footer>

<!-- Detail modal -->
<div class="modal-backdrop" id="detail-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button type="button" class="modal-close" data-close aria-label="Close">&times;</button>
        <h2 id="modal-title"></h2>
        <p id="modal-desc" class="pre-wrap"></p>
        <h4>Associated prompt</h4>
        <pre id="modal-prompt"></pre>
        <button type="button" class="btn" id="copy-prompt">Copy prompt</button>
        <h4>Link to this policy</h4>
        <div class="url-row">
            <input type="text" id="modal-url" readonly aria-label="Policy link">
            <button type="button" class="btn btn-primary" id="copy-url">Copy link</button>
        </div>
    </div>
</div>

<!-- History modal -->
<div class="modal-backdrop" id="history-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <button type="button" class="modal-close" data-close aria-label="Close">&times;</button>
        <h2 id="history-title">Your policies</h2>
        <?php if ($history): ?>
            <ul class="history-list">
                <?php foreach ($history as $h): ?>
                    <li>
                        <a href="?ie=<?= e($h['id']) ?>"><?= e($h['name']) ?></a>
                        <code><?= e($h['id']) ?></code>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php else: ?>
            <p class="muted">No policies yet. <a href="create.php">Create your first one.</a></p>
        <?php endif; ?>
    </div>
</div>

<script src="script.js"></script>
</body>
</html>
