import { resourceChange } from "./combatDictionary.js";
import { allUnits } from "./unit/unit.js";
const modifiers = [];
const currentAction = [];
const eventState = {};
const events = [
    'turnStart', 'resistStart', 'attackStart', 'critStart', 'damageStart', 'healStart', 'modifierStart', 'stun', 'resourceChange', 'targetStart',
    'turnEnd', 'singleResist', 'singleAttack', 'singleCrit', 'singleDamage', 'singleHeal', 'modifierEnd', 'cancel', 'costChange', 'targets',
    'actionStart', 'positionChange', 'waveChange', 'unitChange', 'statChange', 'targetChange'
];
events.forEach(type => eventState[type] = []);
let turnOffStatLog = false;
const system = { name: "system" };

class Modifier {
    constructor(name, description, vars, initFunc, onTurnFunc, cancelFunc, changeTargetFunc) {
        this.name = name;
        this.description = description;
        this.vars = vars;
        this.vars.caster ??= currentAction.at(-1)[1];
        this.init = initFunc;
        this.onTurn = onTurnFunc;
        this.cancel = (cancel = true, temp = false) => {
            turnOffStatLog = temp;
            if (eventState.cancel.length && !temp) handleEvent('cancel', { modifier: this, cancel });
            cancel ? this.vars.cancel++ : this.vars.cancel--;
            if (cancelFunc) (cancelFunc).call(this, cancel, temp);
            else {
                const isActivating = !this.vars.cancel && !this.vars.applied, isDeactivating = this.vars.cancel && this.vars.applied;
                if (isDeactivating || isActivating) {
                    if (this.vars.stats && this.vars.target && !this.vars.disablestatChange) resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats), false);
                    if (!temp && this.vars.cancelListeners) {
                        for (const listener of this.vars.cancelListeners) {
                            this.vars.listeners[listener] = isActivating;
                            if (isActivating) eventState[listener].push(this);
                            else if (isDeactivating) {
                                const i = eventState[listener].indexOf(this);
                                if (i > -1) eventState[listener].splice(i, 1);
                            }
                        }
                    }
                    this.vars.applied = isActivating;
                }
            }
            turnOffStatLog = false;
        }
        this.changeTarget = (...args) => {
            if (eventState.targetChange.length) handleEvent('targetChange', { modifier: this, args });
            (changeTargetFunc || (this.vars.targets ? ((remove = [], add = []) => {
                if (!add.length && remove.length === this.vars.targets.length) removeModifier(this);
                else {
                    if (this.vars.applied) {
                        this.cancel(true, true);
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                        this.vars.targets.push(...add);
                        this.cancel(false, true);
                    } else {
                        for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                        this.vars.targets.push(...add);
                    }
                }
            }) : ((unit) => {
                if (unit === this.vars.target) removeModifier(this);
                else {
                    if (this.vars.applied) {
                        this.cancel(true, true);
                        this.vars.target = unit;
                        this.cancel(false, true);
                    } else this.vars.target = unit;
                }
            }))).apply(this, args);
        }
        if (currentAction.length) {
            this.vars.parent = currentAction.at(-1)[0];
            if (currentAction.at(-1)[0].vars) currentAction.at(-1)[0].vars.child ? currentAction.at(-1)[0].vars.child.push(this) : currentAction.at(-1)[0].vars.child = [this];
        }
        modifiers.push(this);
        if (eventState.modifierStart.length) handleEvent('modifierStart', { modifier: this });
        currentAction.push([this, this.vars.caster]);
        this.init() ? removeModifier(this) : this.vars.cancel = !(this.vars.applied = this.vars.start = true);
        if (this.vars.stats && this.vars.target && !this.vars.disablestatChange) resetStat(this.vars.target, Object.keys(this.vars.stats), Object.values(this.vars.stats));
        if (this.vars.reduction) for (const stat of Object.keys(this.vars.reduction)) this.vars.caster.mult[stat] ? (this.vars.caster.base[stat] -= this.vars.reduction[stat]) && resetStat(this.vars.caster, [stat]) : (this.vars.caster.base[stat] -= this.vars.reduction[stat]) && (this.vars.caster[stat] = Math.max(this.vars.caster[stat] -this.vars.reduction[stat], 0));
        if (this.vars.listeners) for (const eventType in this.vars.listeners) if (this.vars.listeners[eventType]) eventState[eventType].push(this);
        currentAction.pop();
        //window.updateModifiers();
    }
}

