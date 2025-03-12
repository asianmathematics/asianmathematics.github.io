import {Dark, Electric, Servant, enemy} from './unitCombatData.js';
import { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, applyMod, getModifiersDisplay, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, modifierId } from './combatDictionary.js';
let turnCounter = 1;

export function startCombat() {
    createUnit(Dark, 'player');
    createUnit(Electric, 'player');
    createUnit(Servant,  'player');
    for (let i = 8; i > 0; i--) { createUnit(enemy, 'enemy'); }
    updateBattleDisplay();
    combatTick();
}

function updateBattleDisplay() {
    let battleDisplay = getModifiersDisplay();
    battleDisplay += "<div class='battle-display'>";
    battleDisplay += "<div class='team player-team'><h2>Player Team</h2>";
    for (const unit of unitFilter("player", '')) {
        const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
        const hpPercentage = Math.max(0, Math.min(100, (unit.hp / unit.base.hp) * 100));
        const staminaPercentage = Math.max(0, Math.min(100, (unit.resource.stamina / unit.base.resource.stamina) * 100));
        
        battleDisplay += `<div class='unit ${unit.hp <= 0 ? "defeated" : ""}'>
            <div class='unit-name'>${unit.name}</div>
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
            </div>
        </div>`;
    }
    battleDisplay += "</div><div class='team enemy-team'><h2>Enemy Team</h2>";
    for (const unit of unitFilter("enemy", '')) {
        const timerProgress = Math.max(0, Math.min(100, 100 - (unit.timer / 10)));
        const hpPercentage = Math.max(0, Math.min(100, (unit.hp / unit.base.hp) * 100));
        const staminaPercentage = Math.max(0, Math.min(100, (unit.resource.stamina / unit.base.resource.stamina) * 100));
        
        battleDisplay += `<div class='unit ${unit.hp <= 0 ? "defeated" : ""}'>
            <div class='unit-name'>${unit.name}</div>
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
                <div class='stat-label'>Ready</div>
                <div class='stat-bar-container'>
                    <div class='stat-bar timer-bar' style='width: ${timerProgress}%'></div>
                </div>
            </div>
        </div>`;
    }
    document.getElementById("battle-container").innerHTML = battleDisplay + "</div></div>";
}

function createUnit(unit, team) {
    let newUnit = cloneUnit(unit);
    let name = unit.name;
    let dupe = 1;
    let filter = allUnits.filter(obj => obj.name.includes(name));
    while (filter.some(obj => obj.name === name)) { name = `${unit.name} ${++dupe}`; }
    newUnit.name = name;
    if (newUnit.position === "mid") { newUnit.position = "back"; }
    newUnit.team = team;
    allUnits.push(newUnit);
    newUnit.actionInit();
}

function cloneUnit(unit) {
    const newUnit = structuredClone({
        name: unit.name,
        previousAction: [false, false, false],
        base: unit.base,
        mult: unit.mult,
        resource: {},
        actions: {},
        timer: 1000,
    });
    newUnit.actionInit = unit.actionInit;
    for (const stat in newUnit.base) {
        if (typeof newUnit.base[stat] === 'object') { continue; }
        if (newUnit.mult[stat] == undefined) { newUnit[stat] = newUnit.base[stat]; continue; }
        resetStat(newUnit, [stat]);
    }
    newUnit.resource.stamina = unit.base.resource.stamina;
    newUnit.resource.staminaRegen = unit.base.resource.staminaRegen;
    if (unit.base.resource.mana) {
        newUnit.resource.mana = unit.base.resource.mana;
        newUnit.resource.manaRegen = unit.base.resource.manaRegen;
    }
    if (unit.base.resource.energy) {
        newUnit.resource.energy = unit.base.resource.energy;
        newUnit.resource.energyRegen = unit.base.resource.energyRegen;
    }
    return newUnit;
}

/* old name check
function unitNameCheck(unit) {
    const nameCheck = '^' + unit.name + '$|^' + unit.name + '\\s\d$|^' + unit.name + '\\s\d\d$';
    let dupe = 1;
    for (let x of allUnits) { dupe += nameCheck.test(x.name); }
    if (dupe > 1) { unit.name += ' ' + dupe; }
}*/

function updateMod(unit) {
    for (const id in modifiers) {
        const mod = modifiers[id];
        if (mod.target.includes(unit)) {
            mod.duration--;
            if (mod.duration <= 0) {
                unit.mult[mod.stat] -= mod.value;
                const index = mod.target.indexOf(unit);
                resetStat(unit, [mod.stat])
                if (index > -1) { mod.target.splice(index, 1)}
            }
        }
        if (mod.target.length === 0) { delete modifiers[id]; }
    }
}

function regenerateResources(unit) {
    if (!unit.previousAction[0]) {
        unit.resource.stamina = Math.min(unit.base.resource.stamina, Math.floor(unit.resource.stamina + (unit.resource.staminaRegen * unit.mult.resource.staminaRegen)));
    }
    if (unit.base.resource.mana && !unit.previousAction[1]) {
        unit.resource.mana = Math.min(unit.base.resource.mana, Math.floor(unit.resource.mana + (unit.resource.manaRegen * unit.mult.resource.manaRegen)));
    }
    if (unit.base.resource.energy && !unit.previousAction[2]) {
        unit.resource.energy = Math.min(unit.base.resource.energy, Math.floor(unit.resource.energy + (unit.resource.energyRegen * unit.mult.resource.energyRegen)));
    }
    unit.previousAction = [false, false, false];
}

async function combatTick() {
    updateBattleDisplay();
    await sleep(500);
    const playersAlive = unitFilter("player", "front", false);
    const enemiesAlive = unitFilter("enemy", "front", false);
    if (!playersAlive.length || !enemiesAlive.length) {
        if (playersAlive.length) { showMessage("Victory!", "success", "selection", 0); }
        else { showMessage("Defeat!", "error", "selection", 0); }
        return;
    }
    let turn;
    while (turn == undefined) {
        for (const unit of allUnits) {
            if (unit.hp <= 0) { continue; }
            unit.timer -= unit.speed;
            updateBattleDisplay();
            await sleep(0);
            if (unit.timer <= 0) { 
                turn = unit;
                break;
            }
        }
    }
    logAction(`<strong>Turn ${turnCounter}: ${turn.name}'s turn</strong>`, "turn");
    regenerateResources(turn);
    updateMod(turn);
    updateBattleDisplay();
    turn.timer = 1000;
    if (turn.team === "player") { playerTurn(turn); }
    if (turn.team === "enemy") { enemyTurn(turn); }
    turnCounter++
}

window.combatTick = combatTick;