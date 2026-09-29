const FishDB=[
[{name:"Cá Rô",emoji:"🐟",hp:40,reward:25,speed:1.1,size:48},{name:"Cá Chép",emoji:"🐠",hp:70,reward:45,speed:1.35,size:58},{name:"Cá Nóc",emoji:"🐡",hp:110,reward:75,speed:1.6,size:54}],
[{name:"Cá Trắm",emoji:"🐟",hp:220,reward:150,speed:1.5,size:65},{name:"Cá Hồng",emoji:"🐠",hp:350,reward:240,speed:1.8,size:72},{name:"Cá Đuối",emoji:"🦈",hp:550,reward:400,speed:2,size:90}],
[{name:"Cá Kiếm",emoji:"🐟",hp:900,reward:900,speed:2,size:100},{name:"Cá Mập",emoji:"🦈",hp:1500,reward:1500,speed:2.3,size:120},{name:"Cá Vua",emoji:"👑",hp:2800,reward:3000,speed:2.5,size:135}],
[{name:"Quái Ngư",emoji:"🐉",hp:6500,reward:9000,speed:2.8,size:155},{name:"Leviathan",emoji:"🐋",hp:12000,reward:18000,speed:3,size:185}]
];
const Fish={random(stage){let a=FishDB[Math.min(stage,FishDB.length-1)];let base=a[Math.floor(Math.random()*a.length)];return{...base,maxHp:base.hp,hp:base.hp,x:.68+Math.random()*.2,y:.4+Math.random()*.25,dir:Math.random()<.5?-1:1,wiggle:Math.random()*9}}};