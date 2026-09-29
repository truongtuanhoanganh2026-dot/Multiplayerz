const Game={
state:Save.load(),canvas:null,ctx:null,last:0,
init(){UI.init();this.canvas=document.getElementById("canvas");this.ctx=this.canvas.getContext("2d");this.resize();addEventListener("resize",()=>this.resize());
document.getElementById("startBtn").onclick=()=>{UI.show("game");Fishing.cast();Audio.beep(500);};
document.getElementById("backLobby").onclick=()=>UI.show("lobby");
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>UI.show(b.dataset.open));
document.querySelectorAll(".closePanel").forEach(b=>b.onclick=()=>UI.show("lobby"));
document.getElementById("resetBtn").onclick=()=>{if(confirm("Xóa toàn bộ tiến trình?"))Save.reset()};
let reel=document.getElementById("reelBtn");["pointerdown"].forEach(ev=>reel.addEventListener(ev,e=>{e.preventDefault();Fishing.press()}));["pointerup","pointercancel","pointerleave"].forEach(ev=>reel.addEventListener(ev,e=>{e.preventDefault();Fishing.release()}));
document.getElementById("skillBtn").onclick=()=>{let id=Skills.data[Math.floor(Math.random()*Skills.data.length)].id;if(Game.state.skill[id]>0){Game.state.skill[id]++;Game.state.skill[id]=Math.min(5,Game.state.skill[id]);Toast.show("⚡ Skill kích hoạt: +sức mạnh tạm thời");setTimeout(()=>{},1)}else Toast.show("Mở skill trong menu KỸ NĂNG");};
requestAnimationFrame(t=>this.loop(t))},
resize(){this.canvas.width=Math.max(320,innerWidth*devicePixelRatio);this.canvas.height=Math.max(240,(innerHeight-58)*devicePixelRatio);this.canvas.style.width="100%";this.canvas.style.height="calc(100svh - 58px)";this.ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)},
loop(t){let dt=Math.min(.033,(t-this.last)/1000||0);this.last=t;Fishing.update(dt);this.draw();UI.update();requestAnimationFrame(x=>this.loop(x))},
draw(){let c=this.ctx,w=innerWidth,h=innerHeight-58;c.clearRect(0,0,w,h);let sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,"#8bdcff");sky.addColorStop(.48,"#39b6d0");sky.addColorStop(.49,"#087e9b");sky.addColorStop(1,"#031f39");c.fillStyle=sky;c.fillRect(0,0,w,h);
c.fillStyle="rgba(255,255,255,.55)";for(let i=0;i<8;i++){let x=(i*180+(performance.now()/35)%180)-50;c.fillRect(x,80+(i%3)*25,90,2)}
c.strokeStyle="rgba(255,255,255,.18)";for(let y=h*.52;y<h;y+=25){c.beginPath();c.moveTo(0,y);c.quadraticCurveTo(w*.25,y-8,w*.5,y);c.quadraticCurveTo(w*.75,y+8,w,y);c.stroke()}
let f=Fishing.fish;if(!f)return;let fx=f.x*w,fy=f.y*h; c.save();c.translate(fx,fy);c.scale(f.dir,1);c.font=`${f.size}px serif`;c.fillText(f.emoji,0,0);c.restore();
c.strokeStyle="#eee";c.lineWidth=2;c.beginPath();c.moveTo(w*.72,0);c.lineTo(w*.72,h*.42);c.lineTo(fx,fy-f.size*.25);c.stroke();c.fillStyle="#ff4d5d";c.beginPath();c.arc(w*.72,h*.42,7,0,Math.PI*2);c.fill();
}}
Game.init();