function handleEvent(eventType, context) {
    const eventList = [...eventState[eventType]];
    context.event = eventType;
    for (let i = eventList.length - 1; i >= 0; i--) {
        if (!eventState[eventType].includes(eventList[i]) || !eventList[i]?.vars?.start) continue;
        currentAction.push([eventList[i], eventList[i]?.vars?.caster]);
        const stack = currentAction.length;
        try {
            if (!currentAction.at(-1)[1]) throw new Error(`No caster found in Modifier: ${eventList[i]?.name}`);
            if (eventList[i] === currentAction.at(-3)?.[0] && (eventList[i] === currentAction.at(-2)?.[0] || eventList[i] === currentAction.at(-5)?.[0])) logAction(`Modifier ${eventList[i]?.name} was called too many times in one event!`, "error");
            else if (eventList[i].onTurn(context)) removeModifier(eventList[i]);
        } catch (e) {
            console.error(`Error in ${eventType} listener (${eventList[i]?.name}):`, e);
            console.log(`currentAction stack: ${currentAction.map(a => a[0]).join(', ')}\ncurrentUnit stack: ${currentAction.map(a => a[1]).join(', ')}`);
            try {
                removeModifier(eventList[i]);
                logAction(`An error occurred with a modifier.`, "error");
            } catch (err) {
                logAction('A major error occurred with a modifier, event list has been purged', "error");
                modifiers.splice(0, modifiers.length, ...modifiers.filter(mod => mod !== eventList[i]));
                for (const event of events) if (eventState[event].length) eventState[event] = eventState[event].filter(mod => mod !== eventList[i]);
            } finally { currentAction.length = stack }
        } finally { currentAction.pop() }
    }
    window.updateModifiers();
}

function removeModifier(modifier) {
    let index;
    if (modifier.vars.perm || (index = modifiers.indexOf(modifier)) === -1) return;
    if (modifier.vars.passive && allUnits.includes(modifier.vars.caster)) {
        if (modifier.vars.caster.hp === 0 && modifier.vars.focus) {
            currentAction.push([modifier, modifier.vars.caster]);
            modifier.cancel();
            currentAction.pop();
        }
        return;
    }
    if (modifier.vars?.applied) {
        currentAction.push([modifier, modifier.vars.caster]);
        modifier.cancel();
        currentAction.pop();
    }
    if (eventState.modifierEnd.length) handleEvent('modifierEnd', { modifier });
    if (modifier.vars?.listeners) for (const event in modifier.vars.listeners) if (modifier.vars.listeners[event] && eventState[event].indexOf(modifier) > -1) eventState[event].splice(eventState[event].indexOf(modifier), 1);
    if (index !== -1) modifiers.splice(index, 1);
    if (modifier.vars.parent?.vars) modifier.vars.parent.vars.child.length > 1 ? (index = modifier.vars.parent.vars.child.indexOf(modifier)) > -1 && modifier.vars.parent.vars.child.splice(index, 1) : delete modifier.vars.parent.vars.child;
}

function refreshModifier(list, dur = 3, effect = false) { return list.map((mod, i) => (mod = modifiers.find(m => m.name === mod.name && m.vars.caster === mod.vars.caster && m.vars.target === mod.vars.target && m.vars.parent === mod.vars.parent)) && (!effect || effect(mod)) && !logAction(`${mod.vars.caster.name} refreshes ${mod.name}`) && [mod.vars.duration, mod.vars.duration = (dur[i] || dur) > 0 ? (dur[i] || dur) : mod.vars.duration - (dur[i] || dur)][0]) }

function basicModifier(name, description, vari, dur = 'target') {
    return new Modifier(name, description, vari,
        function() {},
        function(context) {
            if (this.vars[dur] === context.unit) this.vars.duration--;
            return this.vars.duration <= 0;
        }
    );
}

function auraModifier (name, description, vari, mod, filter) {
    return new Modifier(name, description, vari,
        function() {},
        function(context) {
            if (context.wave) this.changeTarget(this.vars.targets.filter(u => !filter(u) || !allUnits.includes(u)), allUnits.filter(u => filter(u) && !this.vars.targets.includes(u)));
            else {
                if (this.vars.targets.includes(context.unit)) { if (!allUnits.includes(context.unit) || !filter(context.unit)) this.changeTarget([context.unit]) }
                else if (filter(context.unit)) this.changeTarget([], [context.unit])
            }
        },
        function(cancel, temp) {
            if (!temp) {
                if (this.vars.cancel && this.vars.applied) {
                    if (this.vars.child) [...this.vars.child].forEach(m => removeModifier(m));
                    this.vars.applied = false;
                } else if (!this.vars.cancel && !this.vars.applied) {
                    this.vars.targets.forEach(u => mod(u))
                    this.vars.applied = true;
                }
            }
        },
        function(remove = [], add = []) {
            if (this.vars.applied) {
                if (this.vars.child) this.vars.child.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                add.forEach(u => mod(u))
            }
            this.vars.targets = [...this.vars.targets.filter(target => !remove.includes(target)), ...add];
        }
    )
}

