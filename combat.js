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
import { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, eventState } from './combatDictionary.js';
let turnCounter = 1;
let currentTurn = 0;
let wave = 1;
const gameState = {
    isCombatActive: false,
    isActionInProgress: false,
};
const uiElements = {};
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
    initBattleDisplay();
    gameLoop();
}

export function startCombat() {
    gameState.isCombatActive = true;
    document.getElementById('unit-selection-panel').style.display = 'block';
    document.getElementById('game-controls').style.display = 'none';
    initUnitSelection();
}

function initBattleDisplay() {
    const playerTeamContainer = document.querySelector('.player-team');
    const enemyTeamContainer = document.querySelector('.enemy-team');
    playerTeamContainer.innerHTML = '<h2 class="team-header">Player Team</h2><div class="unit-row"></div>';
    enemyTeamContainer.innerHTML = '<h2 class="team-header">Enemy Team: Wave ' + wave + '</h2><div class="unit-row"></div>';
    const playerUnitRow = playerTeamContainer.querySelector('.unit-row');
    const enemyUnitRow = enemyTeamContainer.querySelector('.unit-row');
    allUnits.forEach(unit => {
        const unitContainer = document.createElement('div');
        unitContainer.className = `unit ${unit.position === "back" ? "back" : ""}`;
        unitContainer.id = `unit-container-${unit.name}`;
        let innerHTML = `
            <div class='unit-name'>${unit.name}</div>
            <div class='position-indicator'>${unit.position === "back" ? "Backline" : ""}</div>
            <div class='stat-row'>
                <div class='stat-label'>HP: <span id="hp-val-${unit.name}">${Math.max(0, unit.hp)}/${unit.base.hp}</span></div>
                <div class='stat-bar-container'><div class='stat-bar hp-bar' id="hp-bar-${unit.name}"></div></div>
            </div>
            <div class='stat-row'>
                <div class='stat-label'>Stamina: <span id="stamina-val-${unit.name}">${Math.floor(unit.resource.stamina)}/${unit.base.resource.stamina}</span></div>
                <div class='stat-bar-container'><div class='stat-bar stamina-bar' id="stamina-bar-${unit.name}"></div></div>
            </div>
        `;
        if (unit.base.resource.mana) {
            innerHTML += `<div class='stat-row'>
                <div class='stat-label'>Mana: <span id="mana-val-${unit.name}">${Math.floor(unit.resource.mana)}/${unit.base.resource.mana}</span></div>
                <div class='stat-bar-container'><div class='stat-bar mana-bar' id="mana-bar-${unit.name}"></div></div>
            </div>`;
        }
        if (unit.base.resource.energy) {
            innerHTML += `<div class='stat-row'>
                <div class='stat-label'>Energy: <span id="energy-val-${unit.name}">${Math.floor(unit.resource.energy)}/${unit.base.resource.energy}</span></div>
                <div class='stat-bar-container'><div class='stat-bar energy-bar' id="energy-bar-${unit.name}"></div></div>
            </div>`;
        }
        innerHTML += `<div class='stat-row'>
            <div class='stat-label'>Ready: <span id="ready-val-${unit.name}">Charging...</span></div>
            <div class='stat-bar-container'><div class='stat-bar timer-bar' id="timer-bar-${unit.name}"></div></div>
        </div>`;
        unitContainer.innerHTML = innerHTML;
        if (unit.team === 'player') { playerUnitRow.appendChild(unitContainer); }
        else { enemyUnitRow.appendChild(unitContainer); }
        uiElements[unit.name] = {
            container: unitContainer,
            hpVal: document.getElementById(`hp-val-${unit.name}`),
            hpBar: document.getElementById(`hp-bar-${unit.name}`),
            staminaVal: document.getElementById(`stamina-val-${unit.name}`),
            staminaBar: document.getElementById(`stamina-bar-${unit.name}`),
            manaVal: document.getElementById(`mana-val-${unit.name}`),
            manaBar: document.getElementById(`mana-bar-${unit.name}`),
            energyVal: document.getElementById(`energy-val-${unit.name}`),
            energyBar: document.getElementById(`energy-bar-${unit.name}`),
            readyVal: document.getElementById(`ready-val-${unit.name}`),
            timerBar: document.getElementById(`timer-bar-${unit.name}`),
        };
        renderUnitStats(unit);
    });
}

function renderUnitStats(unit) {
    const elements = uiElements[unit.name];
    if (!elements) { return }
    elements.hpVal.textContent = `${Math.max(0, unit.hp)}/${unit.base.hp}`;
    elements.hpBar.style.width = `${Math.max(0, (unit.hp / unit.base.hp) * 100)}%`;
    elements.staminaVal.textContent = `${Math.floor(unit.resource.stamina)}/${unit.base.resource.stamina}`;
    elements.staminaBar.style.width = `${(unit.resource.stamina / unit.base.resource.stamina) * 100}%`;
    if (elements.manaBar) {
        elements.manaVal.textContent = `${Math.floor(unit.resource.mana)}/${unit.base.resource.mana}`;
        elements.manaBar.style.width = `${(unit.resource.mana / unit.base.resource.mana) * 100}%`;
    }
    if (elements.energyBar) {
        elements.energyVal.textContent = `${Math.floor(unit.resource.energy)}/${unit.base.resource.energy}`;
        elements.energyBar.style.width = `${(unit.resource.energy / unit.base.resource.energy) * 100}%`;
    }
    if (unit.hp <= 0) { elements.container.classList.add('defeated') }
    else { elements.container.classList.remove('defeated') }
}

function renderAllTimers() {
    for (const unit of allUnits) {
        if (unit.hp > 0) {
            const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
            uiElements[unit.name].timerBar.style.width = `${timerProgress}%`;
            uiElements[unit.name].readyVal.textContent = unit.timer <= 0 ? 'Yes!' : 'Charging...';
        }
    }
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
    newUnit.timer = 1000;
    newUnit.stun = false;
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
            if (eventState.waveChange.flag) { handleEvent('waveChange', {wave}) }
            initBattleDisplay();
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

function gameLoop() {
    if (!gameState.isCombatActive) { return }
    for (const unit of allUnits) { renderUnitStats(unit) }
    findNextTurn()
}

async function findNextTurn() {
    let readyUnits = [];
    while (readyUnits.length === 0) {
        for (const unit of allUnits) {
            if (unit.hp > 0) {
                unit.timer -= unit.speed;
                if (unit.timer <= 0) { readyUnits.push(unit) }
            }
        }
        requestAnimationFrame(renderAllTimers);
        await sleep(10);
    }
    if (readyUnits.length !== 1) { readyUnits.sort((a, b) => a.timer - b.timer) }
    takeTurn(readyUnits[0]);
}

async function takeTurn(turnUnit) {
    if (frontTest()) {
        gameState.isCombatActive = false;
        return;
    }
    logAction(`<strong>Turn ${turnCounter}: ${turnUnit.name}'s turn</strong>`, "turn");
    regenerateResources(turnUnit);
    renderUnitStats(turnUnit);
    if (eventState.turnStart.flag) { handleEvent('turnStart', { unit: turnUnit }) }
    turnUnit.timer += 1000;
    if (turnUnit.stun) {
        logAction(`${turnUnit.name}'s turn was skipped due to being stunned!`, "skip");
        if (eventState.turnEnd.flag) { handleEvent('turnEnd', { unit: turnUnit }) }
        turnCounter++;
        gameState.isActionInProgress = false;
        return;
    }
    if (turnUnit.team === "player") { playerTurn(turnUnit) }
    else { enemyTurn(turnUnit) }
    if (eventState.turnEnd.flag) { handleEvent('turnEnd', { unit: turnUnit }) }
    turnCounter++;
}
window.combatTick = function() { gameLoop() }