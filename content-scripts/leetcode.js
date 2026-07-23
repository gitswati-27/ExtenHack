(() => {

console.log("✅ Content Script Loaded");
const processedSubmissionIds = new Set();
const script = document.createElement("script");

script.src = chrome.runtime.getURL(
    "content-scripts/inject.js"
);

(document.head || document.documentElement).appendChild(script);

script.onload = () => script.remove();

window.addEventListener("message", event => {

    if (event.source !== window)
        return;

    if (event.data.source !== "CodeVault")
        return;

    if (event.data.type !== "submissionDetails")
        return;

    const body = event.data.request;
    const json = event.data.response;

    const details = json?.data?.submissionDetails;

    if (!details)
        return;

    const accepted =
        details.statusCode === 10 ||
        details.statusCode === 16;

    if (!accepted)
        return;

   const problemSlug = details.question.titleSlug;

const submission = {

    id: body.variables.submissionId,

    // Popup uses this
    title: details.question.title || problemSlug,

    // Internal
    problem: problemSlug,

    // Popup uses this
    lang: details.lang.verboseName,

    // Keep for compatibility
    language: details.lang.verboseName,

    runtime: details.runtimeDisplay,

    memory: details.memoryDisplay,

    // Popup uses this
    date: details.timestamp * 1000,

    // Keep original
    timestamp: details.timestamp,

    // Popup uses this
    url: `https://leetcode.com/problems/${problemSlug}/`,

    code: details.code,

    status: "Accepted"
};
    if (processedSubmissionIds.has(String(submission.id))) {
    console.log("Duplicate submission ignored:", submission.id);
    return;
}

processedSubmissionIds.add(String(submission.id));

console.log("Saving ID:", submission.id, submission);

chrome.runtime.sendMessage({
    type: "SAVE_SUBMISSION",
    platform: "leetcode",
    submission
});
});

})();