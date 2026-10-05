import {test} from "node:test";
import assert from "node:assert/strict";
import {serverClockOffset,remainingSeconds,countdownCells} from "../src/lib/auction/clock";
import {isActive,type PublicState} from "../src/lib/auction/model";
test("monotonic countdown follows server clock, decrements each second and adopts extended deadline",()=>{
 const offset=serverClockOffset('2026-10-05T01:00:00Z',100,100);
 const end='2026-10-05T01:01:14Z';assert.equal(remainingSeconds(end,100,offset),74);assert.equal(remainingSeconds(end,1100,offset),73);
 assert.deepEqual(countdownCells(25*86400+18*3600+42*60+17),[25,18,42,17]);
 assert.equal(remainingSeconds('2026-10-05T01:03:14Z',1100,offset),193);
 assert.equal(remainingSeconds(end,100000,offset),0);
 const other=serverClockOffset('2026-10-05T01:00:00Z',99999999,99999999);assert.equal(remainingSeconds(end,99999999,other),74);
});
test("waiting state permits first bid only with zero bids and no running dates; preparation remains closed",()=>{
 const state={status:'waiting_for_first_bid',starts_at:null,ends_at:null,bid_count:0} as PublicState;
 assert.ok(isActive(state));assert.ok(!isActive({...state,bid_count:1}));assert.ok(!isActive({...state,status:'ready_for_activation'}));
});
