let allUnits = [];
const modifiers = [];
const eventState = {};
const events = [
    'turnStart', 'actionStart', 'resistStart', 'attackStart', 'critStart', 'damageStart', 'modifierStart',
    'turnEnd', 'singleResist', 'singleAttack', 'singleCrit', 'singleDamage', 'modifierActivate', 'modifierEnd',
    'targets', 'positionChange', 'waveChange', 'unitChange', 'resourceChange'
];
events.forEach(type => eventState[type] = { flag: false, listeners: [] });

class ModifierPool {
    constructor(size) {
        this.inactive = [];
        for (let i = 0; i < size; i++) { this.inactive.push({name: '', description: '', vars: {}, init: null, onTurn: null}) }
    }
    get() {
        if (this.inactive.length === 0) { for (let i = 0; i < 50; i++) { this.inactive.push({name: '', description: '', vars: {}, init: null, onTurn: null}) } }
        return this.inactive.pop();
    }
    release(modifier) { modifier.name = ''; modifier.description = ''; modifier.vars = {}; modifier.init = null; modifier.onTurn = null; this.inactive.push(modifier) }
}
const modifierPool = new ModifierPool(150);
function handleEvent(eventType, context) {
    for (let i = eventState[eventType].listeners.length - 1; i >= 0; i--) {
        const listener = eventState[eventType].listeners[i];
        if (listener.onTurn(context)) {
            if (eventState.modifierEnd.flag) { handleEvent('modifierEnd', { modifier: listener }) }
            const modifierIndexInGlobal = modifiers.indexOf(listener);
            if (modifierIndexInGlobal > -1) { modifiers.splice(modifierIndexInGlobal, 1) }
            eventState[eventType].listeners.splice(i, 1);
            if (eventState[eventType].listeners.length === 0) { eventState[eventType].flag = false }
            renderModifiers();
        }
    }
}

function renderModifiers() {
    const container = document.querySelector('.modifiers-container');
    container.querySelectorAll('.modifier-display').forEach(el => el.remove());
    modifiers.forEach(mod => {
        const modElement = document.createElement('div');
        modElement.className = 'modifier-display';
        modElement.innerHTML = `<li class="modifier-item">
                <span class="modifier-caster">${mod.vars.caster.name}'s</span>
                <span class="modifier-name" data-tooltip="${mod.description}">${mod.name}.</span>
                <div class="modifier-targets">Targets: ${mod.vars.targets.map(t => t.name).join(', ')}</div>
                <div class="modifier-duration">${mod.vars.duration} turn(s) left</div>
            </li>`;
        container.appendChild(modElement);
    });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function unitFilter(team, position, downed = null) {
    return allUnits.filter(unit => {
        const teamMatch = team === '' || unit.team === team;
        let positionMatch;
        if (position === "mid") { positionMatch = unit.base.position === "mid"; }
        else { positionMatch = position === '' || unit.position === position; }
        let healthMatch = true;
        if (downed === true) { healthMatch = unit.hp <= 0; }
        if (downed === false) { healthMatch = unit.hp > 0; }
        return teamMatch && positionMatch && healthMatch;
    });
}

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
    if (eventState.resistStart.flag) { handleEvent('resistStart', {attacker, defenders}) }
    const will= []
    for (const unit of defenders) {
        const roll = Math.floor(Math.random() * 100);
        const resistSingle = roll === 1 || roll === 100 ? roll : ((attacker.presence + attacker.crit) / Math.max(200 - (attacker.presence + attacker.crit) + (unit.presence + unit.resist), 20) ) + roll;
        if (eventState.singleResist.flag) { handleEvent('singleResist', {attacker, defenders, resistSingle}) }
        will.push(resistSingle);
    }
    return will;
}

function createMod(name, description, vars, initFunc, onTurnFunc) {
    const modifier = modifierPool.get();
    if (!modifier) {
        logAction("Modifier limit reached, effect failed!", "error");
        return null;
    }
    modifier.name = name;
    modifier.description = description;
    modifier.vars = vars;
    modifier.init = () => initFunc(modifier.vars);
    modifier.onTurn = (unit) => onTurnFunc(modifier.vars, unit);
    modifiers.push(modifier);
    if (eventState.modifierStart.flag) { handleEvent('modifierStart', { modifier }) }
    if (modifier.vars.listeners) {
        for (const eventType in modifier.vars.listeners) {
            if (modifier.vars.listeners[eventType]) {
                eventState[eventType].flag = true;
                eventState[eventType].listeners.push(modifier);
            }
        }
    }
    modifier.init();
    renderModifiers();
    return modifier;
}

function resetStat(unit, statList, values = null, add = true) {
    if (values && values.length > 0) {
        for (let i = 0; i < Math.min(statList.length, values.length); i++) {
            if (statList[i].includes('.')) {
                const [parent, child] = statList[i].split('.');
                unit.mult[parent][child] += add ? values[i] : -values[i];
            } else { unit.mult[statList[i]] += add ? values[i] : -values[i]; }
        }
    }
    for (const stat of statList) {
        if (stat.includes('.')) {
            const [parent, child] = stat.split('.');
            unit[parent][child] = unit.base[parent][child] * Math.max(0.2, unit.mult[parent][child]);
        } else { unit[stat] = unit.base[stat] * Math.max(0.2, unit.mult[stat]); }
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
            if (eventState.actionStart.flag) { handleEvent('actionStart', {unit, action}) }
            if (!unit.stun) { unit.actions[action].code() }
            break;
        }
    }
    setTimeout(window.combatTick, 1000);
}

function randTarget(unitList = allUnits, count = 1, trueRand = false) {
    if (count <= 0) return [];
    if (count === 1) {
        if (unitList.length === 1) {
            if (eventState.targets.flag) { handleEvent('targets', {action, selectedTargets: unitList}) }
            return unitList[0];
        }
        if (trueRand) { 
            const selected = [unitList[Math.floor(Math.random() * unitList.length)]];
            if (eventState.targets.flag) { handleEvent('targets', {action, selectedTargets: selected}) }
            return selected;
        }
        const randChoice = Math.random() * unitList.reduce((sum, obj) => sum + obj.presence, 0);
        let cumulativePresence = 0;
        for (const obj of unitList) {
            cumulativePresence += obj.presence;
            if (randChoice <= cumulativePresence) { 
                if (eventState.targets.flag) { handleEvent('targets', {action, selectedTargets: [obj]}) }
                return obj;
            }
        }
    }
    const selectedTargets = [];
    const availableUnits = [...unitList];
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
        }
        if (selectedUnit) { selectedTargets.push(selectedUnit) }
    }
    if (eventState.targets.flag) { handleEvent('targets', {action, selectedTargets}) }
    return selectedTargets;
}

function playerTurn(unit) {
    let actionButton = "<div>";
    for (const actionKey in unit.actions) { 
        const action = unit.actions[actionKey];
        let disabled = '';
        if (action.cost) {
            for (const resource in action.cost) {
                if (unit.resource[resource] < action.cost[resource]) { disabled = " disabled"; }
            }
        }
        actionButton += `
        <button id='${action.name}' class='action-button${disabled}' data-tooltip='${action.description}' onclick='handleActionClick(\"${actionKey}\", \"${unit.name}\")'>${action.name}</button>`;
    }
    document.getElementById("selection").innerHTML = `${actionButton}
        <button id='Skip' class='action-button' data-tooltip="Skip current unit's turn" onclick='handleActionClick("Skip", \"${unit.name}\")'>Skip</button>
    </div>`;
    window.handleActionClick = function(action, name) {
        const unit = allUnits.find(u => u.name === name);
        if (eventState.actionStart.flag) { handleEvent('actionStart', {unit, action}) }
        if (!unit.stun) {
            if (action === "Skip") {
                logAction(`${name} skips their turn`, "skip");
                document.getElementById("selection").innerHTML = "";
                cleanupGlobalHandlers();
                setTimeout(window.combatTick, 500);
            }
            else {
                if (unit.actions[action].target !== undefined) { unit.actions[action].target(); }
                else {
                    unit.actions[action].code();
                    document.getElementById("selection").innerHTML = "";
                    cleanupGlobalHandlers();
                    setTimeout(window.combatTick, 500);
                }
            }
        }
    };
}

