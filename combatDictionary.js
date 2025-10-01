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
const eventState = {};
const events = [
    'turnStart', 'resistStart', 'attackStart', 'critStart', 'damageStart', 'modifierStart', 'elementEffect', 'stun',
    'turnEnd', 'singleResist', 'singleAttack', 'singleCrit', 'singleDamage', 'modifierEnd', 'elementDamage', 'cancel',
    'actionStart', 'targets', 'positionChange', 'waveChange', 'unitChange', 'resourceChange', 'statChange'
];
events.forEach(type => eventState[type] = { flag: false, listeners: [] });

function refreshState() { currentUnit = currentAction = null }
function setUnit(unit) { currentUnit = unit }

class Modifier {
    constructor(name, description, vars, initFunc, onTurnFunc) {
        this.name = name;
        this.description = description;
        this.vars = vars;
        this.init = () => initFunc(this.vars);
        this.onTurn = (context) => onTurnFunc(this.vars, context);
        modifiers.push(this);
        if (this.vars.listeners) {
            for (const eventType in this.vars.listeners) {
                if (this.vars.listeners[eventType]) {
                    eventState[eventType].flag = true;
                    eventState[eventType].listeners.push(this);
                }
            }
        }
        if (eventState.modifierStart.flag) { handleEvent('modifierStart', { modifier: this }) }
        this.init()
        window.updateModifiers();
    }
}

function handleEvent(eventType, context) {
    for (let i = eventState[eventType].listeners.length - 1; i >= 0; i--) {
        try { if (eventState[eventType].listeners[i].onTurn(context)) { removeModifier(eventState[eventType].listeners[i]) } }
        catch (e) {
            console.error(`Error in ${eventType} listener (${eventState[eventType].listeners[i].name}):`, e);
            removeModifier(eventState[eventType].listeners[i]);
        }
    }
    window.updateModifiers();
}

function removeModifier(modifier) {
    if (modifier.vars.applied) {
        modifier.vars.cancel = true;
        if (eventState.cancel.flag) {handleEvent('cancel', { effect: removeModifier, target: modifier, cancel: true }) }
        modifier.onTurn({})
    }
    if (eventState.modifierEnd.flag) { handleEvent('modifierEnd', { modifier }) }
    if (modifier.vars && modifier.vars.listeners) {
        for (const event in modifier.vars.listeners) {
            if (modifier.vars.listeners[event]) {
                if (eventState[event].listeners.indexOf(modifier) !== -1) {
                    eventState[event].listeners.splice(eventState[event].listeners.indexOf(modifier), 1);
                    if (eventState[event].listeners.length === 0) { eventState[event].flag = false }
                }
            }
        }
    }
    if (modifiers.indexOf(modifier) !== -1) { modifiers.splice(modifiers.indexOf(modifier), 1); }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function unitFilter(team, position, downed = null) { return allUnits.filter(unit => (team === '' || unit.team === team) && (position === "mid" ? unit.base.position === "mid" : position === '' || unit.position === position) && (downed === null ? true : (downed ? unit.hp <= 0 : unit.hp > 0))) }

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
    if (eventState.resistStart.flag) { handleEvent('resistStart', {attacker, defenders}) }
    const will = []
    for (const unit of defenders) {
        const roll = Math.floor(Math.random() * 100 + 1);
        const resistSingle = roll === 1 || roll === 100 ? roll : ((attacker.presence + attacker.crit) / Math.max(200 - (attacker.presence + attacker.crit) + (unit.presence + unit.resist), 20) ) + roll;
        if (eventState.singleResist.flag) { handleEvent('singleResist', {attacker, defender: unit, resistSingle}) }
        will.push(resistSingle);
    }
    return will;
}

