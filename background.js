chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_SUBMISSION') {
    saveSubmission(message.platform, message.submission)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open for async
  }
});

async function saveSubmission(platform, submission) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('cvSubmissions', (data) => {
      const submissions = data.cvSubmissions || {};
      if (!submissions[platform]) submissions[platform] = [];

      // Deduplicate by id
      const exists = submissions[platform].findIndex(s => s.id === submission.id);
      if (exists !== -1) {
        // Update existing
        submissions[platform][exists] = submission;
      } else {
        // Prepend newest first, keep max 50 per platform
        submissions[platform].unshift(submission);
        if (submissions[platform].length > 50) {
          submissions[platform] = submissions[platform].slice(0, 50);
        }
      }

      chrome.storage.local.set({ cvSubmissions: submissions }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  });
}
