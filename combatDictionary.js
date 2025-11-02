const allUnits = [];
let modifiers = [];
let currentUnit = null;
let currentAction = null;
let currentMod = [];
const specialElements = ["precision/perfection", "independence/loneliness", "passion/hatred", "ingenuity/insanity"];
const baseElements = ["death/darkness", "light/illusion", "knowledge/memory", "goner/entropy", "harmonic/change", "inertia/cold", "radiance/purity", "anomaly/synthetic", "nature/life"]
const elementCombo = {
    "death/darkness": ["light/illusion", "nature/life"],
    "light/illusion": ["death/darkness", "knowledge/memory"],
    "knowledge/memory": ["light/illusion", "goner/entropy"],
    "goner/entropy": ["knowledge/memory", "harmonic/change"],
    "harmonic/change": ["goner/entropy", "inertia/cold"],
    "inertia/cold": ["harmonic/change", "radiance/purity"],
    "radiance/purity": ["inertia/cold", "anomaly/synthetic"],
    "anomaly/synthetic": ["radiance/purity", "nature/life"],
    "nature/life": ["anomaly/synthetic", "death/darkness"]
};
const eventState = {};
const events = [
    'turnStart', 'resistStart', 'attackStart', 'critStart', 'damageStart', 'modifierStart', 'elementEffect', 'stun',
    'turnEnd', 'singleResist', 'singleAttack', 'singleCrit', 'singleDamage', 'modifierEnd', 'elementDamage', 'cancel',
    'actionStart', 'targets', 'positionChange', 'waveChange', 'unitChange', 'resourceChange', 'statChange'
];
events.forEach(type => eventState[type] = []);

function refreshState() { currentUnit = currentAction = null }
function setUnit(unit) { currentUnit = unit }

class Modifier {
    constructor(name, description, vars, initFunc, onTurnFunc, cancelFunc, changeTargetFunc) {
        this.name = name;
        this.description = description;
        this.vars = vars;
        this.init = initFunc;
        this.onTurn = onTurnFunc;
        this.cancel = (cancel = true, temp = false) => {
            if (eventState.cancel.length && !temp) { handleEvent('cancel', { modifier: this }) }
            cancel ? this.vars.cancel++ : this.vars.cancel--;
            cancelFunc.apply(this, [cancel, temp])
        }
        this.changeTarget = changeTargetFunc || this.vars.targets ? ((remove = [], add = []) => {
            if (remove.length - add.length >= this.vars.targets.length) { removeModifier(this) }
            else {
                if (this.vars.applied) {
                    this.cancel(true, true);
                    for (let i = this.vars.targets.length - 1; i >= 0; i--) { if (remove.includes(this.vars.targets[i])) { this.vars.targets.splice(i, 1)} }
                    this.vars.targets.push(...add);
                    this.cancel(false, true);
                } else {
                    for (let i = this.vars.targets.length - 1; i >= 0; i--) { if (remove.includes(this.vars.targets[i])) { this.vars.targets.splice(i, 1)} }
                    this.vars.targets.push(...add);
                }
            }
        }) : ((unit) => {
            if (unit === this.vars.target) { removeModifier(this) }
            else {
                if (this.vars.applied) {
                    this.cancel(true, true);
                    this.vars.target = unit;
                    this.cancel(false, true);
                } else { this.vars.target = unit }
            }
        }),
        modifiers.push(this);
        if (this.vars.listeners) { for (const eventType in this.vars.listeners) { if (this.vars.listeners[eventType]) { eventState[eventType].push(this) } } }
        if (eventState.modifierStart.length) { handleEvent('modifierStart', { modifier: this }) }
        currentMod.push(this);
        this.init();
        currentMod.pop();
        this.vars.start = true;
        window.updateModifiers();
    }
}

function handleEvent(eventType, context) {
    for (let i = eventState[eventType].length - 1; i >= 0; i--) {
        if (!eventState[eventType][i].vars.start) { continue }
        currentMod.push(eventState[eventType][i]);
        try {
            if (eventState[eventType][i] === currentMod[currentMod.length - 2] && eventState[eventType][i] === currentMod[currentMod.length - 3] && eventState[eventType][i] === currentMod[currentMod.length - 4]) {
                logAction(`Modifier ${eventState[eventType][i]?.name} was called too many times in one event!`, "error");
                currentMod.pop();
                continue;
            }
            if (eventState[eventType][i].onTurn({ ...context, event: eventType })) { removeModifier(eventState[eventType][i]) }
        } catch (e) {
            console.error(`Error in ${eventType} listener (${eventState[eventType][i]?.name}):`, e);
            try {
                removeModifier(eventState[eventType][i]);
                logAction(`An error occurred with a modifier.`, "error");
            } catch (err) {
                logAction('A major error occurred with a modifier, event list has been purged', "error")
                modifiers.splice(0, modifiers.length, ...modifiers.filter(mod => mod !== eventState[eventType][i]))
                for (const event of events) { if (eventState[event].length) { eventState[event].filter(mod => mod !== eventState[eventType][i]) } }
            }
        }
        currentMod.pop();
    }
    window.updateModifiers();
}

