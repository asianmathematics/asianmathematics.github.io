import { allUnits, createUnit } from "./unit/unit.js";
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from './modifier.js'
const elements = ["precision/perfection", "independence/loneliness", "passion/hatred", "ingenuity/insanity"];

function regenerateResources(unit) {
    const regen = {}
    if (!unit.previousAction[0]) regen.stamina = unit.staminaRegen;
    if (unit.base.mana && !unit.previousAction[1]) regen.mana = unit.manaRegen;
    if (unit.base.energy && !unit.previousAction[2]) regen.energy = unit.energyRegen;
    resourceChange(unit, regen);
    unit.previousAction = [false, false, false];
}

function specialTarget(unit, list, count = 1, max = true) { unit.team === "player" ? selectTarget(unit.skills.special, [count, max, list]) : unit.skills.special.code.call(unit, randTarget(list, max ? count : Math.floor(Math.random()*count)+1)) }

function enemyTurn(unit) {
    if (unit.skills.special && unit.stamina >= (unit.skills.special.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.special.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.special.cost?.energy || 0) && Math.random() < 0.2) return executeEnemyAction(unit, unit.skills.special);
    if (Math.random() < 1/16){
        if (eventState.actionStart.length) handleEvent('actionStart', { unit, action: 'skip' });
        logAction(`${unit.name} is resting!`, 'info');
        if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
        return setTimeout(window.combatTick, 1000 / (window.combatSpeedMultiplier || 1));
    }
    const availableActions = [];
    if (unit.skills.basic && unit.stamina >= (unit.skills.basic.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.basic.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.basic.cost?.energy || 0)) availableActions.push(unit.skills.basic);
    if (unit.skills.secondary && unit.stamina >= (unit.skills.secondary.cost?.stamina || 0) && (unit.mana || 0) >= (unit.skills.secondary.cost?.mana || 0) && (unit.energy || 0) >= (unit.skills.secondary.cost?.energy || 0)) availableActions.push(unit.skills.secondary);
    if (availableActions.length) return executeEnemyAction(unit, availableActions[Math.floor(Math.random() * availableActions.length)]);
    logAction(`${unit.name} has no available actions and skips!`, 'miss');
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    setTimeout(window.combatTick, 1000 / (window.combatSpeedMultiplier || 1));
}

function executeEnemyAction(unit, action) {
    const type = Object.keys(unit.skills).find(s => unit.skills[s] === action);
    if (eventState.actionStart.length) handleEvent('actionStart', { unit, action: type });
    if (!action.cost || resourceChange(unit, action.cost, false)) {
        if (type === 'special') logAction(`${unit.name} activates special!`);
        unit.previousAction = [unit.previousAction[0] || action.properties.includes('stamina-block'), unit.previousAction[1] || action.properties.includes('mana-block'), unit.previousAction[2] || action.properties.includes('energy-block')];
        currentAction.push([action, unit]);
        action.target ? action.target.call(unit) : action.code.call(unit);
        currentAction.pop();
    } else logAction(`${unit.name}'s ${action.name} action failed!`, 'miss');
    if (eventState.turnEnd.length) handleEvent('turnEnd', { unit });
    setTimeout(window.combatTick, 1000 / (window.combatSpeedMultiplier || 1));
}

function randTarget(unitList = allUnits, count = 1, trueRand = false) {
    const context = { unitList, count, trueRand, targetMods: {} };
    if (eventState.targetStart.length) handleEvent('targetStart', context);
    if (count >= unitList.length) {
        if (eventState.targets.length) handleEvent('targets', { selectedTargets: unitList, count, trueRand });
        return unitList;
    }
    const weights = unitList.map((u, i) => getModdedStats(u, context.targetMods?.all, context.targetMods?.targets?.[i]).presence );
    if (count === 1) {
        if (trueRand) {
            const selected = [unitList[Math.floor(Math.random() * unitList.length)]];
            if (eventState.targets.length) handleEvent('targets', { selectedTargets: selected, count, trueRand });
            return selected;
        }
        const randChoice = Math.random() * weights.reduce((sum, w) => sum + w, 0);
        let cumulative = 0;
        for (let i = 0; i < unitList.length; i++) {
            cumulative += weights[i];
            if (randChoice <= cumulative) {
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: [unitList[i]], count, trueRand });
                return [unitList[i]];
            }
        }
    }
    let selectedTargets = [];
    const availableUnits = [...unitList];
    for (let i = 0; i < count && availableUnits.length > 0; i++) {
        let selectedUnit;
        if (trueRand) {
            const idx = Math.floor(Math.random() * availableUnits.length);
            selectedUnit = availableUnits.splice(idx, 1)[0];
        } else {
            const randChoice = Math.random() * weights.reduce((sum, w) => sum + w, 0);
            let cumulative = 0;
            for (let j = 0; j < availableUnits.length; j++) {
                cumulative += weights[j];
                if (randChoice <= cumulative) {
                    selectedUnit = availableUnits.splice(j, 1)[0];
                    weights.splice(j, 1);
                    break;
                }
            }
        }
        if (selectedUnit) selectedTargets.push(selectedUnit);
    }
    if (eventState.targets.length) handleEvent('targets', { selectedTargets, count, trueRand });
    return selectedTargets;
}

function selectTarget(action, target, targetType = 'unit') {
    document.getElementById('selection').style.display = 'block';
    const unit = currentAction.at(-1)[1];
    let maxSelections = target[0];
    if (target[0] === -1 || target[0] > target[2].length) maxSelections = target[2].length;
    let selectionTitle = `<h2 style="text-align:center;">Action: ${action.name}</h2>`;
    let selectionForm = `<form id='targetSelection' onsubmit='submitTargetSelection(event)'>`;
    if (targetType === 'hex') selectionForm += `<div class="hex-selection-container">`;
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
    if (targetType === 'hex') selectionForm += `</div>`;
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
            if (validationMsg) validationMsg.innerHTML = '';
        }
    };

    function submitTargetSelection(event) {
        event.preventDefault();
        const selectedInputs = document.querySelectorAll('#targetSelection input[type="checkbox"]:checked, #targetSelection input[type="radio"]:checked');
        if (target[1] && selectedInputs.length !== maxSelections) return showMessage(`Please select exactly ${maxSelections} target${maxSelections !== 1 ? 's' : ''}.`, "error", "validation-message", 0);
        if (selectedInputs.length === 0) return showMessage('Please select at least one target.', "error", "validation-message", 0);
        const selectedTargets = [];
        for (const input of selectedInputs) {
            if (targetType === 'hex') {
                const coords = input.value.split(',').map(Number);
                const targetHex = target[2].find(hex => hex.coord.q === coords[0] && hex.coord.r === coords[1] && hex.coord.s === coords[2]);
                if (targetHex) selectedTargets.push(targetHex);
            } else {
                const targetUnit = allUnits.find(unit => unit.name === input.value);
                if (targetUnit) selectedTargets.push(targetUnit);
            }
        }
        if (eventState.targets.length) handleEvent('targets', {action, selectedTargets});
        if (!unit.cancel && (!action.cost || resourceChange(unit, action.cost, false))) {
            unit.previousAction = [unit.previousAction[0] || action.properties.includes('stamina-block'), unit.previousAction[1] || action.properties.includes('mana-block'), unit.previousAction[2] || action.properties.includes('energy-block')];
            logAction(`<strong>${unit.name}'s turn (Special Interrupt!)</strong>`, 'turn');
            if (eventState.turnStart.length) handleEvent('turnStart', { unit });
            currentAction.push([action, unit]);
            action.code.call(unit, selectedTargets);
            currentAction.pop();
        } else logAction(`${unit.name}'s action was canceled!`, 'miss');
        document.getElementById("selection").innerHTML = "";
        document.getElementById('selection').style.display = 'none';
        cleanupGlobalHandlers();
        if (eventState.turnEnd.length) { handleEvent('turnEnd', { unit }) }
        unit.specialReady = false;
    }

    function exitTargetSelection () { 
        const selectionDiv = document.getElementById("selection");
        if (selectionDiv) selectionDiv.innerHTML = "";
        cleanupGlobalHandlers();
        document.getElementById('selection').style.display = 'none';
    }
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
    if (duration > 0) setTimeout(() => messageElement.remove(), duration);
    return messageElement;
}

function cleanupGlobalHandlers() { window.checkTargetSelection = window.submitTargetSelection = window.exitTargetSelection = window.handleActionClick = null }

