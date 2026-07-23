//Constants
const PLATFORMS = {
  leetcode:   { name: 'LeetCode',   emoji: '🟡', color: '#ffa116' },
  codeforces: { name: 'Codeforces', emoji: '🔵', color: '#1f8dd6' },
  hackerrank: { name: 'HackerRank', emoji: '🟢', color: '#00ea64' },
  atcoder:    { name: 'AtCoder',    emoji: '⚪', color: '#888' },
};

//State 
let submissions = {};   // { platform: [{ id, title, lang, code, date, url }] }
let selected = new Set(); // "platform::id"
let config = null;

//Init
document.addEventListener('DOMContentLoaded', async () => {
  config = await getConfig();
  submissions = await getSubmissions();

  if (!config?.token) {
    showView('setupView');
  } else {
    showView('mainView');
    renderStatus();
    renderPlatforms();
  }
  bindEvents();
});

//Storage helpers
function getConfig() {
  return new Promise(res => chrome.storage.local.get('cvConfig', d => res(d.cvConfig || null)));
}
function saveConfig(c) {
  return new Promise(res => chrome.storage.local.set({ cvConfig: c }, res));
}
function getSubmissions() {
  return new Promise(res => chrome.storage.local.get('cvSubmissions', d => res(d.cvSubmissions || {})));
}
function saveSubmissions(s) {
  return new Promise(res => chrome.storage.local.set({ cvSubmissions: s }, res));
}

//Views 
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

//Render 
function renderStatus() {
  if (!config) return;
  const dot = document.getElementById('ghDot');
  dot.className = 'gh-dot';
  document.getElementById('ghUserDisplay').textContent = config.username || '—';
  document.getElementById('ghRepoDisplay').textContent =
    config.username && config.repo ? `${config.username}/${config.repo}` : 'Not configured';
}

function renderPlatforms() {
  const container = document.getElementById('platformList');
  container.innerHTML = '';

  for (const [platform, meta] of Object.entries(PLATFORMS)) {
    const items = submissions[platform] || [];
    const card = document.createElement('div');
    card.className = 'platform-card';
    card.dataset.platform = platform;

    card.innerHTML = `
      <div class="platform-header">
        <span class="platform-emoji">${meta.emoji}</span>
        <span class="platform-name">${meta.name}</span>
        <span class="platform-count">${items.length} saved</span>
        <span class="platform-arrow">▶</span>
      </div>
      <div class="platform-body">
        ${items.length === 0
          ? `<div class="empty-state">No submissions saved yet.<br>Visit ${meta.name} to capture solutions.</div>`
          : items.map(s => renderSubmissionItem(platform, s)).join('')
        }
      </div>
    `;

    // Toggle accordion
    card.querySelector('.platform-header').addEventListener('click', () => {
      card.classList.toggle('open');
    });

    container.appendChild(card);
  }

  // Bind checkboxes and delete buttons
  container.querySelectorAll('.submission-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.sub-delete')) return;
      const key = item.dataset.key;
      if (selected.has(key)) {
        selected.delete(key);
        item.classList.remove('selected');
      } else {
        selected.add(key);
        item.classList.add('selected');
      }
      updateActionBar();
    });
    item.querySelector('.sub-delete')?.addEventListener('click', e => {
      e.stopPropagation();
      deleteSingleSubmission(item.dataset.platform, item.dataset.id);
    });
  });

  updateActionBar();
}

function renderSubmissionItem(platform, s) {
  const key = `${platform}::${s.id}`;
  const isSelected = selected.has(key);
  const langClass = langToClass(s.lang);
  return `
    <div class="submission-item ${isSelected ? 'selected' : ''}"
         data-key="${key}" data-platform="${platform}" data-id="${s.id}">
      <div class="sub-checkbox">
        <span class="sub-check-icon">✓</span>
      </div>
      <div class="sub-info">
        <div class="sub-name">${escHtml(s.title)}</div>
        <div class="sub-meta">${formatDate(s.date)}</div>
      </div>
      <span class="sub-lang ${langClass}">${escHtml(s.lang)}</span>
      <button class="sub-delete" title="Remove from saved">✕</button>
    </div>
  `;
}

