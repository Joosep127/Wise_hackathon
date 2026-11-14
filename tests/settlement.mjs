import assert from "node:assert/strict";
import { isItemSettled, updateBill } from "../lib/bill.ts";

const item = {id:"pizza",name:"Pizza",cents:1000,quantity:1,category:"Food",weights:{},everyone:false,revision:0};
const drink = {...item,id:"cola",name:"Cola",category:"Drinks",cents:400};
const room = {host:"host",title:"Dinner",currency:"EUR",locked:false,
  people:[{id:"host",name:"Host",paid:false},{id:"guest",name:"Guest",paid:false}],
  items:[item,drink],board:{picks:{},groups:[],paid:{},payments:[]}};
updateBill(room,"host",{action:"shareCategory",category:"Food"},0);
assert.deepEqual(room.board.picks,{host:{pizza:500},guest:{pizza:500}});
assert.equal(isItemSettled(item,room),false,"Reserved shares are not completed payments");
updateBill(room,"guest",{action:"settle",key:"payment",expected:{pizza:500}},1);
assert.equal(isItemSettled(item,room),true,"Host half plus paid guest half covers the item for every viewer");
assert.equal(isItemSettled(drink,room),false);
updateBill(room,"guest",{action:"resetMine"},2);
assert.equal(isItemSettled(item,room),false,"Reversing a demo payment releases the settled state");
console.log("Food split, organiser/guest 50:50 settlement and reset passed.");

const fresh = () => ({host:"host", title:"Undo test", currency:"EUR", locked:false,
  people:structuredClone(room.people), items:[structuredClone(item)],
  board:{picks:{},groups:[],paid:{},payments:[]}});
const edits=fresh();
updateBill(edits,"host",{action:"createGroup",name:"First"},0);
const group=edits.board.groups[0].id;
updateBill(edits,"host",{action:"renameGroup",group,name:"Second"},1);
updateBill(edits,"host",{action:"setGroupItem",group,item:"pizza",cents:500,previous:0},2);
updateBill(edits,"host",{action:"undo"},3);
assert.deepEqual(edits.board.groups[0].items,{});
updateBill(edits,"host",{action:"undo"},4);
assert.equal(edits.board.groups[0].name,"First");
updateBill(edits,"host",{action:"undo"},5);
assert.deepEqual(edits.board.groups,[]);
assert.throws(()=>updateBill(edits,"host",{action:"undo"},6));
updateBill(edits,"host",{action:"createGroup",name:"New"},6);
updateBill(edits,"guest",{action:"select",item:"pizza",cents:200},7);
assert.throws(()=>updateBill(edits,"host",{action:"undo"},8));
updateBill(edits,"host",{action:"createGroup",name:"Another"},8);
updateBill(edits,"host",{action:"undo"},9);
assert.equal(edits.board.picks.guest.pizza,200);
assert.throws(()=>updateBill(edits,"host",{action:"undo"},10));
const closing=fresh();
assert.throws(()=>updateBill(closing,"host",{action:"closeTable"},0));
updateBill(closing,"host",{action:"shareCategory",category:"Food"},0);
assert.throws(()=>updateBill(closing,"host",{action:"closeTable"},1),"Reservations alone do not cover the bill");
updateBill(closing,"guest",{action:"settle",key:"half",expected:{pizza:500}},1);
assert.throws(()=>updateBill(closing,"guest",{action:"closeTable"},2));
updateBill(closing,"host",{action:"closeTable"},2);
assert.equal(closing.locked,true);
assert.equal(closing.board.payments.length,1);
assert.throws(()=>updateBill(closing,"guest",{action:"resetMine"},3));
assert.throws(()=>updateBill(closing,"host",{action:"clearAll"},3));
updateBill(closing,"host",{action:"closeTable"},3);
console.log("Repeated group undo, concurrent-change protection, and completed-table closing passed.");

const added=fresh();
const add={action:"addLine",key:"test-guest-line",name:"  Colas  ",quantity:3,cents:600,category:"Drinks"};
assert.throws(()=>updateBill(added,"host",add,0),"Creators cannot use guest line addition");
for(const invalid of [{quantity:0},{quantity:1.5},{cents:-1},{cents:1.5},{name:" "},{category:"Unknown"}]) {
  assert.throws(()=>updateBill(added,"guest",{...add,...invalid},0));
}
updateBill(added,"guest",add,0);
const newLine=added.items[1];
assert.equal(newLine.name,"Colas");
assert.equal(newLine.quantity,3);
assert.equal(newLine.cents,600);
assert.equal(added.board.picks.guest,undefined,"Adding a line does not automatically reserve it");
updateBill(added,"guest",add,1);
assert.equal(added.items.length,2,"Retrying an addition does not duplicate it");
updateBill(added,"guest",{action:"select",item:newLine.id,cents:200},2);
assert.equal(added.board.picks.guest[newLine.id],200,"One of three units can be selected independently");
updateBill(added,"host",{action:"resetTable",revision:3},3);
assert.equal(added.items.length,1,"Reset restores the original receipt");
assert.throws(()=>updateBill(closing,"guest",add,4),"Closed bills cannot receive new lines");
console.log("Guest lines, validation, idempotency, quantity selection and reset passed.");
