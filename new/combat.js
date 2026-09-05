import { DexSoldier } from './unit/dexSoldier.js';
import { FourArcher } from './unit/fourArcher.js';
import { Mannequin } from './unit/mannequin.js';
import { Silhouette } from './unit/silhouette.js';
import { Doctor } from './unit/doctor.js';
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
import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from './combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from './modifier.js'
import { Unit, createUnit, cloneUnit, allUnits } from './unit/unit.js';

let turnCounter = 1;
let wave = 1;
const availableUnits = [DexSoldier, FourArcher, Mannequin, Silhouette, Doctor];
let selectedUnits = [];
window.combatSpeedMultiplier = 1;

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
            window.combatSpeedMultiplier = parseFloat(btn.dataset.speed);
        });
    });
}

function updateBattleDisplay() {
    updateModifiers();
    updateInspectorUnits();
    const playerBacklineRow = document.getElementById('player-backline-row');
    const frontlineRow = document.getElementById('frontline-row');
    const enemyBacklineRow = document.getElementById('enemy-backline-row');
    if (playerBacklineRow) playerBacklineRow.innerHTML = '';
    if (frontlineRow) frontlineRow.innerHTML = '';
    if (enemyBacklineRow) enemyBacklineRow.innerHTML = '';
    const playerBackline = allUnits.filter(u => u.team === 'player' && u.position === 'back' && u.hp > 0);
    const playerFrontline = allUnits.filter(u => u.team === 'player' && u.position === 'front' && u.hp > 0);
    const enemyFrontline = allUnits.filter(u => u.team === 'enemy' && u.position === 'front' && u.hp > 0);
    const enemyBackline = allUnits.filter(u => u.team === 'enemy' && u.position === 'back' && u.hp > 0);
    const playerBacklineDefeated = allUnits.filter(u => u.team === 'player' && u.position === 'back' && u.hp <= 0);
    const playerFrontlineDefeated = allUnits.filter(u => u.team === 'player' && u.position === 'front' && u.hp <= 0);
    const enemyFrontlineDefeated = allUnits.filter(u => u.team === 'enemy' && u.position === 'front' && u.hp <= 0);
    const enemyBacklineDefeated = allUnits.filter(u => u.team === 'enemy' && u.position === 'back' && u.hp <= 0);
    if (playerBacklineRow) {
        playerBackline.forEach(unit => playerBacklineRow.appendChild(renderUnitCard(unit)));
        playerBacklineDefeated.forEach(unit => playerBacklineRow.appendChild(renderUnitCard(unit)));
    }
    if (frontlineRow) {
        playerFrontline.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, false, true)));
        enemyFrontline.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, true, true)));
        playerFrontlineDefeated.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, false, true)));
        enemyFrontlineDefeated.forEach(unit => frontlineRow.appendChild(renderUnitCard(unit, true, true)));
    }
    if (enemyBacklineRow) {
        enemyBackline.forEach(unit => enemyBacklineRow.appendChild(renderUnitCard(unit, true)));
        enemyBacklineDefeated.forEach(unit => enemyBacklineRow.appendChild(renderUnitCard(unit, true)));
    }
}

function renderUnitCard(unit, isEnemy = false, inFrontline = false) {
    const card = document.createElement('div');
    const isDefeated = unit.hp <= 0;
    const isCurrentTurn = unit.name === currentAction[0]?.[1]?.name;
    const isStunned = unit.stun;
    const isSpecialReady = unit.specialReady && !isDefeated;
    card.className = `unit ${unit.team === 'player' ? 'player-unit' : 'enemy-unit'} ${unit.position === 'back' ? 'back' : ''} ${isDefeated ? 'defeated' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isStunned ? 'stunned' : ''} ${isSpecialReady ? 'special-ready' : ''}`;
    let indicators = '';
    if (isStunned) indicators += '<div class="stun-indicator">STUNNED</div>';
    if (isCurrentTurn) indicators += '<div class="turn-indicator">▶</div>';
    card.innerHTML = `
        ${indicators}
        <div class="unit-name">${unit.name}</div>
        ${renderUnitStats(unit, isEnemy)}
    `;
    if (unit.team === 'player') card.addEventListener('click', () => {
        unit.isExpanded = !unit.isExpanded;
        updateInspectorUnits();
    });
    return card;
}

function renderUnitStats(unit, isEnemy = false) {
    if (unit.hp <= 0) return `<div style="text-align: center; color: #ff0055; font-style: italic; padding: 10px 0;">DEFEATED</div>`;
    let stats = `
        <div class='stat-row'>
            <div class='stat-label'>${isEnemy ? 'HP' : `HP: ${Math.max(0, unit.hp)}/${unit.base.hp}`}</div>
            <div class='stat-bar-container'>
                <div class='stat-bar hp-bar' style='width: ${Math.max(0, Math.min(100, (unit.hp / unit.base.hp) * 100))}%'></div>
            </div>
        </div>
        <div class='stat-row'>
            <div class='stat-label'>${isEnemy ? 'Stamina' : `Stamina: ${Math.floor(unit.stamina)}/${unit.base.stamina}`}</div>
            <div class='stat-bar-container'>
                <div class='stat-bar stamina-bar' style='width: ${Math.max(0, Math.min(100, (unit.stamina / unit.base.stamina) * 100))}%'></div>
            </div>
        </div>
    `;
    if (unit.base.mana) stats += `
            <div class='stat-row'>
                <div class='stat-label'>${isEnemy ? 'Mana' : `Mana: ${Math.floor(unit.mana)}/${unit.base.mana}`}</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar mana-bar' style='width: ${Math.max(0, Math.min(100, (unit.mana / unit.base.mana) * 100))}%'></div>
                </div>
            </div>
        `;
    if (unit.base.energy) stats += `
            <div class='stat-row'>
                <div class='stat-label'>${isEnemy ? 'Energy' : `Energy: ${Math.floor(unit.energy)}/${unit.base.energy}`}</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar energy-bar' style='width: ${Math.max(0, Math.min(100, (unit.energy / unit.base.energy) * 100))}%'></div>
                </div>
            </div>
        `;
    return stats += `
        <div class='stat-row'>
            <div class='stat-label'>${unit.timer <= 0 ? 'Ready!' : 'Charging...'}</div>
            <div class='stat-bar-container'>
                <div class='stat-bar timer-bar' style='width: ${Math.max(0, Math.min(100, 100 - (unit.timer / 10)))}%'></div>
            </div>
        </div>
    `;
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
                <div>HP: ${Math.round((unit.hp / unit.base.hp) * 100)}%</div>
                <div>Stamina: ${Math.round((unit.stamina / unit.base.stamina) * 100)}%</div>
                ${unit.base.mana ? `<div>Mana: ${Math.round((unit.mana / unit.base.mana) * 100)}%</div>` : ''}
                ${unit.base.energy ? `<div>Energy: ${Math.round((unit.energy / unit.base.energy) * 100)}%</div>` : ''}
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
                ${ unit.skills?.basic ? `<button class="doctrine-btn ${unit.autoBehavior === 'basic' ? 'active' : ''}" data-behavior="basic" data-unit="${unit.name}">Basic</button>` : ''}
                ${ unit.skills?.secondary ?`<button class="doctrine-btn ${unit.autoBehavior === 'secondary' ? 'active' : ''}" data-behavior="secondary" data-unit="${unit.name}">Secondary</button>` : ''}
                ${ unit.skills?.basic && unit.skills?.secondary ?`<button class="doctrine-btn ${unit.autoBehavior === 'both' ? 'active' : ''}" data-behavior="both" data-unit="${unit.name}">Both</button>` : ''}
                ${`<button class="doctrine-btn ${unit.autoBehavior === 'none' ? 'active' : ''}" data-behavior="none" data-unit="${unit.name}">None</button>`}
            </div>
        </div>
    `;
    if (unit.skills?.special && unit.hp > 0) html += `
            <button class="activate-special-btn" data-unit="${unit.name}" ${!unit.specialReady && unit.stamina >= (unit.skills.special.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.special.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.special.cost?.energy || 0) ? 'disabled' : ''}>
                ⚡ Activate Special: ${unit.skills.special.name}
            </button>
        `;
    html += `<div style="margin-top:10px; font-size:11px; color:#888;">EQUIPPED SKILLS:</div>`;
    unit.skills ? Object.entries(unit.skills).forEach(([category, skill]) => { html += `<br><div style="font-size:11px; color:#00aaff; margin:3px 0;" class="skillName">• ${skill.name}<span class="skillDesc">${alterDesc(skill, category)}</span></div>` }) : html += `<div style="font-size:11px; color:#666;">No skills equipped</div>`;
    return html;
}

function alterDesc(skill, category) {
    if (!skill.description) return '';
    let desc = '';
    if (skill.reduction) {
        desc += "Reduce ";
        for (const stat in skill.reduction) desc += ['hp', 'stamina', 'mana', 'energy'].includes(stat) ? `max ${stat === 'hp' ? 'HP' : stat.charAt(0).toUpperCase() + stat.slice(1)} by ${skill.reduction[stat]}, ` : `base ${stat.charAt(0).toUpperCase() + stat.slice(1)} by ${skill.reduction[stat]}, `;
        desc = desc.slice(0, -2) + '<br>';
    }
    if (skill.cost) {
        if (skill.cost.position) desc += `${skill.cost.position.charAt(0).toUpperCase() + skill.cost.position.slice(1)}line only, `;
        const list = Object.keys(skill.cost).filter(s => s !== 'position');
        if (list.length) {
            desc += 'Cost ';
            for (const stat of list) desc += `${skill.cost[stat]} ${stat.charAt(0).toUpperCase() + stat.slice(1)}, `;
        }
        desc = desc.slice(0, -2) + '<br>';
    }
    const block = [];
    if (['special', 'basic', 'secondary'].includes(category)) for (const [res, attrib] of [['stamina', 'physical'], ['mana', 'mystic'], ['energy', 'techno']]) if (!(skill.cost && Object.keys(skill.cost).includes(res)) && skill.properties.includes(attrib)) block.push(res);
    if (block.length) {
        desc += "Blocks next turn's regeneration of ";
        for (const stat of block) desc += `${stat.charAt(0).toUpperCase() + stat.slice(1)}, `;
        desc = desc.slice(0, -2) + '<br>';
    }
    return desc + skill.description.replace(/\n/g, '<br>');
}

function updateModifiers() {
    const modifiersContent = document.getElementById('modifiers-content');
    if (!modifiersContent) return;
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
                fullTargets = targetNames.join(', ');
                if (targetNames.length > 5) targetDisplay = `<span class="modifier-targets truncated" data-full-targets="${fullTargets}">${targetNames.slice(0, 4).join(', ')}, +${targetNames.length - 4} more</span>`;
                else targetDisplay = fullTargets;
            }
            modDisplay += `
                <li class="modifier-item ${isCancelled ? 'cancelled' : ''}">
                    <span class="modifier-caster">${modifier.vars.caster?.name || 'System'}'s</span>
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
}

function initTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => { content.classList.remove('active') });
            document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
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
            if (unit?.specialReady) unit.pendingSpecial = true;
        }
    });
}

function updateTimersOnly(units) {
    units.forEach(unit => {
        const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
        const unitCards = document.querySelectorAll('.unit');
        unitCards.forEach(card => {
            if (card.querySelector('.unit-name')?.textContent === unit.name) {
                const timerBar = card.querySelector('.timer-bar');
                const readyTextLabel = card.querySelector('.stat-row:last-child .stat-label');

                if (timerBar) timerBar.style.width = `${timerProgress}%`;
                if (readyTextLabel) readyTextLabel.textContent = unit.timer <= 0 ? 'Ready!' : 'Charging...';
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
    await new Promise(resolve => setTimeout(resolve, 500 / (window.combatSpeedMultiplier || 1)));
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
            if (!list.length) for (const unit of alive) unit.timer -= unit.speed;
            else turn = list.reduce((low, cur) => cur.timer < low.timer ? cur : low);
            await syncTimerUI(alive);
            await new Promise(resolve => setTimeout(resolve, 120 / (window.combatSpeedMultiplier || 1)));
        }
        logAction(`<strong>Turn ${turnCounter++}: ${turn.name}'s turn</strong>`, 'turn');
        if (eventState.turnStart.length) handleEvent('turnStart', { unit: turn });
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
                    setTimeout(combatTick, 500/window.combatSpeedMultiplier);
                }
            } else {
                const behavior = turn.autoBehavior || (turn.skills.basic ? 'basic' : turn.skills.secondary ? 'secondary' : 'none');
                if (behavior === 'none') {
                    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'skip'});
                    logAction(`${turn.name} is resting!`, 'info');
                    regenerateResources(turn);
                    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
                    setTimeout(combatTick, 500/window.combatSpeedMultiplier);
                    turn.specialReady = true;
                } else if (behavior === 'both') executeBoth(turn);
                else executeAutoAction(turn, behavior);
            }
        }
        if (turn.team === 'enemy') enemyTurn(turn);
    } else {
        logAction(`${turn.name}'s turn was skipped due to being stunned!`, 'miss');
        if (eventState.turnEnd.length) handleEvent('turnEnd', { unit: turn });
        setTimeout(combatTick, 500/window.combatSpeedMultiplier);
    }
    turn.timer += 1000;
}

function executeAutoAction(unit, action) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action});
    if (!unit.skills[action].cost || resourceChange(unit, unit.skills[action].cost, false)) {
        unit.previousAction = [unit.previousAction[0] || unit.skills[action].properties.includes('stamina-block'), unit.previousAction[1] || unit.skills[action].properties.includes('mana-block'), unit.previousAction[2] || unit.skills[action].properties.includes('energy-block')];
        currentAction.push([unit.skills[action], unit]);
        unit.skills[action].code.call(unit);
        currentAction.pop();
    }
    unit.specialReady = true;
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    setTimeout(combatTick, 500/window.combatSpeedMultiplier);
}

function executeBoth(unit) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'both'});
    const cost = {};
    for (const [res, attrib] of [['stamina', 'physical'], ['mana', 'mystic'], ['energy', 'techno']]) {
        let count = unit.skills.basic?.properties?.includes(attrib) + unit.skills.secondary?.properties?.includes(attrib);
        if (count) cost[res] = count * 10;
        count = ((unit.skills.basic?.cost?.[res] || 0) + (unit.skills.secondary?.cost?.[res] || 0));
        if (count) cost[res] = (cost[res] || 0) + count;
    }
    if (JSON.stringify(cost) === '{}' || resourceChange(unit, cost, false)) {
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
    setTimeout(combatTick, 500/window.combatSpeedMultiplier);
}

function executeSpecialAction(unit, specialSkill) {
    if (eventState.actionStart.length) handleEvent('actionStart', {unit, action: 'special'});
    if (specialSkill.target) specialSkill.target.call(unit);
    else {
        if (specialSkill.cost && !resourceChange(unit, specialSkill.cost, false)) {
            logAction(`${unit.name}'s special was canceled!`, 'error');
            return setTimeout(combatTick, 2000/window.combatSpeedMultiplier);
        }
        unit.previousAction = [unit.previousAction[0] || specialSkill.properties.includes('stamina-block'), unit.previousAction[1] || specialSkill.properties.includes('mana-block'), unit.previousAction[2] || specialSkill.properties.includes('energy-block')];
        logAction(`<strong>${unit.name}'s turn (Special Interrupt!)</strong>`, 'turn');
        if (eventState.turnStart.length) handleEvent('turnStart', { unit });
        currentAction.push([specialSkill, unit]);
        specialSkill.code.call(unit);
        currentAction.pop();
        if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    }
    setTimeout(combatTick, 2000/window.combatSpeedMultiplier);
}

export function advanceWave(x = 0) {
    if (x) wave = x;
    if (wave === 1 || wave === 2) {
        allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === 'player'));
        for (let i = modifiers.length - 1; i >= 0; i--) if (!allUnits.includes(modifiers[i].vars.caster)) removeModifier(modifiers[i]);
    } else return true;
    logAction(`<strong>Wave ${++wave}!</strong>`, 'turn');
    for (const e of waveCalc(allUnits.filter(u => u.team === 'player'), wave-1 ? 1.5 : 1)) assignEnemySkills(createUnit(e, 'enemy'), e);
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
    let playerPoints = new Map([
       [DexSoldier, 81/16], [FourArcher, 81/16], [Mannequin, 81/16], [Silhouette, 81/16], [Doctor, 81/16]
    ]);
    enemyPoints = new Map([[Experiment, 9/4], [Reject, 9/4], [CouncilMagician, 81/16],
            [CouncilScientist, 81/16], [Revolutionary, 81/16], [enemy, 81/16],
            [ArtificialSoldier, 81/16]]);
    let enemies = [];
    let points = 0;
    const front = [Experiment, Reject, enemy, ArtificialSoldier].filter(e => enemyPoints.has(e));
    const frontEnem = front[Math.floor(Math.random() * front.length)];
    enemies.push(frontEnem);
    points += enemyPoints.get(frontEnem);
    while (points < total) {
        const enem = Math.random() < .5 ? [...enemyPoints.keys(), ...playerPoints.keys()][Math.floor(Math.random() * (enemyPoints.size+playerPoints.size))] : [...enemyPoints.keys()][Math.floor(Math.random() * enemyPoints.size)];
        const p = enemyPoints.has(enem) ? enemyPoints.get(enem) : playerPoints.get(enem);
        if (points + p <= total || (Math.abs(total - points - p) < Math.abs(total - points))) {
            enemies.push(enem);
            points += p;
        } else break;
    }
    return enemies;
}

function assignEnemySkills(newUnit, template) {
    newUnit.skills = {};
    const categories = ['special', 'basic', 'secondary', 'passive', 'augment'];
    const getLoadoutForPosition = (pos) => {
        const defaultLoadout = (pos === 'front' ? template.frontDefaultSkills : template.backDefaultSkills) || template.defaultSkills;
        for (let attempt = 0; attempt < 5; attempt++) {
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
    if (template.base.position === 'mid') {
        newUnit.position = 'back'; 
        newUnit.frontSkills = getLoadoutForPosition('front');
        newUnit.backSkills = getLoadoutForPosition('back');
        newUnit.skills = {...newUnit.backSkills};
        if (Math.random() > 0.5) newUnit.switchPosition(true);
    } else newUnit.skills = getLoadoutForPosition(newUnit.position);
    for (const skill of ['passive', 'augment']) {
        if (newUnit.skills[skill]) {
            currentAction.push([newUnit.skills[skill], newUnit])
            newUnit.skills[skill].code.call(newUnit);
            currentAction.pop();
        }
    }
}

function frontTest() {
    if (!allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'player').length) {
        const midLine = allUnits.filter(u => u.hp && u.position === 'mid' && u.team === 'player');
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
            logAction(`All player midline units moved to the frontline!`, 'turn');
        } else return !!showMessage('Defeat!', 'error', 'message-container', 0);
    }
    if (!allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'enemy').length) {
        const midLine = allUnits.filter(u => u.hp && u.position === 'mid' && u.team === 'enemy');
        if (midLine.length) {
            for (const unit of midLine) {
                unit.switchPosition();
                unit.timer += 1000;
            }
            logAction(`All enemy midline units moved to the frontline!`, 'turn');
        } else if (advanceWave() && !allUnits.filter(u => u.hp && u.position === 'front' && u.team === 'enemy').length) return !!showMessage('Victory!', 'success', 'message-container', 0);
    }
}

window.combatTick = combatTick;
window.updateModifiers = updateModifiers;
document.addEventListener('DOMContentLoaded', () => {
    initTabSwitching();
    initInspectorControls();
    initSpeedControls();
});
document.addEventListener('DOMContentLoaded', () => {
    const pendingSquad = localStorage.getItem('pendingSquad');
    if (pendingSquad) {
        localStorage.removeItem('pendingSquad');
        initializeCombatFromSquad(JSON.parse(pendingSquad));
    }
});

const unitLookup = {
    [DexSoldier.name]: DexSoldier,
    [FourArcher.name]: FourArcher,
    [Mannequin.name]: Mannequin,
    [Silhouette.name]: Silhouette,
    [Doctor.name]: Doctor
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
        for (const skill of ['passive', 'augment']) {
            if (newUnit.skills[skill]) {
                currentAction.push([newUnit.skills[skill], newUnit])
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