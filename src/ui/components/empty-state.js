// Small shared `<li class="empty-state">` builder. Extracted per tasks.md
// 10.2 ("reused for both lookup sections") rather than inlining the same
// three lines twice in prenda-detail.js's linked-outfits and linked-tips
// sections. Existing empty-state `<li>`s elsewhere in the app
// (prendas-list.js, outfits-list.js, tips-list.js, outfit-detail.js,
// tip-form.js) were left as-is -- they predate this component and changing
// them isn't part of Phase 10's scope.
export function renderEmptyState(message) {
  const li = document.createElement("li");
  li.className = "empty-state";
  li.textContent = message;
  return li;
}
