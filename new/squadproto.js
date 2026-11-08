/* =============================================================================
   squadproto.js  -  self-contained port of combat.js for squadproto.html
   -----------------------------------------------------------------------------
   Nothing is imported from combat.js, so this file can replace it outright.
   It keeps the same exports (combatTick, advanceWave, assignEnemySkills) and the
   same window hooks (window.combatTick, window.updateModifiers) that
   combatDictionary.js / modifier.js rely on.

   COPIED VERBATIM from combat.js (game logic, untouched):
     combatTick, executeAutoAction, executeBoth, executeSpecialAction, advanceWave,
     waveCalc, assignEnemySkills, frontTest, clearLogs, initializeCombatFromSquad,
     unitLookup, updateInspectorUnits, renderUnitDetails, alterDesc, updateModifiers,
     initTabSwitching, initInspectorControls, initSpeedControls, syncTimerUI.

   ADAPTED for the rotated-grid layout (display only):
     updateBattleDisplay / renderUnitCard / renderUnitStats  -> place units in grid slots
     updateTimersOnly                                        -> targets the mock's .bar.timer
     startup wiring                                          -> builds missing UI, resets grids

   NEW (clearly marked "NEW" below): slot assignment, zone geometry (layoutBattlefield),
   pan/zoom camera (initMapView), draggable side columns (initPanelResizers),
   mobile bottom sheet (initBottomSheet), ensureUI(), spawnUnit().
   ============================================================================= */
import { DexSoldier } from './unit/dexSoldier.js';
import { FourArcher } from './unit/fourArcher.js';
import { Mannequin } from './unit/mannequin.js';
import { Silhouette } from './unit/silhouette.js';
import { Doctor } from './unit/doctor.js';
import { Detective } from './unit/detective.js'
import { Electric } from './unit/electric.js';
import { ClassicJoy } from './unit/classicJoy.js';
import { enemy } from './unit/enemy.js';
import { ArtificialSoldier } from './unit/artificialSoldier.js';
import { CouncilMagician } from './unit/councilMagician.js';
import { CouncilScientist } from './unit/councilScientist.js';
import { Experiment } from './unit/experiment.js';
import { Reject } from './unit/reject.js';
import { Revolutionary } from './unit/revolutionary.js';
/*import { mysticEnemy } from './unit/mysticEnemy.js';
import { technoEnemy } from './unit/technoEnemy.js';
import { magitechEnemy } from './unit/magitechEnemy.js';
import { ChaosAgent } from './unit/chaosAgent.js';
import { Dreamer } from './unit/dreamer.js';*/
import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from './combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from './modifier.js';
import { Unit, createUnit, cloneUnit } from './unit/unit.js';
let turnCounter = 1;
let wave = 1;

