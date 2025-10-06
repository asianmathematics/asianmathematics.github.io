import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Dark = new Unit("Dark", [550, 75, 18, 50, 115, 45, 120, 35, 125, 175, "front", 66, 150, 18, 250, 30], ["Death/Darkness", "Inertia/Cold", "Independence/Loneliness"], function() {
    this.actions.iceshock = {
        name: "Iceshock [mystic]",
        properties: ["mystic", "intertia/cold", "attack"],
        description: "Attacks a single target 4 times.",
        target: () => { selectTarget(this.actions.iceshock, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            this.previousAction[1] = true;
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.perfectFreeze = {
        name: "Perfect Freeze [mana]",
        properties: ["mystic", "mana", "inertia/cold", "debuff", "stun"],
        cost: { mana: 90 },
        description: "Costs 90 mana\nStuns a single target for a turn",
        target: () => {
            if (this.resource.mana < 90) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.perfectFreeze, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 90;
            this.previousAction[1] = true;
            const will = resistDebuff(this, target);
            if (will[0] > 50) {
                logAction(`${this.name} freezes ${target[0].name}!`, "action");
                const self = this;
                new Modifier("Perfect Freeze", "stun effect",
                    { caster: self, targets: target, duration: 1, attributes: ["mystic"], elements: ["inertia/cold"], listeners: {turnEnd: true}, cancel: false, applied: true, focus: true, mod: null, modlist: null },
                    (vars) => {
                        vars.mod = modifiers.findLast(m => m.name === "Perfect Freeze" && m.vars.targets.includes(target[0]) && m.vars.caster === vars.caster);
                        vars.targets[0].stun = true;
                        if (eventState.stun.flag) {handleEvent('stun', { effect: vars.mod, unit: vars.targets[0], stun: true }) }
                        if (vars.targets[0].stun) {
                            vars.modlist = modifiers.filter( m => m.vars.caster === vars.targets[0] && m.vars.focus === true);
                            for (const mod of vars.modlist) {
                                mod.vars.cancel = true;
                                if (eventState.cancel.flag) {handleEvent('cancel', { effect: vars.mod, target: mod, cancel: true }) }
                                mod.onTurn({})
                            }
                        }
                    },
                    (vars, context) => {
                        if (vars.cancel && vars.applied) {
                            vars.targets[0].stun = false;
                            vars.applied = false;
                            if (eventState.stun.flag) {handleEvent('stun', { effect: vars.mod, unit: vars.targets[0], stun: false }) }
                            if (!vars.targets[0].stun) {
                                for (const mod of vars.modlist) {
                                    mod.vars.cancel = false;
                                    if (eventState.cancel.flag) {handleEvent('cancel', { effect: vars.mod, target: mod, cancel: false }) }
                                    mod.onTurn({})
                                }
                            }
                        }
                        else if (!vars.cancel && !vars.applied) {
                            vars.targets[0].stun = true;
                            vars.applied = true;
                            if (eventState.stun.flag) {handleEvent('stun', { effect: vars.mod, unit: vars.targets[0], stun: true }) }
                            if (vars.targets[0].stun) {
                                vars.modlist = modifiers.filter( m => m.vars.caster === vars.targets[0] && m.vars.focus === true);
                                for (const mod of vars.modlist) {
                                    mod.vars.cancel = true;
                                    if (eventState.cancel.flag) {handleEvent('cancel', { effect: vars.mod, target: mod, cancel: true }) }
                                    mod.onTurn({})
                                }
                            }
                        }
                        if (vars.targets[0] === context.unit) { vars.duration-- }
                        if (vars.duration === 0) { return true }
                    }
                );
            } else { logAction(`${target[0].name} resists the freeze!`, "miss") }
        }
    };

    this.actions.danmaku = {
        name: "Danmaku [mana]",
        properties: ["mystic", "mana", "attack", "debuff", "multitarget"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nDecreases evasion for 1 turn\nHits up to 6 random enemies 10 times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            const statDecrease = [-0.5];
            this.resource.mana -= 40;
            this.previousAction[1] = true;
            logAction(`${this.name} shoots some danmaku!`, "action");
            let target = unitFilter("enemy", "front", false);
            if (target.length > 6) { target = randTarget(target, 6, true) }
            attack(this, target, 10, { attacker: { accuracy: this.accuracy * 0.75, attack: this.attack * 0.5 } });
            const self = this;
            basicModifier("Evasion Penalty", "Evasion reduced during bullet hell", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["evasion"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        properties: ["mystic", "mana", "intertia/cold", "debuff", "resource"],
        cost: { mana: 60 },
        description: "Costs 60 mana\nSets target's mana to 0, disables mana regeneration for next turn, and ends all mystic modifers it\'s focusing",
        target: () => {
            if (this.resource.mana < 60) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 60;
            this.previousAction[1] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 45) {
                    const self = this
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: self.actions.dispelMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (const mod of modifiers.filter(m => m.vars.caster === target[0] && m.attributes && m.attributes.includes("mystic"))) { removeModifier(mod) }
                    window.updateModifiers();
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss") }
            } else { logAction(`${target[0].name} has no magic to dispel!`, "warning") }
        }
    };

    this.actions.dodge = {
        name: "Dodge [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases evasion for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [2];
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            basicModifier("Dodge", "Evasion increased", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["evasion"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };
});