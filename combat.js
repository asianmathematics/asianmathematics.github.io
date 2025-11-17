import { Dark } from './unit/dark.js';
import { Electric } from './unit/electric.js';
import { Servant } from './unit/servant.js';
import { ClassicJoy } from './unit/classicJoy.js';
import { DexSoldier } from './unit/dexSoldier.js';
import { Dandelion } from './unit/dandelion.js';
import { FourArcher } from './unit/fourArcher.js';
import { Paragon } from './unit/paragon.js';
import { Righty001 } from './unit/righty001.js';
import { Mannequin } from './unit/mannequin.js';
import { Idol } from './unit/idol.js';
import { Silhouette } from './unit/silhouette.js';
import { enemy } from './unit/enemy.js';
import { mysticEnemy } from './unit/mysticEnemy.js';
import { technoEnemy } from './unit/technoEnemy.js';
import { magitechEnemy } from './unit/magitechEnemy.js';
import { ArtificialSolider } from './unit/artificialSolider.js';
import { ChaosAgent } from './unit/chaosAgent.js';
import { CouncilMagician } from './unit/councilMagician.js';
import { CouncilScientist } from './unit/councilScientist.js';
import { Dreamer } from './unit/dreamer.js';
import { Experiment } from './unit/experiment.js';
import { Reject } from './unit/reject.js';
import { Revolutionary } from './unit/revolutionary.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from './combatDictionary.js';
let turnCounter = 1;
let currentTurn = 0;
let wave = 1;

const availableUnits = [Dark, Electric, Servant, ClassicJoy, DexSoldier, Dandelion, FourArcher, Paragon, Righty001, Mannequin, Idol, Silhouette];
let selectedUnits = [];

function initUnitSelection() {
    const roster = document.getElementById('unit-roster');
    const selectedContainer = document.getElementById('selected-units');
    const countDisplay = selectedContainer.querySelector('h4');
    roster.innerHTML = '';
    selectedContainer.innerHTML = '<h4>Selected Units (max of 6, 4 recommened)</h4>';
    selectedUnits = [];
    availableUnits.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.dataset.unit = unit.name;
        card.innerHTML = `<strong>${unit.name}</strong>`;
        card.addEventListener('click', () => {
            unit.actionsInit();
            if (unit.passivesInit) { unit.passivesInit() }
            updateInfoDisplay(unit);
            if (selectedUnits.length >= 6 && !card.classList.contains('selected')) {
                showMessage('Maximum 6 units allowed!', 'warning', 'selection');
                return;
            }
            card.classList.toggle('selected');
            card.classList.contains('selected') ? selectedUnits.push(unit) : selectedUnits = selectedUnits.filter(u => u.name !== unit.name);
            countDisplay.textContent = `Selected Units (${selectedUnits.length}/6)`;
            renderSelectedUnits();
        });
        roster.appendChild(card);
    });
    document.getElementById('start-with-selected').addEventListener('click', () => {
        if (selectedUnits.length === 0) {
            showMessage('Please select at least 1 unit!', 'error', 'selection');
            return;
        }
        let frontcheck = true;
        for (const unit of selectedUnits) {
            if (!unit.description.includes("backline")) {
                frontcheck = false;
                break;
            }
        }
        if (frontcheck) {
            showMessage('Please select at least 1 non-backline unit!', 'error', 'selection');
            return;
        }
        startCombatWithSelected();
    });
    document.getElementById('skill-select').addEventListener('click', () => {
        if (selectedUnits.length === 0) {
            showMessage('Please select at least 1 unit!', 'error', 'selection');
            return;
        }
        let frontcheck = true;
        for (const unit of selectedUnits) {
            if (!unit.description.includes("backline")) {
                frontcheck = false;
                break;
            }
        }
        if (frontcheck) {
            showMessage('Please select at least 1 non-backline unit!', 'error', 'selection');
            return;
        }
        startCombatWithSelected();
    });
}

