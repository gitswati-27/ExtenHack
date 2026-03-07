

(function () {
  'use strict';

  const PLATFORM = 'leetcode';

  interceptFetch();
  interceptXHR();

  function interceptFetch() {
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await origFetch.apply(this, args);
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      if (url.includes('/submissions/detail/') || url.includes('submitSolution') || url.includes('interpret_solution')) {
        try {
          const clone = response.clone();
          const json = await clone.json();
          handleSubmissionResult(json, url);
        } catch (_) {}
      }
      return response;
    };
  }

  function interceptXHR() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._cvUrl = url;
      return origOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', function () {
        if (this._cvUrl && (this._cvUrl.includes('/check/') || this._cvUrl.includes('submission'))) {
          try {
            const json = JSON.parse(this.responseText);
            handleSubmissionResult(json, this._cvUrl);
          } catch (_) {}
        }
      });
      return origSend.apply(this, args);
    };
  }

  function handleSubmissionResult(data, url) {
    if (data.status_msg === 'Accepted' || data.run_success === true && data.status_code === 10) {
      extractAndSave(data);
    }
  }

  function extractAndSave(data) {
    const titleEl = document.querySelector('[data-cy="question-title"]')
      || document.querySelector('.mr-2.text-lg.font-medium')
      || document.querySelector('div[class*="title"]');
    const title = titleEl?.textContent?.trim() || document.title.replace(' - LeetCode', '').trim();

    const code = extractCode();
    const lang = detectLanguage(data);

    const submission = {
      id: String(data.submission_id || data.id || Date.now()),
      title: title || 'Untitled',
      lang: lang,
      code: code,
      date: Date.now(),
      url: window.location.href,
      status: data.status_msg || 'Accepted',
    };

    chrome.runtime.sendMessage({ type: 'SAVE_SUBMISSION', platform: PLATFORM, submission });
  }

  function extractCode() {
    try {
      const monacoEditor = window.monaco?.editor?.getEditors?.()[0];
      if (monacoEditor) return monacoEditor.getValue();
    } catch (_) {}

    const cm = document.querySelector('.CodeMirror');
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    const ta = document.querySelector('textarea.inputarea') || document.querySelector('[class*="editor"] textarea');
    if (ta) return ta.value;

    const lines = document.querySelectorAll('.view-line');
    if (lines.length > 0) {
      return Array.from(lines).map(l => l.textContent).join('\n');
    }

    return '// CodeVault: could not extract code automatically.\n// Please paste your solution here.';
  }

  function detectLanguage(data) {
    if (data.lang) return data.lang;

    const langSelect = document.querySelector('[id*="lang"] select, [class*="lang"] select, button[id*="lang"]');
    if (langSelect) return langSelect.value || langSelect.textContent?.trim();

    return 'unknown';
  }

  const origFetch2 = window.fetch;
  window.fetch = async function (...args) {
    const req = args[0];
    const options = args[1];
    const url = typeof req === 'string' ? req : req?.url || '';

    if (url.includes('graphql') && options?.body) {
      try {
        const body = JSON.parse(options.body);
        if (body.operationName === 'submitSolution' || body.operationName === 'Submit') {
          const response = await origFetch2.apply(this, args);
          const clone = response.clone();
          setTimeout(async () => {
            try {
              const json = await clone.json();
              handleSubmissionResult(json?.data?.submitSolution || json, url);
            } catch (_) {}
          }, 3000); 
          return response;
        }
      } catch (_) {}
    }

    return origFetch2.apply(this, args);
  };
})();
