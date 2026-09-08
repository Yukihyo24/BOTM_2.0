import { BOTM, supabase } from "/BOTM_2.0/app.js";

const FALLBACK_AVATAR = "/BOTM_2.0/assets/botm-logo-mark.png";
let currentUser = null;

function esc(v=""){
  return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

export async function initPresence(){
  const { data:{ session } } = await supabase.auth.getSession();
  if(!session) return;
  currentUser = session.user;
  const touch = ()=>supabase.rpc("touch_presence").catch(()=>{});
  await touch();
  setInterval(touch, 60000);
}

async function getChat(){
  const {data,error}=await supabase.rpc("get_chat_messages",{p_limit:50});
  if(error) throw error;
  return data||[];
}

function chatRow(m){
  const avatar=m.avatar_url||FALLBACK_AVATAR;
  return `<div class="chat-msg">
    <a href="/BOTM_2.0/profil.html?id=${encodeURIComponent(m.user_id)}"><img src="${esc(avatar)}" alt=""></a>
    <div><div class="name">${esc(m.username)}</div><div class="text">${esc(m.body)}</div></div>
  </div>`;
}

export async function initChatbox(){
  const { data:{ session } } = await supabase.auth.getSession();
  if(!session || document.getElementById("botm-chatbox")) return;

  const root=document.createElement("div");
  root.id="botm-chatbox";
  root.className="chatbox";
  root.innerHTML=`
    <div class="chat-window">
      <div class="chat-head"><b>💬 Chat BOTM</b><span id="chatOnlineLabel"></span></div>
      <div class="chat-messages" id="chatMessages"></div>
      <form class="chat-send" id="chatSend">
        <input id="chatInput" maxlength="500" placeholder="Écrire un message…" autocomplete="off">
        <button>➤</button>
      </form>
    </div>
    <button class="chat-toggle" id="chatToggle">💬 Chat</button>`;
  document.body.appendChild(root);

  const list=root.querySelector("#chatMessages");
  const render=async()=>{
    try{
      const rows=await getChat();
      list.innerHTML=rows.map(chatRow).join("");
      list.scrollTop=list.scrollHeight;
    }catch(e){ console.error("Chat:",e); }
  };
  await render();

  root.querySelector("#chatToggle").onclick=()=>root.classList.toggle("open");
  root.querySelector("#chatSend").onsubmit=async e=>{
    e.preventDefault();
    const input=root.querySelector("#chatInput");
    const body=input.value.trim();
    if(!body) return;
    input.disabled=true;
    const {error}=await supabase.rpc("send_chat_message",{p_body:body});
    input.disabled=false;
    if(error){alert(error.message);return}
    input.value="";
    await render();
  };

  supabase.channel("botm-public-chat")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},()=>render())
    .subscribe();
}

await initPresence();
await initChatbox();
