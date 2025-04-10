import { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, updateMod, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers } from './combatDictionary.js';
import { initHexGrid, generateStrategicMap, grid, Hex, Grid } from './field.js';
const Honeycomb = window.Honeycomb;
let turnCounter = 1;
let currentTurn = 0;
let wave = 1;
const scout = {
    name: "Scout",
    base: {
        hp: 180,
        attack: 15,
        defense: 4,
        crit: 35,
        resist: 12,
        presence: 35,
        speed: 35,
        resource: {
            stamina: 35,
            staminaRegen: 4
        }
    },
};
const commander = {
    name: 'commander',
    base: {
        hp: 300,
        attack: 25,
        defense: 6,
        crit: 60,
        resist: 20,
        presence: 60,
        speed: 60,
        resource: {
            stamina: 60,
            staminaRegen: 6
        }
    },
}
class Battalion {
    constructor(name, commander, unit, dupe) {
        this.name = name;
        this.base = { resource: {} };
        this.mult = {
            speed: 1,
            attack: 1,
            defense: 1,
            crit: 1,
            resist: 1,
            presence: 1,
            resource: {
                staminaRegen: 1
            }
        };
        this.resource = {};
        this.commander = commander;
        this.unit = unit;
        this.dupe = dupe;
        this.actions = {};
        this.actionInit = () => {
            this.actions.move = {
                name: 'Move',
                description: 'Relocate unit to adjacent hex.',
                target: () => { selectTarget(this.actions.move, () => { playerTurn(this); }, [1, true, validHex(this.coord)], 'hex'); },
                code: (hex) => { moveUnit(this, hex[0].coord); }
            }
            this.actions.engage = {
                name: 'Engage',
                description: 'attacks adjacent unit.',
                target: () => { selectTarget(this.actions.engage, () => { playerTurn(this); }, [1, true, validHex(this.coord)], 'hex'); },
                code: (hex) => { console.log('attacked: ' + hex[0].coord); }
            }
        }
    }
}

export function startCombat() {
    initHexGrid();
    generateStrategicMap();
    createUnit(new Battalion("Player army", commander, scout, 100), "player", new Hex({ q: 8, r: 3, s: -11 }));
    createUnit(new Battalion("Enemy army", commander, scout, 50), "enemy", new Hex({ q: 3, r: 0, s: -3 }));
    updateBattleDisplay();
    combatTick();
}

function battalionStat(battalion) {
    for (const stat in battalion.unit.base) {
        if (typeof battalion.base[stat] === 'object') { continue; }
        if (stat === 'hp') { 
            battalion.base.hp = .1 * battalion.unit.base.hp * battalion.dupe;
            continue;
        }
        if (stat === 'speed') {
            battalion.base.speed = (battalion.unit.base.speed + battalion.commander.base.speed)/2 * (1 - .1 * Math.log10(battalion.dupe));
            continue;
        } 
        battalion.base[stat] = .1 * battalion.unit.base[stat] * battalion.dupe + battalion.commander.base[stat];
        resetStat(battalion, [stat]);
    }
    battalion.base.resource.stamina = .1 * battalion.unit.base.resource.stamina * battalion.dupe + battalion.commander.base.resource.stamina;
    battalion.base.resource.staminaRegen = .1 * battalion.unit.base.resource.staminaRegen * battalion.dupe + battalion.commander.base.resource.staminaRegen;
    resetStat(battalion, ['resource.staminaRegen']);
}

function validHex(centerHex, range = 1, action = 'move') {
        const spiralTraverser = Honeycomb.spiral({ start: centerHex, radius: range });
        const spiralGrid = Array.from(new Grid(Hex, spiralTraverser));
        return spiralGrid
            .filter(hex => {
                const terrainData = grid.state.terrainData.get(`${hex.q},${hex.r},${hex.s}`);
                if (!terrainData) { return false; }
                let isValid;
                switch (action) {
                    case 'move':
                        isValid = terrainData.isPassable;
                        break;
                    default:
                        isvalid = terrainData.isPassable;
                } 
                return isValid;
            })
            .map(hex => {
                const terrainData = grid.state.terrainData.get(`${hex.q},${hex.r},${hex.s}`);
                return {
                    coord: hex,
                    name: `Hex (${hex.q},${hex.r},${hex.s}) [${terrainData.type}]`,
                    terrain: terrainData.type,
                    elevation: terrainData.elevation,
                    isPassable: terrainData.isPassable,
                    unitPresent: !!terrainData.unit,
                };
            });
}

function moveUnit(unit, hex) {
    const oldKey = `${unit.coord.q},${unit.coord.r},${unit.coord.s}`;
    grid.state.terrainData.get(oldKey).unit = null;
    unit.coord = hex;
    const newKey = `${hex.q},${hex.r},${hex.s}`;
    grid.state.terrainData.get(newKey).unit = unit;
    const oldHex = document.querySelector(`[data-cube="${oldKey}"]`);
    const newHex = document.querySelector(`[data-cube="${newKey}"]`);
    if(oldHex && newHex) { newHex.appendChild(oldHex.querySelector('.battle-unit')); }
    logAction(`${unit.name} moved to (${hex.q},${hex.r},${hex.s})`);
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
            if (currentHex && !currentHex.contains(unitDiv)) { currentHex.appendChild(unitDiv); }
        }
    });
}

function createUnit(newUnit, team, coord) {
    battalionStat(newUnit);
    for (const stat in newUnit.base) {
        if (typeof newUnit.base[stat] === 'object') { continue; }
        if (newUnit.mult[stat] === undefined) { newUnit[stat] = newUnit.base[stat]; }
        else { resetStat(newUnit, [stat]); }
    }
    newUnit.previousAction = [false, false, false];
    newUnit.id = `${team}-unit-${allUnits.length}`;
    let name = newUnit.name;
    let dupe = 1;
    const filter = allUnits.filter(obj => obj.name.includes(name));
    while (filter.some(obj => obj.name === name)) { name = `${unit.name} ${++dupe}`; }
    newUnit.name = name;
    newUnit.team = team;
    newUnit.coord = coord;
    allUnits.push(newUnit);
    newUnit.actionInit();
    renderUnit(newUnit);
    newUnit.timer = 500;
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
    regenerateResources(turn);
    updateMod(turn);
    updateBattleDisplay();
    turn.timer = 500;
    if (turn.team === "player") { playerTurn(turn); }
    if (turn.team === "enemy") { enemyTurn(turn); }
    turnCounter++
}

window.combatTick = combatTick;