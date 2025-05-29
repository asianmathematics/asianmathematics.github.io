let allUnits = [];
const modifiers = [];

class Modifier {
    constructor(name, description, vars, initFunc, onTurnFunc) {
      this.name = name;
      this.description = description;
      this.vars = vars;
      this.init = () => initFunc(this.vars);
      this.onTurn = (unit) => onTurnFunc(this.vars, unit);
    }
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
    const entries = logContainer.children;
    /*const maxEntries = window.innerWidth < 800 ? 100 : 250;
    while (entries.length > maxEntries) { logContainer.removeChild(entries[0]); }*/
    logContainer.scrollTop = logContainer.scrollHeight;
}

function resistDebuff(attacker, defenders) {
    const will= []
    for (const unit of defenders) {
        const roll = Math.floor(Math.random() * 100);
        if (roll === 1 || roll === 100) {
            will.push(roll);
            continue;
        }
        will.push(((attacker.presence + attacker.crit) / Math.max(200 - (attacker.presence + attacker.crit) + (unit.presence + unit.resist), 20) ) + roll);
    }
    return will;
}

function createMod(name, description, vars, initFunc, onTurnFunc) {
    const modifier = new Modifier(name, description, vars, initFunc, onTurnFunc);
    modifiers.push(modifier);
    modifier.init();
    return modifier;
}

function updateMod(unit) {
    for (let i = modifiers.length - 1; i >= 0; i--) {
        const modifier = modifiers[i];
        if (modifier.onTurn(unit)) { modifiers.splice(i, 1); }
    }
}

function resetStat(unit, statList) {
     for (const stat of statList) {
        if (stat.includes('.')) {
            const [parent, child] = stat.split('.');
            unit[parent][child] = unit.base[parent][child] * Math.max(0.2, unit.mult[parent][child]);
            continue;
        }
        unit[stat] = unit.base[stat] * Math.max(0.2, unit.mult[stat]);
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
            unit.actions[action].code();
            break;
        }
    }
    setTimeout(window.combatTick, 1000);
}

function randTarget(unitList = allUnits, trueRand = false) {
    if (unitList.length === 1) { return unitList[0]; }
    if (trueRand) { return unitList[Math.floor(Math.random() * unitList.length)]; }
    const randChoice = Math.random() * unitList.reduce((sum, obj) => sum + obj.presence, 0);
    let cumulativePresence = 0
    for (const obj of unitList) {
        cumulativePresence += obj.presence;
        if (randChoice <= cumulativePresence) { return obj; }
    }
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
        if (action === "Skip") {
            logAction(`${name} skips their turn`, "skip");
            document.getElementById("selection").innerHTML = "";
            cleanupGlobalHandlers();
            setTimeout(window.combatTick, 500);
        }
        else {
            const unit = allUnits.find(u => u.name === name);
            if (unit.actions[action].target !== undefined) { unit.actions[action].target(); }
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
    function submitTargetSelection(event) {
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
    if (duration > 0) { setTimeout(() => messageElement.remove(), duration); }
    return messageElement;
}

function cleanupGlobalHandlers() {
    window.checkTargetSelection = null;
    window.submitTargetSelection = null;
    window.exitTargetSelection = null;
    window.handleActionClick = null;
}

function attack(attacker, defenders) {
    const hit = [];
    for (const unit of defenders) { 
        const roll = Math.floor(Math.random() * 100 + 1);
        if (roll === 1) {
            hit.push(0);
            return;
        }
        hit.push(10 * ((roll === 100 ? 2 * attacker.accuracy : attacker.accuracy) / unit.evasion ) + roll - 85);
    }
    if (hit.some((num) => num > 0)){ crit(attacker, defenders, hit); }
    else {logAction(`${attacker.name} misses ${defenders.length === 1 ? defenders[0].name : "all their attacks!"}`, "miss")}
}

function crit(attacker, defenders, hit) {
    if (hit.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and hit (${hit}) array lengths are not equal`); }
    const critical = [];
    for (let i = 0; i < defenders.length; i++) { 
        if (hit[i] < 0) { critical.push(0); continue; }
        critical.push(hit[i] / (Math.max(5*defenders[i].resist - attacker.crit, 10)));
    }
    damage(attacker, defenders, critical);
}

function damage(attacker, defenders, critical) {
    if (critical.length !== defenders.length) { throw new TypeError(`Defender (${defenders}) and critical (${critical}) array lengths are not equal`) }
    const hit = [];
    const miss = [];
    const crit = [];
    let total = 0;
    for (let i = 0; i < defenders.length; i++) {
        if (critical[i] === 0) {
            miss.push(defenders[i].name);
            continue;
        }
        let result;
        if (critical[i] < 1) {
            result = Math.floor(Math.max(((Math.random() / 2) + .75) * (attacker.attack - defenders[i].defense), .1 * attacker.attack, 1));
            hit.push(`${defenders[i].name} (${result})`);
            total += result;
        }
        else {
            result = Math.floor(Math.max(((Math.random() / 2) + .75) * (attacker.attack - defenders[i].defense), .1 * attacker.attack * critical[i], 1) + attacker.lethality * critical[i]);
            crit.push(`${defenders[i].name} (${result})`);
            total += result;
        }
        defenders[i].hp = Math.max(defenders[i].hp - result, 0);
    }
    if (miss.length > 0) { logAction(`${attacker.name} missed ${miss.join(", ")}!`, "miss"); }
    if (hit.length > 0) { logAction(`${attacker.name} hits ${hit.join(", ")}${hit.length > 1 ? ` for a total of ${total} damage!` : '!'}`, "hit"); }
    if (crit.length > 0) { logAction(`${attacker.name} critically hits ${crit.join(", ")}!`, "crit"); }
}

export { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, updateMod, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, };