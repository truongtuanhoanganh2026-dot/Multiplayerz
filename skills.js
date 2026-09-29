const Skills={
data:[
{id:"power",name:"💪 Power Reel",desc:"Tăng sát thương kéo cá.",max:5,base:300},
{id:"lucky",name:"🍀 Lucky Hook",desc:"Tăng tiền nhận được.",max:5,base:450},
{id:"iron",name:"🧵 Iron Line",desc:"Tăng độ bền dây câu.",max:5,base:550},
{id:"frenzy",name:"🔥 Frenzy",desc:"Tăng tốc độ kéo cá.",max:5,base:800}],
cost(s){return Math.round(s.base*Math.pow(1.8,Game.state.skill[s.id]))},
buy(id){let s=this.data.find(x=>x.id===id),lv=Game.state.skill[id];if(lv>=s.max)return Toast.show("Đã đạt cấp tối đa");let c=this.cost(s);if(Game.state.money<c)return Toast.show("💰 Chưa đủ tiền");Game.state.money-=c;Game.state.skill[id]++;Save.write();Toast.show("⚡ Nâng skill thành công!");UI.renderAll()}
};