function updateActionBar() {
  const pushBtn = document.getElementById('pushBtn');
  const deleteSelBtn = document.getElementById('deleteSelBtn');
  const count = selected.size;
  const pushText = document.getElementById('pushBtnText');

  pushBtn.disabled = count === 0;
  pushText.textContent = count > 0 ? `Push ${count} Solution${count > 1 ? 's' : ''}` : 'Push to GitHub';
  deleteSelBtn.style.opacity = count > 0 ? '1' : '0.4';
  deleteSelBtn.style.pointerEvents = count > 0 ? 'auto' : 'none';
}

// Events 
function bindEvents() {
  // Settings toggle
  document.getElementById('settingsBtn').addEventListener('click', () => {
    const setupView = document.getElementById('setupView');
    const mainView = document.getElementById('mainView');
    if (setupView.classList.contains('active')) {
      if (config?.token) showView('mainView');
    } else {
      // Prefill
      if (config) {
        document.getElementById('ghToken').value = config.token || '';
        document.getElementById('ghUsername').value = config.username || '';
        document.getElementById('ghRepo').value = config.repo || '';
        document.getElementById('ghBranch').value = config.branch || 'main';
      }
      showView('setupView');
    }
  });

  document.getElementById('editGhBtn').addEventListener('click', () => {
    if (config) {
      document.getElementById('ghToken').value = config.token || '';
      document.getElementById('ghUsername').value = config.username || '';
      document.getElementById('ghRepo').value = config.repo || '';
      document.getElementById('ghBranch').value = config.branch || 'main';
    }
    showView('setupView');
  });

  // Save settings
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const token = document.getElementById('ghToken').value.trim();
    const username = document.getElementById('ghUsername').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';

    if (!token || !username || !repo) {
      showToast('Fill in all required fields', 'error');
      return;
    }

    // Verify token
    showToast('Verifying token...', 'info');
    const ok = await verifyGitHub(token, username);
    if (!ok) {
      showToast('Invalid token or username', 'error');
      return;
    }

    config = { token, username, repo, branch };
    await saveConfig(config);
    showView('mainView');
    renderStatus();
    renderPlatforms();
    showToast('GitHub connected! ✓', 'success');
  });

  // Push button
  document.getElementById('pushBtn').addEventListener('click', () => {
    if (selected.size === 0) return;
    document.getElementById('timeComp').value = '';
    document.getElementById('spaceComp').value = '';
    document.getElementById('commitNote').value = '';
    document.getElementById('complexityModal').classList.add('show');
  });

  // Modal cancel
  document.getElementById('modalCancel').addEventListener('click', () => {
    document.getElementById('complexityModal').classList.remove('show');
  });

  // Modal confirm → push
document.getElementById('modalConfirm').addEventListener('click', async () => {
    console.log("Modal confirm clicked");

    document.getElementById('complexityModal').classList.remove('show');

    const timeComp = document.getElementById('timeComp').value.trim() || 'O(??)';
    const spaceComp = document.getElementById('spaceComp').value.trim() || 'O(??)';
    const note = document.getElementById('commitNote').value.trim();

    console.log(timeComp, spaceComp, note);

    await pushSelected(timeComp, spaceComp, note);

    console.log("pushSelected finished");
});

  // Delete selected
  document.getElementById('deleteSelBtn').addEventListener('click', async () => {
    if (selected.size === 0) return;
    await deleteSelected();
  });
}

// Delete 
async function deleteSingleSubmission(platform, id) {
  if (!submissions[platform]) return;
  submissions[platform] = submissions[platform].filter(
  s => String(s.id) !== String(id)
);
  selected.delete(`${platform}::${id}`);
  await saveSubmissions(submissions);
  renderPlatforms();
  showToast('Submission removed', 'info');
}

async function deleteSelected() {
  for (const key of selected) {
    const [platform, id] = key.split('::');
    if (submissions[platform]) {
      submissions[platform] = submissions[platform].filter(
  s => String(s.id) !== String(id)
);
    }
  }
  const count = selected.size;
  selected.clear();
  await saveSubmissions(submissions);
  renderPlatforms();
  showToast(`Deleted ${count} submission${count > 1 ? 's' : ''}`, 'info');
}

