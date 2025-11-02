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
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from './combatDictionary.js';
let turnCounter = 1;
let currentTurn = 0;
let wave = 1;

const availableUnits = [Dark, Electric, Servant, ClassicJoy, DexSoldier, Dandelion, FourArcher, Paragon, Righty001, Mannequin, Idol, Silhouette];
let selectedUnits = [];

Dark.description = "5 star mystic unit with high evasion, speed, and crowd control capabilities";
Electric.description = "4 star magitech unit with high versatility";
Servant.description = "4 star unit with stealth and critical hit capabilities";
ClassicJoy.description = "4 star techno backline unit with high attack and healing capabilities";
DexSoldier.description = "3 star unit with high tank abilities and low speed";
Dandelion.description = "4 star mystic unit with decent evasion, speed, and crowd control capabilities";
FourArcher.description = "3 star mystic backline unit with increased luck and low speed";
Paragon.description = "5 star techno backline unit with good healing";
Righty001.description = "5 star techno midline unit with high speed and critical hit capabilities";
Mannequin.description = "3 star techno midline unit with stealth capabilities";
Idol.description = "4 star magitech backline unit with powerful healing, buffs and debuffs";
Silhouette.description = "3 star mystic midline unit with decent versatility"

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
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        const name = document.createElement('strong');
        name.textContent = unit.name;
        const tooltipText = document.createElement('span');
        tooltipText.className = 'tooltiptext';
        tooltipText.textContent = unit.description;
        tooltip.appendChild(name);
        tooltip.appendChild(tooltipText);
        card.appendChild(tooltip);
        card.addEventListener('click', () => {
            unit.actionsInit();
            updateInfoDisplay(unit);
            if (selectedUnits.length >= 6 && !card.classList.contains('selected')) {
                showMessage('Maximum 6 units allowed!', 'warning', 'selection');
                return;
            }
            card.classList.toggle('selected');
            if (card.classList.contains('selected')) { selectedUnits.push(unit) }
            else { selectedUnits = selectedUnits.filter(u => u.name !== unit.name) }
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
}

function renderSelectedUnits() {
    const container = document.getElementById('selected-units');
    container.querySelectorAll('.unit-card').forEach(card => card.remove());
    selectedUnits.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'unit-card selected';
        card.innerHTML = `<strong>${unit.name}</strong>`;
        container.appendChild(card);
        card.addEventListener('click', () => { updateInfoDisplay(unit) })
    });
}

function startCombatWithSelected() {
    document.getElementById('unit-selection-panel').style.display = 'none';
    selectedUnits.forEach(unit => { createUnit(unit, 'player') });
    if (wave > 0) { for (const e of waveCalc(unitFilter("player", ""), .5)) { createUnit(e, 'enemy') } }
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
    for (const resName in unit.resource) {
        const resValue = unit.resource[resName].toFixed(0);
        const label = resName.charAt(0).toUpperCase() + resName.slice(1);
        if (!unit.mult.resource[resName]) { html += `<div class="stat-line"><span>${label}</span><span>${resValue} / ${unit.base.resource[resName].toFixed(0)}</span></div>` }
        else { html += `<div class="stat-line"><span>${label}</span><span>${resValue}</span></div>` }
    }
    html += `</div>`;
    if (unit.actions && Object.keys(unit.actions).length > 0) {
        html += `<div class="right-column">
            <h4>Actions</h4>`;
        for (const actionKey in unit.actions) {
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
    infoDisplay.innerHTML = html + '</div>';
}

export function startCombat() {
    document.getElementById('unit-selection-panel').style.display = 'block';
    document.getElementById('game-controls').style.display = 'none';
    initUnitSelection();
}

function updateModifiers() {
    let modDisplay = "<h3>Active Modifiers</h3>";
    if (modifiers.length === 0) { modDisplay += "<p>No active modifiers</p>" }
    else {
        modDisplay += "<ul class='modifier-list'>";
        for (const modifier of modifiers) {
            modDisplay += `
            <li class="modifier-item">
                <!-- <img class="modifier-icon" src="icons/${modifier.vars.icon}" alt="${modifier.name} icon"> -->
                <span class="modifier-caster">${modifier.vars.caster?.name || "System"}'s</span>
                <span class="modifier-name" data-tooltip="${modifier.description}">${modifier.name}.</span>
                <div class="modifier-targets">Targets: ${modifier.vars?.target?.name || modifier.vars.targets.map(u => u.name).join(", ")}</div>
                <div class="modifier-duration">${modifier.vars.duration} turn(s) left</div>
            </li>`;
        }
        modDisplay += "</ul>";
    }
    document.querySelector(".modifiers-container").innerHTML = modDisplay;
}

function updateBattleDisplay() {
    updateModifiers();
    let battleDisplay = "<div class='team player-team'><h2>Player Team</h2>";
    for (const unit of unitFilter("player", '')) {
        battleDisplay += `<div class='unit ${unit.hp <= 0 ? "defeated" : ""} ${unit.position === "back" ? "back" : ""}'>
            <div class='unit-name'>${unit.name}</div>
            <div class='position-indicator'>${unit.position === "back" ? "Backline" : ""}</div>`
            if (unit.hp > 0) {
                const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
                const hpPercentage = Math.max(0, Math.min(100, (unit.hp / unit.base.hp) * 100));
                const staminaPercentage = Math.max(0, Math.min(100, (unit.resource.stamina / unit.base.resource.stamina) * 100));
                battleDisplay += `
                <div class='stat-row'>
                    <div class='stat-label'>HP: ${Math.max(0, unit.hp)}/${unit.base.hp}</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar hp-bar' style='width: ${hpPercentage}%'></div>
                    </div>
                </div>
                <div class='stat-row'>
                    <div class='stat-label'>Stamina: ${Math.floor(unit.resource.stamina)}/${unit.base.resource.stamina}</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar stamina-bar' style='width: ${staminaPercentage}%'></div>
                    </div>
                </div>`;
                if (unit.base.resource.mana) {
                    const manaPercentage = Math.max(0, Math.min(100, (unit.resource.mana / unit.base.resource.mana) * 100));
                    battleDisplay += `
                    <div class='stat-row'>
                        <div class='stat-label'>Mana: ${Math.floor(unit.resource.mana)}/${unit.base.resource.mana}</div>
                        <div class='stat-bar-container'>
                            <div class='stat-bar mana-bar' style='width: ${manaPercentage}%'></div>
                        </div>
                    </div>`;
                }
                if (unit.base.resource.energy) {
                    const energyPercentage = Math.max(0, Math.min(100, (unit.resource.energy / unit.base.resource.energy) * 100));
                    battleDisplay += `
                    <div class='stat-row'>
                        <div class='stat-label'>Energy: ${Math.floor(unit.resource.energy)}/${unit.base.resource.energy}</div>
                        <div class='stat-bar-container'>
                            <div class='stat-bar energy-bar' style='width: ${energyPercentage}%'></div>
                        </div>
                    </div>`;
                }
                battleDisplay += `
                <div class='stat-row'>
                    <div class='stat-label'>Ready: ${unit.timer <= 0 ? 'Yes!' : 'Charging...'}</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar timer-bar' style='width: ${timerProgress}%'></div>
                    </div>
                </div>`;
            }
            battleDisplay += `</div>`;
    }
    battleDisplay += `</div><div class='team enemy-team'><h2>Enemy Team: Wave ${wave}</h2>`;
    for (const unit of unitFilter("enemy", '')) {
        battleDisplay += `<div class='unit ${unit.hp <= 0 ? "defeated" : ""} ${unit.position === "back" ? "back" : ""}'>
            <div class='unit-name'>${unit.name}</div>
            <div class='position-indicator'>${unit.position === "back" ? "Backline" : ""}</div>`
            if (unit.hp > 0) {
                const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
                const hpPercentage = Math.max(0, Math.min(100, (unit.hp / unit.base.hp) * 100));
                const staminaPercentage = Math.max(0, Math.min(100, (unit.resource.stamina / unit.base.resource.stamina) * 100));
                battleDisplay += `
            <div class='stat-row'>
                    <div class='stat-label'>HP</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar hp-bar' style='width: ${hpPercentage}%'></div>
                    </div>
            </div>
            <div class='stat-row'>
                    <div class='stat-label'>Stamina</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar stamina-bar' style='width: ${staminaPercentage}%'></div>
            </div>
                </div>`;
        if (unit.base.resource.mana) {
                    const manaPercentage = Math.max(0, Math.min(100, (unit.resource.mana / unit.base.resource.mana) * 100));
                    battleDisplay += `
                    <div class='stat-row'>
                        <div class='stat-label'>Mana</div>
                        <div class='stat-bar-container'>
                            <div class='stat-bar mana-bar' style='width: ${manaPercentage}%'></div>
                        </div>
            </div>`;
        }
        if (unit.base.resource.energy) {
                    const energyPercentage = Math.max(0, Math.min(100, (unit.resource.energy / unit.base.resource.energy) * 100));
                    battleDisplay += `
                    <div class='stat-row'>
                        <div class='stat-label'>Energy</div>
                        <div class='stat-bar-container'>
                            <div class='stat-bar energy-bar' style='width: ${energyPercentage}%'></div>
                        </div>
            </div>`;
        }
                battleDisplay += `
                <div class='stat-row'>
                    <div class='stat-label'>Ready: ${unit.timer <= 0 ? 'Yes!' : 'Charging...'}</div>
                    <div class='stat-bar-container'>
                        <div class='stat-bar timer-bar' style='width: ${timerProgress}%'></div>
                    </div>
        </div>`;
            }
            battleDisplay += `</div>`;
    }
    document.querySelector(".battle-display").innerHTML = battleDisplay;
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
        cancel: false
    };
    newUnit.actionsInit = unit.actionsInit;
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
    if (wave < 3) { allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === "player" || (unit.team === "enemy" && unit.hp > 0))) }
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
    currentTurn = allUnits.findIndex(unit => unit.name === turnId);
    wave++;
    if (eventState.waveChange.length) { handleEvent('waveChange', { wave }) }
    updateBattleDisplay();
}

function waveCalc(units, mult) {
    const total = units.reduce((sum, u) => sum + ((+u.description[0]+10.5)**2)/2 - 75.125, 0) * mult;
    const enemyPoints = new Map([ [enemy, 16], [mysticEnemy, 30], [technoEnemy, 30], [magitechEnemy, 45] ]);
    if (!units.some(u => u.description.includes("5 star")) && wave < 3) { enemyPoints.delete(magitechEnemy) }
    let enemies = [];
    let points = 0;
    while (points < total) {
        const enemy = Array.from(enemyPoints.keys())[Math.floor(Math.random() * enemyPoints.size)];
        if (points + enemyPoints.get(enemy) <= total || (Math.abs(total - points - enemyPoints.get(enemy)) < Math.abs(total - points))) {
            enemies.push(enemy);
            points += enemyPoints.get(enemy);
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
    refreshState();
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
    turn.timer += 1000;
    if (!turn.stun) {
        setUnit(turn)
        regenerateResources(turn);
        turn.absorb = [];
        turn.shield = (turn.base.elements || []).filter(e => baseElements.includes(e));
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