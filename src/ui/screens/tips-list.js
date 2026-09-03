import { joinList } from "../../domain/format.js";
import { icons } from "../icons.js";

// Renders the tips list. Not unit tested per design.md's Testing Strategy
// table (DOM screens are manual/E2E for this change), same convention as
// prendas-list.js/outfits-list.js.
export async function renderTipsList(container, { tipsRepo, onSelect, onCreate }) {
  container.innerHTML = "";

  const tips = await tipsRepo.list();

  const screen = document.createElement("div");
  screen.className = "screen tips-list-screen";

  const header = document.createElement("div");
  header.className = "screen-header";
  const heading = document.createElement("h1");
  heading.textContent = "Tips";
  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "btn btn-primary";
  createButton.textContent = "Agregar tip";
  createButton.addEventListener("click", () => onCreate?.());
  header.append(heading, createButton);
  screen.append(header);

  const list = document.createElement("ul");
  list.className = "tips-list card-list";

  if (tips.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Aun no hay tips.";
    list.append(empty);
  }

  for (const row of tips) {
    const item = document.createElement("li");
    item.className = "tip-card card card--row";

    const avatar = document.createElement("div");
    avatar.className = "card-row-icon";
    avatar.innerHTML = icons.bulb;
    item.append(avatar);

    const body = document.createElement("div");
    body.className = "card-row-body";

    const title = document.createElement("strong");
    title.className = "card-title";
    title.textContent = row.tip;

    const meta = document.createElement("span");
    meta.className = "card-row-meta";
    meta.innerHTML = `${icons.tag}<span>${joinList(row.categoria) || "General"}</span>`;

    body.append(title, meta);
    item.append(body);
    item.addEventListener("click", () => onSelect?.(row.id));
    list.append(item);
  }

  screen.append(list);
  container.append(screen);
  return list;
}