function attack(attacker, defenders, num = 1, calcMods = {}) {
    if (eventState.attackStart.length) handleEvent('attackStart', {attacker, defenders, num, calcMods});
    const attackMods = getModdedStats(attacker, calcMods.attacker);
    const array = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = getModdedStats(defenders[i], calcMods.all, calcMods.defenders?.[i]);
        const hit = [];
        for (let j = 0; j < num; j++) {
            let rolls = [];
            for (let r = 0; r <= Math.abs((calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0)); r++) rolls.push(Math.floor(Math.random() * 100 + 1));
            const roll = (calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0) < 0 ? Math.min(...rolls) : Math.max(...rolls);
            let hitSingle = roll === 1 ? 0 : roll - 50 * (roll === 100 ? .5*(((calcMods.max ??= [])[i] ??= [])[j] = true) : 1) * (.75 + (defendMods.evasion-attackMods.accuracy)/(attackMods.accuracy+defendMods.evasion));
            if (eventState.singleAttack.length) {
                const context = {attacker, defender: defenders[i], hitSingle, roll, calcMods, index: [i, j]};
                handleEvent('singleAttack', context);
                hitSingle = context.nil ? 0 : (hitSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0);
            }
            hit.push(hitSingle);
        }
        array.push(hit);
    }
    return crit(attacker, defenders, array, calcMods);
}

function crit(attacker, defenders, hit, calcMods = {}) {
    if (hit.length !== defenders.length) throw new TypeError(`Defender (${defenders}) and hit (${hit}) array lengths are not equal`);
    if (eventState.critStart.length) handleEvent('critStart', {attacker, defenders, hit, calcMods});
    const attackMods = getModdedStats(attacker, calcMods.attacker);
    const array = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = { ...defenders[i], ...calcMods.all, ...calcMods.defenders?.[i] };
        const critical = [];
        for (let j = 0; j < hit[i].length; j++) {
            let critSingle = Math.max(hit[i][j] <= 0 ? 0 : hit[i][j] / (25-10*(attackMods.focus-defendMods.resist)/(attackMods.focus+defendMods.resist)), (calcMods.max?.[i]?.[j] || 0));
            if (eventState.singleCrit.length) {
                const context = {attacker, defender: defenders[i], critSingle, hit: hit[i][j], calcMods, index: [i, j]};
                handleEvent('singleCrit', context);
                critSingle = context.nil ? 0 : (critSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0);
            }
            critical.push(critSingle);
        }
        array.push(critical);
    }
    return damage(attacker, defenders, array, calcMods);
}

function damage(attacker, defenders, critical, calcMods = {}) {
    if (critical.length !== defenders.length) throw new TypeError(`Defender (${defenders}) and critical (${critical}) array lengths are not equal`);
    if (eventState.damageStart.length) handleEvent('damageStart', {attacker, defenders, critical, calcMods});
    const attackMods = getModdedStats(attacker, calcMods.attacker);
    const output = [];
    for (let i = 0; i < defenders.length; i++) {
        let dCheck = false;
        if (critical[i].some(c => c > 0)) {
            const defendMods = getModdedStats(defenders[i], calcMods.all, calcMods.defenders?.[i]);
            const hit = [];
            let total = 0;
            for (let j = 0; j < critical[i].length; j++) {
                let damageSingle = (critical[i][j] <= 0) ? 0 : Math.ceil(Math.max(((Math.random() * 0.5) + 0.75) * ((critical[i][j] < 1 ? 1 : critical[i][j] + 1) * ((2 * attackMods.attack) - defendMods.defense)), (critical[i][j] < 1 ? attackMods.attack : attackMods.attack * (critical[i][j] + 1))/8));
                if (eventState.singleDamage.length) {
                    const context = {attacker, defender: defenders[i], damageSingle, critical: critical[i][j], calcMods, index: [i, j]};
                    handleEvent('singleDamage', context);
                    damageSingle = context.nil ? 0 : Math.ceil(Math.max((damageSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), damageSingle ? (critical[i][j] < 1 ? attackMods.attack : attackMods.attack * (critical[i][j] + 1))/8 : 0));
                }
                hit.push(`${critical[i][j] <= 0 ? '<i>0</i>' : critical[i][j] >= 1 ? `<b>${damageSingle}</b>` : damageSingle}`);
                output.push(damageSingle);
                total += damageSingle;
            }
            if (total) {
                defenders[i].hp = Math.max(defenders[i].hp - total, 0);
                if (defenders[i].hp === 0) {
                    if (eventState.unitChange.length) handleEvent('unitChange', {type: 'downed', unit: defenders[i]});
                    if (defenders[i].hp === 0) for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === defenders[i] && (modifiers[i].vars.focus || modifiers[i].vars.penalty)) removeModifier(modifiers[i]);
                }
                critical[i].length > 1 ? logAction(`${attacker.name} makes ${critical[i].length} attacks on ${defenders[i].name} dealing ${hit.join(", ")} for a total of ${total} damage!`, "hit") : logAction(`${attacker.name} hits ${defenders[i].name} dealing ${hit[0]} damage!`, "hit");
                dCheck = true;
            }
        }
        if (!dCheck) logAction(`${attacker.name} missed ${critical[i].length > 1 ? `all ${critical[i].length} attacks on ` : '' }${defenders[i].name}!`, "miss");
    }
    return output
}