function renderSelectedUnits() {
    const container = document.getElementById('selected-units');
    container.querySelectorAll('.unit-card').forEach(card => card.remove());
    selectedUnits.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'unit-card selected';
        card.innerHTML = `<strong>${unit.name}</strong>`;
        container.appendChild(card);
        card.addEventListener('click', () => { updateInfoDisplay(unit) });
    });
}

function skillSelection(unit) {
    const current = document.getElementById('current-unit');
    const roster = document.getElementById('skill-roster');
    const selectedContainer = document.getElementById('selected-skills');
    const countDisplay = selectedContainer.querySelector('h4');
    current.innerHTML = `${unit.name}`;
    selectedContainer.innerHTML = `<h4>Selected Skills (max of ${unit.skillSlots})</h4>`;
    selected
}

function startCombatWithSelected() {
    document.getElementById('unit-selection-panel').style.display = 'none';
    selectedUnits.forEach(unit => { createUnit(unit, 'player') });
    if (wave > 0) { for (const e of waveCalc(unitFilter("player", ""), .5)) { createUnit(e, 'enemy') } }
    for (const unit of allUnits.filter(u => u.passivesInit)) { for (const pass in unit.passives) { unit.passives[pass].code() } }
    updateBattleDisplay();
    combatTick();
}

function updateInfoDisplay(unit) {
    const infoDisplay = document.querySelector('.info-display');
    if (!infoDisplay || !unit) return;
    let html = `<div class="left-column">
            <h3>${unit.name}</h3>
            <p>${unit.description}</p>
            <h4>Stats (Current)</h4>`;
    for (const statName of ['hp', 'attack', 'defense', 'accuracy', 'evasion', 'focus', 'resist', 'speed', 'presence']) {
        if (statName === 'hp') { html += `<div class="stat-line"><span><strong>HP</strong></span><span>${Math.max(0, unit.hp).toFixed(0)} / ${unit.base.hp.toFixed(0)}</span></div>` }
        else if (unit[statName] !== undefined) { html += `<div class="stat-line"><span>${statName.charAt(0).toUpperCase() + statName.slice(1)}</span><span>${unit[statName].toFixed(0)}</span></div>` }
        else if (unit.base[statName] !== undefined) { html += `<div class="stat-line"><span>${statName.charAt(0).toUpperCase() + statName.slice(1)}</span><span>${unit.base[statName].toFixed(0)}</span></div>` }
    }
    html += `<h4>Resources</h4>`;
    for (const resName in unit.base.resource) {
        const resValue = unit.resource[resName].toFixed(0);
        const label = resName.charAt(0).toUpperCase() + resName.slice(1);
        if (resName === 'stamina' || resName === 'mana' || resName === 'energy') { html += `<div class="stat-line"><span>${label}</span><span>${resValue} / ${unit.base.resource[resName].toFixed(0)}</span></div>` }
        else if (unit.resource[resName] !== undefined) { html += `<div class="stat-line"><span>${resName.charAt(0).toUpperCase() + resName.slice(1)}</span><span>${unit.resource[resName].toFixed(0)}</span></div>` }
        else if (unit.base.resource[resName] !== undefined) { html += `<div class="stat-line"><span>${resName.charAt(0).toUpperCase() + resName.slice(1)}</span><span>${unit.base.resource[resName].toFixed(0)}</span></div>` }
    }
    html += `</div>`;
    if (unit.actions && Object.keys(unit.actions).length > 0) {
        html += `<div class="right-column">
            <h4>Actions</h4>`;
        for (const actionKey in unit.actions) {
            if (actionKey === "actionWeight") { continue }
            const action = unit.actions[actionKey];
            html += `<div class="action-info-box">`;
            html += `<div class="action-name">${action.name}</div>`;
            let costs = [];
            for (const costType in action.cost) { if (action.cost[costType] > 0) { costs.push(`${action.cost[costType]} ${costType.charAt(0).toUpperCase() + costType.slice(1)}`) } }
            html += `<p><strong>Cost:</strong> ${costs.length > 0 ? costs.join(', ') : 'None'}</p>
                <p><strong>Description:</strong><br>${action.description ? action.description.replace(/\n/g, '<br>') : 'No description available.'}</p>`;
            if (action.properties && action.properties.length > 0) { html += `<p><strong>Properties:</strong> ${action.properties.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}</p>` }
            html += `</div>`;
        }
    } else { html += `<p>No active actions for this unit.</p>` }
    if (unit.passives && Object.keys(unit.passives).length > 0) {
        html += `<div class="right-column">
            <h4>Passive skills</h4>`;
            for (const actionKey in unit.passives) {
            const action = unit.passives[actionKey];
            html += `<div class="action-info-box">`;
            html += `<div class="action-name">${action.name}</div>`;
            let costs = [];
            for (const costType in action.cost) { if (action.cost[costType] > 0) { costs.push(`${action.cost[costType]} ${costType.charAt(0).toUpperCase() + costType.slice(1)}`) } }
            html += `<p><strong>Cost:</strong> ${costs.length > 0 ? costs.join(', ') : 'None'}</p>
                <p><strong>Description:</strong><br>${action.description ? action.description.replace(/\n/g, '<br>') : 'No description available.'}</p>`;
            if (action.properties && action.properties.length > 0) { html += `<p><strong>Properties:</strong> ${action.properties.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}</p>` }
            html += `</div>`;
        }
    }
    infoDisplay.innerHTML = html + '</div>';
}