function stunModifier(name, vari, dur = 'target') {
    return new Modifier(name, "Stun", vari,
        function() {
            if (eventState.stun.length) handleEvent("stun", { unit: this.vars.target, stun: true });
            this.vars.target.stun++;
            if (this.vars.target.stun) {
                for (const mod of this.vars.modifiers = modifiers.filter(m => m.vars.caster === this.vars.target && m.vars.focus)) {
                    currentAction.push([mod, mod.vars.caster]);
                    mod.cancel();
                    currentAction.pop();
                }
                logAction(`${this.vars.target} becomes stunned!`, "debuff");
            }
        },
        function(context) {
            if (this.vars[dur] === context.unit) this.vars.duration--;
            return this.vars.duration <= 0;
        },
        function(cancel, temp) {
            if (!temp) {
                if (this.vars.cancel && this.vars.applied) {
                    this.vars.applied = false;
                    if (eventState.stun.length) handleEvent("stun", { unit: this.vars.target, stun: false });
                    this.vars.target.stun--;
                    if (!this.vars.target.stun) {
                        for (const mod of this.vars.modifiers) {
                            currentAction.push([mod, mod.vars.caster]);
                            mod.cancel(false);
                            currentAction.pop();
                        }
                        this.vars.modifiers = []
                    }
                } else if (!this.vars.cancel && !this.vars.applied) {
                    this.vars.applied = true;
                    if (eventState.stun.length) handleEvent("stun", { unit: this.vars.target, stun: true });
                    this.vars.target.stun++;
                    if (this.vars.target.stun) {
                        for (const mod of this.vars.modifiers = modifiers.filter(m => m.vars.caster === this.vars.target && m.vars.focus)) {
                            currentAction.push([mod, mod.vars.caster]);
                            mod.cancel();
                            currentAction.pop();
                        }
                    }
                }
            }
        }
    );
}

function blockModifier(name, vari, res, dur = "target", regen = false) {
    return new Modifier(name, `Blocks ${res === "all" ? 'resource' : res} regeneration`, vari,
        function() {
            this.vars.listeners ? this.vars.listeners.resourceChange = true : this.vars.listeners = { resourceChange: true };
            if (!(this.vars.cancelListeners ??= []).includes('resourceChange')) this.vars.cancelListeners.push('resourceChange');
        },
        function(context) {
            if (regen && regen.includes(context.event)) this.vars.uses = regen[0];
            if (context.unit === this.vars.target && context.resources && (this.vars.uses || !this.vars.hasOwnProperty('uses'))) {
                if (res === "all") {
                    let out = 0;
                    for (const resource in context.resources) if (context.resources[resource] * (context.add ? 1 : -1) > 0) out++, (context[resource] ??= {}).nil = (context[resource].nil || 0) + 1;
                    if (out && this.vars.uses) this.vars.uses--;
                    if (out && this.vars.duration && Object.keys(this.vars.listeners).length === 1) this.vars.duration--;
                }
                else if (context.resources[res] * (context.add ? 1 : -1) > 0) {
                    (context[res] ??= {}).nil = (context[res].nil || 0) + 1;
                    if (this.vars.uses) this.vars.uses--;
                    if (this.vars.duration && Object.keys(this.vars.listeners).length === 1) this.vars.duration--;
                }
            }
            if (context.event !== "resourceChange" && context.unit === this.vars[dur] && this.vars.duration) this.vars.duration--;
            return this.vars.hasOwnProperty('duration') ? this.vars.duration >= 0 : false;
        }
    )
}

