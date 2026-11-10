import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneyEngine} from '../js/journey-engine.js';
const stations=[{code:'AAA',name:'Alpha'},{code:'BBB',name:'Beta'},{code:'CCC',name:'Gamma'},{code:'AIR',name:'Example International Airport'},{code:'APT',name:'Example Airport Rail'}];
const config={minChangeMinutes:2};
const services=[
{id:'direct',code:'D1',name:'Direct slow',mode:'train',stops:[['AAA',600],['CCC',700]]},
{id:'fast1',code:'F1',name:'Fast first',mode:'train',stops:[['AAA',605],['BBB',625]]},
{id:'fast2',code:'F2',name:'Fast second',mode:'train',stops:[['BBB',627],['CCC',650]]},
{id:'tooquick',code:'F3',name:'Too quick',mode:'train',stops:[['BBB',626],['CCC',640]]},
{id:'airport',code:'A1',name:'Airport rail',mode:'train',stops:[['AAA',600],['APT',620]]},
{id:'plane',code:'E1',name:'Flight',mode:'flight',stops:[['AIR',680],['CCC',710]]}
];
const engine=new JourneyEngine({services,transfers:[['APT','AIR',45],['AIR','APT',45]]},stations,config);
test('direct slow train remains visible with a faster change',()=>{
 const r=engine.journeys('AAA','CCC',600,false,10);
 assert.ok(r.some(x=>x.rides===1&&x.arrive===700),'direct service should remain');
 assert.ok(r.some(x=>x.rides===2&&x.arrive===650),'two-minute connection should work');
 assert.ok(!r.some(x=>x.arrive===640),'one-minute change must not work');
});
test('flights excluded unless opted in',()=>{
 assert.equal(engine.route('AIR','CCC',680,false),null);
 assert.ok(engine.route('AIR','CCC',680,true));
});
test('train to flight airport walk allowance is sixty minutes total',()=>{
 const e=new JourneyEngine({services,transfers:[['APT','AIR',45]]},stations,config);
 const r=e.route('AAA','CCC',600,true);
 assert.ok(r);
 assert.equal(r.arrive,650,'flight at 11:20 must be missed after rail arrives 10:20; faster rail connection wins');
});
test('flight connection minimum is 60 minutes after train arrival',()=>{
 const e=new JourneyEngine({services:[
 {id:'r',code:'R',mode:'train',name:'rail',stops:[['AAA',600],['APT',620]]},
 {id:'f',code:'E',mode:'flight',name:'flight',stops:[['AIR',679],['CCC',700]]}
 ],transfers:[['APT','AIR',45]]},stations,config);
 assert.equal(e.route('AAA','CCC',600,true),null);
});
test('overnight trains preserve chronological time',()=>{
 const e=new JourneyEngine({services:[{id:'night',code:'N',mode:'train',name:'night',stops:[['AAA',1430],['CCC',1460]]}],transfers:[]},stations,config);
 const r=e.route('AAA','CCC',1420,false);
 assert.equal(r.arrive,1460);
});

test('flight at exactly sixty minutes after train arrival is permitted',()=>{
 const e=new JourneyEngine({services:[
 {id:'r',code:'R',mode:'train',name:'rail',stops:[['AAA',600],['APT',620]]},
 {id:'f',code:'E',mode:'flight',name:'flight',stops:[['AIR',680],['CCC',700]]}
 ],transfers:[['APT','AIR',45]]},stations,config);
 const r=e.route('AAA','CCC',600,true);
 assert.ok(r);
 assert.equal(r.arrive,700);
 assert.equal(r.rides,2);
});
test('same-time arrival favours fewer changes',()=>{
 const e=new JourneyEngine({services:[
 {id:'one',code:'D',mode:'train',name:'direct',stops:[['AAA',600],['CCC',700]]},
 {id:'part1',code:'P',mode:'train',name:'part1',stops:[['AAA',600],['BBB',650]]},
 {id:'part2',code:'Q',mode:'train',name:'part2',stops:[['BBB',652],['CCC',700]]}
 ],transfers:[]},stations,config);
 const r=e.route('AAA','CCC',600,false);
 assert.equal(r.rides,1);
});
test('boarding index stores one event per service stop',()=>{
 const e=new JourneyEngine({services:[{id:'multi',code:'M',mode:'train',name:'multi',stops:[['AAA',600],['BBB',620],['CCC',640]]}],transfers:[]},stations,config);
 assert.equal([...e.byStation.values()].reduce((n,events)=>n+events.length,0),2);
 assert.equal(e.route('AAA','CCC',600,false).arrive,640);
});