export function startCombat() {
    document.getElementById('unit-selection-panel').style.display = 'block';
    document.getElementById('game-controls').style.display = 'none';
    initUnitSelection();
}

function updateModifiers() {
    let modDisplay = `
        <div class="modifiers-content">
            <h3>Active Modifiers</h3>
    `;
    if (modifiers.length === 0) { modDisplay += "<p>No active modifiers</p>" }
    else {
        modDisplay += "<ul class='modifier-list'>";
         for (const modifier of modifiers) {
            const isCancelled = modifier.vars.cancel > 0;
            let targetDisplay = "";
            let fullTargets = "";
            if (modifier.vars?.target) {
                targetDisplay = modifier.vars.target.name;
                fullTargets = modifier.vars.target.name;
            } else if (modifier.vars?.targets) {
                const targetNames = modifier.vars.targets.map(u => u.name);
                fullTargets = targetNames.join(", ");
                if (targetNames.length > 5) {
                    const truncatedNames = targetNames.slice(0, 4).join(", ") + `, +${targetNames.length - 4} more`;
                    targetDisplay = `<span class="modifier-targets truncated" data-full-targets="${fullTargets}">${truncatedNames}</span>`;
                } else { targetDisplay = fullTargets }
            }
            modDisplay += `
            <li class="modifier-item ${isCancelled ? 'cancelled' : ''}">
                <!-- <img class="modifier-icon" src="icons/${modifier.vars.icon}" alt="${modifier.name} icon"> -->
                <span class="modifier-caster">${modifier.vars.caster?.name || "System"}'s</span>
                <span class="modifier-name" data-tooltip="${modifier.description}">${modifier.name}.</span>
                <div class="modifier-targets">Targets: ${targetDisplay}</div>
                <div class="modifier-duration">${modifier.vars.duration || "indefinite"} turn(s) left</div>
                ${isCancelled ? '<div class="cancelled-indicator">(CANCELLED)</div>' : ''}
            </li>`;
        }
        modDisplay += "</ul>";
    }
    document.querySelector(".modifiers-container").innerHTML = modDisplay + "</div>";
}

function updateBattleDisplay() {
    updateModifiers();
    const playerTeamElement = document.querySelector('.player-team');
    const enemyTeamElement = document.querySelector('.enemy-team');
    const playerScroll = playerTeamElement ? playerTeamElement.scrollTop : 0;
    const enemyScroll = enemyTeamElement ? enemyTeamElement.scrollTop : 0;
    function renderTeam(team, teamClass, teamName, isEnemy = false) {
        let html = `<div class='team ${teamClass}'><h2>${teamName}</h2>`;
        const aliveUnits = team.filter(unit => unit.hp > 0);
        const downedUnits = team.filter(unit => unit.hp <= 0);
        for (const unit of aliveUnits) { html += renderUnit(unit, isEnemy) }
        for (const unit of downedUnits) { html += renderUnit(unit, isEnemy) }
        return html += `</div>`;
    }
    function renderUnit(unit, isEnemy = false) {
        const isDefeated = unit.hp <= 0;
        const isCurrentTurn = currentUnit && unit.name === currentUnit.name;
        const isStunned = unit.stun;
        return `<div class='unit ${isDefeated ? "defeated" : ""} ${unit.position === "back" ? "back" : ""} ${isCurrentTurn ? "current-turn" : ""} ${isStunned ? "stunned" : ""}'>
        ${isStunned ? '<div class="stun-indicator">STUNNED</div>' : ''}
        ${isCurrentTurn ? '<div class="turn-indicator">▶</div>' : ''}
        <div class='unit-name'>${unit.name}</div>
        <div class='position-indicator'>${unit.position === "back" ? "Backline" : ""}</div>
        ${renderUnitStats(unit, isEnemy)}
    </div>`;
}
    function renderUnitStats(unit, isEnemy = false) {
        if (unit.hp <= 0) {
            return `<div style="text-align: center; color: #ff0055; font-style: italic; padding: 10px 0;">
                DEFEATED
            </div>`;
        }
        const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
        const hpPercentage = Math.max(0, Math.min(100, (unit.hp / unit.base.hp) * 100));
        const staminaPercentage = Math.max(0, Math.min(100, (unit.resource.stamina / unit.base.resource.stamina) * 100));
        const hpLabel = isEnemy ? 'HP' : `HP: ${Math.max(0, unit.hp)}/${unit.base.hp}`;
        const staminaLabel = isEnemy ? 'Stamina' : `Stamina: ${Math.floor(unit.resource.stamina)}/${unit.base.resource.stamina}`;
        const manaLabel = isEnemy ? 'Mana' : `Mana: ${Math.floor(unit.resource.mana)}/${unit.base.resource.mana}`;
        const energyLabel = isEnemy ? 'Energy' : `Energy: ${Math.floor(unit.resource.energy)}/${unit.base.resource.energy}`;
        let stats = `
            <div class='stat-row'>
                <div class='stat-label'>${hpLabel}</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar hp-bar' style='width: ${hpPercentage}%'></div>
                </div>
            </div>
            <div class='stat-row'>
                <div class='stat-label'>${staminaLabel}</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar stamina-bar' style='width: ${staminaPercentage}%'></div>
                </div>
            </div>`;
        if (unit.base.resource.mana) {
            const manaPercentage = Math.max(0, Math.min(100, (unit.resource.mana / unit.base.resource.mana) * 100));
            stats += `
                <div class='stat-row'>
                    <div class='stat-label'>${manaLabel}</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar mana-bar' style='width: ${manaPercentage}%'></div>
                    </div>
                </div>`;
        }
        if (unit.base.resource.energy) {
            const energyPercentage = Math.max(0, Math.min(100, (unit.resource.energy / unit.base.resource.energy) * 100));
            stats += `
                <div class='stat-row'>
                    <div class='stat-label'>${energyLabel}</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar energy-bar' style='width: ${energyPercentage}%'></div>
                    </div>
                </div>`;
        }
        stats += `
            <div class='stat-row'>
                <div class='stat-label'>Ready: ${unit.timer <= 0 ? 'Yes!' : 'Charging...'}</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar timer-bar' style='width: ${timerProgress}%'></div>
                </div>
            </div>`;
            
        return stats;
    }
    const playerTeam = unitFilter("player", '');
    const enemyTeam = unitFilter("enemy", '');
    let battleDisplay = renderTeam(playerTeam, 'player-team', 'Player Team', false);
    battleDisplay += renderTeam(enemyTeam, 'enemy-team', `Enemy Team: Wave ${wave}`, true);
    document.querySelector(".battle-display").innerHTML = battleDisplay;
    setTimeout(() => {
        const newPlayerTeam = document.querySelector('.player-team');
        const newEnemyTeam = document.querySelector('.enemy-team');
        if (newPlayerTeam && playerScroll > 0) { newPlayerTeam.scrollTop = playerScroll }
        if (newEnemyTeam && enemyScroll > 0) { newEnemyTeam.scrollTop = enemyScroll }
    }, 10);
}

