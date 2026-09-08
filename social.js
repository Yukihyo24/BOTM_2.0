import { supabase } from "/BOTM_2.0/app.js";

const FALLBACK_AVATAR="/BOTM_2.0/assets/botm-logo-mark.png";
const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

let session=null;

async function getSession(){
  if(session) return session;
  const {data,error}=await supabase.auth.getSession();
  if(error) throw error;
  session=data.session;
  return session;
}

async function touchPresence(){
  try{
    const s=await getSession();
    if(!s) return;
    const {error}=await supabase.rpc("touch_presence");
    if(error) console.error("Présence BOTM :",error);
  }catch(error){
    console.error("Présence BOTM :",error);
  }
}

async function initPresence(){
  await touchPresence();
  setInterval(touchPresence,60000);
}

async function getChat(){
  const {data,error}=await supabase.rpc("get_chat_messages",{p_limit:50});
  if(error) throw error;
  return data||[];
}

function homeRow(m){
  return `<div class="home-chat-row">
    <a href="/BOTM_2.0/profil.html?id=${encodeURIComponent(m.user_id)}">
      <img src="${esc(m.avatar_url||FALLBACK_AVATAR)}" alt="">
    </a>
    <div>
      <div class="who">${esc(m.username)}</div>
      <div class="msg">${esc(m.body)}</div>
    </div>
  </div>`;
}

async function initHomeChat(){
  const list=document.getElementById("homeChatMessages");
  const form=document.getElementById("homeChatForm");
  if(!list||!form) return;

  let rendering=false;

  const render=async()=>{
    if(rendering) return;
    rendering=true;
    try{
      const rows=await getChat();
      list.innerHTML=rows.length
        ? rows.map(homeRow).join("")
        : `<div class="online-empty">Aucun message pour le moment.</div>`;
      list.scrollTop=list.scrollHeight;
    }catch(error){
      console.error("Chat BOTM :",error);
      list.innerHTML=`<div class="online-empty">Impossible de charger le chat.</div>`;
    }finally{
      rendering=false;
    }
  };

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const input=document.getElementById("homeChatInput");
    const body=input.value.trim();
    if(!body) return;

    const sendButton=form.querySelector("button");
    input.disabled=true;
    sendButton.disabled=true;

    try{
      const {error}=await supabase.rpc("send_chat_message",{p_body:body});
      if(error) throw error;

      // Le message est relu immédiatement depuis la base :
      // pas besoin d'attendre l'événement Realtime.
      input.value="";
      await render();
    }catch(error){
      console.error("Envoi chat BOTM :",error);
      alert("Impossible d'envoyer le message : "+error.message);
    }finally{
      input.disabled=false;
      sendButton.disabled=false;
      input.focus();
    }
  });

  await render();

  supabase.channel("botm-home-chat-v13")
    .on(
      "postgres_changes",
      {event:"INSERT",schema:"public",table:"chat_messages"},
      ()=>render()
    )
    .subscribe();
}

async function initOnlinePlayers(){
  const box=document.getElementById("homeOnlineList");
  if(!box) return;

  const render=async()=>{
    try{
      const s=await getSession();
      if(!s){
        box.innerHTML=`<div class="online-empty">Connexion requise.</div>`;
        return;
      }

      const [{data:others,error:othersError},{data:mine,error:mineError}] = await Promise.all([
        supabase.rpc("list_community_users",{p_search:null}),
        supabase.rpc("get_public_profile",{p_user_id:s.user.id})
      ]);

      if(othersError) throw othersError;
      if(mineError) throw mineError;

      const users=[];

      // Affiche aussi le joueur connecté lui-même.
      if(mine?.online){
        users.push({
          id:mine.id,
          username:mine.username,
          avatar_url:mine.avatar_url,
          online:true
        });
      }

      for(const u of (others||[])){
        if(u.online) users.push(u);
      }

      users.sort((a,b)=>String(a.username||"").localeCompare(String(b.username||""),"fr"));

      box.innerHTML=users.length
        ? users.map(u=>`
          <a class="online-user" href="/BOTM_2.0/profil.html?id=${encodeURIComponent(u.id)}">
            <img src="${esc(u.avatar_url||FALLBACK_AVATAR)}" alt="">
            <span class="name">${esc(u.username)}${u.id===s.user.id?" (toi)":""}</span>
            <span class="dot"></span>
          </a>`).join("")
        : `<div class="online-empty">Aucun joueur en ligne.</div>`;
    }catch(error){
      console.error("Joueurs en ligne BOTM :",error);
      box.innerHTML=`<div class="online-empty">Impossible de charger les joueurs.</div>`;
    }
  };

  await render();
  setInterval(render,30000);
}

async function initFloatingChat(){
  // Sur l'accueil, le chat est déjà intégré dans la page.
  if(document.getElementById("homeChatMessages")) return;

  const s=await getSession();
  if(!s||document.getElementById("botm-chatbox")) return;

  const root=document.createElement("div");
  root.id="botm-chatbox";
  root.className="chatbox";
  root.innerHTML=`
    <div class="chat-window">
      <div class="chat-head"><b>💬 Chat BOTM</b></div>
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
      list.innerHTML=rows.map(m=>`<div class="chat-msg">
        <a href="/BOTM_2.0/profil.html?id=${encodeURIComponent(m.user_id)}">
          <img src="${esc(m.avatar_url||FALLBACK_AVATAR)}" alt="">
        </a>
        <div><div class="name">${esc(m.username)}</div><div class="text">${esc(m.body)}</div></div>
      </div>`).join("");
      list.scrollTop=list.scrollHeight;
    }catch(error){
      console.error("Chat BOTM :",error);
    }
  };

  await render();
  root.querySelector("#chatToggle").onclick=()=>root.classList.toggle("open");

  root.querySelector("#chatSend").onsubmit=async e=>{
    e.preventDefault();
    const input=root.querySelector("#chatInput");
    const body=input.value.trim();
    if(!body) return;

    const {error}=await supabase.rpc("send_chat_message",{p_body:body});
    if(error){
      alert("Impossible d'envoyer le message : "+error.message);
      return;
    }
    input.value="";
    await render();
  };

  supabase.channel("botm-public-chat-v13")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},()=>render())
    .subscribe();
}

async function bootSocial(){
  await initPresence();
  await Promise.all([
    initHomeChat(),
    initOnlinePlayers()
  ]);
  await initFloatingChat();
}

bootSocial().catch(error=>console.error("Initialisation sociale BOTM :",error));
