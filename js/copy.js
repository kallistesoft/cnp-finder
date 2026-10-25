// The result page's « Copier le code » button. Pages work without it.
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-copy]");
  if (!btn || !navigator.clipboard) return;
  navigator.clipboard.writeText(btn.dataset.copy).then(() => {
    const label = btn.textContent;
    btn.textContent = "✓ " + btn.dataset.done;
    setTimeout(() => (btn.textContent = label), 2000);
  }, () => {});
});