export function createUnit(unit, team) {
    const newUnit = cloneUnit(unit);
    let name = unit.name;
    let dupe = 1;
    while (allUnits.filter(obj => obj.name.includes(name)).some(obj => obj.name === name)) { name = `${unit.name} ${++dupe}` }
    newUnit.name = name;
    if (newUnit.position === "mid") { newUnit.position = "back" }
    newUnit.team = team;
    allUnits.push(newUnit);
    newUnit.actionsInit();
    if (newUnit.passivesInit) { newUnit.passivesInit() }
    newUnit.timer = 1000;
}

function cloneUnit(unit) {
    const newUnit = {
        name: unit.name,
        description: unit?.description,
        previousAction: [false, false, false],
        base: structuredClone(unit.base),
        mult: structuredClone(unit.mult),
        resource: { ...unit.base.resource},
        actions: {},
        elements: [...unit.base.elements],
        absorb: [],
        shield: (unit.base.elements || []).filter(e => baseElements.includes(e)),
        stun: false,
        cancel: false,
        learnedSkills: []
    };
    newUnit.actionsInit = unit.actionsInit;
    if (unit.passivesInit) {
        newUnit.passives = {};
        newUnit.passivesInit = unit.passivesInit;
    }
    for (const stat in newUnit.base) {
        if (typeof newUnit.base[stat] === 'object') { continue }
        newUnit[stat] = newUnit.base[stat];
    }
    return newUnit;
}

function regenerateResources(unit) {
    if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: regenerateResources, unit, resource: [] }) }
    if (!unit.previousAction[0]) { unit.resource.stamina = Math.min(unit.base.resource.stamina, Math.floor(unit.resource.stamina + unit.resource.staminaRegen + Number.EPSILON)) }
    if (unit.base.resource.mana && !unit.previousAction[1]) { unit.resource.mana = Math.min(unit.base.resource.mana, Math.floor(unit.resource.mana + unit.resource.manaRegen + Number.EPSILON)) }
    if (unit.base.resource.energy && !unit.previousAction[2]) { unit.resource.energy = Math.min(unit.base.resource.energy, Math.floor(unit.resource.energy + unit.resource.energyRegen + Number.EPSILON)) }
    unit.previousAction = [false, false, false];
}

export function advanceWave(x = 0) {
    if (x) { wave = x }
    let turnId = allUnits[currentTurn].name;
    if (wave < 3) {
        const re = allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === "player"));
        for (const mod of modifiers) { if (re.includes(mod.vars.caster)) { removeModifier(mod) } }
    }
        let i = allUnits.length;
    switch (wave) {
        case 2:
            for (const e of waveCalc(unitFilter("player", ""), 2)) { createUnit(e, 'enemy') }
            break;
        case 1:
            for (const e of waveCalc(unitFilter("player", ""), 1)) { createUnit(e, 'enemy') }
            break;
        default:
            return true;
    }
    for (const unit of allUnits.slice(i).filter(u => u.passivesInit)) { for (const pass in unit.passives) { unit.passives[pass].code() } }
    currentTurn = allUnits.findIndex(unit => unit.name === turnId);
    logAction(`Wave ${++wave}!`, "turn");
    if (eventState.waveChange.length) { handleEvent('waveChange', { wave }) }
    updateBattleDisplay();
}

