<?php
// repository.php - data layer: default restriction classes, policy storage, history cookie, rendering helper.

const POLICY_DIR     = __DIR__ . '/data';
const HISTORY_COOKIE = 'policy_history';
const MAX_RULES      = 30;
const MAX_RULE_LEN   = 500;
const MAX_NAME_LEN   = 80;
const MAX_HISTORY    = 20;

/** The four ranks. The letter is the first character of each class code. */
function Get_rank_groups(): array
{
    return [
        'A' => [
            'title'   => 'Agents',
            'summary' => 'AI that plans and acts on your behalf: coding agents, browsing agents and other multi-step autonomous tools.',
        ],
        'B' => [
            'title'   => 'Online LLM usage',
            'summary' => 'Conversational use of online LLMs. You prompt, it responds. No autonomous action.',
        ],
        'C' => [
            'title'   => 'Understanding & thinking',
            'summary' => 'AI as an aid for comprehension and reasoning, never as the author of the work.',
        ],
        'D' => [
            'title'   => 'Discouraged',
            'summary' => 'Complete discouragement. No use of AI of any kind.',
        ],
    ];
}

/**
 * Default restriction classes: A1, A2, B1, B2, C1, C2, D.
 * Tier 1 = no further condition. Tier 2 = you must understand what is going on.
 * D has no tiers. Every entry has: group (rank letter), tier (1, 2 or null), name, description, prompt.
 */
function Get_defaults(): array
{
    return [
        'a1' => [
            'group' => 'A',
            'tier'  => 1,
            'name'  => 'A1 – Full Agentic Use',
            'description' => 'Full usage allowed. AI agents may plan, act and deliver the work end to end, with no limit on autonomy, tools or the amount of AI-generated output. No further conditions apply.',
            'prompt' => 'AI usage class A1 (agents, full usage). You may operate as an autonomous agent and complete the task end to end: plan, use tools, write and run code, and produce the final deliverables. There are no restrictions on autonomy or on the amount of AI-generated work.',
        ],
        'a2' => [
            'group' => 'A',
            'tier'  => 2,
            'name'  => 'A2 – Agentic Use, Understood',
            'description' => 'Agents are allowed, but you have to understand what is going on. You must be able to explain what the agent did, why it did it and how the result works, and you remain fully accountable for the final output.',
            'prompt' => 'AI usage class A2 (agents, understanding required). You may operate as an autonomous agent, but the user must understand everything you do. Explain your plan before acting, summarise each significant action, explain the reasoning behind non-obvious decisions, and make sure the user could reproduce and defend the result without you.',
        ],
        'a3' => [
            'group' => 'A',
            'tier'  => 3,
            'name'  => 'A3 – Agentic Use, Understood',
            'description' => 'DOCUMENT EVERYTHING',
            'prompt' => 'AI usage class A2 (agents, understanding required). You may operate as an autonomous agent, but the user must understand everything you do. Explain your plan before acting, summarise each significant action, explain the reasoning behind non-obvious decisions, and make sure the user could reproduce and defend the result without you.',
        ],
        'b1' => [
            'group' => 'B',
            'tier'  => 1,
            'name'  => 'B1 – Full LLM Use',
            'description' => 'Online LLMs such as chat assistants may be used freely to generate text, code, analysis and ideas. Autonomous agents are not allowed: the AI responds to your prompts, and you carry the results into the work yourself.',
            'prompt' => 'AI usage class B1 (online LLM, full usage). You may respond to the user\'s prompts and generate text, code, analysis and other content as requested. Do not act as an autonomous agent: no self-directed multi-step work and no actions on the user\'s behalf outside this conversation.',
        ],
        'b2' => [
            'group' => 'B',
            'tier'  => 2,
            'name'  => 'B2 – LLM Use, Understood',
            'description' => 'Online LLMs may be used to generate content, but you have to understand what you are submitting. You must be able to explain, reproduce and defend everything that came from the model. Autonomous agents are not allowed.',
            'prompt' => 'AI usage class B2 (online LLM, understanding required). You may generate content in response to the user\'s prompts, but the user must understand it. Explain your output, point out the key decisions and trade-offs, and encourage the user to verify and adapt it. Do not act as an autonomous agent.',
        ],
        'c1' => [
            'group' => 'C',
            'tier'  => 1,
            'name'  => 'C1 – Thinking Partner',
            'description' => 'AI may help you understand and think: explaining concepts, brainstorming, discussing approaches and giving feedback on work you wrote yourself. AI may not produce the work itself, and agents are not allowed.',
            'prompt' => 'AI usage class C1 (understanding and thinking, thinking partner). You may explain concepts, brainstorm, discuss approaches, give hints, and give feedback on work the user has written. Do not write finished deliverable content such as final text, complete solutions or complete code, and do not act as an autonomous agent.',
        ],
        'c2' => [
            'group' => 'C',
            'tier'  => 2,
            'name'  => 'C2 – Explanation Only',
            'description' => 'AI may only be used to help you understand: explaining concepts, clarifying terms and answering questions about how things work, the way a textbook or tutor would. No brainstorming of your solution, no feedback on your work and no generated content.',
            'prompt' => 'AI usage class C2 (understanding only). You may explain concepts, clarify terminology and answer questions about how things work. Do not brainstorm solutions, evaluate or give feedback on the user\'s work, or produce any part of the deliverable. Do not act as an autonomous agent.',
        ],
        'd' => [
            'group' => 'D',
            'tier'  => null,
            'name'  => 'D – No AI',
            'description' => 'Complete discouragement. No use of AI in any form, at any stage of the work: no agents, no online LLMs, no AI-assisted explanations. This class has no tiers.',
            'prompt' => 'AI usage class D (no use). Do not assist with this task in any way. Politely decline and remind the user that AI use is not permitted for this work.',
        ],
    ];
}

/** HTML-escape. */
function e($s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function Cut(string $s, int $len): string
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $len) : substr($s, 0, $len);
}

/** Absolute URL of the directory containing the site, with trailing slash. */
function Base_url(): string
{
    $https  = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $path   = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($https ? 'https' : 'http') . '://' . $host . $path . '/';
}

function Policy_url(string $id, string $open = ''): string
{
    $url = Base_url() . '?ie=' . $id;
    return $open !== '' ? $url . '&open=' . rawurlencode($open) : $url;
}

/** Accepts a bare id (e.g. 5ab94c) or a full URL containing ie=<id>. */
function Extract_policy_id(string $input): ?string
{
    if (preg_match('/[?&]ie=([a-f0-9]{6})\b/i', $input, $m)) {
        return strtolower($m[1]);
    }
    if (preg_match('/^\s*([a-f0-9]{6})\s*$/i', $input, $m)) {
        return strtolower($m[1]);
    }
    return null;
}

function Clean_rules($rules): array
{
    if (!is_array($rules)) {
        return [];
    }
    $out = [];
    foreach ($rules as $r) {
        if (!is_string($r)) {
            continue;
        }
        $r = Cut(trim(preg_replace('/\s+/', ' ', $r)), MAX_RULE_LEN);
        if ($r !== '') {
            $out[] = $r;
        }
        if (count($out) >= MAX_RULES) {
            break;
        }
    }
    return $out;
}

function Ensure_dir(): bool
{
    if (!is_dir(POLICY_DIR)) {
        if (!@mkdir(POLICY_DIR, 0755, true)) {
            return false;
        }
        @file_put_contents(POLICY_DIR . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    return is_writable(POLICY_DIR);
}

/** Saves a policy and returns its 6-char id, or null on failure. */
function Save_policy(string $name, string $class, array $rules): ?string
{
    if (!Ensure_dir()) {
        return null;
    }
    $data = json_encode([
        'name'    => Cut(trim($name), MAX_NAME_LEN),
        'class'   => $class,
        'rules'   => array_values($rules),
        'created' => time(),
    ], JSON_UNESCAPED_UNICODE);

    for ($i = 0; $i < 20; $i++) {
        $id = bin2hex(random_bytes(3));
        $fh = @fopen(POLICY_DIR . "/$id.json", 'x'); // 'x' fails if the file already exists
        if ($fh) {
            fwrite($fh, $data);
            fclose($fh);
            return $id;
        }
    }
    return null;
}

function Load_policy(string $id): ?array
{
    if (!preg_match('/^[a-f0-9]{6}$/', $id)) {
        return null;
    }
    $path = POLICY_DIR . "/$id.json";
    if (!is_file($path)) {
        return null;
    }
    $p = json_decode((string)file_get_contents($path), true);
    if (!is_array($p) || !isset($p['name'], $p['class'], $p['rules']) || !is_array($p['rules'])) {
        return null;
    }
    $p['id'] = $id;
    return $p;
}

/** Full prompt = class prompt + additional restrictions. */
function Build_prompt(string $classKey, array $rules): string
{
    $defaults = Get_defaults();
    $prompt   = $defaults[$classKey]['prompt'] ?? '';
    if ($rules) {
        $prompt .= "\n\nAdditional restrictions:";
        foreach ($rules as $i => $r) {
            $prompt .= "\n" . ($i + 1) . '. ' . $r;
        }
    }
    return $prompt;
}

/** Previously created policies, newest first (stored in a cookie). */
function Get_history(): array
{
    $raw = $_COOKIE[HISTORY_COOKIE] ?? '';
    $arr = json_decode($raw, true);
    if (!is_array($arr)) {
        return [];
    }
    $out = [];
    foreach ($arr as $item) {
        if (is_array($item) && isset($item['id'], $item['name'])
            && preg_match('/^[a-f0-9]{6}$/', (string)$item['id'])) {
            $out[] = ['id' => $item['id'], 'name' => Cut((string)$item['name'], MAX_NAME_LEN)];
        }
    }
    return $out;
}

function Add_to_history(string $id, string $name): void
{
    $hist = array_filter(Get_history(), fn($h) => $h['id'] !== $id);
    array_unshift($hist, ['id' => $id, 'name' => Cut($name, MAX_NAME_LEN)]);
    $hist = array_slice($hist, 0, MAX_HISTORY);
    setcookie(HISTORY_COOKIE, json_encode($hist, JSON_UNESCAPED_UNICODE), [
        'expires'  => time() + 60 * 60 * 24 * 365,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Renders one clickable box. All modal data lives in data-* attributes. */
function Render_box(string $key, string $title, string $desc, string $prompt, string $url): void
{
    ?>
    <article class="box" tabindex="0"
             data-key="<?= e($key) ?>"
             data-title="<?= e($title) ?>"
             data-desc="<?= e($desc) ?>"
             data-prompt="<?= e($prompt) ?>"
             data-url="<?= e($url) ?>">
        <button type="button" class="copy-btn" data-copy="<?= e($prompt) ?>" aria-label="Copy prompt for <?= e($title) ?>">Copy</button>
        <h3><?= e($title) ?></h3>
        <p><?= e($desc) ?></p>
    </article>
    <?php
}