// ---- NEW: battlefield grid state ------------------------------------------------
// Lane keys match the mockup: 'player' = player backline, 'frontline' = shared front,
// 'enemy' = enemy backline. A unit keeps the same slot until it changes lane.
// Base slots per lane = cols x rows. Change these (and the --slot-* tokens in the CSS) and the
// zones, world size and camera fit all follow: see layoutBattlefield().
const BATTLEFIELD = { cols: 6, backRows: 4, frontRows: 6 };
const LANES = {
    player:    { gridId: 'player-grid',    slots: BATTLEFIELD.cols * BATTLEFIELD.backRows },
    frontline: { gridId: 'frontline-grid', slots: BATTLEFIELD.cols * BATTLEFIELD.frontRows },
    enemy:     { gridId: 'enemy-grid',     slots: BATTLEFIELD.cols * BATTLEFIELD.backRows }
};
const grids = {};
const slotOf = new Map();
function initSpeedControls() {
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = '#333';
                b.style.borderColor = '#555';
            });
            btn.classList.add('active');
            btn.style.background = '#060';
            btn.style.borderColor = '#0a0';
            combatSpeedMultiplier[0] = parseFloat(btn.dataset.speed);
        });
    });
}
// ---- NEW: slot helpers ----------------------------------------------------------
const laneOf = unit => unit.position === 'front' ? 'frontline' : unit.team === 'player' ? 'player' : 'enemy';
function makeSlot() {
    const slot = document.createElement('div');
    slot.className = 'grid-slot';
    return slot;
}
// Rebuild each grid with exactly its configured slot count (also discards any units or
// slots that were baked into a saved copy of the page).
function initGrids() {
    for (const [lane, cfg] of Object.entries(LANES)) {
        const grid = document.getElementById(cfg.gridId);
        if (!grid) continue;
        grid.replaceChildren(...Array.from({ length: cfg.slots }, makeSlot));
        grids[lane] = grid;
    }
    slotOf.clear();
}
// Random free slot (same feel as the mock's spawn); grows the grid rather than losing a unit.
function claimSlot(lane, taken) {
    const grid = grids[lane];
    const free = [];
    for (let i = 0; i < grid.children.length; i++) if (!taken.has(i)) free.push(i);
    if (!free.length) {
        grid.appendChild(makeSlot());
        return grid.children.length - 1;
    }
    return free[Math.floor(Math.random() * free.length)];
}
function updateBattleDisplay() {
    updateModifiers();
    updateInspectorUnits();
    if (!Object.keys(grids).length) return;
    for (const unit of [...slotOf.keys()]) if (!allUnits.includes(unit)) slotOf.delete(unit);
    for (const grid of Object.values(grids)) for (const slot of grid.children) slot.replaceChildren();
    const taken = { player: new Set(), frontline: new Set(), enemy: new Set() };
    for (const unit of allUnits) {
        const lane = laneOf(unit), held = slotOf.get(unit);
        if (grids[lane] && held && held.lane === lane && held.index < grids[lane].children.length && !taken[lane].has(held.index)) taken[lane].add(held.index);
        else slotOf.delete(unit);
    }
    for (const unit of allUnits) {
        const lane = laneOf(unit);
        if (!grids[lane]) continue;
        if (!slotOf.has(unit)) {
            const index = claimSlot(lane, taken[lane]);
            taken[lane].add(index);
            slotOf.set(unit, { lane, index });
        }
        grids[lane].children[slotOf.get(unit).index].appendChild(renderUnitCard(unit));
    }
}
function renderUnitCard(unit) {
    const card = document.createElement('div');
    const isDefeated = unit.hp <= 0;
    const isCurrentTurn = unit.name === currentAction[0]?.[1].name;
    const isStunned = unit.stun;
    const isSpecialReady = unit.specialReady && !isDefeated;
    card.className = `unit ${unit.team === 'player' ? 'player-unit' : 'enemy-unit'} ${unit.position === 'back' ? 'back' : ''} ${isDefeated ? 'defeated' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isStunned ? 'stunned' : ''} ${isSpecialReady ? 'special-ready' : ''}`;
    let indicators = '';
    if (isStunned) indicators += '<div class="stun-indicator">STUNNED</div>';
    if (isCurrentTurn) indicators += '<div class="turn-indicator">▶</div>';
    card.innerHTML = `
        ${indicators}
        <div class="unit-name">${unit.name}</div>
        ${renderUnitStats(unit)}
    `;
    card.title = unitTooltip(unit);
    if (unit.team === 'player') card.addEventListener('click', () => {
        unit.isExpanded = !unit.isExpanded;
        updateInspectorUnits();
        if (unit.isExpanded && window.squadSheet?.isMobile()) window.squadSheet.show('right');   // NEW: reveal it on phones
    });
    return card;
}
// Cards are too small for text rows, so the numbers combat.js printed on player cards
// ("HP: x/y" ...) move to a hover tooltip. Enemy numbers stay hidden, as before.
function unitTooltip(unit) {
    if (unit.hp <= 0) return `${unit.name} - DEFEATED`;
    if (unit.team !== 'player') return unit.name;
    const parts = [`HP: ${Math.max(0, unit.hp)}/${unit.base.hp}`, `Stamina: ${Math.floor(unit.stamina)}/${unit.base.stamina}`];
    if (unit.base.mana) parts.push(`Mana: ${Math.floor(unit.mana)}/${unit.base.mana}`);
    if (unit.base.energy) parts.push(`Energy: ${Math.floor(unit.energy)}/${unit.base.energy}`);
    parts.push(unit.timer <= 0 ? 'Ready!' : 'Charging...');
    return `${unit.name}\n${parts.join('\n')}`;
}
function renderUnitStats(unit) {
    if (unit.hp <= 0) return '';
    const pct = (value, max) => Math.max(0, Math.min(100, (value / max) * 100));
    const bar = (kind, percent) => `<div class="bar-wrapper"><div class="bar ${kind}" style="width: ${percent}%"></div></div>`;
    let bars = bar('hp', pct(unit.hp, unit.base.hp)) + bar('stamina', pct(unit.stamina, unit.base.stamina));
    if (unit.base.mana) bars += bar('mana', pct(unit.mana, unit.base.mana));
    if (unit.base.energy) bars += bar('energy', pct(unit.energy, unit.base.energy));
    bars += bar('timer', Math.max(0, Math.min(100, 100 - (unit.timer / 10))));
    return `<div class="bars-container">${bars}</div>`;
}
function updateInspectorUnits() {
    const inspectorList = document.getElementById('inspector-unit-list');
    if (!inspectorList) return;
    const playerUnits = allUnits.filter(u => u.team === 'player');
    if (playerUnits.length === 0) return inspectorList.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">No units in battle</p>';
    inspectorList.innerHTML = '';
    playerUnits.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'inspector-unit-card';
        card.dataset.unitName = unit.name;
        unit.isExpanded ? card.classList.add('expanded') : card.classList.remove('expanded');
        card.innerHTML = `
            <div class="inspector-unit-header">
                <span class="inspector-unit-name">${unit.name}</span>
                <span class="inspector-unit-status ${unit.specialReady ? 'ready' : ''}">${unit.specialReady ? 'READY' : (unit.hp <= 0 ? 'DEFEATED' : 'Charging...')}</span>
            </div>
            <div class="inspector-mini-bars">
                <div>HP: ${Math.round(unit.hp)} / ${Math.round(unit.base.hp)}</div>
                <div>Stamina: ${Math.round(unit.stamina)} / ${Math.round(unit.base.stamina)}</div>
                ${unit.base.mana ? `<div>Mana: ${Math.round(unit.mana)} / ${Math.round(unit.base.mana)}</div>` : ''}
                ${unit.base.energy ? `<div>Energy: ${Math.round(unit.energy)} / ${Math.round(unit.base.energy)}</div>` : ''}
                <div>Timer: ${Math.round(100 - (unit.timer / 10))}%</div>
                <div>Mode: ${unit.autoBehavior || 'basic'}</div>
            </div>
            <div class="inspector-unit-details">
                ${renderUnitDetails(unit)}
            </div>
        `;
        card.addEventListener('click', () => {
            unit.isExpanded = !unit.isExpanded;
            card.classList.toggle('expanded');
        });
        inspectorList.appendChild(card);
    });
}
function renderUnitDetails(unit) {
    let html = `
        <div style="margin-top:10px; padding:10px; background:#0a0a0a; border:1px solid #333;">
        <div style="font-size:12px; color:#888; margin-bottom:5px;">CURRENT STATS</div>
        <div style="font-size:11px; color:#00ff88; line-height: 1.5;">
            <span style="white-space: nowrap;">Attack: ${Math.round(unit.attack)}</span> | <span style="white-space: nowrap;">Defense: ${Math.round(unit.defense)}</span> | <span style="white-space: nowrap;">Accuracy: ${Math.round(unit.accuracy)}</span> | 
            <span style="white-space: nowrap;">Evasion: ${Math.round(unit.evasion)}</span> | <span style="white-space: nowrap;">Focus: ${Math.round(unit.focus)}</span> | <span style="white-space: nowrap;">Resist: ${Math.round(unit.resist)}</span> | 
            <span style="white-space: nowrap;">Speed: ${Math.round(unit.speed)}</span> | <span style="white-space: nowrap;">Presence: ${Math.round(unit.presence)}</span> | <span style="white-space: nowrap;">Heal Factor: ${Math.round(unit.healFactor)}</span> | 
            <span style="white-space: nowrap;">Stamina Regen: ${Math.round(unit.staminaRegen)}</span>${unit.mana ? ` | <span style="white-space: nowrap;">Mana Regen: ${Math.round(unit.manaRegen)}</span>` : ''}${unit.energy ? ` | <span style="white-space: nowrap;">Energy Regen: ${Math.round(unit.energyRegen)}</span>` : ''}
        </div>
    </div>
        <div style="margin-top:10px;">
            <div style="font-size:12px; color:#888; margin-bottom:5px;">AUTO-BEHAVIOR</div>
            <div class="doctrine-toggle">
                ${unit.skills?.basic ? `<button class="doctrine-btn ${unit.autoBehavior === 'basic' ? 'active' : ''}" data-behavior="basic" data-unit="${unit.name}">Basic</button>` : ''}
                ${unit.skills?.secondary ?`<button class="doctrine-btn ${unit.autoBehavior === 'secondary' ? 'active' : ''}" data-behavior="secondary" data-unit="${unit.name}">Secondary</button>` : ''}
                ${unit.skills?.basic && unit.skills?.secondary ?`<button class="doctrine-btn ${unit.autoBehavior === 'both' ? 'active' : ''}" data-behavior="both" data-unit="${unit.name}">Both</button>` : ''}
                ${`<button class="doctrine-btn ${unit.autoBehavior === 'none' ? 'active' : ''}" data-behavior="none" data-unit="${unit.name}">None</button>`}
            </div>
        </div>
    `;
    if (unit.skills?.special && unit.hp > 0) html += `
            <button class="activate-special-btn" data-unit="${unit.name}" ${!unit.specialReady || !(unit.stamina >= (unit.skills.special.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.special.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.special.cost?.energy || 0)) ? 'disabled' : ''}>
                ⚡ Activate Special: ${unit.skills.special.name}
            </button>
        `;
    html += `<div style="margin-top:10px; font-size:11px; color:#888;">EQUIPPED SKILLS:</div>`;
    const skills = ["special", "basic", "secondary", "passive", "augment", "conditional"];
    unit.skills ? Object.entries(unit.skills).sort((a, b) => skills.indexOf(a[0])-skills.indexOf(b[0])).forEach(([category, skill]) => html += `<br><div style="font-size:11px; color:#00aaff; margin:3px 0;" class="skillName">• ${skill.name}<span class="skillDesc">${alterDesc(skill, category)}</span></div>`) : html += `<div style="font-size:11px; color:#666;">No skills equipped</div>`;
    return html;
}
function alterDesc(skill, category) {
    if (!skill.description) return '';
    let desc = '';
    if (skill.reduction) {
        desc += "Reduce ";
        for (const stat in skill.reduction) desc += ['hp', 'stamina', 'mana', 'energy'].includes(stat) ? `max ${stat === 'hp' ? 'HP' : capital(stat)} by ${skill.reduction[stat]}, ` : `base ${capital(stat)} by ${skill.reduction[stat]}, `;
        desc = desc.slice(0, -2) + '<br>';
    }
    if (skill.cost) {
        if (skill.cost.position) desc += `${capital(skill.cost.position)}line only, `;
        const list = Object.keys(skill.cost).filter(s => s !== 'position');
        if (list.length) {
            desc += 'Cost ';
            for (const stat of list) desc += `${skill.cost[stat]} ${capital(stat)}, `;
        }
        desc = desc.slice(0, -2) + '<br>';
    }
    const block = [];
    if (['special', 'basic', 'secondary'].includes(category)) for (const [res, attrib] of [['stamina', 'stamina-block'], ['mana', 'mana-block'], ['energy', 'energy-block']]) if (!(skill.cost && Object.keys(skill.cost).includes(res)) && skill.properties.includes(attrib)) block.push(res);
    if (block.length) {
        desc += "Blocks next turn's regeneration of ";
        for (const stat of block) desc += `${capital(stat)}, `;
        desc = desc.slice(0, -2) + '<br>';
    }
    return desc + skill.description.replace(/\n/g, '<br>');
}
function updateModifiers() {
    const modifiersContent = document.getElementById('modifiers-content');
    if (!modifiersContent || !modifiersContent.parentElement.classList.contains("active")) return;
    //const down = (modifiersContent.scrollHeight - modifiersContent.scrollTop - modifiersContent.clientHeight) <= 90, scroll = modifiersContent.scrollTop;
    let modDisplay = `<h3 style="border-bottom:2px solid #ff0055; padding-bottom:5px; margin-bottom:10px;">Active Modifiers</h3>`;
    if (modifiers.length === 0) modDisplay += `<p style="color:#888;">No active modifiers</p>`;
    else {
        modDisplay += `<ul class='modifier-list'>`;
        for (const modifier of modifiers) {
            const isCancelled = modifier.vars.cancel > 0;
            let targetDisplay = 'N/A';
            let fullTargets = '';
            if (modifier.vars?.target) {
                targetDisplay = modifier.vars.target.name;
                fullTargets = modifier.vars.target.name;
            } else if (modifier.vars?.targets?.length) {
                const targetNames = modifier.vars.targets.map(u => u.name);
                fullTargets = comma(targetNames);
                if (targetNames.length > 5) targetDisplay = `<span class="modifier-targets truncated" data-full-targets="${fullTargets}">${targetNames.slice(0, 4).join(', ')}, +${targetNames.length - 4} more</span>`;
                else targetDisplay = fullTargets;
            }
            modDisplay += `
                <li class="modifier-item ${isCancelled ? 'cancelled' : ''}">
                    <span class="modifier-caster">${modifier.vars.caster.name || 'System'}'s</span>
                    <span class="modifier-name" data-tooltip="${modifier.description}">${modifier.name}.</span>
                    <div class="modifier-targets">Targets: ${targetDisplay}</div>
                    <div class="modifier-duration">${modifier.vars.duration || 'indefinite'} turn(s) left</div>
                    ${isCancelled ? '<div class="cancelled-indicator">(CANCELLED)</div>' : ''}
                </li>
            `;
        }
        modDisplay += `</ul>`;
    }
    modifiersContent.innerHTML = modDisplay;
    //if (!down) modifiersContent.scrollTop = scroll;
}
function initTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => { content.classList.remove('active'); });
            document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
            if (button.innerHTML === "Modifiers") updateModifiers();
        });
    });
}
function initInspectorControls() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('doctrine-btn')) {
            const unit = allUnits.find(u => u.name === e.target.dataset.unit);
            if (unit) {
                unit.autoBehavior = e.target.dataset.behavior;
                logAction(`${unit.name} doctrine set to: ${e.target.dataset.behavior.toUpperCase()}`, 'info');
                updateInspectorUnits();
            }
        }
        if (e.target.classList.contains('activate-special-btn')) {
            const unit = allUnits.find(u => u.name === e.target.dataset.unit);
            if (unit.specialReady) unit.pendingSpecial = true;
        }
    });
}
function updateTimersOnly(units) {
    units.forEach(unit => {
        const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
        const unitCards = document.querySelectorAll('.unit');
        unitCards.forEach(card => {
            if (card.querySelector('.unit-name')?.textContent === unit.name) {
                const timerBar = card.querySelector('.bar.timer');
                if (timerBar) timerBar.style.width = `${timerProgress}%`;
            }
        });
        const inspectorCards = document.querySelectorAll('.inspector-unit-card');
        inspectorCards.forEach(card => {
            if (card.dataset.unitName === unit.name) {
                const timerDiv = Array.from(card.querySelectorAll('.inspector-mini-bars div')).find(div => div.textContent.startsWith('Timer:'));
                if (timerDiv) timerDiv.textContent = `Timer: ${Math.round(timerProgress)}%`;
            }
        });
    });
}
const syncTimerUI = (aliveUnits) => {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            updateTimersOnly(aliveUnits);
            resolve();
        });
    });
};
export async function combatTick() {
    updateBattleDisplay();
    await new Promise(resolve => setTimeout(resolve, 500 / (combatSpeedMultiplier[0] || 1)));
    if (frontTest()) return;
    let turn;
    let isSpecialInterrupt = false;
    const specialUnit = allUnits.find(u => u.hp > 0 && u.pendingSpecial);
    if (specialUnit) {
        turn = specialUnit;
        specialUnit.pendingSpecial = false;
        isSpecialInterrupt = true;
    } else {
        const alive = allUnits.filter(u => u.hp);
        while (turn == undefined) {
            const list = alive.filter(u => u.timer <= 0);
            let pend;
            if (!list.length) for (const unit of alive) {
                unit.timer -= unit.speed;
                if (unit.pendingSpecial) pend = true;
            } else turn = list.reduce((low, cur) => cur.timer < low.timer ? cur : low);
            if (pend) return combatTick()
            await syncTimerUI(alive);
            await new Promise(resolve => setTimeout(resolve, 120 / (combatSpeedMultiplier[0] || 1)));
        }
        logAction(`<strong>Turn ${turnCounter++}: ${turn.name}'s turn</strong>`, 'turn');
        if (eventState.turnStart.length) {
            handleEvent('turnStart', { unit: turn });
            if (frontTest()) return;
        }
    }
    if (!turn.stun) {
        regenerateResources(turn);
        updateBattleDisplay();
        if (turn.team === 'player') {
            if (isSpecialInterrupt) {
                if (turn.skills.special) executeSpecialAction(turn, turn.skills.special);
                else {
                    logAction("Can't find special action!", "error");
                    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
                    setTimeout(combatTick, 500/combatSpeedMultiplier[0]);
                }
            } else {
                const behavior = turn.autoBehavior || (turn.skills.basic ? 'basic' : turn.skills.secondary ? 'secondary' : 'none');
                if (behavior === 'none') {
                    if (eventState.actionStart.length) handleEvent('actionStart', { unit: turn, action: 'skip'});
                    logAction(`${turn.name} is resting!`, 'info');
                    regenerateResources(turn);
                    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
                    setTimeout(combatTick, 500/combatSpeedMultiplier[0]);
                    turn.specialReady = true;
                } else if (behavior === 'both') executeBoth(turn);
                else executeAutoAction(turn, behavior);
            }
        } else enemyTurn(turn);
    } else {
        logAction(`${turn.name}'s turn was skipped due to being stunned!`, 'miss');
        if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
        setTimeout(combatTick, 500/combatSpeedMultiplier[0]);
    }
    turn.timer += 1000;
}
function executeAutoAction(unit, action) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action});
    if (!unit.skills[action].cost || resourceChange(unit, unit.skills[action].cost, false, false)) {
        unit.previousAction = [unit.previousAction[0] || unit.skills[action].properties.includes('stamina-block'), unit.previousAction[1] || unit.skills[action].properties.includes('mana-block'), unit.previousAction[2] || unit.skills[action].properties.includes('energy-block')];
        currentAction.push([unit.skills[action], unit]);
        unit.skills[action].code.call(unit);
        currentAction.pop();
    }
    unit.specialReady = true;
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    setTimeout(combatTick, 500/combatSpeedMultiplier[0]);
}
function executeBoth(unit) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'both'});
    const cost = {};
    for (const [res, attrib] of [['stamina', 'stamina-block'], ['mana', 'mana-block'], ['energy', 'energy-block']]) {
        let count = unit.skills.basic.properties.includes(attrib) + unit.skills.secondary.properties.includes(attrib);
        if (count) cost[res] = count * 10;
        count = ((unit.skills.basic.cost?.[res] || 0) + (unit.skills.secondary.cost?.[res] || 0));
        if (count) cost[res] = (cost[res] || 0) + count;
    }
    if (JSON.stringify(cost) === '{}' || resourceChange(unit, cost, false, false)) {
        unit.previousAction = [true, true, true];
        currentAction.push([unit.skills.basic, unit]);
        unit.skills.basic.code.call(unit);
        currentAction.pop();
        currentAction.push([unit.skills.secondary, unit]);
        unit.skills.secondary.code.call(unit);
        currentAction.pop();
        unit.specialReady = false;
    }
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    setTimeout(combatTick, 500/combatSpeedMultiplier[0]);
}
function executeSpecialAction(unit, specialSkill) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'special'});
    if (specialSkill.target) specialSkill.target.call(unit);
    else {
        if (specialSkill.cost && !resourceChange(unit, specialSkill.cost, false, false)) {
            logAction(`${unit.name}'s special was canceled!`, 'error');
            return setTimeout(combatTick, 2000/combatSpeedMultiplier[0]);
        }
        unit.previousAction = [unit.previousAction[0] || specialSkill.properties.includes('stamina-block'), unit.previousAction[1] || specialSkill.properties.includes('mana-block'), unit.previousAction[2] || specialSkill.properties.includes('energy-block')];
        logAction(`<strong>${unit.name}'s turn (Special Interrupt!)</strong>`, 'turn');
        if (eventState.turnStart.length) handleEvent('turnStart', { unit });
        currentAction.push([specialSkill, unit]);
        specialSkill.code.call(unit);
        currentAction.pop();
        if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    }
    setTimeout(combatTick, 2000/combatSpeedMultiplier[0]);
}
export function advanceWave(x = 0) {
    if (x) wave = x;
    if (wave === 1 || wave === 2) {
        allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === 'player'));
        for (let i = modifiers.length - 1; i >= 0; i--) if (!allUnits.includes(modifiers[i].vars.caster)) removeModifier(modifiers[i]);
    } else return true;
    logAction(`<strong>Wave ${++wave}!</strong>`, 'turn');
    for (const e of waveCalc(allUnits.filter(u => u.team === 'player'), wave-2 ? 1.5 : 1)) {
        const u = createUnit(e, 'enemy');
        assignEnemySkills(u, e);
        if (u.base.position === "mid" && Math.random() < .5) u.switchPosition(true);
    }
    if (eventState.waveChange.length) handleEvent('waveChange', { wave });
    updateBattleDisplay();
}
function waveCalc(units, mult) {
    const total = units.filter(s => !s.custom?.summoner).reduce((sum, u) => sum + (2.25 ** (u.star - 1)), 0) * mult;
    let enemyPoints;
    /*if (total >= 100) {
        enemyPoints = new Map([
            [Dreamer, 729/64], [mysticEnemy, 729/64], [technoEnemy, 729/64],
            [ChaosAgent, 729/64], [magitechEnemy, 6561/256]
        ]);
    } else {
        enemyPoints = new Map([
            [Experiment, 9/4], [Reject, 9/4], [CouncilMagician, 81/16],
            [CouncilScientist, 81/16], [Revolutionary, 81/16], [enemy, 81/16],
            [ArtificialSolider, 81/16], [Dreamer, 729/64], [mysticEnemy, 729/64],
            [technoEnemy, 729/64], [ChaosAgent, 729/64], [magitechEnemy, 6561/256]
        ]);
        if (!units.some(u => +u.description[0] === 5) && wave < 3) {
            enemyPoints.delete(magitechEnemy);
        }
        if (total >= 60) {
            enemyPoints.delete(Experiment);
            enemyPoints.delete(Reject);
        }
    }*/
    const playerPoints = [DexSoldier, FourArcher, Mannequin, Silhouette, Doctor, Detective, Electric, ClassicJoy];
    enemyPoints = [Experiment, Reject, CouncilMagician, CouncilScientist, Revolutionary, enemy, ArtificialSoldier];
    const enemies = [];
    let points = 0;
    const front = [Experiment, Reject, enemy, ArtificialSoldier];
    const frontEnem = front[Math.floor(Math.random() * front.length)];
    enemies.push(frontEnem);
    points += 2.25**(frontEnem.star-1);
    while (points < total) {
        const enem = Math.random() < .5 ? [...enemyPoints, ...playerPoints][Math.floor(Math.random() * (enemyPoints.length+playerPoints.length))] : enemyPoints[Math.floor(Math.random() * enemyPoints.length)], p = 2.25**(enem.star-1);
        if (points + p <= total || (Math.abs(total - points - p) < Math.abs(total - points))) {
            enemies.push(enem);
            points += p;
        } else break;
    }
    return enemies;
}
export function assignEnemySkills(newUnit, template) {
    const categories = ['special', 'basic', 'secondary', 'passive', 'augment', 'conditional'].map(val => ({ val, rand: Math.random() })).sort((a, b) => a.rand - b.rand).map(({ val }) => val);
    const getLoadoutForPosition = (pos) => {
        const defaultLoadout = (pos === 'front' ? template.frontDefaultSkills : template.backDefaultSkills) || template.defaultSkills;
        for (let attempt = 0;; attempt++) {
            const loadout = {};
            const usedNames = new Set();
            let isFullLoadout = true;
            for (const category of categories) {
                const availableSkills = template.skills[category];
                if (!availableSkills) continue;
                const validSkills = availableSkills.filter(skill => (!skill.cost?.position || skill.cost.position === pos) && !usedNames.has(skill.name) );
                let selectedSkill = null;
                if (Math.random() < 0.5 && defaultLoadout) {
                    const defaultDef = defaultLoadout.find(def => def.category === category);
                    if (defaultDef) {
                        const defSkill = availableSkills.find(s => s.name === defaultDef.name);
                        if (defSkill && !usedNames.has(defSkill.name) && (!defSkill.cost?.position || defSkill.cost.position === pos)) selectedSkill = defSkill;
                    }
                }
                if (!selectedSkill && validSkills.length > 0) selectedSkill = validSkills[Math.floor(Math.random() * validSkills.length)];
                if (selectedSkill) {
                    loadout[category] = selectedSkill;
                    usedNames.add(selectedSkill.name);
                } else isFullLoadout = false;
            }
            if (isFullLoadout || attempt === 4) return loadout;
        }
    };
    if (!newUnit) return template.base.position === 'mid' ? [getLoadoutForPosition('front'), getLoadoutForPosition('back')] : getLoadoutForPosition(template.base.position);
    newUnit.skills = {};
    if (template.base.position === 'mid') {
        newUnit.position = 'back'; 
        newUnit.frontSkills = getLoadoutForPosition('front');
        newUnit.backSkills = getLoadoutForPosition('back');
        newUnit.skills = {...newUnit.backSkills};
    } else newUnit.skills = getLoadoutForPosition(newUnit.position);
    (newUnit.traits || []).forEach(s => {
        currentAction.push([s, newUnit]);
        s.code.call(newUnit);
        currentAction.pop();
    });
    (newUnit.synergy || []).forEach(s => {
        currentAction.push([s, newUnit]);
        s.code.call(newUnit);
        currentAction.pop();
    });
    for (const skill of ['passive', 'augment', 'conditional']) {
        if (newUnit.skills[skill]) {
            currentAction.push([newUnit.skills[skill], newUnit]);
            newUnit.skills[skill].code.call(newUnit);
            currentAction.pop();
        }
    }
}
function frontTest() {
    const infinite = false;
    if (infinite) clearLogs();
    if (!allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'player').length) {
        const midLine = allUnits.filter(u => u.hp && u.base.position === 'mid' && u.team === 'player');
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
            logAction(`All player midline units moved to the frontline!`, 'turn');
        } else if (infinite) allUnits.forEach(u => u.team === "player" && hpChange(u, [u], [u.base.hp]));
        else return !!showMessage('Defeat!', 'error', 'message-container', 0);
    }
    if (!allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'enemy').length) {
        const midLine = allUnits.filter(u => u.hp && u.base.position === 'mid' && u.team === 'enemy');
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
            logAction(`All enemy midline units moved to the frontline!`, 'turn');
        } else if (advanceWave(infinite ? 1 : 0) && !allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'enemy').length) return !!showMessage('Victory!', 'success', 'message-container', 0);
    }
}
function clearLogs() {
    const logContainer = document.getElementById('action-log');
    if (!logContainer) return;
    const entries = logContainer.children;
    while (entries.length > (window.innerWidth < 800 ? 1000 : 3000)) logContainer.removeChild(entries[0]);
}
window.combatTick = combatTick;
window.updateModifiers = updateModifiers;
// ---- NEW: zone geometry, solved from the BATTLEFIELD config + CSS size tokens ---------
// Sizes the three rotated zones so every slot sits inside its zone's rounded outline, stacks
// them along the zones' own "down" axis so they never overlap, and sizes the world to the
// outlines plus a margin. Writes --cx/--cy/--w/--h on each zone and width/height on the world.
function layoutBattlefield() {
    const world = document.getElementById('map-world');
    if (!world) return;
    const cs = getComputedStyle(document.documentElement);
    const px = name => parseFloat(cs.getPropertyValue(name)) || 0;
    const sw = px('--slot-w'), sh = px('--slot-h'), gap = px('--slot-gap'), pad = px('--grid-pad');
    const zpad = px('--zone-pad'), zgap = px('--zone-gap'), margin = px('--world-margin');
    const tilt = px('--tilt') * Math.PI / 180;
    const { cols, backRows, frontRows } = BATTLEFIELD;
    const gridW = cols * sw + (cols - 1) * gap + 2 * pad;
    const gridH = rows => rows * sh + (rows - 1) * gap + 2 * pad;

    // Backline zones: flat edge holds the grid, the far end is a half-ellipse (CSS border-radius).
    const backGH = gridH(backRows), backW = gridW * 1.14;
    let backH = backGH + zpad;
    while (((gridW / 2) / (backW / 2)) ** 2 + Math.max(0, (zpad + backGH - backH / 2) / (backH / 2)) ** 2 > 0.97) backH += 4;
    // Frontline: lens-shaped ends (5% / 50% radii); the grid's corners must clear them.
    const frontGH = gridH(frontRows), frontW = gridW * 1.10, rx = frontW * 0.05;
    let frontH = frontGH + 2 * zpad;
    while (gridW / 2 > (frontW / 2 - rx) + rx * Math.sqrt(Math.max(0, 1 - (frontGH / 2 / (frontH / 2)) ** 2)) - 6) frontH += 4;

    // Outline of each zone (local coords, centred) so the world hugs the real shapes.
    const outline = (kind, w, h) => {
        const hw = w / 2, hh = h / 2, pts = [];
        const arc = (cx, cy, ax, ay, a0, a1) => { for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * i / 16; pts.push([cx + ax * Math.cos(a), cy + ay * Math.sin(a)]); } };
        if (kind === 'player') { pts.push([-hw, -hh], [hw, -hh]); arc(0, 0, hw, hh, 0, Math.PI); }
        else if (kind === 'enemy') { pts.push([-hw, hh], [hw, hh]); arc(0, 0, hw, hh, Math.PI, 2 * Math.PI); }
        else { const r = w * 0.05; arc(hw - r, 0, r, hh, -Math.PI / 2, Math.PI / 2); arc(-hw + r, 0, r, hh, Math.PI / 2, 1.5 * Math.PI); }
        return pts;
    };
    const vx = -Math.sin(tilt), vy = Math.cos(tilt), d = frontH / 2 + backH / 2 + zgap;
    const zones = [
        { sel: '.player-backline', kind: 'player', w: backW,  h: backH,  cx:  d * vx, cy:  d * vy },
        { sel: '.frontline',       kind: 'front',  w: frontW, h: frontH, cx: 0,       cy: 0 },
        { sel: '.enemy-backline',  kind: 'enemy',  w: backW,  h: backH,  cx: -d * vx, cy: -d * vy }
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of zones) for (const [x, y] of outline(z.kind, z.w, z.h)) {
        const X = z.cx + x * Math.cos(tilt) - y * Math.sin(tilt), Y = z.cy + x * Math.sin(tilt) + y * Math.cos(tilt);
        minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
    }
    for (const z of zones) {
        const el = world.querySelector(z.sel);
        if (!el) continue;
        el.style.setProperty('--cx', `${(z.cx - minX + margin).toFixed(1)}px`);
        el.style.setProperty('--cy', `${(z.cy - minY + margin).toFixed(1)}px`);
        el.style.setProperty('--w', `${z.w.toFixed(1)}px`);
        el.style.setProperty('--h', `${z.h.toFixed(1)}px`);
    }
    world.style.setProperty('--cols', cols);
    world.style.width = `${Math.ceil(maxX - minX + 2 * margin)}px`;
    world.style.height = `${Math.ceil(maxY - minY + 2 * margin)}px`;
}