function attribCancelMod(name, vari, attrib, dur = "target") {
    return new Modifier(name, `Ends non-passive ${attrib} modifiers target is focusing, cancels ${attrib} modifiers on target, and disables ${attrib === 'physical' ? 'stamina' : attrib === 'mystic' ? 'mana' : 'energy'} regen`, vari,
        function() {
            this.vars.modifiers = [];
            for (const mod of modifiers.filter(m => m !== this && m.vars.properties.includes(attrib) && !m.vars.perm && (m.vars.caster === this.vars.target || m.vars.target === this.vars.target))) {
                if (mod.vars.caster === this.vars.target && mod.vars.focus && !mod.vars.passive) removeModifier(mod);
                else if (mod.vars.target === this.vars.target || mod.vars.focus) {
                    this.vars.modifiers.push(mod);
                    currentAction.push([mod, mod.vars.caster]);
                    mod.cancel();
                    currentAction.pop();
                }
            }
            this.vars.listeners ? this.vars.listeners.resourceChange = this.vars.listeners.modifierEnd = this.vars.listeners.modifierStart = this.vars.listeners.targetChange = true : this.vars.listeners = { targetChange: true, modifierStart: true, modifierEnd: true, resourceChange: true };
            if (!(this.vars.cancelListeners ??= []).includes('resourceChange')) this.vars.cancelListeners.push('resourceChange');
            logAction(`${this.vars.target}'s ${attrib === 'physical' ? 'stamina' : attrib === 'mystic' ? 'mana' : 'energy'} is disabled!`, "debuff");
        },
        function(context) {
            if (context.modifier === this) return;
            if (context.event === 'targetChange') {
                if (context.modifier.vars.caster !== this.vars.target && this.vars.modifiers.includes(context.modifier)) {
                    this.vars.modifiers.splice(this.vars.modifiers.indexOf(context.modifier), 1);
                    currentAction.push([context.modifier, context.modifier.vars.caster]);
                    context.modifier.cancel(false);
                    currentAction.pop();
                } else if (context.args[0] === this.vars.target && context.modifier.properties.includes(attrib) && !this.vars.modifiers.includes(context.modifier)) {
                    this.vars.modifiers.push(context.modifier);
                    currentAction.push([context.modifier, context.modifier.vars.caster]);
                    context.modifier.cancel();
                    currentAction.pop();
                }
            }
            if (context.event === 'modifierStart' && context.modifier.vars.properties.includes(attrib) && !context.modifier.vars.perm && (context.modifier.vars.caster === this.vars.target || context.modifier.vars.target === this.vars.target)) {
                if (context.modifier.vars.caster === this.vars.target && context.modifier.vars.focus && !context.modifier.vars.passive) removeModifier(context.modifier);
                else if (context.modifier.vars.target === this.vars.target || context.modifier.vars.focus) {
                    this.vars.modifiers.push(context.modifier);
                    currentAction.push([context.modifier, context.modifier.vars.caster]);
                    context.modifier.cancel();
                    currentAction.pop();
                }
            }
            if (context.event === 'modifierEnd' && this.vars.modifiers.includes(context.modifier)) { this.vars.modifiers.splice(this.vars.modifiers.indexOf(context.modifier), 1) }
            if (this.vars.applied && context.unit === this.vars.target && context.resources?.[attrib === 'physical' ? 'stamina' : attrib === 'mystic' ? 'mana' : 'energy'] * (context.add ? 1 : -1) > 0) (context[attrib === 'physical' ? 'stamina' : attrib === 'mystic' ? 'mana' : 'energy'] ??= {}).nil = (context[attrib === 'physical' ? 'stamina' : attrib === 'mystic' ? 'mana' : 'energy'].nil || 0) + 1;
            if (context.event !== 'resourceChange' && this.vars[dur] === context.unit) this.vars.duration--;
            if (this.vars.hasOwnProperty("duration")) return this.vars.duration <= 0;
        },
        function(cancel, temp) {
            if (!temp) {
                if (this.vars.cancel && this.vars.applied) {
                    this.vars.applied = false;
                    for (const listener of this.vars.cancelListeners) {
                        this.vars.listeners[listener] = false;
                        const i = eventState[listener].indexOf(this);
                        if (i > -1) eventState[listener].splice(i, 1);
                    }
                    for (const mod of this.vars.modifiers) {
                        currentAction.push([mod, mod.vars.caster]);
                        mod.cancel(false);
                        currentAction.pop();
                    }
                    this.vars.modifiers = []
                } else if (!this.vars.cancel && !this.vars.applied) {
                    this.vars.applied = true;
                    for (const listener of this.vars.cancelListeners) {
                        this.vars.listeners[listener] = true;
                        eventState[listener].push(this);
                    }
                    for (const mod of modifiers.filter(m => m !== this && m.vars.properties.includes(attrib) && !m.vars.perm && (m.vars.caster === this.vars.target || m.vars.target === this.vars.target))) {
                        if (mod.vars.caster === this.vars.target && mod.vars.focus && !mod.vars.passive) removeModifier(mod);
                        else if (mod.vars.target === this.vars.target || mod.vars.focus) {
                            this.vars.modifiers.push(mod);
                            currentAction.push([mod, mod.vars.caster]);
                            mod.cancel();
                            currentAction.pop();
                        }
                    }
                }
            }
        }
    );
}