function removeModifier(modifier) {
    if (eventState.modifierEnd.length) { handleEvent('modifierEnd', { modifier }) }
    if (modifier.vars.applied) {
        currentMod.push(modifier);
        modifier.cancel();
        currentMod.pop();
    }
    if (modifier.vars && modifier.vars.listeners) { for (const event in modifier.vars.listeners) { if (modifier.vars.listeners[event]) { eventState[event].splice(eventState[event].indexOf(modifier), 1) } } }
    modifiers.splice(modifiers.indexOf(modifier), 1);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function unitFilter(team, position, downed = null) { return allUnits.filter(unit => (team === '' || unit.team === team) && (position === "mid" ? unit.base.position === "mid" : position === '' || unit.position === position) && (downed === null ? true : (downed ? unit.hp <= 0 : unit.hp > 0))) }

function logAction(message, type = 'info') {
    const logContainer = document.getElementById('action-log');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}-entry`;
    logEntry.innerHTML = message;
    logContainer.appendChild(logEntry);
    /*const entries = logContainer.children;
    const maxEntries = window.innerWidth < 800 ? 100 : 250;
    while (entries.length > maxEntries) { logContainer.removeChild(entries[0]); }*/
    logContainer.scrollTop = logContainer.scrollHeight;
}

function resistDebuff(attacker, defenders) {
    if (eventState.resistStart.length) { handleEvent('resistStart', {attacker, defenders}) }
    const will = []
    for (const unit of defenders) {
        const roll = Math.floor(Math.random() * 100 + 1);
        const resistSingle = roll === 1 || roll === 100 ? roll : roll * ((attacker.presence + attacker.focus) / (unit.presence + (2 * unit.resist)));
        if (eventState.singleResist.length) { handleEvent('singleResist', {attacker, defender: unit, resistSingle}) }
        will.push(resistSingle);
    }
    return will;
}

function resetStat(unit, statList, values = [], add = true) {
    if (values.length > 0) {
        /*console.log(values);*/
        if (eventState.statChange.length) { handleEvent('statChange', { unit, statList, values, add }) }
        let nullCheck;
        for (let i = 0; i < Math.min(statList.length, values.length); i++) {
            if (values[i] !== values[i] || values[i] === undefined) {
                if (!nullCheck) {
                    logAction("Stat change has null values!", "error");
                    nullCheck = true;
                }
                continue;
            }
            if (statList[i].includes('.')) {
                const [parent, child] = statList[i].split('.');
                unit.mult[parent][child] += add ? values[i] : -values[i];
            } else { unit.mult[statList[i]] += add ? values[i] : -values[i]; }
        }
    }
    for (const stat of statList) {
        if (stat.includes('.')) {
            const [parent, child] = stat.split('.');
            unit[parent][child] = unit.base[parent][child] + Math.max(-0.8 * unit.base[parent][child], unit.mult[parent][child]);
        } else { unit[stat] = unit.base[stat] + Math.max(-0.8 * unit.base[stat], unit.mult[stat]) }
    }
}

function enemyTurn(unit) {
    const availableActions = {};
    let totalWeight = 0;
    for (const action in unit.actions.actionWeight) {
        let useable = true;
        if (unit.actions[action].cost) {
            for (const resource in unit.actions[action].cost) {
                if (resource === "position") { continue }
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
            if (eventState.actionStart.length) { handleEvent('actionStart', {unit, action: unit.actions[action]}) }
            if (!unit.cancel) { unit.actions[action].target ? unit.actions[action].target() : unit.actions[action].code() }
            break;
        }
    }
    if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit }) }
    setTimeout(window.combatTick, 1000);
}

function randTarget(unitList = allUnits, count = 1, trueRand = false) {
    if (count >= unitList.length) {
        if (eventState.targets.length) { handleEvent('targets', { selectedTargets: unitList }) }
        return unitList;
    }
    if (count === 1) {
        if (trueRand) {
            if (eventState.targets.length) { handleEvent('targets', { selectedTargets: unitList }) }
            return [unitList[Math.floor(Math.random() * unitList.length)]];
        }
        const randChoice = Math.random() * unitList.reduce((sum, obj) => sum + obj.presence, 0);
        let cumulativePresence = 0;
        for (let obj of unitList) {
            cumulativePresence += obj.presence;
            if (randChoice <= cumulativePresence) {
                if (eventState.targets.length) { handleEvent('targets', { selectedTargets: [obj] }) }
                return [obj];
            }
        }
    }
    let selectedTargets = [];
    const availableUnits = [ ...unitList];
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
    if (eventState.targets.length) { handleEvent('targets', { selectedTargets }) }
    return selectedTargets;
}


function playerTurn(unit) {
    let actionButton = `<h3 style="text-align:center;font-size:48px;margin:10px;"><b>${unit.name}'s turn</b></h3><div>`;
    for (const actionKey in unit.actions) {
        if (actionKey === "actionWeight") { continue }
        const action = unit.actions[actionKey];
        let disabled = '';
        if (action.cost) {
            if (action.cost.hasOwnProperty("position") && action.cost.position !== unit.position) { continue }
            for (const resource in action.cost) { if (resource !== "position" && unit.resource[resource] < action.cost[resource]) { disabled = " disabled" } }
        }
        actionButton += `
        <button id='${action.name}' class='action-button${disabled}' data-tooltip='${action.description}' onclick='handleActionClick(\"${actionKey}\", \"${unit.name}\")'>${action.name}</button>`;
    }
    document.getElementById("selection").innerHTML = `${actionButton}
        <button id='Skip' class='action-button' data-tooltip="Skip current unit's turn" onclick='handleActionClick("Skip", \"${unit.name}\")'>Skip</button>
    </div>`;
    window.handleActionClick = function(action, name) {
        const unit = allUnits.find(u => u.name === name);
        if (eventState.actionStart.length) { handleEvent('actionStart', {unit, action: unit.actions[action]}) }
        if (!unit.cancel) {
            if (action === "Skip") {
                logAction(`${name}'s turn is skipped`, "skip");
                document.getElementById("selection").innerHTML = "";
                cleanupGlobalHandlers();
                if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit }) }
                setTimeout(window.combatTick, 500);
            } else {
                currentAction = unit.actions[action];
                if (unit.actions[action].target !== undefined) { unit.actions[action].target() }
                else {
                    if (unit.actions[action].cost && eventState.resourceChange.length) { handleEvent('resourceChange', { effect: unit.actions[action], unit, resource: null }) }
                    unit.actions[action].code();
                    document.getElementById("selection").innerHTML = "";
                    cleanupGlobalHandlers();
                    if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit }) }
                    setTimeout(window.combatTick, 500);
                }
            }
        } else {
            setTimeout(window.combatTick, 500);
            if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit }) }
        }
    };
}

