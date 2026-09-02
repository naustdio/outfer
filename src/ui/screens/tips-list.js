import { joinList } from "../../domain/format.js";

// Renders the tips list. Not unit tested per design.md's Testing Strategy
// table (DOM screens are manual/E2E for this change), same convention as
// prendas-list.js/outfits-list.js.
export async function renderTipsList(container, { tipsRepo, onSelect, onCreate }) {
  container.innerHTML = "";

  const tips = await tipsRepo.list();

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.textContent = "Nuevo tip";
  createButton.addEventListener("click", () => onCreate?.());
  container.append(createButton);

  const list = document.createElement("ul");
  list.className = "tips-list";

  if (tips.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Aun no hay tips.";
    list.append(empty);
  }

  for (const row of tips) {
    const item = document.createElement("li");
    item.className = "tip-card";

    const title = document.createElement("strong");
    title.textContent = row.tip;

    const meta = document.createElement("span");
    meta.textContent = joinList(row.categoria);

    item.append(title, meta);
    item.addEventListener("click", () => onSelect?.(row.id));
    list.append(item);
  }

  container.append(list);
  return list;
}