function heal(healer, targets, amount, calcMods = {}) {
    if (eventState.healStart.length) handleEvent('healStart', {healer, targets, calcMods});
    const heal = [];
    for (let i = 0; i < targets.length; i++) {
        let healSingle = getModdedStats(targets[i], calcMods.all, calcMods.targets?.[i]).healFactor * amount[i];
        if (eventState.singleHeal.length) {
            const context = {healer, target: targets[i], healSingle, calcMods, index: [i]};
            handleEvent('singleHeal', context);
            healSingle = context.nil ? 0 : Math.ceil(Math.max((healSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), 0));
        }
        const revive = !targets[i].hp && healSingle;
        targets[i].hp = Math.min(Math.ceil(targets[i].hp + healSingle), targets[i].base.hp);
        if (revive && eventState.unitChange.length) handleEvent('unitChange', {type: 'revive', unit: targets[i]});
        heal.push(`${targets[i].name} ${healSingle} hp`);
    }
    logAction(`${healer.name} heals ${heal.join(", ")}!`, "heal");
}

function hpChange(unit, targets, values) {
    let defenders = [], damages = [], heals = [];
    for (let i = targets.length - 1; i >= 0; i--) {
        if (values[i] < 0) {
            defenders.push(targets.splice(i, 1)[0]);
            damages.push(-values[i]);
        } else heals.unshift(values[i]);
    }
    if (eventState.damageStart.length) handleEvent('damageStart', {attacker: unit, defenders, damages, direct: true});
    for (let i = 0; i < defenders.length; i++) {
        let damageSingle = damages[i];
        if (eventState.singleDamage.length) {
            const context = {attacker: unit, defender: defenders[i], damageSingle, index: [i], direct: true};
            handleEvent('singleDamage', context);
            damageSingle = context.nil ? 0 : Math.ceil(Math.max((damageSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), 0));
        }
        defenders[i].hp = Math.max(defenders[i].hp - damageSingle, 0);
        if (defenders[i].hp === 0) {
            if (eventState.unitChange.length) handleEvent('unitChange', {type: 'downed', unit: defenders[i]});
            if (defenders[i].hp === 0) for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === defenders[i] && (modifiers[i].vars.focus || modifiers[i].vars.penalty)) removeModifier(modifiers[i]);
        }
        logAction(`${unit.name} dealt ${damageSingle} damage to ${defenders[i].name}!`, "hit");
    }
    if (eventState.healStart.length) handleEvent('healStart', {healer: unit, targets, heals, direct: true});
    for (let i = 0; i < targets.length; i++) {
        let healSingle = heals[i];
        if (eventState.singleHeal.length) {
            const context = {healer: unit, target: targets[i], healSingle, index: [i], direct: true};
            handleEvent('singleHeal', context);
            healSingle = context.nil ? 0 : Math.ceil(Math.max((healSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0), 0));
        }
        const revive = !targets[i].hp && healSingle;
        targets[i].hp = Math.min(targets[i].hp + healSingle, targets[i].base.hp);
        if (revive && eventState.unitChange.length) handleEvent('unitChange', {type: 'revived', unit: targets[i]});
        logAction(`${unit.name} heals ${targets[i].name} for ${healSingle} hp!`, "heal");
    }
}

