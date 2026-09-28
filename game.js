(() => {
"use strict";

const $ = id => document.getElementById(id);
const lobby=$("lobby"), game=$("game"), canvas=$("gameCanvas"), ctx=canvas.getContext("2d");
const statusEl=$("status"), roomPanel=$("roomPanel"), roomCodeEl=$("roomCode"), playersEl=$("players");
const toast=$("toast"), feed=$("feed");
const waveEl=$("wave"), zombiesEl=$("zombies"), aliveEl=$("alive"), scoreEl=$("score");

const MAX_PLAYERS=4, TICK=50, SNAPSHOT=100;
let ws=null, room="", clientId="", playerName="Player-"+Math.floor(100+Math.random()*900);
let isHost=false, started=false, paused=false, peers=new Map(), dataChannels=new Map();
let localState={x:0,y:0,hp:100,alive:true,score:0,color:"#62f38a"};
let remotePlayers=new Map(), zombies=new Map(), bullets=[];
let world={wave:1,score:0,lastSpawn:0,spawned:0,kills:0};
let keys={}, move={x:0,y:0}, fire={x:0,y:0,active:false}, lastTime=performance.now(), lastNet=0, idSeq=1;
let hostTimer=null;

function setStatus(s){statusEl.textContent=s}
function toastMsg(s){toast.textContent=s;toast.classList.add("show");clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>toast.classList.remove("show"),1800)}
function addFeed(s){const d=document.createElement("div");d.textContent=s;feed.prepend(d);setTimeout(()=>d.remove(),3500)}
function randomColor(){return ["#62f38a","#55c8ff","#ffcf58","#ff6f91"][Math.floor(Math.random()*4)]}
function roomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}

function connectWS(){
  if(ws && (ws.readyState===0||ws.readyState===1)) return;
  const proto=location.protocol==="https:"?"wss":"ws";
  const host=location.host;
  if(!host){setStatus("Hãy mở game qua địa chỉ web có server.js.");return}
  ws=new WebSocket(`${proto}://${host}`);
  ws.onopen=()=>setStatus("Đã kết nối máy chủ.");
  ws.onclose=()=>{setStatus("Mất kết nối signaling server."); if(started) addFeed("⚠ Mất kết nối máy chủ signaling");};
  ws.onerror=()=>setStatus("Không thể kết nối signaling server.");
  ws.onmessage=e=>handleSignal(JSON.parse(e.data));
}

