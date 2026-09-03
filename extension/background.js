// Service worker: open the side panel on toolbar click, and extract the
// job description from the active tab on request.

chrome.runtime.onInstalled.addListener(() => {
  // Open the side panel when the toolbar icon is clicked. Clicking the action
  // also grants activeTab for the current tab, which is what lets us read the
  // job description off the page.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn("setPanelBehavior failed", e));
});

// Runs in the page context to pull out the most likely job-description text.
function extractJobDescription() {
  const pick = (el) => (el ? el.innerText : "");
  // Prefer a semantic container if the page has one.
  const candidates = [
    document.querySelector("main"),
    document.querySelector("article"),
    document.querySelector('[class*="job" i][class*="desc" i]'),
    document.querySelector('[class*="description" i]'),
  ].filter(Boolean);

  let best = "";
  for (const el of candidates) {
    const t = pick(el).trim();
    if (t.length > best.length) best = t;
  }
  const body = (document.body ? document.body.innerText : "").trim();
  // Use the semantic container only if it captured a meaningful chunk.
  let text = best.length > 400 ? best : body;
  const title = document.title || "";
  text = (title + "\n\n" + text).replace(/\n{3,}/g, "\n\n").trim();
  return text.slice(0, 24000);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "grabJD") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab || !tab.id) {
          sendResponse({ ok: false, error: "No active tab." });
          return;
        }
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractJobDescription,
        });
        const text = results && results[0] && results[0].result;
        sendResponse({ ok: true, text: text || "", url: tab.url || "" });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
      }
    })();
    return true; // async response
  }
});
