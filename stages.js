const Stages=[
{name:"Hồ Tân Thủ",cost:0,mult:1},
{name:"Sông Hoang Dã",cost:2500,mult:4},
{name:"Biển Xanh",cost:9000,mult:12},
{name:"Vực Hải Vương",cost:30000,mult:35}
];
const StageManager={unlock(i){if(Game.state.stage>=i)return Toast.show("Đã mở khu vực");if(Game.state.stage!==i-1)return Toast.show("🔒 Hãy mở khu vực trước");let c=Stages[i].cost;if(Game.state.money<c)return Toast.show("💰 Chưa đủ tiền");Game.state.money-=c;Game.state.stage=i;Save.write();Toast.show("🌊 Khu vực mới đã mở!");UI.renderAll()}};