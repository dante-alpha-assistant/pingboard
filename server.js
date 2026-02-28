const express = require('express');
const app = express();
const PORT = 9091;

const SUPABASE_BASE = process.env.SUPABASE_URL || 'https://lessxkxujvcmublgwdaa.supabase.co';
const SUPABASE_URL = `${SUPABASE_BASE}/rest/v1/agent_cards?select=*`;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

async function fetchAgents() {
  const res = await fetch(SUPABASE_URL, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

function relativeTime(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderCard(a) {
  const name = escapeHtml(a.name || a.agent_name || 'Unknown');
  const status = (a.status || 'offline').toLowerCase();
  const statusColor = status === 'online' ? '#22c55e' : status === 'disabled' ? '#ef4444' : '#71717a';
  const statusDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px"></span>`;
  const avatar = a.avatar || a.emoji || name.charAt(0).toUpperCase();
  const isEmoji = avatar.length <= 2 && /\p{Emoji}/u.test(avatar);
  const avatarHtml = isEmoji
    ? `<div class="avatar">${avatar}</div>`
    : avatar.startsWith('http')
      ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="${name}">`
      : `<div class="avatar">${escapeHtml(avatar.charAt(0).toUpperCase())}</div>`;

  const caps = Array.isArray(a.capabilities) ? a.capabilities : [];
  const capTags = caps.map(c => `<span class="tag">${escapeHtml(c)}</span>`).join('');
  const tasks = a.active_tasks || a.active_task_count || 0;
  const heartbeat = relativeTime(a.last_heartbeat);
  const successRate = a.success_rate != null ? Math.round(a.success_rate) : null;
  const successBar = successRate != null
    ? `<div class="rate-bar"><div class="rate-fill" style="width:${successRate}%"></div><span class="rate-label">${successRate}%</span></div>`
    : '';

  const model = escapeHtml(a.model || '');
  const endpoint = escapeHtml(a.endpoint || '');
  const capacity = a.capacity != null ? a.capacity : '';
  const meta = a.metadata ? escapeHtml(JSON.stringify(a.metadata, null, 2)) : '';

  return `
  <div class="card" onclick="this.classList.toggle('expanded')">
    <div class="card-header">
      ${avatarHtml}
      <div class="card-info">
        <div class="card-name">${statusDot}${name}</div>
        <div class="card-status">${escapeHtml(status)} · ${heartbeat}</div>
      </div>
      <div class="card-tasks" title="Active tasks">${tasks} 🔧</div>
    </div>
    <div class="card-caps">${capTags}</div>
    ${successBar}
    <div class="card-details">
      ${model ? `<div><strong>Model:</strong> ${model}</div>` : ''}
      ${endpoint ? `<div><strong>Endpoint:</strong> ${endpoint}</div>` : ''}
      ${capacity ? `<div><strong>Capacity:</strong> ${capacity}</div>` : ''}
      ${meta ? `<pre>${meta}</pre>` : ''}
    </div>
  </div>`;
}

function renderPage(agents) {
  const cards = agents.map(renderCard).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Pingboard</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;color:#fff;font-family:'JetBrains Mono',monospace;min-height:100vh}
.header{padding:24px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.header h1{font-size:1.5rem;color:#22c55e}
.refresh-indicator{font-size:.75rem;color:#71717a}
.refresh-indicator.active{color:#22c55e}
.filters{display:flex;gap:8px;padding:0 32px 16px}
.filters button{background:#27272a;border:1px solid #3f3f46;color:#a1a1aa;padding:6px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.8rem;transition:all .2s}
.filters button:hover,.filters button.active{background:#22c55e;color:#0a0a0a;border-color:#22c55e}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;padding:0 32px 32px}
.card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:16px;cursor:pointer;transition:all .25s ease}
.card:hover{border-color:#3f3f46;transform:translateY(-2px)}
.card-header{display:flex;align-items:center;gap:12px}
.avatar{width:40px;height:40px;border-radius:10px;background:#27272a;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;object-fit:cover}
img.avatar{border:0}
.card-info{flex:1;min-width:0}
.card-name{font-weight:700;font-size:.95rem;display:flex;align-items:center}
.card-status{font-size:.7rem;color:#71717a;margin-top:2px}
.card-tasks{font-size:.8rem;color:#a1a1aa}
.card-caps{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}
.tag{background:#27272a;color:#a1a1aa;padding:2px 8px;border-radius:4px;font-size:.65rem}
.rate-bar{background:#27272a;border-radius:4px;height:6px;margin-top:10px;position:relative;overflow:hidden}
.rate-fill{background:#22c55e;height:100%;border-radius:4px;transition:width .3s}
.rate-label{position:absolute;right:4px;top:-1px;font-size:.55rem;color:#a1a1aa}
.card-details{max-height:0;overflow:hidden;transition:max-height .3s ease;font-size:.75rem;color:#a1a1aa;margin-top:0}
.card.expanded .card-details{max-height:400px;margin-top:12px}
.card-details div{margin-bottom:4px}
.card-details pre{background:#0a0a0a;padding:8px;border-radius:6px;overflow-x:auto;margin-top:6px;font-size:.65rem}
.empty{text-align:center;color:#71717a;padding:60px 32px;font-size:.9rem}
</style>
</head>
<body>
<div class="header">
  <h1>⚡ Agent Pingboard</h1>
  <div class="refresh-indicator" id="ri">auto-refresh 30s</div>
</div>
<div class="filters">
  <button class="active" data-filter="all">All</button>
  <button data-filter="online">Online</button>
  <button data-filter="offline">Offline</button>
  <button data-filter="disabled">Disabled</button>
</div>
<div class="grid" id="grid">
${cards || '<div class="empty">No agents found</div>'}
</div>
<script>
let currentFilter='all';
document.querySelectorAll('.filters button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.filters button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter=btn.dataset.filter;
    applyFilter();
  });
});
function applyFilter(){
  document.querySelectorAll('.card').forEach(c=>{
    const s=c.querySelector('.card-status')?.textContent.split('·')[0].trim().toLowerCase()||'';
    c.style.display=(currentFilter==='all'||s===currentFilter)?'':'none';
  });
}
async function refresh(){
  const ri=document.getElementById('ri');
  ri.classList.add('active');ri.textContent='refreshing...';
  try{
    const r=await fetch('/api/agents');
    const agents=await r.json();
    const grid=document.getElementById('grid');
    if(!agents.length){grid.innerHTML='<div class="empty">No agents found</div>';return;}
    // rebuild via server-rendered partial would be complex; use simple DOM rebuild
    const tmp=document.createElement('div');
    agents.forEach(a=>{
      const name=a.name||a.agent_name||'Unknown';
      const status=(a.status||'offline').toLowerCase();
      const sc=status==='online'?'#22c55e':status==='disabled'?'#ef4444':'#71717a';
      const avatar=a.avatar||a.emoji||name.charAt(0).toUpperCase();
      const isEmoji=avatar.length<=2&&/\\p{Emoji}/u.test(avatar);
      const avHtml=isEmoji?'<div class="avatar">'+avatar+'</div>'
        :avatar.startsWith('http')?'<img class="avatar" src="'+avatar+'">'
        :'<div class="avatar">'+avatar.charAt(0).toUpperCase()+'</div>';
      const caps=Array.isArray(a.capabilities)?a.capabilities:[];
      const tasks=a.active_tasks||a.active_task_count||0;
      const hb=relTime(a.last_heartbeat);
      const sr=a.success_rate!=null?Math.round(a.success_rate):null;
      const srBar=sr!=null?'<div class="rate-bar"><div class="rate-fill" style="width:'+sr+'%"></div><span class="rate-label">'+sr+'%</span></div>':'';
      const model=a.model||'';const endpoint=a.endpoint||'';const capacity=a.capacity!=null?a.capacity:'';
      const meta=a.metadata?JSON.stringify(a.metadata,null,2):'';
      const card=document.createElement('div');
      card.className='card';card.onclick=function(){this.classList.toggle('expanded')};
      card.innerHTML=\`
        <div class="card-header">\${avHtml}<div class="card-info">
        <div class="card-name"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:\${sc};margin-right:6px"></span>\${esc(name)}</div>
        <div class="card-status">\${esc(status)} · \${hb}</div></div>
        <div class="card-tasks">\${tasks} 🔧</div></div>
        <div class="card-caps">\${caps.map(c=>'<span class="tag">'+esc(c)+'</span>').join('')}</div>
        \${srBar}
        <div class="card-details">
        \${model?'<div><strong>Model:</strong> '+esc(model)+'</div>':''}
        \${endpoint?'<div><strong>Endpoint:</strong> '+esc(endpoint)+'</div>':''}
        \${capacity?'<div><strong>Capacity:</strong> '+capacity+'</div>':''}
        \${meta?'<pre>'+esc(meta)+'</pre>':''}
        </div>\`;
      tmp.appendChild(card);
    });
    grid.innerHTML='';
    while(tmp.firstChild)grid.appendChild(tmp.firstChild);
    applyFilter();
  }catch(e){console.error('refresh failed',e)}
  finally{ri.classList.remove('active');ri.textContent='auto-refresh 30s';}
}
function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function relTime(ts){if(!ts)return'never';const d=Date.now()-new Date(ts).getTime();if(d<0)return'just now';const s=Math.floor(d/1000);if(s<60)return s+'s ago';const m=Math.floor(s/60);if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago';}
setInterval(refresh,30000);
</script>
</body>
</html>`;
}

// Routes
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await fetchAgents();
    res.json(agents);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/.well-known/agent-cards.json', async (req, res) => {
  try {
    const agents = await fetchAgents();
    res.json(agents);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/', async (req, res) => {
  try {
    const agents = await fetchAgents();
    res.send(renderPage(agents));
  } catch (e) {
    res.status(500).send(renderPage([]));
  }
});

app.listen(PORT, () => console.log(`Pingboard running on :${PORT}`));
