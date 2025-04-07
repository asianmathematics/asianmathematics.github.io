import { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, updateMod, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers } from './combatDictionary.js';
import { initHexGrid, grid, Hex, Grid } from './field.js';
const Honeycomb = window.Honeycomb;
let turnCounter = 1;
let currentTurn = 0;
let wave = 1;
const scout = {
    name: "Scout",
    base: {
        hp: 100,
        speed: 20,
        attack: 15,
        defense: 8,
        movement: 2,
    },
    mult: {},
    actionInit: function() {
        this.actions.move = {
            name: 'Move',
            description: 'Relocate unit to adjacent hex',
            target: () => {
                try {
                console.log("Scout coord: " + this.coord);
                const validHexes = validHex(this.coord, 1);
                console.log("Valid hexes found: " + validHexes.length);
                selectTarget(
                    this.actions.move, 
                    () => { playerTurn(this); }, 
                    [1, true, validHexes], 
                    'hex'
                );
                } catch(err){ console.log(err.message); }
            },
            code: (hex) => {
                console.log("Selected hex for movement:", hex[0]);
                moveUnit(this, hex[0].coord);
                combatTick();
            }
        }
    }
};

export function startCombat() {
    initHexGrid();
    createUnit(scout, "player", new Hex({ q: 5, r: 5, s: -10 }));
    updateBattleDisplay();
    combatTick();
}

function validHex(centerHex, range, actionType = 'move') {
    try {
        const spiralTraverser = Honeycomb.spiral({ start: centerHex, radius: range });
        const spiralGrid = Array.from(new Grid(Hex, spiralTraverser));
        console.log("Center Hex (q, r, s):", centerHex.q, centerHex.r, centerHex.s);
        return Array.from(spiralGrid
            .filter(hex => {
                const hexKey = `${hex.q},${hex.r},${hex.s}`;
                const terrainData = grid.state.terrainData.get(hexKey);
                if (!terrainData) return false;
                let isValid = terrainData.isPassable;
                if (actionType === 'move') {
                    isValid = isValid && !terrainData.unit;
                }
                return isValid;
            })
            .map(hex => {
                const hexKey = `${hex.q},${hex.r},${hex.s}`;
                const terrainData = grid.state.terrainData.get(hexKey);
                console.log("Valid hex found: " + hexKey);
                return {
                    coord: hex,
                    name: `Hex (${hex.q},${hex.r},${hex.s}) [${terrainData.type}]`,
                    terrain: terrainData.type,
                    elevation: terrainData.elevation,
                    isPassable: terrainData.isPassable,
                    unitPresent: !!terrainData.unit,
                };
            }));
    } catch(err) {
        console.log("validHex error:", err);
        return [];
    }
}

function moveUnit(unit, hex) {
    const oldKey = `${unit.coord.q},${unit.coord.r},${unit.coord.s}`;
    grid.state.terrainData.get(oldKey).unit = null;
    unit.coord = hex;
    const newKey = `${hex.q},${hex.r},${hex.s}`;
    grid.state.terrainData.get(newKey).unit = unit;
    const oldHex = document.querySelector(`[data-cube="${oldKey}"]`);
    const newHex = document.querySelector(`[data-cube="${newKey}"]`);
    if(oldHex && newHex) {
        const unitDiv = oldHex.querySelector('.battle-unit');
        newHex.appendChild(unitDiv);
    }
    logAction(`${unit.name} moved to (${hex.x},${hex.y},${hex.z})`);
}

function renderUnit(unit) {
    const hexElement = document.querySelector(`[data-cube="${unit.coord.q},${unit.coord.r},${unit.coord.s}"]`);
    if (hexElement && !hexElement.querySelector('.battle-unit')) {
        const unitDiv = document.createElement('div');
        unitDiv.className = `battle-unit ${unit.team}`;
        unitDiv.id = unit.id;
        hexElement.appendChild(unitDiv);
    }
}

function updateBattleDisplay() {
    allUnits.forEach(unit => {
        const unitDiv = document.getElementById(unit.id);
        if (unitDiv) {
            const currentHex = document.querySelector(`[data-cube="${unit.coord.q},${unit.coord.r},${unit.coord.s}"]`);
            if (currentHex && !currentHex.contains(unitDiv)) {
                currentHex.appendChild(unitDiv);
            }
        }
    });
}

function createUnit(unit, team, coord) {
    const newUnit = cloneUnit(unit);
    newUnit.id = `${team}-unit-${allUnits.length}`;
    let name = unit.name;
    let dupe = 1;
    const filter = allUnits.filter(obj => obj.name.includes(name));
    while (filter.some(obj => obj.name === name)) { name = `${unit.name} ${++dupe}`; }
    newUnit.name = name;
    newUnit.team = team;
    newUnit.coord = coord;
    allUnits.push(newUnit);
    newUnit.actionInit();
    renderUnit(newUnit);
    newUnit.timer = 100;
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
    newUnit.actionInit = unit.actionInit;
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

async function combatTick() {
    updateBattleDisplay();
    await sleep(500);
    if (false /*insert win condition here*/) { return; }
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
    //regenerateResources(turn);
    updateMod(turn);
    updateBattleDisplay();
    turn.timer = 100;
    if (turn.team === "player") { playerTurn(turn); }
    if (turn.team === "enemy") { enemyTurn(turn); }
    turnCounter++
}

window.combatTick = combatTick;