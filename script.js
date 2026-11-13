(function () {
    'use strict';

    /* ---------- Clipboard ---------- */
    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy') ? resolve() : reject();
            } catch (err) {
                reject(err);
            } finally {
                document.body.removeChild(ta);
            }
        });
    }

    function flash(btn, okLabel) {
        var original = btn.textContent;
        btn.textContent = okLabel || 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('copied');
        }, 1500);
    }

    function copyWithFeedback(btn, text) {
        copyText(text).then(function () { flash(btn); }, function () { flash(btn, 'Failed'); });
    }

    /* ---------- Modals ---------- */
    var detail = document.getElementById('detail-modal');
    var lastFocus = null;

    function openModal(modal) {
        if (!modal) return;
        lastFocus = document.activeElement;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        var close = modal.querySelector('[data-close]');
        if (close) close.focus();
    }

    function closeModals() {
        document.querySelectorAll('.modal-backdrop').forEach(function (m) { m.hidden = true; });
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function openBox(box) {
        if (!detail) return;
        document.getElementById('modal-title').textContent = box.dataset.title;
        document.getElementById('modal-desc').textContent = box.dataset.desc;
        document.getElementById('modal-prompt').textContent = box.dataset.prompt;
        document.getElementById('modal-url').value = box.dataset.url;
        openModal(detail);
    }

    document.addEventListener('click', function (ev) {
        var t = ev.target;

        // Copy button on a box (must not open the modal)
        var copyBtn = t.closest('.copy-btn');
        if (copyBtn) {
            ev.stopPropagation();
            copyWithFeedback(copyBtn, copyBtn.dataset.copy);
            return;
        }

        // Open generic modal (e.g. history)
        var opener = t.closest('[data-open-modal]');
        if (opener) {
            openModal(document.getElementById(opener.dataset.openModal));
            return;
        }

        // Close button or click on backdrop
        if (t.closest('[data-close]') || t.classList.contains('modal-backdrop')) {
            closeModals();
            return;
        }

        // Open box detail
        var box = t.closest('.box');
        if (box) openBox(box);
    });

    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') {
            closeModals();
        } else if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('box')) {
            ev.preventDefault();
            openBox(ev.target);
        }
    });

    // Modal copy buttons
    var copyPrompt = document.getElementById('copy-prompt');
    if (copyPrompt) {
        copyPrompt.addEventListener('click', function () {
            copyWithFeedback(copyPrompt, document.getElementById('modal-prompt').textContent);
        });
    }
    var copyUrl = document.getElementById('copy-url');
    if (copyUrl) {
        copyUrl.addEventListener('click', function () {
            copyWithFeedback(copyUrl, document.getElementById('modal-url').value);
        });
    }
    var urlInput = document.getElementById('modal-url');
    if (urlInput) urlInput.addEventListener('focus', function () { urlInput.select(); });

    // Auto-open a box from ?open=<key> (used by shared links)
    var openKey = new URLSearchParams(window.location.search).get('open');
    if (openKey) {
        var boxes = document.querySelectorAll('.box');
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].dataset.key === openKey) {
                openBox(boxes[i]);
                break;
            }
        }
    }

    /* ---------- Create page: restriction list ---------- */
    var ruleInput = document.getElementById('rule-input');
    var addBtn = document.getElementById('add-rule');
    var list = document.getElementById('rule-list');

    if (ruleInput && addBtn && list) {
        var max = parseInt(list.dataset.max, 10) || 30;

        function addRule() {
            var text = ruleInput.value.trim();
            if (!text || list.children.length >= max) return;

            var li = document.createElement('li');

            var hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = 'rules[]';
            hidden.value = text;

            var span = document.createElement('span');
            span.textContent = text;

            var remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'remove-rule';
            remove.setAttribute('aria-label', 'Remove restriction');
            remove.innerHTML = '&times;';

            li.appendChild(hidden);
            li.appendChild(span);
            li.appendChild(remove);
            list.appendChild(li);

            ruleInput.value = '';
            ruleInput.focus();
        }

        addBtn.addEventListener('click', addRule);

        ruleInput.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                addRule();
            }
        });

        list.addEventListener('click', function (ev) {
            var rm = ev.target.closest('.remove-rule');
            if (rm) rm.parentNode.remove();
        });

        // Don't lose a restriction that was typed but not yet added
        document.getElementById('policy-form').addEventListener('submit', addRule);
    }
})();