new Modifier("Reapply Passive", "Reapplies passive modifiers on unit revive",
    { caster: system, target: system, properties: ["system"], listeners: { unitChange: true }, perm: true },
    function() {},
    function(context) { if (context.type === "revive") for (const mod of modifiers.filter(m => m.vars.caster === context.unit && m.vars.passive && (m.vars.focus || m.vars.penalty))) mod.cancel(false) },
    function() {},
    function() {}
);

new Modifier("Remove Reduction", "Remove passive modifiers and reduction on midline position change",
    { caster: system, target: system, properties: ["system"], listeners: { positionChange: true }, perm: true },
    function() {},
    function(context) {
        for (let i = modifiers.length - 1; i >= 0; i--) {
            if (modifiers[i].vars.caster !== context.unit || !modifiers[i].vars.passive) continue;
            if (modifiers[i].vars.reduction) for (const stat of Object.keys(modifiers[i].vars.reduction)) modifiers[i].vars.caster.mult[stat] ? (modifiers[i].vars.caster.base[stat] += modifiers[i].vars.reduction[stat]) && resetStat(modifiers[i].vars.caster, [stat]) : (modifiers[i].vars.caster.base[stat] += modifiers[i].vars.reduction[stat]) && (modifiers[i].vars.caster[stat] = Math.min(modifiers[i].vars.caster[stat] + modifiers[i].vars.reduction[stat], modifiers[i].vars.caster.base[stat]));
            modifiers[i].vars.passive = false;
            removeModifier(modifiers[i]);
        }
        for (const skill of ['passive', 'augment']) {
            if (context.unit.skills[skill]) {
                currentAction.push([context.unit.skills[skill], context.unit])
                context.unit.skills[skill].code.call(context.unit);
                currentAction.pop();
            }
        }
    },
    function() {},
    function() {}
);

const logAction = (function () {
    let lastLogState = {};
    const STAT_CHANGE_REGEX = /^(.+?)'s (.+ (?:increased|decreased)(?:, and .+ decreased)?\.)$/;
    return function (message, type = 'info') {
        const logContainer = document.getElementById('action-log');
        if (!logContainer) return;
        const actionPrefix = currentAction.length ? currentAction.at(-1)[0].name + ': ' : '';
        const match = message.match(STAT_CHANGE_REGEX);
        if (match) {
            const [, unitName, statChangeText] = match;
            if (lastLogState.type === type && lastLogState.actionPrefix === actionPrefix && lastLogState.statChangeText === statChangeText) {
                lastLogState.units.push(unitName);
                const combinedUnits = lastLogState.units.join(', ');
                lastLogState.element.innerHTML = `${actionPrefix}${combinedUnits}'s ${statChangeText}`;
                logContainer.scrollTop = logContainer.scrollHeight;
                return;
            }
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}-entry`;
            logEntry.innerHTML = actionPrefix + message;
            logContainer.appendChild(logEntry);
            lastLogState = { type, actionPrefix, statChangeText, units: [unitName], element: logEntry };
        } else {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}-entry`;
            logEntry.innerHTML = actionPrefix + message;
            logContainer.appendChild(logEntry);
            lastLogState = {};
        }
        /*const entries = logContainer.children;
        const maxEntries = window.innerWidth < 800 ? 100 : 250;
        while (entries.length > maxEntries) logContainer.removeChild(entries[0]);*/
        logContainer.scrollTop = logContainer.scrollHeight;
    };
})();

function resetStat(unit, statList, values = [], add = true) {
    if (values.length) {
        /*console.log(values);*/
        if (eventState.statChange.length) handleEvent('statChange', { unit, statList, values, add });
        let nullCheck;
        const inc = [], dec = [];
        for (let i = 0; i < Math.min(statList.length, values.length); i++) {
            if (!values[i]) {
                if ((values[i] == null || Number.isNaN(values[i])) && !nullCheck) nullCheck = !logAction("Stat change has null values!", "error");
                continue;
            }
            unit.mult[statList[i]] += add ? values[i] : -values[i];
            (add ? values[i] : -values[i]) > 0 ? inc.push(statList[i]) : dec.push(statList[i]);
        }
        if (!turnOffStatLog && (inc.length + dec.length)) !dec.length ? logAction(`${unit.name}'s ${inc.join(", ")} increased.`, 'buff') : !inc.length ? logAction(`${unit.name}'s ${dec.join(", ")} decreased.`, 'debuff') : logAction(`${unit.name}'s ${inc.join(", ")} increased, and ${dec.join(", ")} decreased.`, 'info');
    }
    for (const stat of statList) unit[stat] = unit.base[stat] + Math.max(-0.8 * unit.base[stat], unit.mult[stat] || 0);
}

export { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState };