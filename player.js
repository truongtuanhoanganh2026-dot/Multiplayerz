const Rods=[
{name:"Cần Tre",price:0,power:1,line:100,crit:0},
{name:"Cần Sợi Carbon",price:500,power:1.45,line:120,crit:.04},
{name:"Cần Titan",price:1800,power:2,line:145,crit:.08},
{name:"Cần Hải Vương",price:6500,power:2.8,line:180,crit:.13},
{name:"Cần Leviathan",price:18000,power:4,line:230,crit:.2}
];
const Player={rod(){return Rods[Game.state.rod]},power(){let r=this.rod();return r.power*(1+Game.state.skill.power*.18)},line(){return this.rod().line*(1+Game.state.skill.iron*.15)}};