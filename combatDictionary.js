const allUnits = [];
const modifiers = [];
let currentUnit = null;
let currentAction = null;
const baseElements = ["death/darkness", "light/illusion", "knowledge/memory", "goner/entropy", "harmonic/change", "inertia/cold", "radiance/purity", "anomaly/synthetic", "nature/life"]
const elementCombo = {
    "Death/Darkness": ["light/illusion", "nature/life"],
    "Light/Illusion": ["death/darkness", "knowledge/memory"],
    "Knowledge/Memory": ["light/illusion", "goner/entropy"],
    "Goner/Entropy": ["knowledge/memory", "harmonic/change"],
    "Harmonic/Change": ["goner/entropy", "inertia/cold"],
    "Inertia/Cold": ["harmonic/change", "radiance/purity"],
    "Radiance/Purity": ["inertia/cold", "anomaly/synthetic"],
    "Anomaly/synthetic": ["radiance/purity", "nature/life"],
    "Nature/Life": ["anomaly/synthetic", "death/darkness"]
};

function refreshState() { currentUnit = currentAction = null }
function setUnit(unit) { currentUnit = unit }

class Modifier {
    constructor(name, description, vars, initFunc, onTurnFunc) {
      this.name = name;
      this.description = description;
      this.vars = vars;
      this.init = () => initFunc(this.vars);
      this.onTurn = (unit) => onTurnFunc(this.vars, unit);
      modifiers.push(this);
      this.init();
    }
}

function updateMod(unit) { for (let i = modifiers.length - 1; i >= 0; i--) { if (modifiers[i].onTurn(unit)) { modifiers.splice(i, 1) } } }

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function unitFilter(team, position, downed = null) { return allUnits.filter(unit => { return (team === '' || unit.team === team) && (position === "mid" ? unit.base.position === "mid" : position === '' || unit.position === position) && (downed === null ? true : (downed ? unit.hp <= 0 : unit.hp > 0)) }) }