function resetStat(unit, statList, values = [], add = true) {
    if (values.length > 0) {
        if (eventState.statChange.flag) { handleEvent('statChange', { unit, statList, values, add  }) }
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
        let useable = true;
        if (unit.actions[action].cost) {
            for (const resource in unit.actions[action].cost) {
                if (unit.resource[resource] < unit.actions[action].cost[resource]) {
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
            if (eventState.actionStart.flag) { handleEvent('actionStart', {unit, action: unit.actions[action]}) }
            if (!unit.cancel) { unit.actions[action].code() }
            break;
        }
    }
    setTimeout(window.combatTick, 1000);
}

function randTarget(unitList = allUnits, count = 1, trueRand = false) {
    if (count === 1) {
        if (unitList.length === 1) {
            if (eventState.targets.flag) { handleEvent('targets', {action: currentAction, selectedTargets: unitList}) }
            return unitList[0];
        }
        if (trueRand) {
            if (eventState.targets.flag) { handleEvent('targets', {action: currentAction, selectedTargets: unitList}) }
            return [unitList[Math.floor(Math.random() * unitList.length)]];
        }
        const randChoice = Math.random() * unitList.reduce((sum, obj) => sum + obj.presence, 0);
        let cumulativePresence = 0;
        for (const obj of unitList) {
            cumulativePresence += obj.presence;
            if (randChoice <= cumulativePresence) {
                if (eventState.targets.flag) { handleEvent('targets', {action: currentAction, selectedTargets: [obj]}) }
                return obj;
            }
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
    if (eventState.targets.flag) { handleEvent('targets', {action: currentAction, selectedTargets}) }
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
        const unit = allUnits.find(u => u.name === name);
        if (eventState.actionStart.flag) { handleEvent('actionStart', {unit, action: unit.actions[action]}) }
        if (!unit.cancel) {
            if (action === "Skip") {
                logAction(`${name} skips their turn`, "skip");
                document.getElementById("selection").innerHTML = "";
                cleanupGlobalHandlers();
                setTimeout(window.combatTick, 500);
            } else {
                currentAction = unit.actions[action];
                if (unit.actions[action].target !== undefined) { unit.actions[action].target() }
                else {
                    if (unit.actions[action].cost && eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: unit.actions[action], unit, resource: null }) }
                    unit.actions[action].code();
                    document.getElementById("selection").innerHTML = "";
                    cleanupGlobalHandlers();
                    setTimeout(window.combatTick, 500);
                }
            }
        } else { setTimeout(window.combatTick, 500) }
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
        if (eventState.targets.flag) { handleEvent('targets', {action, selectedTargets}) }
        if (!currentUnit.cancel) {
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: action, currentUnit, resource: null }) }
            action.code(selectedTargets);
        }
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
    if (eventState.attackStart.flag) { handleEvent('attackStart', {attacker, defenders, num, calcMods}) }
    const attackMods = { ...attacker, ...(calcMods.attacker && calcMods.attacker) };
    const array = [];
    for (const unit of defenders) {
        const defendMods = { ...unit, ...(calcMods.defender && calcMods.defender) };
        const hit = [];
        for (let i = 0; i < num; i++) { 
            const roll = Math.floor(Math.random() * 100 + 1);
            let hitSingle = roll === 1 ? 0 : 10 * ((roll === 100 ? 2 * attackMods.accuracy : attackMods.accuracy) / defendMods.evasion ) + roll - 85;
            if (eventState.singleAttack.flag) { handleEvent('singleAttack', {attacker, defender: defenders[i], hitSingle}) }
             if (attacker.cancel) {
                hitSingle = 0; 
                attacker.cancel = false;
            }
            hit.push(hitSingle);
        }
        array.push(hit);
    }
    crit(attacker, defenders, array, calcMods);
}

function crit(attacker, defenders, hit, calcMods = {}) {
    if (hit.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and hit (${hit}) array lengths are not equal`)}
    if (eventState.critStart.flag) { handleEvent('critStart', {attacker, defenders, hit, calcMods}) }
    const attackMods = { ...attacker, ...(calcMods.attacker && calcMods.attacker) };
    const array = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = { ...defenders[i], ...(calcMods.defender && calcMods.defender) };
        const critical = [];
        for (let j = 0; j < hit[i].length; j++) { 
            let critSingle = hit[i][j] <= 0 ? 0 : hit[i][j] / (Math.max(5*defendMods.resist - attackMods.focus, 10));
            if (eventState.singleCrit.flag) { handleEvent('singleCrit', {attacker, defender: defenders[i], critSingle}) }
            if (attacker.cancel) {
                critSingle = 0; 
                attacker.cancel = false;
            }
            critical.push(critSingle);
        }
        array.push(critical);
    }
    damage(attacker, defenders, array, calcMods);
}

function damage(attacker, defenders, critical, calcMods = {}) {
    if (critical.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and critical (${critical}) array lengths are not equal`) }
    if (eventState.damageStart.flag) { handleEvent('damageStart', {attacker, defenders, critical, calcMods}) }
    const attackMods = { ...attacker, ...(calcMods.attacker && calcMods.attacker) };
    for (let i = 0; i < defenders.length; i++) {
        if (currentAction.properties) {
            for (const prop of currentAction.properties) {
                if (baseElements.includes(prop.toLowerCase()) ) {
                    if (defenders[i].shield.includes(prop.toLowerCase())) { defenders[i].shield.splice(defenders[i].shield.indexOf(prop.toLowerCase()), 1) }
                    else if (!defenders[i].absorb.includes(prop.toLowerCase())) { defenders[i].absorb.push(prop.toLowerCase()) }
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
                            doubleDamage = true
                            comboElement = comboKey
                            if (eventState.elementDamage.flag) { handleEvent('elementDamage', { attacker, unit: defenders[i], comboElement, doubleDamage }) }
                            if (doubleDamage) { break }
                        }
                    }
                }
            } if (doubleDamage) { break }
        }
        const defendMods = { ...defenders[i], ...(calcMods.defender && calcMods.defender) };
        const hit = [];
        let total = 0;
        for (let j = 0; j < critical[i].length; j++) {
            let damageSingle = (doubleDamage + 1) * (critical[i][j] <= 0 ? 0 : critical[i][j] < 1 ? Math.ceil(Math.max(((Math.random() / 2) + .75) * (attackMods.attack - defendMods.defense), .1 * attackMods.attack)) : Math.ceil(Math.max(((Math.random() / 2) + .75) * (attackMods.attack - defendMods.defense), .1 * attackMods.attack * critical[i][j]) + attackMods.lethality * critical[i][j]));
            if (eventState.singleDamage.flag) { handleEvent('singleDamage', {attacker, defender: defenders[i], damageSingle}) }
            hit.push(`${critical[i][j] <= 0 ? '<i>0</i>' : critical[i][j] < 1 ? `<b>${damageSingle}</b>` : damageSingle}`);
            total += damageSingle;
        }
        if (total > 0) {
            defenders[i].hp = Math.max(defenders[i].hp - total, 0);
            if (defenders[i].hp === 0 && eventState.unitChange.flag) { handleEvent('unitChange', {type: 'downed', unit: defenders[i]}) }
            if (critical[i].length > 1) { logAction(`${attacker.name} makes ${critical[i].length} attacks on ${defenders[i].name} dealing ${hit.join(", ")} for a total of ${total} ${doubleDamage ? "elemental " : ""}damage!`, "hit") }
            else { logAction(`${attacker.name} hits ${defenders[i].name} dealing ${hit[0]} ${doubleDamage ? "elemental " : ""}damage!`, "hit") }
        } else { logAction(`${attacker.name} missed ${critical[i].length > 1 ? `all ${critical[i].length} attacks on ` : '' }${defenders[i].name}!`, "miss") }
    }
}

function basicModifier(name, description, vari) {
    if (vari.targets.length === 1) {
        return new Modifier(name, description, vari,
            (vars) => { resetStat(vars.targets[0], vars.stats, vars.values) },
            (vars, context) => {
                if (vars.cancel && vars.applied) {
                    resetStat(vars.targets[0], vars.stats, vars.values, false);
                    vars.applied = false;
                }
                else if (!vars.cancel && !vars.applied) {
                    resetStat(vars.targets[0], vars.stats, vars.values);
                    vars.applied = true;
                }
                if (vars.targets[0] === context.unit) { vars.duration-- }
                if (vars.duration <= 0) { return true }
            }
        );
    } else {
        return new Modifier(name, description, vari,
            (vars) => { for (const unit of vars.targets) { resetStat(unit, vars.stats, vars.values) } },
            (vars, context) => {
                if (vars.cancel && vars.applied) {
                    for (const unit of vars.targets) {
                        resetStat(unit, vars.stats, vars.values, false);
                        vars.applied = false;
                    }
                }
                else if (!vars.cancel && !vars.applied) {
                    for (const unit of vars.targets) {
                        resetStat(unit, vars.stats, vars.values);
                        vars.applied = true;
                    }
                }
                if (vars.caster === context.unit) { vars.duration-- }
                if (vars.duration <= 0) { return true }
            }
        );
    }
}

export { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState };