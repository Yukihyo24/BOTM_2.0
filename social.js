import { BOTM, supabase } from "/BOTM_2.0/app.js";

const FALLBACK_AVATAR="/BOTM_2.0/assets/botm-logo-mark.png";
const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

async function initPresence(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return;
  const touch=()=>supabase.rpc("touch_presence").catch(()=>{});
  await touch();
  setInterval(touch,60000);
}

async function getChat(){
  const {data,error}=await supabase.rpc("get_chat_messages",{p_limit:50});
  if(error)throw error;
  return data||[];
}

function homeRow(m){
  return `<div class="home-chat-row">
    <a href="/BOTM_2.0/profil.html?id=${encodeURIComponent(m.user_id)}"><img src="${esc(m.avatar_url||FALLBACK_AVATAR)}" alt=""></a>
    <div><div class="who">${esc(m.username)}</div><div class="msg">${esc(m.body)}</div></div>
  </div>`;
}

async function initHomeChat(){
  const list=document.getElementById("homeChatMessages");
  const form=document.getElementById("homeChatForm");
  if(!list||!form)return false;

  const render=async()=>{
    try{
      const rows=await getChat();
      list.innerHTML=rows.map(homeRow).join("")||`<div class="online-empty">Aucun message pour le moment.</div>`;
      list.scrollTop=list.scrollHeight;
    }catch(e){
      console.error(e);
      list.innerHTML=`<div class="online-empty">Chat indisponible.</div>`;
    }
  };

  form.onsubmit=async e=>{
    e.preventDefault();
    const input=document.getElementById("homeChatInput");
    const body=input.value.trim();
    if(!body)return;
    input.disabled=true;
    const {error}=await supabase.rpc("send_chat_message",{p_body:body});
    input.disabled=false;
    if(error){alert(error.message);return}
    input.value="";
    await render();
  };

  await render();
  supabase.channel("botm-home-chat")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},render)
    .subscribe();
  return true;
}

async function initOnlinePlayers(){
  const box=document.getElementById("homeOnlineList");
  if(!box)return;
  const render=async()=>{
    const {data,error}=await supabase.rpc("list_community_users",{p_search:null});
    if(error){box.innerHTML=`<div class="online-empty">Impossible de charger les joueurs.</div>`;return}
    const online=(data||[]).filter(u=>u.online);
    box.innerHTML=online.length?online.map(u=>`
      <a class="online-user" href="/BOTM_2.0/profil.html?id=${encodeURIComponent(u.id)}">
        <img src="${esc(u.avatar_url||FALLBACK_AVATAR)}" alt="">
        <span class="name">${esc(u.username)}</span>
        <span class="dot"></span>
      </a>`).join(""):`<div class="online-empty">Aucun autre joueur en ligne.</div>`;
  };
  await render();
  setInterval(render,30000);
}

async function initFloatingChat(){
  if(document.getElementById("homeChatMessages"))return;
  const {data:{session}}=await supabase.auth.getSession();
  if(!session||document.getElementById("botm-chatbox"))return;

  const root=document.createElement("div");
  root.id="botm-chatbox";root.className="chatbox";
  root.innerHTML=`<div class="chat-window"><div class="chat-head"><b>💬 Chat BOTM</b></div><div class="chat-messages" id="chatMessages"></div><form class="chat-send" id="chatSend"><input id="chatInput" maxlength="500" placeholder="Écrire un message…" autocomplete="off"><button>➤</button></form></div><button class="chat-toggle" id="chatToggle">💬 Chat</button>`;
  document.body.appendChild(root);
  const list=root.querySelector("#chatMessages");
  const render=async()=>{
    const rows=await getChat();
    list.innerHTML=rows.map(m=>`<div class="chat-msg"><a href="/BOTM_2.0/profil.html?id=${encodeURIComponent(m.user_id)}"><img src="${esc(m.avatar_url||FALLBACK_AVATAR)}" alt=""></a><div><div class="name">${esc(m.username)}</div><div class="text">${esc(m.body)}</div></div></div>`).join("");
    list.scrollTop=list.scrollHeight;
  };
  await render();
  root.querySelector("#chatToggle").onclick=()=>root.classList.toggle("open");
  root.querySelector("#chatSend").onsubmit=async e=>{
    e.preventDefault();
    const input=root.querySelector("#chatInput"),body=input.value.trim();
    if(!body)return;
    const {error}=await supabase.rpc("send_chat_message",{p_body:body});
    if(error){alert(error.message);return}
    input.value="";await render();
  };
  supabase.channel("botm-public-chat").on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},render).subscribe();
}

await initPresence();
await initHomeChat();
await initOnlinePlayers();
await initFloatingChat();
