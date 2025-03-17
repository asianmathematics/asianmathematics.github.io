import {Dark, Electric, Servant, ClassicJoy, enemy, mysticEnemy, technoEnemy, magitechEnemy} from './unitCombatData.js';
import { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, applyMod, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, modifierId } from './combatDictionary.js';
let turnCounter = 1;
let currentTurn = 0;
let wave = 1;

export function startCombat() {
    createUnit(Dark, 'player');
    createUnit(Electric, 'player');
    createUnit(Servant,  'player');
    createUnit(ClassicJoy, 'player')
    createUnit(enemy, 'enemy');
    createUnit(enemy, 'enemy');
    createUnit(magitechEnemy, 'enemy');
    updateBattleDisplay();
    combatTick();
}

function getModifiersDisplay() {
    let modDisplay = "<div class='modifiers-container'><h3>Active Modifiers</h3>";
    if (Object.keys(modifiers).length === 0) { modDisplay += "<p>No active modifiers</p>"; }
    else {
        modDisplay += "<ul class='modifier-list'>";
        for (const id in modifiers) {
            const mod = modifiers[id];
            modDisplay += `<li><span class="modifier-target">${mod.target.map(unit => unit.name).join(", ")}</span>: `;
            for (let i = 0; i < mod.stat.length; i++) {
                if (i > 0) modDisplay += ", ";
                modDisplay += `<span class="modifier-stat">${mod.stat[i]}</span> `;
                modDisplay += `<span class="modifier-value">${mod.value[i] > 0 ? `+${mod.value[i] * 100}%` : `${mod.value[i] * 100}%`}</span>`;
            }
            modDisplay += ` <span class="modifier-duration">(${mod.duration} turns)</span></li>`;
        }
    }
    
    return modDisplay + "</ul></div>";
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
    newUnit.actionInit();
    newUnit.timer = 300
}

function cloneUnit(unit) {
    const newUnit = structuredClone({
        name: unit.name,
        previousAction: [false, false, false],
        base: unit.base,
        mult: unit.mult,
        resource: {},
        actions: {},
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

function updateMod(unit) {
    for (const id in modifiers) {
        const mod = modifiers[id];
        if (mod.target.includes(unit)) {
            mod.duration--;
            if (mod.duration <= 0) {
                for (let i = 0; i < mod.stat.length; i++) {
                    unit.mult[mod.stat[i]] -= mod.value[i];
                    resetStat(unit, [mod.stat[i]]);
                }
                const index = mod.target.indexOf(unit);
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

function advanceWave() {
    let turnId = allUnits[currentTurn].name;
    switch (wave) {
        case 1:
            allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === "player" || (unit.team === "enemy" && unit.hp > 0)))
            createUnit(enemy, 'enemy');
            createUnit(enemy, 'enemy');
            createUnit(magitechEnemy, 'enemy');
            createUnit(mysticEnemy, 'enemy');
            createUnit(technoEnemy, 'enemy');
            currentTurn = allUnits.findIndex(unit => unit.name === turnId);
            wave +=1;
            break;
        case 2:
            allUnits.splice(0, allUnits.length, ...allUnits.filter(unit => unit.team === "player" || (unit.team === "enemy" && unit.hp > 0)))
            createUnit(enemy, 'enemy');
            createUnit(enemy, 'enemy');
            createUnit(enemy, 'enemy');
            createUnit(magitechEnemy, 'enemy');
            createUnit(mysticEnemy, 'enemy');
            createUnit(mysticEnemy, 'enemy');
            createUnit(technoEnemy, 'enemy');
            createUnit(technoEnemy, 'enemy');
            currentTurn = allUnits.findIndex(unit => unit.name === turnId);
            wave += 1;
            break;
        case 3:
        default:
            return true;
    }
}

function frontTest() {
    const playersAlive = unitFilter("player", "front", false);
    const enemiesAlive = unitFilter("enemy", "front", false);
    if (!playersAlive.length || !enemiesAlive.length) {
        if (!playersAlive.length) {
            const midLine = unitFilter("player", "mid", false);
            if (midLine.length) {
                for (const unit of midLine) { unit.position = "front"; }
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