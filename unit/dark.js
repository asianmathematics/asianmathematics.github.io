import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Dark = new Unit("Dark", [2400, 80, 40, 200, 60, 175, 75, 275, 225, "front", 160, 120, 15, 200, 20], ["death/darkness", "inertia/cold", "radiance/purity", "independence/loneliness"], function() {
    this.actions.iceshock = {
        name: "Iceshock [mystic]",
        properties: ["mystic", "intertia/cold", "attack"],
        description: "Attacks a single target 4 times.",
        points: 60,
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
        cost: { mana: 50 },
        description: "Costs 50 mana\nStuns a single target for 1 turn, 1% chance of failure",
        points: 58,
        target: () => {
            if (this.resource.mana < 50) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.perfectFreeze, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 50;
            this.previousAction[1] = true;
            if (resistDebuff(this, target)[0] > 1) {
                logAction(`${this.name} freezes ${target[0].name}!`, "action");
                new Modifier("Perfect Freeze", "stun effect",
                    { caster: this, targets: target, duration: 1, attributes: ["mystic"], elements: ["inertia/cold"], listeners: {turnEnd: true}, cancel: false, applied: true, focus: true, modlist: null },
                    function() {
                        this.vars.targets[0].stun = true;
                        if (eventState.stun.flag) {handleEvent('stun', { effect: this, unit: this.vars.targets[0], stun: true }) }
                        if (this.vars.targets[0].stun) {
                            this.vars.modlist = modifiers.filter( m => m.vars.caster === this.vars.targets[0] && m.vars.focus === true);
                            for (const mod of this.vars.modlist) {
                                mod.vars.cancel++;
                                if (eventState.cancel.flag) {handleEvent('cancel', { effect: this, target: mod, cancel: true }) }
                                mod.onTurn({})
                            }
                        }
                    },
                    function(context) {
                        if (this.vars.cancel && this.vars.applied) {
                            this.vars.targets[0].stun = false;
                            this.vars.applied = false;
                            if (eventState.stun.flag) {handleEvent('stun', { effect: this, unit: this.vars.targets[0], stun: false }) }
                            if (!this.vars.targets[0].stun) {
                                for (const mod of this.vars.modlist) {
                                    mod.vars.cancel--;
                                    if (eventState.cancel.flag) {handleEvent('cancel', { effect: this, target: mod, cancel: false }) }
                                    mod.onTurn({})
                                }
                            }
                        }
                        else if (!this.vars.cancel && !this.vars.applied) {
                            this.vars.targets[0].stun = true;
                            this.vars.applied = true;
                            if (eventState.stun.flag) {handleEvent('stun', { effect: this, unit: this.vars.targets[0], stun: true }) }
                            if (this.vars.targets[0].stun) {
                                this.vars.modlist = modifiers.filter( m => m.vars.caster === this.vars.targets[0] && m.vars.focus === true);
                                for (const mod of this.vars.modlist) {
                                    mod.vars.cancel++;
                                    if (eventState.cancel.flag) {handleEvent('cancel', { effect: this, target: mod, cancel: true }) }
                                    mod.onTurn({})
                                }
                            }
                        }
                        if (this.vars.targets[0] === context?.unit) { this.vars.duration-- }
                        if (this.vars.duration === 0) { return true }
                    }
                );
            } else { logAction(`${target[0].name} resists the freeze!`, "miss") }
        }
    };

    this.actions.danmaku = {
        name: "Danmaku [mana]",
        properties: ["mystic", "mana", "attack", "debuff", "multitarget"],
        cost: { mana: 50 },
        description: "Costs 50 mana\nAttacks 4 random enemies 6 times with decreased accuracy and damage, decreases evasion for 1 turn",
        points: 60,
        code: () => {
            if (this.resource.mana < 50) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            const statDecrease = [-20];
            this.resource.mana -= 50;
            this.previousAction[1] = true;
            logAction(`${this.name} shoots some danmaku!`, "action");
            attack(this, randTarget(unitFilter("enemy", "front", false), 4, true), 6, { attacker: { accuracy: this.accuracy - 36, attack: this.attack - 20, focus: this.focus - 50 } });
            basicModifier("Evasion Penalty", "Evasion reduced during bullet hell", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["evasion"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        properties: ["mystic", "mana", "intertia/cold", "debuff", "resource"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nChance to set target&#39;s mana to 0, disable mana regeneration for next turn, and end all mystic modifiers it focuses or cast on it",
        points: 60,
        target: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 40;
            this.previousAction[1] = true;
            if (target[0].resource.mana !== undefined) {
                if (resistDebuff(this, target)[0] > 25) {
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.dispelMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (const mod of modifiers.filter(m => m?.attributes?.includes("mystic") && ((m.vars.caster === target[0] && m.vars.focus) || m.vars.targets[0] === target[0]))) { removeModifier(mod) }
                    for (const mod of modifiers.filter(m => m.vars.targets.includes(target[0]) && m?.attributes?.includes("mystic"))) {
                        if (mod.vars.applied) {
                            mod.vars.cancel++;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.dispelMagic, target: mod, cancel: true }) }
                            mod.onTurn.call(mod.vars, {})
                            mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1);
                            mod.vars.cancel--;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.dispelMagic, target: mod, cancel: false }) }
                            mod.onTurn.call(mod.vars, {})
                        } else { mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1) }
                     }
                    window.updateModifiers();
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss") }
            } else { logAction(`${target[0].name} has no magic to dispel!`, "warning") }
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        properties: ["physical", "buff"],
        description: "Slightly increases defense and resist, slightly decreases presence, and increases evasion for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [2, 12, 7, -2];
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            basicModifier("Dodge", "Evasion and resist increased", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };
}/*, function() {
    this.passives.avatarOfLoneliness = {
        name: "Avatar of Loneliness [passive]",
        properties: ["passive", "independence/loneliness", "buff", "debuff"],
        description: "Strong Independence/Loneliness boosts, self penalty when others present",
        code: () => {
            new Modifier("Avatar of Loneliness", "Strong Independence/Loneliness boosts, self penalty when others present", 
                { caster: this, targets: unitFilter(this.team, "").filter(unit => unit.elements.includes("independence/loneliness") && unit !== this), elements: ["radiance/purity", "independence/loneliness"], listeners: { unitChange: true }, self: false, cancel: false, applied: true, focus: true},
                function() {}
            )
        }
    }
}*/);