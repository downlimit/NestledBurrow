(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const needOrder = ['novelty', 'energy', 'satiety', 'toilet', 'lustre', 'dialogue'];
  const needsMeta = {
    novelty: ['N', 'Новизна'], energy: ['E', 'Энергия'], satiety: ['S', 'Сытость'],
    toilet: ['T', 'Туалет'], lustre: ['L', 'Лоск'], dialogue: ['D', 'Общение'],
  };
  const items = {
    axe:['🪓','Топор',1], pickaxe:['⛏️','Кирка',1], hoe:['🪏','Мотыга',1], bucket:['🪣','Ведро',1],
    wood:['🪵','Древесина',10], stone:['🪨','Камень',8], berry:['🫐','Ягоды',6], herb:['🌿','Травы',5],
    fiber:['🧶','Волокно',8], ore:['⛓️','Руда',4], relic:['💠','Реликт',1], ration:['🍱','Паёк',3],
    clay:['🟦','Голубая глина',2], traveler:['🎒','Рюкзак путника',1], spear:['🗡️','Копьё',1],
  };
  const graph = {
    nest:{title:'🪺 Островное Гнездо', tier:0, next:['forest1','mine1']},
    forest1:{title:'🌲 Лес T1', tier:1, next:['forestNpc','forest2']},
    mine1:{title:'⛏️ Шахты T1', tier:1, next:['mineNpc','mine2']},
    forest2:{title:'🌳 Лес T2', tier:2, next:['forest3','forestAuto']},
    mine2:{title:'🕳️ Шахты T2', tier:2, next:['mine3','mineAuto']},
    forestNpc:{title:'🧑 Лесной NPC-сегмент', tier:2, terminal:true, npc:true},
    mineNpc:{title:'🧑 Гротовый NPC-сегмент', tier:2, terminal:true, npc:true},
    forest3:{title:'🌲 Лес T3', tier:3, terminal:true}, forestAuto:{title:'⚙️ Моту', tier:3, terminal:true},
    mine3:{title:'💎 Шахты T3', tier:3, terminal:true}, mineAuto:{title:'⚡ Голубая дыра', tier:3, terminal:true},
  };
  const eventPool = ['timid','rain','traveler','stream','support','clay','camp','cache','beast','quiet'];
  const storageKey = 'nestledBurrow.wildAtollPrototype.gates.v1';
  let persistent = loadPersistent();
  let state;

  function loadPersistent() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { return {}; }
  }
  function savePersistent() { try { localStorage.setItem(storageKey, JSON.stringify(persistent)); } catch {} }
  function rng(seed) {
    let x = 2166136261;
    for (const c of seed) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); }
    return () => ((x = Math.imul(x ^ (x >>> 15), 1 | x)) ^ (x + Math.imul(x ^ (x >>> 7), 61 | x)) >>> 0) / 4294967296;
  }
  function randomChoice(list) { return list[Math.floor(state.random() * list.length)]; }
  function log(text, type='') {
    state.logs.unshift({n: ++state.logId, text, type});
    state.logs.length = Math.min(state.logs.length, 80);
    renderLog();
  }
  function changeNeed(id, delta, reason='') {
    const before = state.needs[id];
    state.needs[id] = clamp(before + delta);
    if (before > 30 && state.needs[id] <= 30) state.crossed[id] = true;
    floatOnNeed(id, delta);
    if (reason) log(`${needsMeta[id][0]} ${delta >= 0 ? '+' : ''}${delta}: ${reason}`, delta < 0 ? 'bad' : 'good');
    if (id === 'toilet' && state.needs.toilet <= 0) accident();
    if (id === 'energy' && state.needs.energy <= 0) collapse();
  }
  function changeItem(id, delta) {
    const before = state.inventory[id] || 0;
    state.inventory[id] = Math.max(0, before + delta);
    floatOnInventory(id, state.inventory[id] - before);
    return state.inventory[id] - before;
  }
  function stacksUsed() {
    return Object.entries(state.inventory).reduce((n,[id,count]) => n + (count ? Math.ceil(count / items[id][2]) : 0), 0);
  }
  function canTake(id, count=1) {
    const used = stacksUsed();
    const current = state.inventory[id] || 0;
    const before = Math.ceil(current / items[id][2]);
    const after = Math.ceil((current + count) / items[id][2]);
    return used - before + after <= 16;
  }
  function take(id, count, label) {
    if (!canTake(id,count)) { log(`Нет свободной ячейки для: ${label || items[id][1]}.`, 'bad'); return false; }
    changeItem(id,count); log(`${items[id][0]} Получено: ${label || items[id][1]} ×${count}.`, 'good'); return true;
  }
  function spend(cost) {
    if (Object.entries(cost).some(([id,n]) => (state.inventory[id]||0) < n)) return false;
    Object.entries(cost).forEach(([id,n]) => changeItem(id,-n)); return true;
  }
  function floatAt(element, text, good=true) {
    if (!element) return;
    const node = document.createElement('span'); node.className = `float-delta ${good?'good':'bad'}`; node.textContent = text;
    element.classList.add('feedback-anchor'); element.appendChild(node); setTimeout(() => node.remove(), 1000);
  }
  function floatOnNeed(id, delta) { floatAt(document.querySelector(`[data-need="${id}"]`), `${delta>0?'+':''}${delta}`, delta>=0); }
  function floatOnInventory(id, delta) { floatAt(document.querySelector(`[data-item="${id}"]`), `${delta>0?'+':''}${delta}`, delta>=0); }

  function newRun() {
    const seed = $('seedInput').value.trim() || `${Date.now()}`;
    $('seedInput').value = seed;
    state = {
      seed, random:rng(seed), runId:Date.now(), segmentId:'nest', segmentPath:['nest'], arenaIndex:0, arenas:[],
      needs:{novelty:76,energy:82,satiety:72,toilet:68,lustre:74,dialogue:58}, crossed:{},
      inventory:{axe:1,pickaxe:1,hoe:1,bucket:1,berry:2,spear:1}, water:0, clay:false,
      logs:[], logId:0, repairedThisRun:{}, companion:null, routeBlocked:false, attached:0, invitations:0,
    };
    generateSegment('nest');
    log(`Новый Атолл: seed ${seed}. План начинается в Гнезде, но события могут его изменить.`, 'system');
    render();
  }

  function generateSegment(id) {
    state.segmentId = id; state.arenaIndex = 0; state.routeBlocked = false;
    const count = 4 + Math.floor(state.random()*3);
    state.arenas = Array.from({length:count}, (_,i) => makeArena(i));
    state.arenas.push({kind:'threshold', title:'🌉 Постоянный порог', resolved:false});
    log(`Вход в сегмент «${graph[id].title}»: ${count} случайных арен и постоянный порог.`, 'system');
  }

  function makeArena(i) {
    const type = randomChoice(eventPool);
    const arena = {type, resolved:false, gathered:false, title:'', text:'', resources:{wood:0,stone:0,berry:0,herb:0,ore:0}};
    const tier = graph[state.segmentId].tier;
    if (type==='timid') Object.assign(arena,{title:'🐿️ Пугливый зверёк у деревьев',text:'Зверёк устроился возле лучших деревьев. Рубка даст древесину, но спугнёт возможность контакта.',resources:{...arena.resources,wood:2+tier}});
    if (type==='rain') Object.assign(arena,{title:'🌧️ Надвигающийся ливень',text:'Дождь наполнит ведро и вернёт лоск, но смоет голубую глину и отнимет энергию.'});
    if (type==='traveler') Object.assign(arena,{title:'🧑 Заблудший путник',text:'Путник может стать гостем таверны или попросить сопровождения, заняв ячейку.'});
    if (type==='stream') Object.assign(arena,{title:'💧 Разлившийся ручей',text:'Можно наполнить ведро, перейти вброд к тайнику или отвести поток, открыв боковую находку.'});
    if (type==='support') Object.assign(arena,{title:'🪨 Треснувшая подпорка',text:'Укрепить путь безопасно или рискнуть обвалом ради дополнительной руды.',resources:{...arena.resources,stone:2+tier,ore:tier>1?1:0}});
    if (type==='clay') Object.assign(arena,{title:'🟦 Голубая глина',text:'Глина конвертирует 40 лоска в маскировку для редкого приручения.'});
    if (type==='camp') Object.assign(arena,{title:'⛺ Заброшенный лагерь',text:'Костёр восстанавливает энергию, но требует древесину и пачкает. Отдых с путником особенно ценен.'});
    if (type==='cache') Object.assign(arena,{title:'🪏 Полузакопанный тайник',text:'Мотыга откроет компактную находку. Можно оставить слот свободным на более редкий предмет.'});
    if (type==='beast') Object.assign(arena,{title:tier>1?'✨ След редкого существа':'🐾 Нора дикого зверя',text:'Ягоды служат приманкой. Глина и запах меняют шанс; охота даёт ресурсы, но снижает общение.'});
    if (type==='quiet') Object.assign(arena,{title:'🌿 Обычная ресурсная поляна',text:'Здесь ничего не навязывается: можно добывать, отдыхать или пройти дальше.',resources:{wood:1+tier,stone:1,berry:2,herb:1}});
    arena.index=i; return arena;
  }

  function travelTo(index) {
    if (index !== state.arenaIndex + 1 && index !== state.arenaIndex - 1) return;
    const back = index < state.arenaIndex;
    changeNeed('energy', back?-3:-2, back?'возврат по пройденному пути':'переход к следующей арене');
    changeNeed('satiety',-1); changeNeed('toilet',-1); changeNeed('dialogue',-1);
    state.arenaIndex = index;
    changeNeed('novelty', back?-1:4);
    render();
  }

  function resolveArena(action) {
    const a = state.arenas[state.arenaIndex];
    if (!a || a.kind==='threshold') return;
    if (a.type==='timid') {
      if (action==='chop') { if (take('wood',5,'древесина')) { changeNeed('energy',-6); changeNeed('lustre',-4); log('Рубка спугнула зверька: ресурс получен, контакт потерян.', 'bad'); } }
      if (action==='bait') { if (!spend({berry:1})) return log('Нужна 1 ягода.', 'bad'); changeNeed('dialogue',10); changeNeed('novelty',8); take('wood',2); log('Зверёк отведён приманкой: контакт сохранён, часть древесины доступна.', 'good'); }
      if (action==='watch') { changeNeed('novelty',14); changeNeed('dialogue',6); log('Наблюдение открыло звериную тропу, но дерево осталось нетронутым.', 'good'); }
    }
    if (a.type==='rain') {
      if (action==='rain') { changeNeed('lustre',25); changeNeed('energy',-7); state.water=8; if(state.clay){state.clay=false;log('Ливень смыл голубую глину.','bad');} }
      if (action==='shelter') { changeNeed('satiety',-5); changeNeed('toilet',-6); changeNeed('novelty',-3); log('Ливень переждан: маскировка сохранена, но ожидание съело запас времени и комфорта.','system'); }
    }
    if (a.type==='traveler') {
      if (action==='card') { if(state.needs.lustre<20)return log('Путник не готов брать визитку при таком лоске.','bad'); state.invitations++; changeNeed('dialogue',18); log('Визитка оставлена: будущий гость таверны без обязательства сопровождения.','good'); }
      if (action==='escort') { if(!take('traveler',1,'рюкзак путника'))return; state.companion='путник'; changeNeed('dialogue',24); log('Путник идёт рядом. Рюкзак занял слот, но совместный отдых станет эффективнее.','system'); }
      if (action==='decline') log('Вы сохранили маршрут и свободные ячейки, но отказались от социальной возможности.','system');
    }
    if (a.type==='stream') {
      if (action==='fill') { state.water=8; changeNeed('toilet',-8); log('Ведро наполнено, питьё ускорило туалетную потребность.','good'); }
      if (action==='ford') { changeNeed('energy',-8); changeNeed('lustre',-10); take('relic',1); log('Переход вброд дал реликт, но стоил сил и лоска.','rare'); }
      if (action==='divert') { if(!spend({stone:2}))return log('Нужно 2 камня для отвода потока.','bad'); take('herb',3); changeNeed('novelty',10); log('Поток отведён: затопленный проход закрыт, зато открылось редкое растение.','rare'); }
    }
    if (a.type==='support') {
      if (action==='brace') { if(!spend({wood:2}))return log('Нужно 2 древесины.','bad'); take('stone',4); log('Подпорка укреплена: безопасная добыча без руды.','good'); }
      if (action==='risk') { changeNeed('energy',-8); take('stone',5); take('ore',2); if(state.random()<.5){state.routeBlocked=true;log('Обвал перекрыл прямой выход: придётся возвращаться или потратить материалы.','bad');} else log('Риск оправдался: руда добыта, выход устоял.','rare'); }
    }
    if (a.type==='clay') {
      if (action==='smear') { if(state.needs.lustre<40)return log('Для маскировки нужно минимум 40 лоска.','bad'); changeNeed('lustre',-40); state.clay=true; log('Голубая глина нанесена: редкое приручение дешевле, но дождь или мытьё её снимут.','rare'); }
      if (action==='take') take('clay',1);
    }
    if (a.type==='camp') {
      if (action==='fire') { if(!spend({wood:3}))return log('Нужно 3 древесины.','bad'); changeNeed('energy',state.companion?24:18); changeNeed('dialogue',state.companion?14:-3); changeNeed('lustre',-10); changeNeed('satiety',-4); }
      if (action==='ration') { if(!spend({ration:1}))return log('Нет пайка.','bad'); changeNeed('satiety',32); changeNeed('energy',10); changeNeed('toilet',-8); }
    }
    if (a.type==='cache') {
      if (action==='dig') { if(!state.inventory.hoe)return; changeNeed('energy',-5); changeNeed('lustre',-6); take(randomChoice(['ore','relic','ration']),1); }
      if (action==='mark') { changeNeed('novelty',6); log('Тайник отмечен на будущее: слот сохранён, мгновенная награда упущена.','system'); }
    }
    if (a.type==='beast') {
      if (action==='tame') { const rare=graph[state.segmentId].tier>1; const cost=state.clay?1:(rare?3:2); if(!spend({berry:cost}))return log(`Нужно ${cost} ягод.`,'bad'); const chance=(state.clay?.85:(rare?.35:.65)) + (state.needs.lustre<25?.1:0); if(state.random()<chance){changeNeed('dialogue',20);changeNeed('novelty',16);state.clay=false;log('Существо приручено и станет новой возможностью дома.','rare');}else log('Приручение не удалось; приманка потрачена, зверь остался настороженным.','bad'); }
      if (action==='hunt') { changeNeed('energy',-9); changeNeed('dialogue',-8); changeNeed('lustre',-12); take('ore',1,'трофей'); }
      if (action==='leave') changeNeed('novelty',4);
    }
    if (a.type==='quiet') {
      if (action==='wood') { changeNeed('energy',-5); changeNeed('lustre',-3); take('wood',5); }
      if (action==='stone') { changeNeed('energy',-6); changeNeed('lustre',-4); take('stone',4); }
      if (action==='forage') { changeNeed('energy',-2); changeNeed('novelty',5); take(randomChoice(['berry','herb','fiber']),2); }
    }
    a.resolved=true; render();
  }

  function collapse() {
    state.needs.energy=25; changeNeed('satiety',-10); changeNeed('toilet',-10); changeNeed('lustre',-8);
    log('Персонаж потерял силы. Прошло два игровых часа; энергия восстановлена до 25, но остальные потребности продолжили меняться.','bad');
  }
  function accident() {
    state.needs.toilet=70; changeNeed('lustre',-45); changeNeed('novelty',-20); if(state.companion)changeNeed('dialogue',-15);
    log('Туалетная потребность переполнилась: T=70, сильная потеря лоска и новизны; при свидетеле пострадало общение.','bad');
  }
  function fieldAction(kind) {
    if (kind==='eat') { if(!spend({berry:2}))return log('Нужно 2 ягоды.','bad'); changeNeed('satiety',18);changeNeed('toilet',-7); }
    if (kind==='wash') { if(state.water<2)return log('В ведре недостаточно воды.','bad');state.water-=2;changeNeed('lustre',18);changeNeed('energy',-2);if(state.clay){state.clay=false;log('Мытьё сняло голубую глину.','bad');} }
    if (kind==='relieve') { changeNeed('toilet',48);changeNeed('lustre',-14);log('Импровизированное облегчение оставило запах, который может повлиять на животных.','system'); }
    if (kind==='rest') { changeNeed('energy',state.companion?14:9);changeNeed('dialogue',state.companion?10:-2);changeNeed('satiety',-3); }
    render();
  }

  function thresholdAction(action, target) {
    const segment=graph[state.segmentId];
    if(action==='totem'){generateSegment('nest');state.segmentPath=['nest'];render();return;}
    if(segment.terminal){ if(segment.npc && action==='attach'){ if(!spend({relic:1}))return log('Для присоединения острова нужен 1 реликт.','bad');state.attached++;log('Остров NPC присоединён к Анклаву.','rare');} generateSegment('nest');state.segmentPath=['nest'];render();return; }
    const progress=persistent[state.segmentId]||0;
    if(action==='repair'){
      if(state.repairedThisRun[state.segmentId])return log('На этой площадке уже выполнен этап в текущем забеге.','bad');
      const costs=progress===0?{wood:6,stone:4}:{fiber:3,ore:2,relic:1};
      if(!spend(costs))return log(`Для этапа ремонта не хватает: ${Object.entries(costs).map(([id,n])=>`${items[id][0]}${n}`).join(' ')}`,'bad');
      persistent[state.segmentId]=progress+1;state.repairedThisRun[state.segmentId]=true;savePersistent();changeNeed('energy',-14);changeNeed('lustre',-8);
      log(`Площадка: выполнен этап ${progress+1}/2. Продолжение потребует нового забега.`,'system');render();return;
    }
    if(action==='go'){
      if((persistent[state.segmentId]||0)<2)return log('Транспортная площадка ещё не восстановлена.','bad');
      state.segmentPath.push(target);changeNeed('energy',-4);changeNeed('satiety',-2);changeNeed('toilet',-2);generateSegment(target);render();
    }
  }

  function actionButton(label, note, fn, disabled=false, cls='') {
    const b=document.createElement('button');b.className=cls;b.disabled=disabled;b.innerHTML=`${label}<small>${note}</small>`;b.onclick=fn;return b;
  }
  function renderNeeds() {
    $('needs').innerHTML='';
    needOrder.forEach(id=>{const [symbol,label]=needsMeta[id],v=Math.round(state.needs[id]);const d=document.createElement('div');d.className=`need ${v<15?'critical':v<30?'low':''}`;d.dataset.need=id;d.innerHTML=`<div class="need-head"><span>${symbol} · ${label}</span><strong>${v}</strong></div><div class="bar"><i style="width:${v}%"></i></div><div class="need-note">${v<30?'давление влияет через действия и события':'стабильно'}</div>`;$('needs').appendChild(d);});
  }
  function renderInventory() {
    const entries=[];Object.entries(state.inventory).forEach(([id,count])=>{for(let left=count;left>0;left-=items[id][2])entries.push({id,count:Math.min(left,items[id][2])});});
    const make=(count,start,cls)=>{const grid=document.createElement('div');grid.className=`slot-grid ${cls}`;for(let i=0;i<count;i++){const e=entries[start+i];const s=document.createElement('div');s.className=`slot compact ${e?'filled':'empty'}`;if(e){s.dataset.item=e.id;s.innerHTML=`<span class="slot-index">${i+1}</span><strong>${items[e.id][0]}</strong><small>${e.count}</small>`;}else s.innerHTML=`<span class="slot-index">${i+1}</span>`;grid.appendChild(s);}return grid;};
    $('inventory').innerHTML='<div class="slot-zone-head"><span>Мирные ячейки</span><span>10</span></div>';$('inventory').appendChild(make(10,0,'peaceful-grid'));
    const h=document.createElement('div');h.className='slot-zone-head';h.innerHTML='<span>Боевые numbered-ячейки</span><span>6</span>';$('inventory').appendChild(h);$('inventory').appendChild(make(6,10,'combat-grid'));
    $('baitSummary').innerHTML=`🫐 Приманки: <strong>${state.inventory.berry||0}</strong> · 🪣 вода: <strong>${state.water}/8</strong>`;
  }
  function renderArena() {
    const a=state.arenas[state.arenaIndex],root=$('arena');root.innerHTML='';
    const title=document.createElement('div');title.className='arena-title';title.innerHTML=`<div><h2>${a.title}</h2><div class="subtitle">${graph[state.segmentId].title} · арена ${state.arenaIndex+1}/${state.arenas.length}</div></div>`;root.appendChild(title);
    if(a.kind==='threshold'){renderThreshold(root);return;}
    const p=document.createElement('p');p.className='arena-copy';p.textContent=a.text;root.appendChild(p);
    const grid=document.createElement('div');grid.className='action-grid';
    const add=(l,n,k,dis=false,c='')=>grid.appendChild(actionButton(l,n,()=>resolveArena(k),dis,c));
    if(a.type==='timid'){add('🪓 Рубить','5 древесины; зверёк убежит','chop');add('🫐 Отвести ягодой','−1 ягода; контакт + часть древесины','bait',(state.inventory.berry||0)<1);add('🔭 Наблюдать','новизна и общение; без древесины','watch');}
    if(a.type==='rain'){add('🌧️ Выйти под дождь','лоск + вода; глина смоется','rain');add('🌲 Переждать','сохранить глину; потерять S/T/N','shelter');}
    if(a.type==='traveler'){add('📇 Оставить визитку','будущий гость; нужен L≥20','card',state.needs.lustre<20);add('🎒 Сопроводить','занять ячейку, получить совместный отдых','escort',!canTake('traveler',1),'rare');add('➡️ Отказать','сохранить план и слот','decline');}
    if(a.type==='stream'){add('🪣 Наполнить ведро','8 воды; T снизится','fill');add('🌊 Перейти вброд','E/L цена → реликт','ford',!canTake('relic',1),'rare');add('🪨 Отвести поток','−2 камня → травы и новизна','divert',(state.inventory.stone||0)<2);}
    if(a.type==='support'){add('🪵 Укрепить','−2 древесины → безопасный камень','brace',(state.inventory.wood||0)<2);add('⛏️ Рискнуть','камень + руда; возможен завал','risk',false,'rare');}
    if(a.type==='clay'){add('🟦 Измазаться','−40 L → маскировка','smear',state.needs.lustre<40||state.clay,'rare');add('🟦 Взять порцию','занять место переносимой глиной','take',!canTake('clay',1));}
    if(a.type==='camp'){add('🔥 Развести костёр','−3 древесины → E; L/S цена','fire',(state.inventory.wood||0)<3);add('🍱 Съесть паёк','S/E вверх, T вниз','ration',(state.inventory.ration||0)<1);}
    if(a.type==='cache'){add('🪏 Вскопать','E/L цена → случайная находка','dig');add('🗺️ Отметить','сохранить слот, получить N','mark');}
    if(a.type==='beast'){add('🫐 Приручить',`ягоды; ${state.clay?'глина усиливает шанс':'обычный шанс'}`,'tame',(state.inventory.berry||0)<1,'rare');add('🗡️ Охотиться','трофей; E/L/D цена','hunt');add('➡️ Оставить','сохранить ресурсы','leave');}
    if(a.type==='quiet'){add('🪓 Добыть дерево','−E/L → 5 древесины','wood');add('⛏️ Добыть камень','−E/L → 4 камня','stone');add('🌿 Собирать','−E, +N → случайный ресурс','forage');}
    root.appendChild(grid);
  }
  function renderThreshold(root) {
    const seg=graph[state.segmentId],progress=persistent[state.segmentId]||0;
    const card=document.createElement('div');card.className='event-card';card.innerHTML=`<strong>🗿 Тотем возврата</strong><br>Мгновенно возвращает в Гнездо.<br><br><strong>🛠️ Транспортная площадка</strong><br>${seg.terminal?'Терминальная ветка.':`Ремонт: ${progress}/2; один этап на забег.`}`;root.appendChild(card);
    const grid=document.createElement('div');grid.className='action-grid';grid.appendChild(actionButton('🗿 В Гнездо','завершить текущую ветвь',()=>thresholdAction('totem')));
    if(seg.terminal){if(seg.npc)grid.appendChild(actionButton('🏝️ Присоединить остров','нужен 1 реликт',()=>thresholdAction('attach'),false,'rare'));grid.appendChild(actionButton('✅ Завершить ветвь','вернуться в Гнездо',()=>thresholdAction('finish')));}
    else {grid.appendChild(actionButton('🛠️ Чинить площадку',progress===0?'6 дерева + 4 камня':'3 волокна + 2 руды + 1 реликт',()=>thresholdAction('repair'),progress>=2||state.repairedThisRun[state.segmentId]));if(progress>=2)seg.next.forEach(id=>grid.appendChild(actionButton(`➡️ ${graph[id].title}`,'перейти в следующий сегмент',()=>thresholdAction('go',id),false,'rare')));}
    root.appendChild(grid);
  }
  function renderMap() {
    $('map').innerHTML='';state.arenas.forEach((a,i)=>{const n=document.createElement('div');n.className=`node ${i===state.arenaIndex?'current':i<state.arenaIndex?'visited':i===state.arenaIndex+1?'reachable':''}`;n.innerHTML=`<strong>${a.title}</strong><span class="mini">${i===state.arenaIndex?'вы здесь':i<state.arenaIndex?'пройдено':i===state.arenaIndex+1?'доступно':'впереди'}</span>`;if(i===state.arenaIndex+1)n.onclick=()=>travelTo(i);if(i===state.arenaIndex-1){n.classList.add('back');n.onclick=()=>travelTo(i);}$('map').appendChild(n);});
    $('segmentDepth').textContent=`T${graph[state.segmentId].tier}`;$('segmentHint').textContent=graph[state.segmentId].terminal?'Терминальная ветвь возвращает в Гнездо.':'Порог помнит ремонт между забегами.';
  }
  function renderField() {
    const r=$('fieldActions');r.innerHTML='';r.appendChild(actionButton('🫐 Съесть 2 ягоды','+S, −T',()=>fieldAction('eat'),(state.inventory.berry||0)<2));r.appendChild(actionButton('🪣 Ополоснуться','−2 воды → +L, −E',()=>fieldAction('wash'),state.water<2));r.appendChild(actionButton('🌳 Отойти в кусты','+T, −L; оставить запах',()=>fieldAction('relieve')));r.appendChild(actionButton('🧘 Передохнуть',state.companion?'+E и +D со спутником':'+E, но немного −D',()=>fieldAction('rest')));
  }
  function renderBuffs() {$('buffs').innerHTML=[state.clay?'<div class="buff rare">🟦 Голубая глина: улучшает приручение, смывается водой.</div>':'',state.companion?'<div class="buff">🧑 Спутник: усиливает совместный отдых, рюкзак занимает слот.</div>':'',state.routeBlocked?'<div class="buff bad">🪨 Завал: прямой план сорван.</div>':''].join('')||'<span class="subtitle">Нет активных последствий.</span>';}
  function renderRoute() {$('routeStrip').innerHTML=state.segmentPath.map((id,i)=>`<span class="route-chip ${i===state.segmentPath.length-1?'current':''}">${graph[id].title}</span>`).join(' → ');}
  function renderLog() {$('log').innerHTML=state.logs.map(x=>`<div class="log-entry ${x.type}"><span class="n">${String(x.n).padStart(3,'0')}</span> ${x.text}</div>`).join('');}
  function render() {renderNeeds();renderInventory();renderArena();renderMap();renderField();renderBuffs();renderRoute();renderLog();$('bingos').innerHTML='<div class="bingo"><div class="bingo-title">План → событие → пересборка</div><p>Макет оценивает не идеальные шкалы, а последствия решений и возможность продолжить выбранную цель.</p></div>';$('bingoScore').textContent=`островов ${state.attached}`;}

  $('newRunBtn').onclick=newRun;$('returnBtn').onclick=()=>{generateSegment('nest');state.segmentPath=['nest'];render();};$('clearLogBtn').onclick=()=>{state.logs=[];renderLog();};
  $('stressNeedsBtn').onclick=()=>{needOrder.forEach(id=>changeNeed(id,-18));render();};$('randomEventBtn').onclick=()=>{state.arenas[state.arenaIndex]=makeArena(state.arenaIndex);log('Событие на текущей арене изменилось.','system');render();};
  $('grantKitBtn').onclick=()=>{[['wood',6],['stone',4],['berry',4],['fiber',3],['ore',2],['relic',1],['ration',1]].forEach(([id,n])=>take(id,n));state.water=8;render();};
  $('revealBtn').onclick=()=>{changeNeed('energy',-3);changeNeed('novelty',10);log('Разведка раскрыла характер оставшихся арен, но не создала абстрактный новый путь.','good');render();};
  $('resetGatesBtn').onclick=()=>{persistent={};savePersistent();log('Постоянный ремонт площадок сброшен.','system');render();};
  $('modalClose').onclick=()=>$('modal').classList.remove('open');$('modalNew').onclick=()=>{$('modal').classList.remove('open');newRun();};
  newRun();
})();