// ---- NEW: draggable / collapsible side columns -----------------------------------
// Drag a .col-resizer to resize its panel (dragging far enough collapses it), click its
// chevron or double-click / press Enter on the handle to collapse or grow it, and use the
// arrow keys on a focused handle to nudge. Widths persist in localStorage. The map viewport
// takes the freed/used space and the camera re-fits (or keeps its centre) automatically.
function initPanelResizers() {
    const layout = document.querySelector('.battleground-layout');
    if (!layout || !layout.querySelector('.col-resizer')) return;
    const HANDLE = 14, MIN_W = 200, MAP_MIN = 280, COLLAPSE_BELOW = 110, KEY = 'squadproto.panels.v1';
    const SIDES = ['left', 'right'];
    const state = { left: { w: null, collapsed: false }, right: { w: null, collapsed: false } };
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved) for (const side of SIDES) if (saved[side]) state[side] = { w: Number(saved[side].w) || null, collapsed: !!saved[side].collapsed };
    } catch (_) { /* storage unavailable: defaults */ }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignore */ } };
    const panelWidth = side => parseFloat(getComputedStyle(layout.querySelector(`.${side}-panel`)).width) || 0;
    const maxWidth = side => {                      // never squeeze the map below MAP_MIN
        const other = side === 'left' ? 'right' : 'left';
        const room = layout.clientWidth - (state[other].collapsed ? 0 : panelWidth(other)) - 2 * HANDLE - MAP_MIN;
        return Math.max(MIN_W, Math.min(room, window.innerWidth * 0.4));   // 40vw mirrors the CSS cap
    };
    function apply() {
        for (const side of SIDES) {
            const s = state[side];
            if (s.collapsed) layout.style.setProperty(`--${side}-w`, '0px');
            else if (s.w) layout.style.setProperty(`--${side}-w`, `${s.w}px`);
            else layout.style.removeProperty(`--${side}-w`);
            layout.dataset[side] = s.collapsed ? 'collapsed' : 'open';
            const btn = layout.querySelector(`.panel-toggle[data-side="${side}"]`);
            if (btn) {
                const label = `${s.collapsed ? 'Expand' : 'Collapse'} ${side} panel`;
                btn.innerHTML = (side === 'left') === !s.collapsed ? '&lsaquo;' : '&rsaquo;';
                btn.title = label;
                btn.setAttribute('aria-label', label);
            }
        }
    }
    function setWidth(side, raw, restoreW) {      // restoreW: width to bring back if this collapses it
        const s = state[side];
        if (raw < COLLAPSE_BELOW) { s.collapsed = true; if (restoreW !== undefined) s.w = restoreW; }
        else { s.collapsed = false; s.w = Math.round(clampNum(raw, MIN_W, maxWidth(side))); }
        apply();
    }
    const toggle = side => { state[side].collapsed = !state[side].collapsed; apply(); save(); };

    let drag = null, dragStartW = null;
    layout.querySelectorAll('.col-resizer').forEach(handle => {
        const side = handle.dataset.side;
        handle.addEventListener('pointerdown', e => {
            if (e.target.closest('.panel-toggle') || (e.pointerType === 'mouse' && e.button !== 0)) return;
            drag = e.pointerId;
            dragStartW = state[side].w;
            try { handle.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
            handle.classList.add('dragging');
            document.body.classList.add('resizing');
            e.preventDefault();
        });
        handle.addEventListener('pointermove', e => {
            if (drag !== e.pointerId) return;
            const r = layout.getBoundingClientRect();
            setWidth(side, side === 'left' ? e.clientX - r.left - HANDLE / 2 : r.right - e.clientX - HANDLE / 2, dragStartW);
        });
        const end = e => {
            if (drag !== e.pointerId) return;
            drag = null;
            handle.classList.remove('dragging');
            document.body.classList.remove('resizing');
            save();
        };
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        handle.addEventListener('dblclick', e => { if (!e.target.closest('.panel-toggle')) toggle(side); });
        handle.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(side); return; }
            const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!dir) return;
            e.preventDefault();
            const grow = (side === 'left' ? dir : -dir) * (e.shiftKey ? 96 : 24);
            setWidth(side, (state[side].collapsed ? 0 : panelWidth(side)) + grow, state[side].w);
            save();
        });
    });
    layout.querySelectorAll('.panel-toggle').forEach(btn => btn.addEventListener('click', () => toggle(btn.dataset.side)));
    apply();
}

// ---- NEW: mobile bottom sheet ----------------------------------------------------
// On narrow screens (the CSS @media (max-width: 900px) layout) only ONE side column is shown,
// in a sheet docked to the bottom of the screen under the map. Drag the bar's top edge up or
// down to resize the sheet (drag it all the way down to collapse), tap the grip to collapse /
// reopen it, and use the two tabs to switch between Command & Log and the Inspector. Height,
// tab and open/closed persist. On desktop the bar is hidden and none of this has any effect.
function initBottomSheet() {
    const layout = document.querySelector('.battleground-layout');
    const bar = layout && layout.querySelector('.sheet-bar');
    if (!bar) return;
    const KEY = 'squadproto.sheet.v1', MAP_MIN = 140, SHEET_MIN = 120, COLLAPSE_BELOW = 70, TAP = 6;
    const state = { tab: 'left', h: null, open: true };
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved) {
            if (saved.tab === 'left' || saved.tab === 'right') state.tab = saved.tab;
            state.h = Number(saved.h) || null;
            state.open = saved.open !== false;
        }
    } catch (_) { /* storage unavailable: defaults */ }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignore */ } };
    const maxHeight = () => Math.max(SHEET_MIN, layout.clientHeight - bar.offsetHeight - MAP_MIN);
    const sheetHeight = () => {                       // current height of the sheet row (px)
        const rows = getComputedStyle(layout).gridTemplateRows.split(' ');
        return rows.length === 3 ? parseFloat(rows[2]) || 0 : 0;
    };
    function apply() {
        layout.dataset.sheet = state.tab;
        layout.dataset.sheetOpen = String(state.open);
        if (!state.open) layout.style.setProperty('--sheet-h', '0px');
        else if (state.h) layout.style.setProperty('--sheet-h', `${Math.min(state.h, maxHeight())}px`);
        else layout.style.removeProperty('--sheet-h');
        bar.querySelectorAll('.sheet-tab').forEach(tab => {
            const on = tab.dataset.sheet === state.tab;
            tab.classList.toggle('active', on);
            tab.setAttribute('aria-pressed', String(on));
        });
    }
    function show(tab) { state.tab = tab; state.open = true; apply(); save(); }

    // Move/up are listened for on the window, so a fast flick that leaves the bar (or even the
    // browser window) keeps dragging; touch pointers are implicitly captured anyway.
    let drag = null, suppressClick = false;
    function onMove(e) {
        if (!drag || drag.id !== e.pointerId) return;
        if (!drag.moved) {
            if (Math.abs(e.clientY - drag.y) < TAP) return;
            drag.moved = true;
            bar.classList.add('dragging');
            document.body.classList.add('resizing-y');
        }
        const h = drag.startH + (drag.y - e.clientY);          // dragging up makes the sheet taller
        if (h < COLLAPSE_BELOW) { state.open = false; state.h = drag.restoreH; }   // reopening restores the pre-drag height
        else { state.open = true; state.h = Math.round(clampNum(h, SHEET_MIN, maxHeight())); }
        apply();
    }
    function onUp(e) {
        if (!drag || drag.id !== e.pointerId) return;
        if (drag.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); save(); }
        drag = null;
        bar.classList.remove('dragging');
        document.body.classList.remove('resizing-y');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    }
    bar.addEventListener('pointerdown', e => {
        if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
        drag = { id: e.pointerId, y: e.clientY, startH: state.open ? sheetHeight() : 0, restoreH: state.h, moved: false };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    });
    bar.addEventListener('click', e => {
        if (suppressClick) { e.stopPropagation(); e.preventDefault(); return; }
        const tab = e.target.closest('.sheet-tab');
        if (tab) show(tab.dataset.sheet);
        else { state.open = !state.open; apply(); save(); }    // tap on the grip / empty bar
    }, true);
    window.addEventListener('resize', apply);                  // re-clamp after rotation / zoom
    window.squadSheet = { show, isMobile: () => window.matchMedia('(max-width: 900px)').matches };
    apply();
}