function resistDebuff(attacker, defenders, calcMods = {}) {
    if (eventState.resistStart.length) handleEvent('resistStart', {attacker, defenders, calcMods});
    const attackMods = getModdedStats(attacker, calcMods.attacker);
    const will = [];
    for (let i = 0; i < defenders.length; i++) {
        const defendMods = getModdedStats(defenders[i], calcMods.all, calcMods.defenders?.[i]);
        let rolls = [];
        for (let r = 0; r <= Math.abs((calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0)); r++) rolls.push(Math.floor(Math.random() * 100 + 1));
        const roll = (calcMods.all?.reroll || 0) + (calcMods.defenders?.[i]?.reroll || 0) < 0 ? Math.min(...rolls) : Math.max(...rolls);
        let resistSingle = roll === 1 || roll === 100 ? roll : roll + 50 * ((attackMods.presence + attackMods.focus - defendMods.presence - defendMods.resist) / (attackMods.presence + attackMods.focus + defendMods.presence + defendMods.resist));
        if (eventState.singleResist.length) {
            const context = {attacker, defender: defenders[i], resistSingle, calcMods, index: [i]};
            handleEvent('singleResist', context);
            resistSingle = context.nil ? 0 : (resistSingle + (context.bonus || 0))*(context.mult || 1)/(context.div || 1) + (context.flatBonus || 0);
        }
        will.push(Math.min(resistSingle, 100));
    }
    return will;
}

function resourceChange(unit, resources, add = true, drain = false) {
    const { position, ...actualResources } = resources;
    const context = {unit, resources: actualResources, add, drain};
    if (eventState.resourceChange.length) handleEvent('resourceChange', context);
    for (const resource in context.resources) {
        let change = (context[resource]?.nil || context.all?.nil) ? 0 : (context.resources[resource] + (context[resource]?.bonus || 0) + (context.all?.bonus || 0))*(context[resource]?.mult || 1)*(context.all?.mult || 1)/(context[resource]?.div || 1)/(context.all?.div || 1) + (context[resource]?.flatBonus || 0) + (context.all?.flatBonus || 0);
        context.resources[resource] = add ? change : -change;
        if (!drain && -context.resources[resource] > unit[resource]) return (currentAction.length === 1 && currentAction.at(-1)[1].team === 'player') ? logAction(`Not enough ${resource}!`, "warning") && false : false;
    }
    for (const resource in context.resources) unit[resource] = Math.ceil(Math.max(0, Math.min(unit[resource] + context.resources[resource], unit.base[resource])));
    return true;
}

function getModdedStats(baseUnit, ...modObjects) {
    const moddedStats = { ...baseUnit };
    for (const mods of modObjects) {
        if (!mods) continue;
        for (const stat in mods) moddedStats[stat] = Math.max(((moddedStats[stat] + (mods[stat].bonus || 0)) * (mods[stat].mult || 1) / (mods[stat].div || 1)) + (mods[stat].flatBonus || 0), baseUnit.base[stat] * 0.2);
    }
    return moddedStats;
}

function getStat(unit, statName, type = 'number') {
    switch (type) {
        case "number":
            return unit[statName];
        case "base":
            return unit.base[statName];
        case "percent":
            return unit[statName] / unit.base[statName];
    }
}

function unitByStat(units, statName, type = 'number', max = true, count = 1) {
    const context = { unitList: units, count, statName, type, max };
    if (eventState.targetStart.length) handleEvent('targetStart', context);
    const sorted = [...units].sort((a, b) => {
        const valA = getStat(a, statName, type);
        const valB = getStat(b, statName, type);
        return max ? valB - valA : valA - valB;
    });
    const targets = sorted.slice(0, count);
    if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count, statName, type, max });
    return targets;
}

function kill(attacker, defenders) {
    for (const defender of defenders) {
        allUnits.splice(allUnits.indexOf(defender), 1);
        if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit: defender });
        for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === defender) removeModifier(modifiers[i]);
    }
    logAction(`${attacker.name} kills ${defenders.map(u => u.name).join(', ')}!`);
}

function summon(summoner, unit, skills = {}) {
    const clone = createUnit(unit, summoner.team);
    clone.skills = skills;
    clone.custom = { ...clone.custom, summoner };
    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'summon', unit: clone });
    return clone;
}

export { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements };