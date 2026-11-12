import test from 'node:test';
import assert from 'node:assert/strict';
import {trace,balance,transfers} from '../frontend/src/money-trail-data.js';
test('traces forward in time and reports hop depths',()=>{const t=trace('bakery',transfers);assert.deepEqual(t.map(r=>r.depth),[1,1,2]);assert.equal(t[2].to,'endpoint');});
test('does not follow earlier transfers or recurse forever on cycles',()=>{const rows=[{from:'a',to:'b',minute:10},{from:'b',to:'a',minute:11},{from:'b',to:'z',minute:9}];const t=trace('a',rows);assert.equal(t.length,2);assert.equal(t[1].cycle,true);assert.equal(trace('a',rows,1).length,1);});
test('reconciles money without counting downstream transfers twice',()=>{assert.equal(balance('bakery',2000000,12400000,transfers),9000000);assert.equal(balance('receiver',0,0,transfers),300000);assert.deepEqual(trace('endpoint',transfers),[]);assert.deepEqual(trace('bakery',[]),[]);});