function selectTarget(action, back, target, targetType = 'unit') {
    let maxSelections = target[0];
    if (target[0] === -1 || target[0] > target[2].length) { maxSelections = target[2].length; }
    let selectionTitle = `<h2 style="text-align:center;">Action: ${action.name}</h2>`;
    let selectionForm = `<form id='targetSelection' onsubmit='submitTargetSelection(event)'>`;
    if (targetType === 'hex') { selectionForm += `<div class="hex-selection-container">`; }
    for (const obj of target[2]) {
        let objId, objLabel, objValue;
        if (targetType === 'hex') {
            const coords = `${obj.coord.q},${obj.coord.r},${obj.coord.s}`;
            objId = `hex-${obj.coord.q}-${obj.coord.r}-${obj.coord.s}`;
            objLabel = obj.name || `Hex (${coords})`;
            objValue = coords;
            selectionForm += `
            <div class="hex-option">
                <input type='${(maxSelections === 1) ? 'radio' : 'checkbox'}' id='${objId}' name='${objId}' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
                <label for='${objId}' class="hex-label ${obj.terrain ? `terrain-${obj.terrain}` : ''}">
                    ${objLabel}
                </label>
            </div>`;
        } else {
            objId = objLabel = objValue = obj.name;
            selectionForm += `
            <div>
                <input type='${(maxSelections === 1) ? 'radio' : 'checkbox'}' id='${objId}' name='targetSelection' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
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
        if (eventState.targets.length) { handleEvent('targets', {action, selectedTargets}) }
        if (!currentUnit.cancel) {
            if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: action, currentUnit, resource: null }) }
            action.code(selectedTargets);
        }
        document.getElementById("selection").innerHTML = "";
        cleanupGlobalHandlers();
        if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit: currentUnit }) }
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
    if (eventState.attackStart.length) { handleEvent('attackStart', {attacker, defenders, num, calcMods}) }
    const attackMods = { ...attacker, ...calcMods.attacker };
    const array = [];
    for (const unit of defenders) {
        const defendMods = { ...unit, ...calcMods.defender };
        const hit = [];
        for (let i = 0; i < num; i++) { 
            const roll = Math.floor(Math.random() * 100 + 1);
            let hitSingle = roll === 1 ? 0 : 10 * ((roll === 100 ? 2 * attackMods.accuracy : attackMods.accuracy) / defendMods.evasion ) + roll - 85;
            if (roll === 100) { hitSingle = Math.min(-hitSingle, -100) }
            if (eventState.singleAttack.length) { handleEvent('singleAttack', {attacker, defender: unit, hitSingle}) }
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
    if (eventState.critStart.length) { handleEvent('critStart', {attacker, defenders, hit, calcMods}) }
    const attackMods = { ...attacker, ...calcMods.attacker };
    const array = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = { ...defenders[i], ...calcMods.defender };
        const critical = [];
        for (let j = 0; j < hit[i].length; j++) {
            let max = false;
            if (hit[i][j] <= -100) {
                hit[i][j] *= -1;
                max = true;
            }
            let critSingle = Math.max(hit[i][j] <= 0 ? 0 : hit[i][j] / (Math.max((3 * defendMods.resist) - attackMods.focus, 10)), max);
            if (eventState.singleCrit.length) { handleEvent('singleCrit', {attacker, defender: defenders[i], critSingle}) }
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
    if (eventState.damageStart.length) { handleEvent('damageStart', {attacker, defenders, critical, calcMods}) }
    const attackMods = { ...attacker, ...calcMods.attacker };
    for (let i = 0; i < defenders.length; i++) {
        const doubleDamage = elementDamage(attacker, defenders[i], calcMods?.actionOverride || null);
        const defendMods = { ...defenders[i], ...calcMods.defender };
        const hit = [];
        let total = 0;
        for (let j = 0; j < critical[i].length; j++) {
            let damageSingle = (doubleDamage + 1) * (critical[i][j] <= 0 ? 0 : Math.ceil(Math.max(((Math.random() / 2) + .75) * ((critical[i][j] < 1 ? attackMods.attack : attackMods.attack * (critical[i][j] + 1)) - defendMods.defense), .1 * (critical[i][j] < 1 ? attackMods.attack : attackMods.attack * (critical[i][j] + 1)))));
            if (eventState.singleDamage.length) { handleEvent('singleDamage', {attacker, defender: defenders[i], damageSingle}) }
            hit.push(`${critical[i][j] <= 0 ? '<i>0</i>' : critical[i][j] >= 1 ? `<b>${damageSingle}</b>` : damageSingle}`);
            total += damageSingle;
        }
        if (total > 0) {
            defenders[i].hp = Math.max(defenders[i].hp - total, 0);
            if (defenders[i].hp === 0) {
                if (eventState.unitChange.length) { handleEvent('unitChange', {type: 'downed', unit: defenders[i]}) }
                if (defenders[i].hp === 0) { for (const mod of modifiers) { if (mod.caster === defenders[i] && (mod.vars.focus || mod.vars.penalty)) { removeModifier(mod) } } }
            }
            if (critical[i].length > 1) { logAction(`${attacker.name} makes ${critical[i].length} attacks on ${defenders[i].name} dealing ${hit.join(", ")} for a total of ${total} ${doubleDamage ? "elemental " : ""}damage!`, "hit") }
            else { logAction(`${attacker.name} hits ${defenders[i].name} dealing ${hit[0]} ${doubleDamage ? "elemental " : ""}damage!`, "hit") }
        } else { logAction(`${attacker.name} missed ${critical[i].length > 1 ? `all ${critical[i].length} attacks on ` : '' }${defenders[i].name}!`, "miss") }
    }
}

function elementDamage(attacker, defender, actionOverride = null) {
   const elementSource = actionOverride ?? (currentMod.length > 0 ? currentMod[currentMod.length - 1] : currentAction);
    const properties = elementSource?.vars?.elements || elementSource?.properties || [];
    if (properties.length === 0) { return false }
    for (const prop of properties) {
        if (baseElements.includes(prop)) {
            if (defender.shield.includes(prop)) { defender.shield.splice(defender.shield.indexOf(prop), 1) }
            else if (!defender.absorb.includes(prop)) { defender.absorb.push(prop) }
        }
    }
    let doubleDamage = false;
    let comboElement = null;
    const comboKeys = Object.keys(elementCombo);
    for (const unitElement of defender.elements || []) {
        const comboKey = comboKeys.find(key => key === unitElement);
        if (comboKey && properties) {
            for (const actionElement of properties) {
                if (elementCombo[comboKey].includes(actionElement)) {
                    if (elementCombo[comboKey].every(e => defender.absorb.map(a => a).includes(e))) {
                        doubleDamage = true;
                        comboElement = comboKey;
                        if (eventState.elementDamage.length) { handleEvent('elementDamage', { attacker, unit: defender, comboElement, doubleDamage }) }
                        break;
                    }
                }
            }
        } if (doubleDamage) { break }
    }
    return doubleDamage;
}

function elementBonus(unit, actionOverride = null, weightOverrides = null) {
    const elementSource = actionOverride ?? (currentMod.length > 0 ? currentMod[currentMod.length - 1] : currentAction);
    const elements = elementSource?.properties || elementSource?.vars?.elements || [];
    if (elements.length === 0) { return 0 }
    const rawWeights = (weightOverrides && typeof weightOverrides === 'object') ? weightOverrides : (elementSource?.vars?.elementWeights && typeof elementSource.vars.elementWeights === 'object') ? elementSource.vars.elementWeights : {};
    const normalizedWeights = {};
    for (const key in rawWeights) {
        if (typeof rawWeights[key] === 'number') { normalizedWeights[key] = { match: Number(rawWeights[key]), opposite: -Math.abs(Number(rawWeights[key])) } }
        else if (typeof rawWeights[key] === 'object') { normalizedWeights[key] = { match: Number(rawWeights[key].match ?? 1), opposite: Number(rawWeights[key].opposite ?? -1) } }
    }
    for (const wKey in normalizedWeights) { if (!elements.find(e => String(e) === wKey)) { elements.push(wKey) } }
    if (elements.length === 0) { return 0 }
    const targetElems = (unit.elements || []);
    let bonus = 0;
    for (const eff of elements) {
        const comboKey = Object.keys(elementCombo).find(k => k === eff);
        const w = normalizedWeights[eff] || { match: 1, opposite: -1 };
        if (comboKey) {
            if (targetElems.includes(comboKey)) { bonus += w.match }
            for (const opp of elementCombo[comboKey]) { if (targetElems.includes(opp)) { bonus += w.opposite } }
        }
        else if (normalizedWeights[eff] && targetElems.includes(eff)) { bonus += w.match }
    }
    if (eventState.elementEffect.length) { handleEvent('elementEffect', { effect: elementSource, target: unit, elementBonus: bonus }) }
    return bonus;
}

function basicModifier(name, description, vari) {
    if (vari.target) {
        return new Modifier(name, description, vari,
            function() { resetStat(this.vars.target, this.vars.stats, this.vars.values) },
            function(context) {
                if (this.vars.target === context.unit) { this.vars.duration-- }
                if (this.vars.duration <= 0) { return true }
            },
            function() {
                if (this.vars.cancel && this.vars.applied) {
                    resetStat(this.vars.target, this.vars.stats, this.vars.values, false);
                    this.vars.applied = false;
                }
                else if (!this.vars.cancel && !this.vars.applied) {
                    resetStat(this.vars.target, this.vars.stats, this.vars.values);
                    this.vars.applied = true;
                }
            }
        );
    } else {
        return new Modifier(name, description, vari,
            function() { for (const unit of this.vars.targets) { resetStat(unit, this.vars.stats, this.vars.values) } },
            function(context) {
                if (this.vars.caster === context.unit) { this.vars.duration-- }
                if (this.vars.duration <= 0) { return true }
            },
            function() {
                if (this.vars.cancel && this.vars.applied) {
                    for (const unit of this.vars.targets) { resetStat(unit, this.vars.stats, this.vars.values, false) }
                    this.vars.applied = false;
                }
                else if (!this.vars.cancel && !this.vars.applied) {
                    for (const unit of this.vars.targets) { resetStat(unit, this.vars.stats, this.vars.values) }
                    this.vars.applied = true;
                }
            }
        );
    }
}

export { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState };