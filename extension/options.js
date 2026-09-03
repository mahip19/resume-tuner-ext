const els = {
  template: document.getElementById("template"),
  extra: document.getElementById("extra"),
  save: document.getElementById("save"),
  status: document.getElementById("status"),
};

const DEFAULTS = { template: "", extra: "" };

async function load() {
  const s = await chrome.storage.local.get(DEFAULTS);
  els.template.value = s.template || "";
  els.extra.value = s.extra || "";
}

els.save.addEventListener("click", async () => {
  await chrome.storage.local.set({
    template: els.template.value,
    extra: els.extra.value,
  });
  els.status.textContent = "Saved.";
  els.status.classList.add("ok");
  setTimeout(() => {
    els.status.textContent = "";
    els.status.classList.remove("ok");
  }, 1800);
});

load();