function selectTarget(action, back, target, targetType = 'unit', unit) {
    let maxSelections = target[0];
    if (target[0] === -1 || target[0] > target[2].length) { maxSelections = target[2].length; }
    let selectionTitle = `<h1>Action: ${action.name}</h1>`;
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
                <input type='checkbox' id='${objId}' name='${objId}' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
                <label for='${objId}' class="hex-label ${obj.terrain ? `terrain-${obj.terrain}` : ''}">
                    ${objLabel}
                </label>
            </div>`;
        }
        else {
            objId = obj.name;
            objLabel = obj.name;
            objValue = obj.name;
            selectionForm += `
            <div>
                <input type='checkbox' id='${objId}' name='${objId}' value='${objValue}' onclick='checkTargetSelection(this, ${maxSelections})'>
                <label for='${objId}'>${objLabel}</label>
            </div>`;
        }
    }
    if (targetType === 'hex') { selectionForm += `</div>`; }
    document.getElementById("selection").innerHTML = `${selectionTitle}
        ${selectionForm}
        <div id='validation-message' style='color: red;'></div>
        <button type='submit'>Submit</button>
    </form>
    <button id='back' onclick='exitTargetSelection()'>Back</button>`;
    function checkTargetSelection(checkbox, maxSelections) {
        const selectedTargets = document.querySelectorAll('#targetSelection input[type="checkbox"]:checked');
        if (selectedTargets.length > maxSelections && checkbox.checked) {
          checkbox.checked = false;
          showMessage(`You can only select up to ${maxSelections} target${maxSelections !== 1 ? 's' : ''}.`, "error", "validation-message", 0);
        }
        else { 
            const validationMsg = document.getElementById('validation-message');
            if (validationMsg) { validationMsg.innerHTML = ''; }
        }
    };
    function submitTargetSelection(event, unit = null) {
        event.preventDefault();
        const checkboxes = document.querySelectorAll('#targetSelection input[type="checkbox"]:checked');
        if (target[1] && checkboxes.length !== maxSelections) {
            showMessage(`Please select exactly ${maxSelections} target${maxSelections !== 1 ? 's' : ''}.`, "error", "validation-message", 0);
            return;
        }
        if (checkboxes.length === 0) {
            showMessage('Please select at least one target.', "error", "validation-message", 0);
            return;
        }
        const selectedTargets = [];
        for (const checkbox of checkboxes) {
            if (targetType === 'hex') {
                const coords = checkbox.value.split(',').map(Number);
                const targetHex = target[2].find(hex => hex.coord.q === coords[0] && hex.coord.r === coords[1] && hex.coord.s === coords[2]);
                if (targetHex) { selectedTargets.push(targetHex); }
            }
            else {
                const targetUnit = allUnits.find(unit => unit.name === checkbox.value);
                if (targetUnit) { selectedTargets.push(targetUnit); }
            }
        }
        if (eventState.targets.flag) { handleEvent('targets', {action, selectedTargets}) }
        if (unit === null || !unit.stun) { action.code(selectedTargets) }
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
    if (duration > 0) { setTimeout(() => messageElement.remove(), duration); }
    return messageElement;
}

function cleanupGlobalHandlers() {
    window.checkTargetSelection = null;
    window.submitTargetSelection = null;
    window.exitTargetSelection = null;
    window.handleActionClick = null;
}

function attack(attacker, defenders, num = 1) {
    if (eventState.attackStart.flag) { handleEvent('attackStart', {attacker, defenders, num}) }
    const array = [];
    for (const unit of defenders) {
        const hit = [];
        for (let i = 0; i < num; i++) {
            const roll = Math.floor(Math.random() * 100 + 1);
            let hitSingle = roll === 1 ? 0 : 10 * ((roll === 100 ? 2 * attacker.accuracy : attacker.accuracy) / unit.evasion ) + roll - 85;
            if (eventState.singleAttack.flag) { handleEvent('singleAttack', {attacker, defenders, num, hitSingle}) }
            if (attacker.stun) {
                hitSingle = 0; 
                attacker.stun = false;
            }
            hit.push(hitSingle);
        }
        array.push(hit);
    }
    crit(attacker, defenders, array);
}

function crit(attacker, defenders, hit) {
    if (eventState.critStart.flag) { handleEvent('critStart', {attacker, defenders, hit}) }
    const array = [];
    if (hit.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and hit (${hit}) array lengths are not equal`)}
    for (let i = 0; i < defenders.length; i++) {
        const critical = [];
        for (let j = 0; j < hit[i].length; j++) { 
            let critSingle = hit[i][j] <= 0 ? 0 : hit[i][j] / (Math.max(5*defenders[i].resist - attacker.crit, 10));
            if (eventState.singleCrit.flag) { handleEvent('singleCrit', {attacker, defenders, hit, critSingle}) }
            if (attacker.stun) {
                critSingle = 0; 
                attacker.stun = false;
            }
            critical.push(critSingle);
        }
        array.push(critical);
    }
    damage(attacker, defenders, array);
}

function damage(attacker, defenders, critical) {
    if (eventState.damageStart.flag) { handleEvent('damageStart', {attacker, defenders, critical}) }
    if (critical.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and critical (${critical}) array lengths are not equal`) }
    for (let i = 0; i < defenders.length; i++) {
        const hit = [];
        let total = 0;
        for (let j = 0; j < critical[i].length; j++) {
            const damageSingle = critical[i][j] <= 0 ? 0 : critical[i][j] < 1 ? Math.floor(Math.max(((Math.random() / 2) + .75) * (attacker.attack - defenders[i].defense), .1 * attacker.attack, 1)) : Math.floor(Math.max(((Math.random() / 2) + .75) * (attacker.attack - defenders[i].defense), .1 * attacker.attack * critical[i][j], 1) + attacker.lethality * critical[i][j]);
            if (eventState.singleDamage.flag) { handleEvent('singleDamage', {attacker, defenders, hit, damageSingle}) }
            hit.push(`${critical[i][j] <= 0 ? '<i>0</i>' : critical[i][j] < 1 ? `<b>${damageSingle}</b>` : damageSingle}`);
            total += damageSingle;
            defenders[i].hp = Math.max(defenders[i].hp - total, 0);
            if (defenders[i].hp === 0 && eventState.unitChange.flag) { handleEvent('unitChange', {type: 'downed', unit: defenders[i]}) }
        }
        if (total > 0) {
            if (critical[i].length > 1) { logAction(`${attacker.name} makes ${critical[i].length} attacks on ${defenders[i].name} dealing ${hit.join(", ")} for a total of ${total} damage!`, "hit") }
            else { logAction(`${attacker.name} hits ${defenders[i].name} dealing ${hit[0]} damage!`, "hit") }
        } 
        else { logAction(`${attacker.name} missed ${critical[i].length > 1 ? `all ${critical[i].length} attacks on ` : '' }${defenders[i].name}!`, "miss") }
    }
}

export { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, handleEvent, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, eventState};