function sendWS(o){if(ws?.readyState===1)ws.send(JSON.stringify(o))}
function createRoom(){
  connectWS(); const wait=setInterval(()=>{if(ws?.readyState===1){clearInterval(wait);room=roomCode();isHost=true;sendWS({type:"create",room,name:playerName});}},50);
}
function joinRoom(){
  const c=$("roomInput").value.trim().toUpperCase();
  if(c.length!==6){toastMsg("Mã phòng phải có 6 ký tự");return}
  connectWS(); const wait=setInterval(()=>{if(ws?.readyState===1){clearInterval(wait);room=c;isHost=false;sendWS({type:"join",room,name:playerName});}},50);
}
function leaveRoom(){
  peers.forEach(p=>p.pc.close()); peers.clear(); dataChannels.clear(); remotePlayers.clear();
  sendWS({type:"leave",room}); room=""; started=false; isHost=false; stopHost(); roomPanel.classList.add("hidden"); lobby.classList.add("active"); game.classList.remove("active"); setStatus("Đã rời phòng.");
}
function updatePlayers(list){
  playersEl.innerHTML="";
  list.forEach(p=>{
    const d=document.createElement("div"); d.className="player";
    d.innerHTML=`<span class="name">👤 ${escapeHtml(p.name||"Player")}</span><span class="tag">${p.host?"HOST":"PLAYER"}${p.id===clientId?" • BẠN":""}</span>`;
    playersEl.appendChild(d);
  });
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function handleSignal(m){
  if(m.type==="hello"){clientId=m.id;return}
  if(m.type==="roomCreated"||m.type==="roomJoined"){
    room=m.room; roomPanel.classList.remove("hidden"); roomCodeEl.textContent=room;
    updatePlayers(m.players); setStatus(isHost?"Bạn là HOST. Gửi mã phòng cho bạn bè.":"Đã vào phòng.");
    if(m.peers) for(const p of m.peers) await makePeer(p.id,p.name,true);
    return;
  }
  if(m.type==="playerJoined"){
    updatePlayers(m.players);
    if(isHost) await makePeer(m.id,m.name,false);
    addFeed(`👤 ${m.name} đã vào phòng`);
    return;
  }
  if(m.type==="playerLeft"){updatePlayers(m.players);removePeer(m.id);addFeed("👤 Một người chơi đã rời phòng");return}
  if(m.type==="start"){startGame(m.state);return}
  if(m.type==="signal"){
    let p=peers.get(m.from); if(!p) p=await makePeer(m.from,m.name,false);
    try{await p.pc.setRemoteDescription(m.data); if(m.data.type==="offer"){const ans=await p.pc.createAnswer();await p.pc.setLocalDescription(ans);sendWS({type:"signal",room,to:m.from,data:p.pc.localDescription})}}catch(e){console.error(e)}
    return;
  }
}

async function makePeer(id,name,initiator){
  if(peers.has(id)) return peers.get(id);
  const pc=new RTCPeerConnection({iceServers:[
    {urls:"stun:stun.l.google.com:19302"},
    {urls:"stun:stun.cloudflare.com:3478"}
  ]});
  const item={pc,name};
  peers.set(id,item);
  pc.onicecandidate=e=>{if(e.candidate)sendWS({type:"signal",room,to:id,data:{candidate:e.candidate}})}
  pc.onconnectionstatechange=()=>{if(["failed","closed","disconnected"].includes(pc.connectionState))removePeer(id)}
  pc.ondatachannel=e=>setupChannel(id,e.channel);
  if(initiator) setupChannel(id,pc.createDataChannel("game",{ordered:true}));
  pc.onnegotiationneeded=async()=>{
    if(!initiator)return;
    try{await pc.setLocalDescription(await pc.createOffer());sendWS({type:"signal",room,to:id,data:pc.localDescription})}catch(e){console.error(e)}
  };
  return item;
}
function setupChannel(id,ch){
  dataChannels.set(id,ch);
  ch.onopen=()=>{addFeed("🟢 Kết nối người chơi");sendStateTo(id)}
  ch.onclose=()=>dataChannels.delete(id);
  ch.onmessage=e=>handleGameData(id,JSON.parse(e.data));
}
async function handleCandidate(id,data){
  const p=peers.get(id); if(p&&data.candidate) await p.pc.addIceCandidate(data.candidate);
}

const oldSignal=handleSignal;
handleSignal=async m=>{
  if(m.type==="signal" && m.data?.candidate){await handleCandidate(m.from,m.data);return}
  return oldSignal(m);
};

function removePeer(id){try{peers.get(id)?.pc.close()}catch{} peers.delete(id);dataChannels.delete(id);remotePlayers.delete(id)}

function startGame(initial){
  started=true;paused=false;lobby.classList.remove("active");game.classList.add("active");
  resize(); localState={x:Math.random()*700+50,y:Math.random()*400+100,hp:100,alive:true,score:0,color:randomColor()};
  world={wave:initial?.wave||1,score:0,lastSpawn:0,spawned:0,kills:0};
  zombies.clear(); bullets=[]; remotePlayers.clear();
  if(isHost){spawnInitial();stopHost();hostTimer=setInterval(hostTick,TICK)}
  requestAnimationFrame(loop);
}
function beginStart(){
  if(!isHost){toastMsg("Chỉ HOST có thể bắt đầu");return}
  sendWS({type:"start",room,state:{wave:1}});
}
function stopHost(){if(hostTimer){clearInterval(hostTimer);hostTimer=null}}
function spawnInitial(){for(let i=0;i<7;i++)spawnZombie()}
function spawnZombie(){
  const id="z"+(idSeq++), side=Math.floor(Math.random()*4), w=canvas.width||800,h=canvas.height||600;
  let x=side===0?-30:side===1?w+30:Math.random()*w, y=side===2?-30:side===3?h+30:Math.random()*h;
  zombies.set(id,{id,x,y,hp:50+world.wave*8,max:50+world.wave*8,speed:35+world.wave*2,r:15});
}
function hostTick(){
  const dt=TICK/1000;
  const all=[{id:clientId,...localState}];
  remotePlayers.forEach(p=>all.push(p));
  for(const z of zombies){
    let target=null,best=1e9;
    for(const p of all)if(p.alive){const d=(p.x-z.x)**2+(p.y-z.y)**2;if(d<best){best=d;target=p}}
    if(target){
      const dx=target.x-z.x,dy=target.y-z.y,d=Math.hypot(dx,dy)||1;
      z.x+=dx/d*z.speed*dt;z.y+=dy/d*z.speed*dt;
      if(d<25){
        const damage=12*dt;
        if(target.id===clientId){
          localState.hp=Math.max(0,localState.hp-damage);
          if(localState.hp<=0 && localState.alive){localState.alive=false;addFeed("💀 Bạn đã gục");}
        }else{
          const rp=remotePlayers.get(target.id);
          if(rp){
            rp.hp=Math.max(0,rp.hp-damage);
            if(rp.hp<=0 && rp.alive){rp.alive=false;addFeed("💀 Một người chơi đã gục");}
          }
        }
      }
    }
  }
  remotePlayers.forEach(p=>{
    if(!p.alive || !p.firing) return;
    const now=performance.now();
    if(now-(p.lastShot||0)<180) return;
    p.lastShot=now;
    let dx=p.fireX||0,dy=p.fireY||0,len=Math.hypot(dx,dy);
    if(len<0.1) return;
    dx/=len;dy/=len;
    for(const z of zombies.values()){
      const zx=z.x-p.x,zy=z.y-p.y,dist=Math.hypot(zx,zy);
      const dot=zx*dx+zy*dy;
      if(dot>0&&dot<500&&Math.abs(zx*dy-zy*dx)/Math.max(1,dist)<20){
        z.hp-=35;
        if(z.hp<=0){zombies.delete(z.id);p.score=(p.score||0)+100;world.score+=100;world.kills++;}
        break;
      }
    }
  });
  world.lastSpawn+=TICK;
  const targetCount=Math.min(40,7+world.wave*2);
  if(zombies.size<targetCount && world.lastSpawn>650){spawnZombie();world.lastSpawn=0}
  if(zombies.size===0){world.wave++;for(let i=0;i<7+world.wave;i++)spawnZombie();addFeed(`🌊 WAVE ${world.wave}`)}
  broadcast({type:"snapshot",players:all,zombies:[...zombies.values()],wave:world.wave,score:world.score});
}
function sendStateTo(id){const ch=dataChannels.get(id);if(ch?.readyState==="open")ch.send(JSON.stringify({type:"snapshot",players:[{id:clientId,...localState}],zombies:[...zombies.values()],wave:world.wave,score:world.score}))}
function broadcast(o){
  const s=JSON.stringify(o);
  dataChannels.forEach(ch=>{if(ch.readyState==="open")ch.send(s)})
}
function handleGameData(from,m){
  if(isHost && m.type==="input"){
    remotePlayers.set(from,{id:from,name:peers.get(from)?.name||"Player",x:m.x,y:m.y,hp:m.hp,alive:m.alive,score:m.score,color:m.color,fireX:m.fireX||0,fireY:m.fireY||0,firing:!!m.firing,lastShot:remotePlayers.get(from)?.lastShot||0});
  } else if(!isHost && m.type==="snapshot") applySnapshot(m);
}
function applySnapshot(m){
  world.wave=m.wave;world.score=m.score;zombies.clear();m.zombies.forEach(z=>zombies.set(z.id,z));
  remotePlayers.clear();
  m.players.forEach(p=>{if(p.id===clientId){localState.x=p.x;localState.y=p.y;localState.hp=p.hp;localState.alive=p.alive;localState.score=p.score}else remotePlayers.set(p.id,p)})
}

function resize(){const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.floor(innerWidth*d);canvas.height=Math.floor(innerHeight*d);ctx.setTransform(d,0,0,d,0,0)}
addEventListener("resize",resize);

function loop(t){
  const dt=Math.min(.05,(t-lastTime)/1000);lastTime=t;
  if(started&&!paused){updateLocal(dt);draw();if(t-lastNet>80){sendInput();lastNet=t}}
  if(started)requestAnimationFrame(loop);
}
function updateLocal(dt){
  if(!localState.alive)return;
  let dx=move.x,dy=move.y;
  if(keys.w||keys.ArrowUp)dy-=1;if(keys.s||keys.ArrowDown)dy+=1;if(keys.a||keys.ArrowLeft)dx-=1;if(keys.d||keys.ArrowRight)dx+=1;
  const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
  localState.x=Math.max(20,Math.min(innerWidth-20,localState.x+dx*190*dt));
  localState.y=Math.max(65,Math.min(innerHeight-20,localState.y+dy*190*dt));
  if(fire.active)shoot();
}
let lastShot=0;
function shoot(){
  const now=performance.now();if(now-lastShot<180||!localState.alive)return;lastShot=now;
  let dx=fire.x,dy=fire.y;if(Math.hypot(dx,dy)<.1){dx=1;dy=0}
  const l=Math.hypot(dx,dy);dx/=l;dy/=l;
  bullets.push({x:localState.x,y:localState.y,vx:dx*650,vy:dy*650,life:.6});
  if(isHost){
    for(const z of zombies.values()){
      const zx=z.x-localState.x,zy=z.y-localState.y;
      const dot=zx*dx+zy*dy, dist=Math.hypot(zx,zy);
      if(dot>0&&dot<500&&Math.abs(zx*dy-zy*dx)/Math.max(1,dist)<18){z.hp-=35;if(z.hp<=0){zombies.delete(z.id);localState.score+=100;world.score=localState.score;world.kills++;}break}
    }
  }
}
function sendInput(){
  if(isHost)return;
  dataChannels.forEach(ch=>{if(ch.readyState==="open")ch.send(JSON.stringify({type:"input",x:localState.x,y:localState.y,hp:localState.hp,alive:localState.alive,score:localState.score,color:localState.color,fireX:fire.x,fireY:fire.y,firing:fire.active}))});
}
function draw(){
  const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#071009";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#0f2516";ctx.lineWidth=1;
  for(let x=0;x<w;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
  for(let y=0;y<h;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  zombies.forEach(z=>drawZombie(z));remotePlayers.forEach(p=>drawPlayer(p));drawPlayer({id:clientId,...localState});
  bullets.forEach((b,i)=>{b.x+=b.vx*.016;b.y+=b.vy*.016;b.life-=.016;ctx.fillStyle="#dfffe6";ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();if(b.life<=0)bullets.splice(i,1)});
  waveEl.textContent=world.wave;zombiesEl.textContent=zombies.size;aliveEl.textContent=1+[...remotePlayers.values()].filter(p=>p.alive).length;scoreEl.textContent=localState.score;
}
function drawPlayer(p){
  ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=p.alive?1:.35;
  ctx.fillStyle=p.color||"#62f38a";ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#dffff0";ctx.beginPath();ctx.arc(5,-4,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#0008";ctx.fillRect(-18,-27,36,4);ctx.fillStyle="#58ef7c";ctx.fillRect(-18,-27,36*Math.max(0,p.hp/100),4);
  ctx.restore();
}
function drawZombie(z){
  ctx.save();ctx.translate(z.x,z.y);ctx.fillStyle="#7ee88d";ctx.beginPath();ctx.arc(0,0,z.r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#132519";ctx.beginPath();ctx.arc(-5,-3,2.5,0,Math.PI*2);ctx.arc(5,-3,2.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#0009";ctx.fillRect(-16,-23,32,4);ctx.fillStyle="#ff5b5b";ctx.fillRect(-16,-23,32*Math.max(0,z.hp/z.max),4);ctx.restore();
}

function bindStick(el,type){
  const knob=el.querySelector(".knob");let active=false;
  const update=e=>{
    const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    const p=e.touches?e.touches[0]:e,dx=p.clientX-cx,dy=p.clientY-cy,max=r.width*.31,l=Math.hypot(dx,dy)||1;
    const k=Math.min(1,max/l);knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;
    if(type==="move"){move={x:dx*k/max,y:dy*k/max}}else{fire={x:dx*k/max,y:dy*k/max,active:true}}
  };
  const end=()=>{active=false;knob.style.transform="";if(type==="move")move={x:0,y:0};else fire={x:0,y:0,active:false}};
  el.addEventListener("touchstart",e=>{active=true;update(e);e.preventDefault()},{passive:false});
  el.addEventListener("touchmove",e=>{if(active)update(e);e.preventDefault()},{passive:false});
  el.addEventListener("touchend",end);el.addEventListener("touchcancel",end);
}
bindStick($("moveStick"),"move");bindStick($("fireStick"),"fire");
addEventListener("keydown",e=>{keys[e.key]=true;if(e.key===" "){fire={x:1,y:0,active:true}}});
addEventListener("keyup",e=>{keys[e.key]=false;if(e.key===" ")fire.active=false});

$("createBtn").onclick=createRoom;$("joinBtn").onclick=joinRoom;$("startBtn").onclick=beginStart;$("leaveBtn").onclick=leaveRoom;
$("copyRoomBtn").onclick=()=>navigator.clipboard?.writeText(room).then(()=>toastMsg("Đã sao chép mã phòng"));
$("gameMenuBtn").onclick=()=> $("gameMenu").classList.toggle("hidden");
$("resumeBtn").onclick=()=>{paused=false;$("gameMenu").classList.add("hidden")};
$("copyGameRoomBtn").onclick=()=>navigator.clipboard?.writeText(room).then(()=>toastMsg("Đã sao chép mã phòng"));
$("leaveGameBtn").onclick=()=>{stopHost();leaveRoom()};
$("roomInput").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));

window.addEventListener("beforeunload",()=>sendWS({type:"leave",room}));
})();
