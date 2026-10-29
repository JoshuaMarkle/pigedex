// Icons (PiBirdBold from react-icons, others from lucide)
const ICONS = {
  bird: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M176,72a16,16,0,1,1-16-16A16,16,0,0,1,176,72Zm68,8a12,12,0,0,1-5.34,10L220,102.42V120A108.12,108.12,0,0,1,112,228H24A20,20,0,0,1,8.41,195.5l.15-.18L92,95.18V76.89C92,41.28,120.57,12.17,155.69,12H156a63.94,63.94,0,0,1,60.58,43.29L238.66,70A12,12,0,0,1,244,80Zm-33.63,0-10.69-7.13a12,12,0,0,1-5-7A40,40,0,0,0,156,36h-.19c-21.95.11-39.8,18.45-39.8,40.89V99.52a12,12,0,0,1-2.79,7.69L32.57,204H53.05l69.74-83.68a12,12,0,1,1,18.43,15.36L84.29,204H112a84.09,84.09,0,0,0,84-84V96a12,12,0,0,1,5.35-10Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  person: '<svg viewBox="0 0 512 512" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"><path d="M344 144c-3.92 52.87-44 96-88 96s-84.15-43.12-88-96c-4-55 35-96 88-96s92 42 88 96z"/><path d="M256 304c-87 0-175.3 48-191.64 138.6C62.39 453.52 68.57 464 80 464h352c11.44 0 17.62-10.48 15.65-21.4C431.3 352 343 304 256 304z" stroke-miterlimit="10"/></svg>',
  house: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  feather: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};

// Render a family tree: pigeon nodes + union dots + bezier edges (like React Flow's default edge)
function renderTree(root, { pigeons, unions, highlight = [] }) {
  const W = 180, H = 72;
  const hl = new Set(highlight);
  const byId = Object.fromEntries(pigeons.map((p) => [p.id, p]));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", "position:absolute;inset:0;overflow:visible;width:1px;height:1px");
  svg.innerHTML = `<defs>
    <marker id="arrow" viewBox="-10 -10 20 20" markerWidth="12.5" markerHeight="12.5" orient="auto-start-reverse" refX="0" refY="0">
      <polyline points="-5,-4 0,0 -5,4 -5,-4" fill="var(--edge)" stroke="var(--edge)" stroke-width="1" stroke-linejoin="round"/>
    </marker>
    <marker id="arrow-hl" viewBox="-10 -10 20 20" markerWidth="12.5" markerHeight="12.5" orient="auto-start-reverse" refX="0" refY="0">
      <polyline points="-5,-4 0,0 -5,4 -5,-4" fill="var(--blue)" stroke="var(--blue)" stroke-width="1" stroke-linejoin="round"/>
    </marker></defs>`;
  root.appendChild(svg);

  function edge(sx, sy, tx, ty, on, arrow) {
    const d = Math.max(Math.abs(ty - sy) * 0.5, 25);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M${sx},${sy} C${sx},${sy + d} ${tx},${ty - d} ${tx},${ty}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", on ? "var(--blue)" : "var(--edge)");
    path.setAttribute("stroke-width", on ? 2.5 : 2);
    if (on) path.setAttribute("stroke-dasharray", "5 5");
    if (arrow) path.setAttribute("marker-end", `url(#${on ? "arrow-hl" : "arrow"})`);
    svg.appendChild(path);
  }

  for (const u of unions) {
    const on = u.parents.some((id) => hl.has(id)) && u.children.some((id) => hl.has(id));
    for (const pid of u.parents) {
      const p = byId[pid];
      edge(p.x + W / 2, p.y + H, u.x, u.y - 8, on && hl.has(pid), false);
    }
    for (const cid of u.children) {
      const c = byId[cid];
      edge(u.x, u.y + 8, c.x + W / 2, c.y - 2, on && hl.has(cid), true);
    }
    const dot = document.createElement("div");
    dot.className = "union";
    dot.style.left = u.x + "px";
    dot.style.top = u.y + "px";
    root.appendChild(dot);
  }

  for (const p of pigeons) {
    const el = document.createElement("div");
    el.className = `node ${p.status}`;
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    if (p.style) el.setAttribute("style", el.getAttribute("style") + p.style);
    el.innerHTML = `<div class="avatar">${ICONS.bird}</div>
      <div><div class="name">${p.name}</div><div class="bday">${p.bday || "Unknown"}</div></div>`;
    root.appendChild(el);
  }
}

document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = ICONS[el.dataset.icon];
});