//Push to GitHub
async function pushSelected(timeComp, spaceComp, note) {
  const pushBtn = document.getElementById('pushBtn');
  const pushText = document.getElementById('pushBtnText');
  pushBtn.disabled = true;
  pushBtn.innerHTML = `<div class="spinner"></div> Pushing...`;
 
  let pushed = 0;
  let failed = 0;

  for (const key of selected) {
    const [platform, id] = key.split('::');
    const sub = (submissions[platform] || []).find(
    s => String(s.id) === String(id)
);
    if (!sub) continue;
console.log("Pushing submission:", sub);
    const ext = langToExt(sub.lang);
    const fileName = sanitizeFilename(sub.title);
    const filePath = `${platform}/${fileName}.${ext}`;
    const commitMsg = buildCommitMessage(sub, platform, timeComp, spaceComp, note);
    const content = buildFileContent(sub, platform, timeComp, spaceComp, note);

    try {
      await pushFileToGitHub(filePath, content, commitMsg);
      pushed++;
    } catch (e) {
      console.error('Push failed', e);
      failed++;
    }
  }

  pushBtn.innerHTML = `<span id="pushBtnText">Push to GitHub</span>`;
  pushBtn.disabled = false;

  if (pushed > 0) {
    showToast(`✓ Pushed ${pushed} file${pushed > 1 ? 's' : ''} to GitHub!`, 'success');
    selected.clear();
    renderPlatforms();
  }
  if (failed > 0) {
    showToast(`${failed} push(es) failed. Check token/repo.`, 'error');
  }
}

async function pushFileToGitHub(path, content, message) {
  const { token, username, repo, branch } = config;
  const base64Content = btoa(unescape(encodeURIComponent(content)));
  const url = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;

  // Check if file exists (to get SHA for update)
  let sha = null;
  try {
    const getRes = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      }
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (_) {}

  const body = {
    message,
    content: base64Content,
    branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
console.log(text);
throw new Error(text);
    throw new Error(err.message || 'GitHub API error');
  }
  return res.json();
}

// GitHub Verify 
async function verifyGitHub(token, username) {
  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `token ${token}` }
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// Helpers
function buildCommitMessage(sub, platform, timeComp, spaceComp, note) {
  const parts = [
    `[${PLATFORMS[platform]?.name || platform}] ${sub.title}`,
    `Time: ${timeComp} | Space: ${spaceComp}`,
    `Lang: ${sub.lang}`,
  ];
  if (note) parts.push(`Note: ${note}`);
  return parts.join(' · ');
}

function buildFileContent(sub, platform, timeComp, spaceComp, note) {
  const commentChar = langToCommentChar(sub.lang);
  const separator = `${commentChar} ${'─'.repeat(60)}`;
  const lines = [
    separator,
    `${commentChar} Problem : ${sub.title}`,
    `${commentChar} Platform: ${PLATFORMS[platform]?.name || platform}`,
    `${commentChar} URL     : ${sub.url || 'N/A'}`,
    `${commentChar} Language: ${sub.lang}`,
    `${commentChar} Date    : ${new Date(sub.date).toLocaleString()}`,
    separator,
    `${commentChar} Time Complexity : ${timeComp}`,
    `${commentChar} Space Complexity: ${spaceComp}`,
    note ? `${commentChar} Notes           : ${note}` : null,
    separator,
    '',
    sub.code,
  ].filter(l => l !== null);
  return lines.join('\n');
}

function langToExt(lang) {
  const map = {
    python: 'py', python3: 'py',
    cpp: 'cpp', 'c++': 'cpp',
    java: 'java',
    javascript: 'js', js: 'js',
    typescript: 'ts',
    go: 'go', golang: 'go',
    rust: 'rs',
    c: 'c',
    csharp: 'cs', 'c#': 'cs',
    kotlin: 'kt',
    swift: 'swift',
    ruby: 'rb',
    scala: 'scala',
    php: 'php',
  };
  return map[lang?.toLowerCase()] || 'txt';
}

function langToCommentChar(lang) {
  const hash = ['python', 'python3', 'ruby', 'bash'];
  if (hash.includes(lang?.toLowerCase())) return '#';
  return '//';
}

function langToClass(lang) {
  const l = lang?.toLowerCase();
  if (l === 'python' || l === 'python3') return 'lang-python';
  if (l === 'cpp' || l === 'c++') return 'lang-cpp';
  if (l === 'java') return 'lang-java';
  if (l === 'javascript' || l === 'js') return 'lang-js';
  if (l === 'go' || l === 'golang') return 'lang-go';
  if (l === 'rust') return 'lang-rust';
  return 'lang-js';
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9\-_]/gi, '_').replace(/__+/g, '_').slice(0, 80);
}

function formatDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) { return ''; }
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Toast 
let toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}
