import { Dark } from './unit/dark.js';
import { Electric } from './unit/electric.js';
import { Servant } from './unit/servant.js';
import { ClassicJoy } from './unit/classicJoy.js';
import { DexSoldier } from './unit/dexSoldier.js';
import { Dandelion } from './unit/dandelion.js';
import { FourArcher } from './unit/fourArcher.js';
import { enemy } from './unit/enemy.js';
import { mysticEnemy } from './unit/mysticEnemy.js';
import { technoEnemy } from './unit/technoEnemy.js';
import { magitechEnemy } from './unit/magitechEnemy.js';
import { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, updateMod, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers } from './combatDictionary.js';
let turnCounter = 1;
let currentTurn = 0;
let wave = 1;

const availableUnits = [Dark, Electric, Servant, ClassicJoy, DexSoldier, Dandelion, FourArcher];
let selectedUnits = [];

Dark.description = "4 star mystic unit with high evasion, speed, and offensive capabilities";
Electric.description = "3 star magitech unit with high versitility";
Servant.description = "3 star unit with stealth and critical hit capabilities";
ClassicJoy.description = "4 star techno backline unit with high attack, low speed, and healing";
DexSoldier.description = "3 star unit with strong offensive and tank abilities and low speed";
Dandelion.description = "3 star mystic unit with decent evasion, speed, and offensive capabilities";
FourArcher.description = "3 star mystic backline unit with high luck and low speed";

function initUnitSelection() {
    const roster = document.getElementById('unit-roster');
    const selectedContainer = document.getElementById('selected-units');
    const countDisplay = selectedContainer.querySelector('h4');
    roster.innerHTML = '';
    selectedContainer.innerHTML = '<h4>Selected Units (max of 4)</h4>';
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
            if (selectedUnits.length >= 4 && !card.classList.contains('selected')) {
                showMessage('Maximum 4 units allowed!', 'warning', 'selection');
                return;
            }
            card.classList.toggle('selected');
            if (card.classList.contains('selected')) { selectedUnits.push(unit); }
            else { selectedUnits = selectedUnits.filter(u => u.name !== unit.name); }
            countDisplay.textContent = `Selected Units (${selectedUnits.length}/4)`;
            renderSelectedUnits();
        });
        roster.appendChild(card);
    });
    document.getElementById('start-with-selected').addEventListener('click', () => {
        if (selectedUnits.length === 0) {
            showMessage('Please select at least 1 unit!', 'error', 'selection');
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
    });
}

function startCombatWithSelected() {
    document.getElementById('unit-selection-panel').style.display = 'none';
    selectedUnits.forEach(unit => { createUnit(unit, 'player') });
    createUnit(enemy, 'enemy');
    createUnit(enemy, 'enemy');
    createUnit(magitechEnemy, 'enemy');
    updateBattleDisplay();
    combatTick();
}

export function startCombat() {
    document.getElementById('unit-selection-panel').style.display = 'block';
    document.getElementById('game-controls').style.display = 'none';
    initUnitSelection();
}

function getModifiersDisplay() {
    let modDisplay = "<div class='modifiers-container'><h3>Active Modifiers</h3>";
    if (modifiers.length === 0) { 
        modDisplay += "<p>No active modifiers</p>"; 
    }
    else {
        modDisplay += "<ul class='modifier-list'>";
        for (const modifier of modifiers) {
            const caster = modifier.vars.caster?.name || "System";
            const targets = modifier.vars.targets.map(u => u.name).join(", ");
            modDisplay += `
            <li class="modifier-item">
                <span class="modifier-caster">${caster}'s</span>
                <span class="modifier-name" data-tooltip="${modifier.description}">${modifier.name}.</span>
                <div class="modifier-targets">Targets: ${targets}</div>
                <div class="modifier-duration">${modifier.vars.duration} turn(s) left</div>
            </li>`;
        }
        modDisplay += "</ul>";
    }
    return modDisplay + "</div>";
}

function updateBattleDisplay() {
    let battleDisplay = getModifiersDisplay();
    battleDisplay += "<div class='battle-display'>";
    battleDisplay += "<div class='team player-team'><h2>Player Team</h2>";
    for (const unit of unitFilter("player", '')) {
        battleDisplay += `<div class='unit ${unit.hp <= 0 ? "defeated" : ""} ${unit.position === "back" ? "back" : ""}'>
            <div class='unit-name'>${unit.name}</div>
            <div class='position-indicator'>${unit.position === "back" ? "Backline" : ""}</div>`
            if (unit.hp > 0) {
                const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 3)));
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
                const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 3)));
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
    document.getElementById("battle-container").innerHTML = battleDisplay + "</div></div>";
}

