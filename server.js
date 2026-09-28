const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const rooms = new Map();
const clients = new Map();

function id(){return Math.random().toString(36).slice(2,10)}
function safeName(s){return String(s||"Player").slice(0,20).replace(/[^\wÀ-ỹ ._-]/g,"")}
function publicPlayers(room){
  const r=rooms.get(room); if(!r)return [];
  return [...r.players.values()].map(p=>({id:p.id,name:p.name,host:p.host}));
}
function send(ws,obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))}
function broadcastRoom(room,obj,except){
  const r=rooms.get(room);if(!r)return;
  r.players.forEach(p=>{if(p.ws!==except)send(p.ws,obj)});
}
function leave(ws){
  const c=clients.get(ws);if(!c)return;
  const r=rooms.get(c.room);
  if(r){
    r.players.delete(c.id);
    if(r.players.size){
      const first=r.players.values().next().value;
      r.players.forEach(p=>p.host=p===first);
      broadcastRoom(c.room,{type:"playerLeft",id:c.id,name:c.name,players:publicPlayers(c.room)});
    }else rooms.delete(c.room);
  }
  clients.delete(ws);
}

const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
const server=http.createServer((req,res)=>{
  let pathname=decodeURIComponent((req.url||"/").split("?")[0]);
  if(pathname==="/")pathname="/index.html";
  const file=path.join(ROOT,path.normalize(pathname));
  if(!file.startsWith(ROOT)){res.writeHead(403);return res.end("Forbidden")}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);return res.end("Not found")}
    res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
    res.end(data);
  });
});

const wss=new WebSocket.Server({server});
wss.on("connection",(ws)=>{
  const client={id:id(),ws,name:"Player",room:null};
  clients.set(ws,client);
  send(ws,{type:"hello",id:client.id});

  ws.on("message",raw=>{
    let m;try{m=JSON.parse(raw.toString())}catch{return}
    if(m.type==="create"){
      const room=String(m.room||"").toUpperCase();
      if(!/^[A-Z0-9]{6}$/.test(room)||rooms.has(room)){send(ws,{type:"error",message:"Phòng không hợp lệ hoặc đã tồn tại"});return}
      client.room=room;client.name=safeName(m.name);
      const players=new Map();players.set(client.id,{id:client.id,ws,name:client.name,host:true});
      rooms.set(room,{players});
      send(ws,{type:"roomCreated",room,players:publicPlayers(room)});
      return;
    }
    if(m.type==="join"){
      const room=String(m.room||"").toUpperCase(),r=rooms.get(room);
      if(!r){send(ws,{type:"error",message:"Không tìm thấy phòng"});return}
      if(r.players.size>=4){send(ws,{type:"error",message:"Phòng đã đủ 4 người"});return}
      client.room=room;client.name=safeName(m.name);
      r.players.set(client.id,{id:client.id,ws,name:client.name,host:false});
      const existing=[...r.players.values()].filter(p=>p.id!==client.id).map(p=>({id:p.id,name:p.name}));
      send(ws,{type:"roomJoined",room,players:publicPlayers(room),peers:existing});
      broadcastRoom(room,{type:"playerJoined",id:client.id,name:client.name,players:publicPlayers(room)},ws);
      return;
    }
    if(m.type==="signal"){
      const r=rooms.get(client.room);if(!r)return;
      const target=r.players.get(m.to);if(!target)return;
      send(target.ws,{type:"signal",from:client.id,name:client.name,data:m.data});
      return;
    }
    if(m.type==="start"){
      const r=rooms.get(client.room);if(!r)return;
      const me=r.players.get(client.id);if(!me?.host)return;
      broadcastRoom(client.room,{type:"start",state:m.state});
      return;
    }
    if(m.type==="leave")leave(ws);
  });
  ws.on("close",()=>leave(ws));
});

server.listen(PORT,"0.0.0.0",()=>console.log(`Zombie Multiplayer: http://0.0.0.0:${PORT}`));