// ---- NEW: pan/zoom battlefield camera -------------------------------------------
// The three zones live in a fixed-size "world" (#map-world, sized in plain CSS px) that is
// moved and scaled by ONE transform inside #map-viewport. The world never reflows, so the
// grid keeps its exact geometry at any window size, device or browser zoom; only the camera
// changes. Drag to pan; mouse wheel, trackpad/touch pinch, the +/- buttons or the +/- keys
// to zoom; Fit (or the 0 key) frames everything. Until the player moves the camera it keeps
// re-fitting whenever the viewport changes size (resize, rotate, browser zoom).
const camera = { x: 0, y: 0, z: 1, auto: true };   // x,y: world origin inside the viewport (px); z: scale
let mapView = null, mapWorld = null, mapZoomLabel = null;
let mapLastSize = { w: 0, h: 0 };

const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const viewSize = () => ({ w: mapView.clientWidth, h: mapView.clientHeight });
function fitZoom() {
    const v = viewSize();
    return v.w && v.h ? Math.min(v.w / mapWorld.offsetWidth, v.h / mapWorld.offsetHeight) : 1;
}
function zoomLimits() {
    const fit = fitZoom();
    return { min: fit * 0.5, max: Math.max(fit * 6, 2.5) };
}
// Keep the map from being flung out of view, like a map app: the world can be dragged
// freely as long as at least ~35% of the viewport's worth of it (or all of it, if smaller)
// stays visible. This never fights cursor-anchored zooming.
function clampCamera() {
    const v = viewSize(), sw = mapWorld.offsetWidth * camera.z, sh = mapWorld.offsetHeight * camera.z;
    const kx = Math.min(sw, v.w * 0.35), ky = Math.min(sh, v.h * 0.35);
    camera.x = clampNum(camera.x, kx - sw, v.w - kx);
    camera.y = clampNum(camera.y, ky - sh, v.h - ky);
}
function applyCamera() {
    mapWorld.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`;
    mapView.style.setProperty('--map-x', `${camera.x}px`);
    mapView.style.setProperty('--map-y', `${camera.y}px`);
    mapView.style.setProperty('--map-z', camera.z);
    if (mapZoomLabel) mapZoomLabel.textContent = `${Math.round(camera.z * 100)}%`;
}
function fitView() {
    const v = viewSize();
    camera.z = fitZoom();
    camera.x = (v.w - mapWorld.offsetWidth * camera.z) / 2;
    camera.y = (v.h - mapWorld.offsetHeight * camera.z) / 2;
    camera.auto = true;
    applyCamera();
}
// Zoom by `factor`, keeping the world point under viewport position (px, py) fixed.
function zoomAt(factor, px, py) {
    const { min, max } = zoomLimits();
    const z = clampNum(camera.z * factor, min, max);
    camera.x = px - (px - camera.x) * (z / camera.z);
    camera.y = py - (py - camera.y) * (z / camera.z);
    camera.z = z;
    camera.auto = false;
    clampCamera();
    applyCamera();
}
function panBy(dx, dy) {
    camera.x += dx; camera.y += dy;
    camera.auto = false;
    clampCamera();
    applyCamera();
}

function initMapView() {
    mapView = document.getElementById('map-viewport');
    mapWorld = document.getElementById('map-world');
    if (!mapView || !mapWorld) return;            // older markup without a map: nothing to do
    mapZoomLabel = mapView.querySelector('.map-zoom');
    const markUsed = () => mapView.classList.add('used');
    const local = e => { const r = mapView.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    // Re-fit on any viewport size change (window resize, device rotation, browser zoom).
    // Once the player has moved the camera, keep whatever is at the centre at the centre.
    new ResizeObserver(() => {
        const v = viewSize();
        if (!v.w || !v.h) return;
        if (camera.auto || !mapLastSize.w) fitView();
        else {
            const wx = (mapLastSize.w / 2 - camera.x) / camera.z, wy = (mapLastSize.h / 2 - camera.y) / camera.z;
            const { min, max } = zoomLimits();
            camera.z = clampNum(camera.z, min, max);
            camera.x = v.w / 2 - wx * camera.z;
            camera.y = v.h / 2 - wy * camera.z;
            clampCamera();
            applyCamera();
        }
        mapLastSize = v;
    }).observe(mapView);

    // Wheel / trackpad pinch (ctrl+wheel) zoom around the cursor.
    mapView.addEventListener('wheel', e => {
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 100;
        const c = local(e);
        zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), c.x, c.y);
        markUsed();
    }, { passive: false });

    // Pointer pan (1 pointer) and pinch (2 pointers). A press only becomes a drag after it
    // moves a few px, so plain clicks on unit cards still reach the cards.
    const pointers = new Map();
    let pinch = null, suppressClick = false;
    const capture = id => { try { mapView.setPointerCapture(id); } catch (_) { /* synthetic pointer */ } };
    mapView.addEventListener('pointerdown', e => {
        if (e.target.closest('.map-controls')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
        if (pointers.size === 2) {
            pointers.forEach((p, id) => { p.moved = true; capture(id); });
            mapView.classList.add('dragging');
            pinch = null;
        }
    });
    mapView.addEventListener('pointermove', e => {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (pointers.size === 1) {
            if (!p.moved) {
                if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6) return;
                p.moved = true;
                capture(e.pointerId);
                mapView.classList.add('dragging');
            }
            panBy(dx, dy);
            markUsed();
        } else if (pointers.size === 2) {
            const [a, b] = [...pointers.values()], r = mapView.getBoundingClientRect();
            const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top, d = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinch && pinch.d > 0) {
                camera.x += mx - pinch.mx; camera.y += my - pinch.my;
                zoomAt(d / pinch.d, mx, my);
                markUsed();
            }
            pinch = { mx, my, d };
        }
    });
    const release = e => {
        const p = pointers.get(e.pointerId);
        if (!p) return;
        if (p.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
        pointers.delete(e.pointerId);
        pinch = null;
        if (![...pointers.values()].some(q => q.moved)) mapView.classList.remove('dragging');
    };
    mapView.addEventListener('pointerup', release);
    mapView.addEventListener('pointercancel', release);
    mapView.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);

    // Buttons and keys.
    const centre = () => ({ x: mapView.clientWidth / 2, y: mapView.clientHeight / 2 });
    const act = { in: () => zoomAt(1.4, centre().x, centre().y), out: () => zoomAt(1 / 1.4, centre().x, centre().y), fit: fitView };
    mapView.querySelectorAll('[data-map]').forEach(btn => btn.addEventListener('click', () => { act[btn.dataset.map]?.(); markUsed(); }));
    mapView.addEventListener('keydown', e => {
        const step = e.shiftKey ? 200 : 60;
        const keys = {
            '+': act.in, '=': act.in, '-': act.out, '_': act.out, '0': act.fit,
            ArrowLeft: () => panBy(step, 0), ArrowRight: () => panBy(-step, 0),
            ArrowUp: () => panBy(0, step), ArrowDown: () => panBy(0, -step)
        };
        if (keys[e.key]) { e.preventDefault(); keys[e.key](); markUsed(); }
    });

    window.battlefieldMap = { camera, fit: fitView, zoomAt, panBy, relayout: () => { layoutBattlefield(); if (camera.auto) fitView(); } };   // handy for the console / tests
}

// ---- NEW: build any UI the page markup does not already provide ------------------
// combat.html shipped the inspector tabs, #selection and the speed bar in its markup.
// squadproto.html does not (yet), so they are created here only when missing. Once they
// are added to the HTML this function simply finds them and does nothing.
// It also does nothing on pages without the battlefield (squadselect imports this file).
function ensureUI() {
    const panel = document.getElementById('unit-details-display');
    if (panel && !document.getElementById('inspector-unit-list')) panel.innerHTML = `
        <div class="inspector-tabs">
            <button class="tab-button active" data-tab="units">Units</button>
            <button class="tab-button" data-tab="modifiers">Modifiers</button>
        </div>
        <div class="tab-content active" id="tab-units">
            <div id="inspector-unit-list">
                <p style="color:#888; text-align:center; padding:20px;">Select a unit to inspect...</p>
            </div>
        </div>
        <div class="tab-content" id="tab-modifiers">
            <div id="modifiers-content">
                <h3 style="border-bottom:2px solid #ff0055; padding-bottom:5px; margin-bottom:10px;">Active Modifiers</h3>
                <p style="color:#888;">No active modifiers</p>
            </div>
        </div>`;
    if (!document.getElementById('selection')) {
        const selection = document.createElement('div');
        selection.id = 'selection';
        selection.style.cssText = 'display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:500; min-width:400px; max-width:600px;';
        document.body.appendChild(selection);
    }
    if (!document.getElementById('speed-controls')) document.body.insertAdjacentHTML('beforeend', `
    <div id="speed-controls" style="position: fixed; bottom: 20px; right: 20px; background: rgba(20, 20, 20, 0.95); padding: 8px 12px; border-radius: 8px; z-index: 1000; display: flex; gap: 8px; align-items: center; border: 1px solid #444; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">
    <span style="color: #ccc; font-size: 12px; font-weight: bold;">SPEED:</span>
    <button class="speed-btn" data-speed="0.25" style="padding: 4px 8px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">0.25x</button>
    <button class="speed-btn" data-speed="0.5" style="padding: 4px 8px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">0.5x</button>
    <button class="speed-btn active" data-speed="1" style="padding: 4px 8px; background: #060; color: #fff; border: 1px solid #0a0; border-radius: 4px; cursor: pointer; font-size: 11px;">1x</button>
    <button class="speed-btn" data-speed="2" style="padding: 4px 8px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">2x</button>
    <button class="speed-btn" data-speed="4" style="padding: 4px 8px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">4x</button>
    <button class="speed-btn" data-speed="6" style="padding: 4px 8px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 11px;">6x</button>
</div>
    `);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('frontline-grid')) {
        ensureUI();
        layoutBattlefield();
        initGrids();
        initMapView();
        initPanelResizers();
        initBottomSheet();
    }
    initTabSwitching();
    initInspectorControls();
    initSpeedControls();
});
document.addEventListener('DOMContentLoaded', () => {
    const pendingSquad = localStorage.getItem('pendingSquad');
    if (pendingSquad) {
        localStorage.removeItem('pendingSquad');
        initializeCombatFromSquad(JSON.parse(pendingSquad));
        const command = document.getElementById('command');
        if (command) command.style.display = 'none';
    }
});
const unitLookup = {
    [DexSoldier.name]: DexSoldier,
    [FourArcher.name]: FourArcher,
    [Mannequin.name]: Mannequin,
    [Silhouette.name]: Silhouette,
    [Doctor.name]: Doctor,
    [Detective.name]: Detective,
    [Electric.name]: Electric,
    [ClassicJoy.name]: ClassicJoy
};
function initializeCombatFromSquad(squadData) {
    const selectionPanel = document.getElementById('unit-selection-panel');
    if (selectionPanel) selectionPanel.style.display = 'none';
    const gameLayout = document.querySelector('.game-layout');
    if (gameLayout) gameLayout.style.display = 'flex';
    squadData.forEach(unitConfig => {
        const ref = unitLookup[unitConfig.templateName];
        const newUnit = createUnit(ref, 'player');
        newUnit.skills = {};
        if (newUnit.base.position === 'mid') {
            newUnit.position = "back";
            newUnit.frontSkills = {};
            newUnit.backSkills = {};
            for (const skill of unitConfig.skills.front ) newUnit.frontSkills[skill.category] = ref.skills[skill.category].find(s => s.name === skill.name);
            for (const skill of unitConfig.skills.back ) newUnit.backSkills[skill.category] = ref.skills[skill.category].find(s => s.name === skill.name);
            newUnit.skills = {...newUnit.backSkills};
            if (unitConfig.startingPosition === "front") newUnit.switchPosition(true);
        } else for (const skill of unitConfig.skills ) newUnit.skills[skill.category] = ref.skills[skill.category].find(s => s.name === skill.name);
        (newUnit.traits || []).forEach(s => {
            currentAction.push([s, newUnit]);
            s.code.call(newUnit);
            currentAction.pop();
        });
        (newUnit.synergy || []).forEach(s => {
            currentAction.push([s, newUnit]);
            s.code.call(newUnit);
            currentAction.pop();
        });
        for (const skill of ['passive', 'augment', 'conditional']) {
            if (newUnit.skills[skill]) {
                currentAction.push([newUnit.skills[skill], newUnit]);
                newUnit.skills[skill].code.call(newUnit);
                currentAction.pop();
            }
        }
        newUnit.autoBehavior = (newUnit.skills[unitConfig.autoBehavior] && unitConfig.autoBehavior) || (newUnit.skills.basic ? 'basic' : newUnit.skills.secondary ? 'secondary' : 'none');
        newUnit.specialReady = true;
    });
    if (wave > 0) for (const e of waveCalc(allUnits.filter(u => u.team === 'player'), .5)) assignEnemySkills(createUnit(e, 'enemy'), e);
    updateBattleDisplay();
    if (eventState.waveChange.length) handleEvent('waveChange', { wave });
    combatTick();
}

// ---- NEW: the mockup's four COMMAND buttons, backed by real engine units ----------
// spawnUnit('player' | 'frontline' | 'enemy', 'player' | 'enemy'): lane names are the
// mock's (player = player backline, enemy = enemy backline). Handy for previewing the
// layout without a squad; remove together with the buttons if not wanted.
const enemyRoster = [Experiment, Reject, CouncilMagician, CouncilScientist, Revolutionary, enemy, ArtificialSoldier];
function spawnUnit(lane, team) {
    const roster = team === 'player' ? Object.values(unitLookup) : enemyRoster;
    const position = lane === 'frontline' ? 'front' : 'back';
    const options = roster.filter(t => t.base.position === 'mid' || t.base.position === position);
    if (!options.length) return showMessage(`No ${team} units can start in the ${lane} lane.`, 'warning');
    const template = options[Math.floor(Math.random() * options.length)];
    const unit = createUnit(template, team);
    assignEnemySkills(unit, template);
    if (template.base.position === 'mid' && position === 'front') unit.switchPosition(true);
    if (team === 'player') {
        unit.autoBehavior = unit.skills.basic ? 'basic' : unit.skills.secondary ? 'secondary' : 'none';
        unit.specialReady = true;
    }
    updateBattleDisplay();
}
window.spawnUnit = spawnUnit;