function createUnit(unit, team) {
    const newUnit = cloneUnit(unit);
    let name = unit.name;
    let dupe = 1;
    const filter = allUnits.filter(obj => obj.name.includes(name));
    while (filter.some(obj => obj.name === name)) { name = `${unit.name} ${++dupe}`; }
    newUnit.name = name;
    if (newUnit.position === "mid") { newUnit.position = "back"; }
    newUnit.team = team;
    allUnits.push(newUnit);
    newUnit.actionsInit();
    newUnit.timer = 300
}

function cloneUnit(unit) {
    const newUnit = {
        name: unit.name,
        previousAction: [false, false, false],
        base: structuredClone(unit.base),
        mult: structuredClone(unit.mult),
        resource: { ...unit.base.resource },
        actions: {},
    };
    newUnit.actionsInit = unit.actionsInit;
    for (const stat in newUnit.base) {
        if (typeof newUnit.base[stat] === 'object') { continue; }
        if (newUnit.mult[stat] === undefined) { newUnit[stat] = newUnit.base[stat]; }
        else { resetStat(newUnit, [stat]); }
    }
    return newUnit;
}

function regenerateResources(unit) {
    if (!unit.previousAction[0]) { unit.resource.stamina = Math.min(unit.base.resource.stamina, Math.floor(unit.resource.stamina + (unit.resource.staminaRegen * unit.mult.resource.staminaRegen))); }
    if (unit.base.resource.mana && !unit.previousAction[1]) { unit.resource.mana = Math.min(unit.base.resource.mana, Math.floor(unit.resource.mana + (unit.resource.manaRegen * unit.mult.resource.manaRegen))); }
    if (unit.base.resource.energy && !unit.previousAction[2]) { unit.resource.energy = Math.min(unit.base.resource.energy, Math.floor(unit.resource.energy + (unit.resource.energyRegen * unit.mult.resource.energyRegen))); }
    unit.previousAction = [false, false, false];
}

function advanceWave() {
    let turnId = allUnits[currentTurn].name;
    if (wave < 3) { allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === "player" || (unit.team === "enemy" && unit.hp > 0))) }
    switch (wave) {
        case 2:
            createUnit(enemy, 'enemy');
            createUnit(mysticEnemy, 'enemy');
            createUnit(technoEnemy, 'enemy');
        case 1:
            createUnit(enemy, 'enemy');
            createUnit(enemy, 'enemy');
            createUnit(magitechEnemy, 'enemy');
            createUnit(mysticEnemy, 'enemy');
            createUnit(technoEnemy, 'enemy');
            currentTurn = allUnits.findIndex(unit => unit.name === turnId);
            wave += 1;
            break;
        default:
            return true;
    }
}

function frontTest() {
    const playersAlive = unitFilter("player", "front", false);
    const enemiesAlive = unitFilter("enemy", "front", false);
    if (playersAlive.length && enemiesAlive.length) {return;}
    if (!playersAlive.length) {
        const midLine = unitFilter("player", "mid", false);
        if (midLine.length) {
            for (const unit of midLine) { unit.actions.switchPosition.code(); }
            logAction(`All player midline units moved to the frontline!`, "turn")
        }
        else {
            showMessage("Defeat!", "error", "selection", 0);
            return true;
        }
    }
    if (!enemiesAlive.length) {
        const midLine = unitFilter("enemy", "mid", false);
        if (midLine.length) {
            for (const unit of midLine) { unit.actions.switchPosition.code(); }
            logAction(`All enemy midline units moved to the frontline!`, "turn");
        }
        const win = advanceWave();
        if (win && !unitFilter("enemy", "front", false).length) {
            showMessage("Victory!", "success", "selection", 0);
            return true;
        }
    }
}

async function combatTick() {
    updateBattleDisplay();
    await sleep(500);
    if (frontTest()) { return; }
    if (currentTurn === -1) { currentTurn = 0; }
    let turn;
    while (turn == undefined) {
        for (let i = 0; i < allUnits.length; i++) {
            const unit = allUnits[(currentTurn + i) % allUnits.length];
            if (unit.hp <= 0) { continue; }
            unit.timer -= unit.speed;
            if (unit.timer <= 0) {
                turn = unit;
                currentTurn = (currentTurn + i) % allUnits.length;
                break;
            }
            updateBattleDisplay();
            await sleep(0);
        }
    }
    logAction(`<strong>Turn ${turnCounter}: ${turn.name}'s turn</strong>`, "turn");
    regenerateResources(turn);
    updateMod(turn);
    updateBattleDisplay();
    turn.timer = 300;
    if (turn.team === "player") { playerTurn(turn); }
    if (turn.team === "enemy") { enemyTurn(turn); }
    turnCounter++
}

window.combatTick = combatTick;