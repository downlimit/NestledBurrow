import assert from 'node:assert/strict';
import { createFreshGameSessionState, advanceGameTime, drainAwakeEnergy, hitRuby } from '../src/gameSessionState.js';
import { DEFAULT_GAME_SECONDS_PER_REAL_SECOND, DEFAULT_START_TIME_SECONDS, formatClock, nightTintAlpha } from '../src/gameClock.js';
import { DEFAULT_GAMEPLAY_TUNING } from '../src/debrisConfig.js';

assert.equal(DEFAULT_GAME_SECONDS_PER_REAL_SECOND, 80);
let s=createFreshGameSessionState();
assert.equal(s.gameplay.worldTimeSeconds, DEFAULT_START_TIME_SECONDS);
advanceGameTime(s,1080,1); assert.equal(s.gameplay.worldTimeSeconds-DEFAULT_START_TIME_SECONDS,86400);
s=createFreshGameSessionState(); advanceGameTime(s,45,1); assert.equal(s.gameplay.worldTimeSeconds-DEFAULT_START_TIME_SECONDS,3600);
s=createFreshGameSessionState(); advanceGameTime(s,45,8); assert.equal(s.gameplay.worldTimeSeconds-DEFAULT_START_TIME_SECONDS,28800);
assert.equal(formatClock(0,'ru'),'00:00'); assert.equal(formatClock(21900,'ru'),'06:05'); assert.equal(formatClock(45900,'ru'),'12:45'); assert.equal(formatClock(86340,'ru'),'23:59');
assert.equal(formatClock(0,'en'),'12:00 AM'); assert.equal(formatClock(21900,'en'),'6:05 AM'); assert.equal(formatClock(45900,'en'),'12:45 PM'); assert.equal(formatClock(86340,'en'),'11:59 PM');
assert.equal(nightTintAlpha(8*3600),0); assert.equal(nightTintAlpha(18*3600),0); assert(nightTintAlpha(19.5*3600)>0 && nightTintAlpha(19.5*3600)<0.55); assert.equal(nightTintAlpha(21*3600),0.55); assert.equal(nightTintAlpha(2*3600),0.55); assert(nightTintAlpha(6.5*3600)>0 && nightTintAlpha(6.5*3600)<0.55);
const idle=createFreshGameSessionState(); let drains=0; while(idle.gameplay.currentEnergy>0){drainAwakeEnergy(idle,{amount:1}); drains++;} assert.equal(drains*DEFAULT_GAMEPLAY_TUNING.awakeDrainIntervalSeconds*80,57600);
const legacy=createFreshGameSessionState(); legacy.gameplay={...legacy.gameplay, worldTimeSeconds:undefined, elapsedGameSeconds:10}; const norm=(await import('../src/gameSessionState.js')).normalizeGameSessionState(legacy); assert.equal(norm.gameplay.worldTimeSeconds, DEFAULT_START_TIME_SECONDS+800);
const ruby=createFreshGameSessionState(); for(let i=0;i<4;i++) hitRuby(ruby,'yard-ruby-01',{energyPerHit:4}); assert.equal(ruby.gameplay.rubies,0); assert.equal(ruby.gameplay.currentEnergy,84); assert.equal(hitRuby(ruby,'yard-ruby-01',{energyPerHit:4}).status,'cleared'); assert.equal(ruby.gameplay.rubies,1); assert.equal(ruby.gameplay.wood,0); const before=JSON.stringify(ruby.gameplay); hitRuby(ruby,'yard-ruby-01',{energyPerHit:4}); assert.equal(JSON.stringify(ruby.gameplay),before);
console.log('clock cycle checks passed');