function waveCalc(units, mult) {
    const total = units.reduce((sum, u) => sum + 2*(+u.description[0]+1)*(1.5**(+u.description[0]-3)), 0) * mult;
    let enemyPoints;
    if (total >= 200) { enemyPoints = new Map([ [Dreamer, 15], [mysticEnemy, 15], [technoEnemy, 15], [ChaosAgent, 15], [magitechEnemy, 27] ]) }
    else {
        enemyPoints = new Map([ [Experiment, 4], [Reject, 4], [CouncilMagician, 8], [CouncilScientist, 8], [Revolutionary, 8], [enemy, 8], [ArtificialSolider, 8], [Dreamer, 15], [mysticEnemy, 15], [technoEnemy, 15], [ChaosAgent, 15], [magitechEnemy, 27] ]);
        if (!units.some(u => u.description.includes("5 star")) && wave < 3) { enemyPoints.delete(magitechEnemy) }
        if (total >= 125) {
            enemyPoints.delete(Experiment);
            enemyPoints.delete(Reject);
        }
    }
    let enemies = [];
    let points = 0;
    const front = [Experiment, Reject, enemy, ArtificialSolider, mysticEnemy, magitechEnemy].filter(e => enemyPoints.has(e));
    while (points < total) {
        const enem = points === 0 ? front[Math.floor(Math.random() * front.length)] : Array.from(enemyPoints.keys())[Math.floor(Math.random() * enemyPoints.size)];
        if (points + enemyPoints.get(enem) <= total || (Math.abs(total - points - enemyPoints.get(enem)) < Math.abs(total - points))) {
            enemies.push(enem);
            points += enemyPoints.get(enem);
        } else { break }
    }
    return enemies;
}

function frontTest() {
    const playersAlive = unitFilter("player", "front", false);
    const enemiesAlive = unitFilter("enemy", "front", false);
    if (playersAlive.length && enemiesAlive.length) { return }
    if (!playersAlive.length) {
        const midLine = unitFilter("player", "mid", false);
        if (midLine.length) {
            for (const unit of midLine) {
                unit.actions.switchPosition.code();
                unit.timer += 1000;
            }
            logAction(`All player midline units moved to the frontline!`, "turn");
        } else {
            showMessage("Defeat!", "error", "selection", 0);
            return true;
        }
    }
    if (!enemiesAlive.length) {
        const midLine = unitFilter("enemy", "mid", false);
        if (midLine.length) {
            for (const unit of midLine) {
                unit.actions.switchPosition.code();
                unit.timer += 1000;
            }
            logAction(`All enemy midline units moved to the frontline!`, "turn");
        } else if (advanceWave() && !unitFilter("enemy", "front", false).length) {
            showMessage("Victory!", "success", "selection", 0);
            return true;
        }
    }
}

export async function combatTick() {
    if (currentUnit) { currentUnit.timer += 1000 }
    setUnit(null);
    updateBattleDisplay();
    await sleep(500);
    if (frontTest()) { return }
    if (currentTurn === -1) { currentTurn = 0 }
    let turn;
    while (turn == undefined) {
        for (let i = 0; i < allUnits.length; i++) {
            const unit = allUnits[(currentTurn + i) % allUnits.length];
            if (unit.hp <= 0) { continue }
            unit.timer -= unit.speed;
            if (unit.timer <= 0) {
                turn = unit;
                currentTurn = (currentTurn + i) % allUnits.length;
                break;
            }
            await sleep(0);
        }
        updateBattleDisplay();
    }
    logAction(`<strong>Turn ${turnCounter++}: ${turn.name}'s turn</strong>`, "turn");
    if (eventState.turnStart.length) { handleEvent('turnStart', { unit: turn }) }
    if (!turn.stun) {
        setUnit(turn);
        regenerateResources(turn);
        baseElements.forEach(e => {
            const i = turn.absorb.indexOf(e)
            if (i !== -1) { turn.absorb.splice(i, 1) }
        })
        turn.elements.filter(e => baseElements.includes(e)).forEach(e => { if (!turn.shield.includes(e)) { turn.shield.push(e) } })
        updateBattleDisplay();
        if (turn.team === "player") {
            updateInfoDisplay(turn);
            playerTurn(turn);
        }
        if (turn.team === "enemy") { enemyTurn(turn) }
    } else {
        logAction(`${turn.name}'s turn was skipped due to being stunned!`, "miss");
        if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit: turn }) }
        setTimeout(combatTick, 500);
    }
}

window.combatTick = combatTick;
window.updateModifiers = updateModifiers;
