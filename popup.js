const COLS = 7;
const TAB_ICONS = { recent:"🕘", 0:"😀", 1:"👋", 3:"🐻", 4:"🍔", 5:"✈️", 6:"⚽", 7:"💡", 8:"❤️", 9:"🏳️" };
const GROUP_ORDER = [0,1,3,4,5,6,7,8,9];

let DATA = { groups:[], emoji:[] };
let activeTab = "recent";          // "recent" | group index
let query = "";
let cells = [];                    // [{c, btn}] currently rendered, for keyboard nav
let selIndex = -1;

const $q = document.getElementById("q");
const $clear = document.getElementById("clear");
const $tabs = document.getElementById("tabs");
const $grid = document.getElementById("grid");
const $empty = document.getElementById("empty");
const $toast = document.getElementById("toast");

/* ---------- recents ---------- */
function getRecents(){
  try { return JSON.parse(localStorage.getItem("recents") || "[]"); }
  catch { return []; }
}
function pushRecent(c){
  let r = getRecents().filter(x => x !== c);
  r.unshift(c);
  r = r.slice(0, 21);
  localStorage.setItem("recents", JSON.stringify(r));
}

/* ---------- search ---------- */
function norm(s){ return (s||"").toLowerCase().trim(); }

function score(e, q){
  let best = 0;
  const en = e.en.toLowerCase(), kn = e.kn;
  if (en === q || kn === q) return 100;
  if (en.startsWith(q) || kn.startsWith(q)) best = 65;
  else if (en.includes(q) || kn.includes(q)) best = 42;
  for (const t of e.ek){
    const tl = t.toLowerCase();
    if (tl === q) best = Math.max(best, 52);
    else if (tl.startsWith(q)) best = Math.max(best, 30);
    else if (tl.includes(q)) best = Math.max(best, 14);
  }
  for (const t of e.kk){           // 한국어 태그 + 슬랭은 살짝 가중
    if (t === q) best = Math.max(best, 58);
    else if (t.startsWith(q)) best = Math.max(best, 34);
    else if (t.includes(q)) best = Math.max(best, 16);
  }
  return best;
}

function search(q){
  const scored = [];
  for (let i = 0; i < DATA.emoji.length; i++){
    const s = score(DATA.emoji[i], q);
    if (s > 0) scored.push([s, i, DATA.emoji[i]]);
  }
  scored.sort((a,b) => b[0]-a[0] || a[1]-b[1]);
  return scored.map(x => x[2]);
}

/* ---------- render ---------- */
function emojiCell(c){
  const b = document.createElement("button");
  b.className = "cell";
  b.textContent = c;
  b.title = c;
  b.addEventListener("click", () => copyEmoji(c));
  return b;
}

function renderRow(list, label){
  const frag = document.createDocumentFragment();
  if (label){
    const l = document.createElement("div");
    l.className = "sec-label"; l.textContent = label;
    frag.appendChild(l);
  }
  const row = document.createElement("div");
  row.className = "row";
  for (const c of list){
    const b = emojiCell(c);
    cells.push({ c, btn:b });
    row.appendChild(b);
  }
  frag.appendChild(row);
  return frag;
}

function render(){
  cells = []; selIndex = -1;
  $grid.innerHTML = "";

  if (query){
    const res = search(query);
    if (!res.length){ $empty.hidden = false; $grid.appendChild(document.createDocumentFragment()); return; }
    $empty.hidden = true;
    $grid.appendChild(renderRow(res.map(e => e.c)));
    setSel(0);
    return;
  }

  $empty.hidden = true;
  if (activeTab === "recent"){
    const r = getRecents();
    if (r.length) $grid.appendChild(renderRow(r, "최근 사용"));
    const smile = DATA.emoji.filter(e => e.g === 0).map(e => e.c);
    $grid.appendChild(renderRow(smile, r.length ? "웃는 얼굴·감정" : null));
  } else {
    const list = DATA.emoji.filter(e => e.g === activeTab).map(e => e.c);
    $grid.appendChild(renderRow(list));
  }
}

function renderTabs(){
  const mk = (key, label) => {
    const b = document.createElement("button");
    b.className = "tab" + (key === activeTab ? " on" : "");
    b.textContent = TAB_ICONS[key];
    b.title = label;
    b.addEventListener("click", () => {
      activeTab = key; query = ""; $q.value = ""; $clear.hidden = true;
      [...$tabs.children].forEach(c => c.classList.remove("on"));
      b.classList.add("on");
      render(); $q.focus();
    });
    return b;
  };
  $tabs.appendChild(mk("recent", "최근 사용"));
  GROUP_ORDER.forEach(g => $tabs.appendChild(mk(g, DATA.groups[g])));
}

/* ---------- selection / keyboard ---------- */
function setSel(i){
  if (!cells.length) return;
  if (selIndex >= 0 && cells[selIndex]) cells[selIndex].btn.classList.remove("sel");
  selIndex = Math.max(0, Math.min(i, cells.length - 1));
  const cur = cells[selIndex].btn;
  cur.classList.add("sel");
  cur.scrollIntoView({ block:"nearest" });
}

function copyEmoji(c){
  const done = () => {
    pushRecent(c);
    $toast.textContent = "복사됨  " + c;
    $toast.hidden = false;
    clearTimeout(copyEmoji._t);
    copyEmoji._t = setTimeout(() => { $toast.hidden = true; }, 1100);
  };
  navigator.clipboard.writeText(c).then(done).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = c; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove(); done();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape"){
    if (query){ query = ""; $q.value = ""; $clear.hidden = true; render(); $q.focus(); }
    else window.close();
    return;
  }
  if (e.key === "Enter"){
    if (cells[selIndex]) { copyEmoji(cells[selIndex].c); e.preventDefault(); }
    return;
  }
  if (["ArrowDown","ArrowUp","ArrowLeft","ArrowRight"].includes(e.key)){
    if (!cells.length) return;
    e.preventDefault();
    if (selIndex < 0) { setSel(0); return; }
    if (e.key === "ArrowRight") setSel(selIndex + 1);
    if (e.key === "ArrowLeft")  setSel(selIndex - 1);
    if (e.key === "ArrowDown")  setSel(selIndex + COLS);
    if (e.key === "ArrowUp"){
      if (selIndex < COLS) $q.focus();   // 맨 윗줄에서 위로 → 검색창
      else setSel(selIndex - COLS);
    }
  }
});

$q.addEventListener("input", () => {
  query = norm($q.value);
  $clear.hidden = !$q.value;
  render();
});
$clear.addEventListener("click", () => {
  query = ""; $q.value = ""; $clear.hidden = true; render(); $q.focus();
});

/* ---------- boot ---------- */
fetch(chrome.runtime.getURL("emoji-data.json"))
  .then(r => r.json())
  .then(d => { DATA = d; renderTabs(); render(); $q.focus(); })
  .catch(err => { $grid.textContent = "데이터를 불러오지 못했어요: " + err; });