function logAction(message, type = 'info') {
    const logContainer = document.getElementById('action-log');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}-entry`;
    logEntry.innerHTML = message;
    logContainer.appendChild(logEntry);
    const entries = logContainer.children;
    /*const maxEntries = window.innerWidth < 800 ? 100 : 250;
    while (entries.length > maxEntries) { logContainer.removeChild(entries[0]); }*/
    logContainer.scrollTop = logContainer.scrollHeight;
}

function resistDebuff(attacker, defenders) {
    const will = []
    for (const unit of defenders) {
        const roll = Math.floor(Math.random() * 100 + 1);
        if (roll === 1 || roll === 100) {
            will.push(roll);
            continue;
        }
        will.push(((attacker.presence + attacker.focus) / Math.max(200 - (attacker.presence + attacker.focus) + (unit.presence + unit.resist), 20) ) + roll);
    }
    return will;
}

function resetStat(unit, statList, values = null, add = true) {
    if (values && values.length > 0) {
        for (let i = 0; i < Math.min(statList.length, values.length); i++) {
            if (statList[i].includes('.')) {
                const [parent, child] = statList[i].split('.');
                unit.mult[parent][child] += add ? values[i] : -values[i];
            } else { unit.mult[statList[i]] += add ? values[i] : -values[i] }
        }
    }
    for (const stat of statList) {
        if (stat.includes('.')) {
            const [parent, child] = stat.split('.');
            unit[parent][child] = unit.base[parent][child] * Math.max(0.2, unit.mult[parent][child]);
        } else { unit[stat] = unit.base[stat] * Math.max(0.2, unit.mult[stat]) }
    }
}

function enemyTurn(unit) {
    const availableActions = {};
    let totalWeight = 0;
    for (const action in unit.actions.actionWeight) {
        const actionObj = unit.actions[action]
        let useable = true;
        if (actionObj.cost) {
            for (const resource in actionObj.cost) {
                if (unit.resource[resource] < actionObj.cost[resource]) {
                    useable = false;
                    break;
                }
            }
        }
        if (useable) {
            availableActions[action] = unit.actions.actionWeight[action];
            totalWeight += unit.actions.actionWeight[action];
        }
    }
    if (totalWeight === 0) {
        showMessage(`${unit.name} has no available actions!`, "warning", "message-container");
        setTimeout(window.combatTick, 1000);
        return;
    }
    const randChoice = Math.random() * totalWeight;
    let cumulativeWeight = 0
    for (const action in availableActions) {
        cumulativeWeight += unit.actions.actionWeight[action];
        if (randChoice <= cumulativeWeight) {
            currentAction = unit.actions[action];
            unit.actions[action].code();
            break;
        }
    }
    setTimeout(window.combatTick, 1000);
}

function randTarget(unitList = allUnits, count = 1, trueRand = false) {
    if (count === 1) {
        if (unitList.length === 1) { return unitList[0] }
        if (trueRand) { return [unitList[Math.floor(Math.random() * unitList.length)]] }
        const randChoice = Math.random() * unitList.reduce((sum, obj) => sum + obj.presence, 0);
        let cumulativePresence = 0;
        for (const obj of unitList) {
            cumulativePresence += obj.presence;
            if (randChoice <= cumulativePresence) { return obj }
        }
    }
    const selectedTargets = [];
    const availableUnits = unitList;
    for (let i = 0; i < count && availableUnits.length > 0; i++) {
        let selectedUnit;
        if (trueRand) {
            const randomIndex = Math.floor(Math.random() * availableUnits.length);
            selectedUnit = availableUnits[randomIndex]; 
            availableUnits.splice(randomIndex, 1);
        } else {
            const totalPresence = availableUnits.reduce((sum, obj) => sum + obj.presence, 0);
            const randChoice = Math.random() * totalPresence;
            let cumulativePresence = 0;
            for (let j = 0; j < availableUnits.length; j++) {
                cumulativePresence += availableUnits[j].presence;
                if (randChoice <= cumulativePresence) {
                    selectedUnit = availableUnits[j];
                    availableUnits.splice(j, 1);
                    break;
                }
            }
        } if (selectedUnit) { selectedTargets.push(selectedUnit) }
    }
    return selectedTargets;
}


function playerTurn(unit) {
    let actionButton = "<div>";
    for (const actionKey in unit.actions) { 
        const action = unit.actions[actionKey];
        let disabled = '';
        if (action.cost) { for (const resource in action.cost) { if (unit.resource[resource] < action.cost[resource]) { disabled = " disabled" }}}
        actionButton += `
        <button id='${action.name}' class='action-button${disabled}' data-tooltip='${action.description}' onclick='handleActionClick(\"${actionKey}\", \"${unit.name}\")'>${action.name}</button>`;
    }
    document.getElementById("selection").innerHTML = `${actionButton}
        <button id='Skip' class='action-button' data-tooltip="Skip current unit's turn" onclick='handleActionClick("Skip", \"${unit.name}\")'>Skip</button>
    </div>`;
    window.handleActionClick = function(action, name) {
        if (action === "Skip") {
            logAction(`${name} skips their turn`, "skip");
            document.getElementById("selection").innerHTML = "";
            cleanupGlobalHandlers();
            setTimeout(window.combatTick, 500);
        } else {
            const unit = allUnits.find(u => u.name === name);
            currentAction = unit.actions[action];
            if (unit.actions[action].target !== undefined) { unit.actions[action].target() }
            else {
                unit.actions[action].code();
                document.getElementById("selection").innerHTML = "";
                cleanupGlobalHandlers();
                setTimeout(window.combatTick, 500);
            }
        }
    };
}

function selectTarget(action, back, target, targetType = 'unit') {
    let maxSelections = target[0];
    if (target[0] === -1 || target[0] > target[2].length) { maxSelections = target[2].length; }
    let selectionTitle = `<h1>Action: ${action.name}</h1>`;
    let selectionForm = `<form id='targetSelection' onsubmit='submitTargetSelection(event)'>`;
    if (targetType === 'hex') { selectionForm += `<div class="hex-selection-container">`; }
    for (const obj of target[2]) {
        let objId, objLabel, objValue, inputType;
        if (targetType === 'hex') {
            const coords = `${obj.coord.q},${obj.coord.r},${obj.coord.s}`;
            objId = `hex-${obj.coord.q}-${obj.coord.r}-${obj.coord.s}`;
            objLabel = obj.name || `Hex (${coords})`;
            objValue = coords;
            inputType = (maxSelections === 1) ? 'radio' : 'checkbox';
            selectionForm += `
            <div class="hex-option">
                <input type='${inputType}' id='${objId}' name='${objId}' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
                <label for='${objId}' class="hex-label ${obj.terrain ? `terrain-${obj.terrain}` : ''}">
                    ${objLabel}
                </label>
            </div>`;
        } else {
            objId = obj.name;
            objLabel = obj.name;
            objValue = obj.name;
            inputType = (maxSelections === 1) ? 'radio' : 'checkbox';
            selectionForm += `
            <div>
                <input type='${inputType}' id='${objId}' name='targetSelection' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
                <label for='${objId}'>${objLabel}</label>
            </div>`;
        }
    }
    if (targetType === 'hex') { selectionForm += `</div>`; }
    document.getElementById("selection").innerHTML = `${selectionTitle}
        ${selectionForm}
        <div id='validation-message' style='color: red;'></div>
        <button type='submit' id='submit'>Submit</button>
    </form>
    <button id='back' onclick='exitTargetSelection()'>Back</button>`;

    function checkTargetSelection(input, maxSelections) {
        const selectedTargets = document.querySelectorAll('#targetSelection input[type="checkbox"]:checked, #targetSelection input[type="radio"]:checked');
        if (input.type === 'checkbox' && selectedTargets.length > maxSelections && input.checked) {
            input.checked = false;
            showMessage(`You can only select up to ${maxSelections} target${maxSelections !== 1 ? 's' : ''}.`, "error", "validation-message", 0);
        } else {
            const validationMsg = document.getElementById('validation-message');
            if (validationMsg) { validationMsg.innerHTML = '' }
        }
    };

    function submitTargetSelection(event) {
        event.preventDefault();
        const selectedInputs = document.querySelectorAll('#targetSelection input[type="checkbox"]:checked, #targetSelection input[type="radio"]:checked');
        if (target[1] && selectedInputs.length !== maxSelections) {
            showMessage(`Please select exactly ${maxSelections} target${maxSelections !== 1 ? 's' : ''}.`, "error", "validation-message", 0);
            return;
        }
        if (selectedInputs.length === 0) {
            showMessage('Please select at least one target.', "error", "validation-message", 0);
            return;
        }
        const selectedTargets = [];
        for (const input of selectedInputs) {
            if (targetType === 'hex') {
                const coords = input.value.split(',').map(Number);
                const targetHex = target[2].find(hex => hex.coord.q === coords[0] && hex.coord.r === coords[1] && hex.coord.s === coords[2]);
                if (targetHex) { selectedTargets.push(targetHex) }
            } else {
                const targetUnit = allUnits.find(unit => unit.name === input.value);
                if (targetUnit) { selectedTargets.push(targetUnit) }
            }
        }
        action.code(selectedTargets);
        document.getElementById("selection").innerHTML = "";
        cleanupGlobalHandlers();
        setTimeout(window.combatTick, 500);
    }

    function exitTargetSelection () { back(); }
    window.checkTargetSelection = checkTargetSelection;
    window.submitTargetSelection = submitTargetSelection;
    window.exitTargetSelection = exitTargetSelection;
}

function showMessage(message, type = 'info', elementId = 'message-container', duration = 3000) {
    let container = document.getElementById(elementId);
    if (!container) {
      container = document.createElement('div');
      container.id = elementId;
      container.className = 'message-container';
      document.body.appendChild(container);
    }
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}-message`;
    messageElement.textContent = message;
    container.appendChild(messageElement);
    if (duration > 0) { setTimeout(() => messageElement.remove(), duration) }
    return messageElement;
}

function cleanupGlobalHandlers() {
    window.checkTargetSelection = null;
    window.submitTargetSelection = null;
    window.exitTargetSelection = null;
    window.handleActionClick = null;
}

function attack(attacker, defenders, num = 1, calcMods = {}) {
    const attackMods = { ...attacker, ...(calcMods.attacker && calcMods.attacker) };
    const array = [];
    for (const unit of defenders) {
        const defendMods = { ...unit, ...(calcMods.defender && calcMods.defender) };
        const hit = [];
        for (let i = 0; i < num; i++) { 
            const roll = Math.floor(Math.random() * 100 + 1);
            if (roll === 1) { hit.push(0); continue; }
            hit.push(10 * ((roll === 100 ? 2 * attackMods.accuracy : attackMods.accuracy) / defendMods.evasion ) + roll - 85);
        }
        array.push(hit);
    }
    crit(attacker, defenders, array, calcMods);
}

function crit(attacker, defenders, hit, calcMods = {}) {
    if (hit.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and hit (${hit}) array lengths are not equal`)}
    const attackMods = { ...attacker, ...(calcMods.attacker && calcMods.attacker) };
    const array = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = { ...defenders[i], ...(calcMods.defender && calcMods.defender) };
        const critical = [];
        for (let j = 0; j < hit[i].length; j++) { 
            if (hit[i][j] <= 0) { critical.push(0); continue; }
            critical.push(hit[i][j] / (Math.max(5*defendMods.resist - attackMods.focus, 10)));
        }
        array.push(critical);
    }
    damage(attacker, defenders, array, calcMods);
}

function damage(attacker, defenders, critical, calcMods = {}) {
    if (critical.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and critical (${critical}) array lengths are not equal`) }
    const attackMods = { ...attacker, ...(calcMods.attacker && calcMods.attacker) };
    for (let i = 0; i < defenders.length; i++) {
        if (currentAction.properties) {
            for (const prop of currentAction.properties) {
                if (baseElements.includes(prop.toLowerCase()) ) {
                    if (defenders[i].shield.includes(prop)) { defenders[i].shield.pop(prop) }
                    else if (!defenders[i].absorb.includes(prop)) { defenders[i].absorb.splice(defenders[i].absorb.indexOf(prop), 1) }
                }
            }
        }
        let doubleDamage = false;
        let comboElement = null;
        for (const unitElement of defenders[i].elements || []) {
            const comboKey = Object.keys(elementCombo).find(key => key.toLowerCase() === unitElement.toLowerCase());
            if (comboKey && currentAction.properties) {
                for (const actionElement of currentAction.properties) {
                    if (elementCombo[comboKey].includes(actionElement.toLowerCase())) {
                        if (elementCombo[comboKey].every(e => defenders[i].absorb.map(a => a.toLowerCase()).includes(e))) {
                            doubleDamage = true;
                            comboElement = comboKey;
                            break;
                        }
                    }
                }
            } if (doubleDamage) { break }
        }
        
        const hit = [];
        let total = 0;
        for (let j = 0; j < critical[i].length; j++) {
            const defendMods = { ...defenders[i], ...(calcMods.defender && calcMods.defender) };
            if (critical[i][j] <= 0) {
                hit.push('<i>0</i>');
                continue;
            } 
            let result; 
            if (critical[i][j] < 1) {
                result = (doubleDamage + 1) * Math.floor(Math.max(((Math.random() / 2) + .75) * (attackMods.attack - defendMods.defense), .1 * attackMods.attack, 1));
                hit.push(`${result}`);
                total += result;
            } else {
                result = (doubleDamage + 1) * Math.floor(Math.max(((Math.random() / 2) + .75) * (attackMods.attack - defendMods.defense), .1 * attackMods.attack * critical[i][j], 1) + attackMods.lethality * critical[i][j]);
                hit.push(`<b>${result}</b>`);
                total += result;
            }
            defenders[i].hp = Math.max(defenders[i].hp - result, 0);
        }
        if (total > 0) {
            if (critical[i].length > 1) { logAction(`${attacker.name} makes ${critical[i].length} attacks on ${defenders[i].name} dealing ${hit.join(", ")} for a total of ${total} ${doubleDamage ? "elemental " : ""}damage!`, "hit") }
            else { logAction(`${attacker.name} hits ${defenders[i].name} dealing ${hit[0]} ${doubleDamage ? "elemental " : ""}damage!`, "hit") }
        } else { logAction(`${attacker.name} missed ${critical[i].length > 1 ? `all ${critical[i].length} attacks on ` : '' }${defenders[i].name}!`, "miss") }
    }
}

export { Modifier, refreshState, setUnit, updateMod, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo };