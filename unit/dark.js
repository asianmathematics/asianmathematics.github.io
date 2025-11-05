import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Dark = new Unit("Dark", [2400, 84, 40, 200, 60, 175, 75, 275, 245, "front", 160, 120, 15, 200, 20], ["death/darkness", "inertia/cold", "radiance/purity", "independence/loneliness"], function() {
    this.actions.iceshock = {
        name: "Iceshock [mystic]",
        properties: ["mystic", "intertia/cold", "attack"],
        description: "Attacks a single target 4 times.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.iceshock, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.iceshock.code(randTarget(unitFilter("player", "front", false))) },
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
            this.team === "player" ? selectTarget(this.actions.perfectFreeze, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.perfectFreeze.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            this.resource.mana -= 50;
            this.previousAction[1] = true;
            if (resistDebuff(this, target)[0] * (2 ** (elementBonus(this, this.actions.perfectFreeze) - elementBonus(target[0], this.actions.perfectFreeze))) > 1) {
                logAction(`${this.name} freezes ${target[0].name}!`, "action");
                new Modifier("Perfect Freeze", "stun effect",
                    { caster: this, target: target[0], duration: 1, attributes: ["mystic"], elements: ["inertia/cold"], listeners: {turnEnd: true}, cancel: false, applied: true, focus: true, debuff: function(unit) { return resistDebuff(this, unit)[0] * (2 ** (elementBonus(this.vars.caster, this.vars.caster.actions.perfectFreeze) - elementBonus(unit, this.vars.caster.actions.perfectFreeze))) > 1}, modlist: null },
                    function() {
                        this.vars.target.stun++;
                        if (eventState.stun.length) {handleEvent('stun', { effect: this, unit: this.vars.target, stun: true }) }
                        if (this.vars.target.stun) {
                            this.vars.modlist = modifiers.filter( m => m.vars.caster === this.vars.target && m.vars.focus === true);
                            for (const mod of this.vars.modlist) {
                                modifiers.push(mod);
                                mod.cancel();
                                modifiers.pop();
                            }
                        }
                    },
                    function(context) {
                        if (this.vars.target === context?.unit) { this.vars.duration-- }
                        if (this.vars.duration === 0) { return true }
                    },
                    function() {
                        if (this.vars.cancel && this.vars.applied) {
                            this.vars.target.stun--;
                            this.vars.applied = false;
                            if (eventState.stun.length) {handleEvent('stun', { effect: this, unit: this.vars.target, stun: false }) }
                            if (!this.vars.target.stun) {
                                for (const mod of this.vars.modlist) {
                                    modifiers.push(mod);
                                    mod.cancel(false);
                                    modifiers.pop();
                                }
                            }
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            this.vars.target.stun++;
                            this.vars.applied = true;
                            if (eventState.stun.length) {handleEvent('stun', { effect: this, unit: this.vars.target, stun: true }) }
                            if (this.vars.target.stun) {
                                this.vars.modlist = modifiers.filter( m => m.vars.caster === this.vars.target && m.vars.focus === true);
                                for (const mod of this.vars.modlist) {
                                    modifiers.push(mod);
                                    mod.cancel();
                                    modifiers.pop();
                                }
                            }
                        }
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
            attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false), 4, true), 6, { attacker: { accuracy: this.accuracy - 36, attack: this.attack - 20, focus: this.focus - 50 } });
            basicModifier("Evasion Penalty", "Evasion reduced during bullet hell", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["evasion"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
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
            this.team === "player" ? selectTarget(this.actions.dispelMagic, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.dispelMagic.code(randTarget(unitFilter("player", "front", false).filter(u => u.base.resource.mana)));
        },
        code: (target) => {
            if (target.length) {
                this.resource.mana -= 40;
                this.previousAction[1] = true;
                if (target[0].resource.mana !== undefined) {
                    if (resistDebuff(this, target)[0] > 50 - (25 * 2 ** (elementBonus(this, this.actions.dispelMagic) - elementBonus(target[0], this.actions.dispelMagic)))) {
                        if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.actions.dispelMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                        target[0].resource.mana = 0;
                        target[0].previousAction[1] = true;
                        for (const mod of modifiers.filter(m => m?.attributes?.includes("mystic") && ((m.vars.caster === target[0] && m.vars.focus) || m.vars?.target === target[0]))) { removeModifier(mod) }
                        for (const mod of modifiers.filter(m => m.vars?.targets?.includes(target[0]) && m?.attributes?.includes("mystic"))) { mod.changeTarget(target) }
                        window.updateModifiers();
                        logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                    } else { logAction(`${target[0].name} resists dispel magic`, "miss") }
                } else { logAction(`${target[0].name} has no magic to dispel!`, "warning") }
            } else { this.actions.iceshock.target() }
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
            basicModifier("Dodge", "Evasion and resist increased", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.actionWeight = {
        iceshock: 0.3,
        perfectFreeze: 0.2,
        danmaku: 0.15,
        dispelMagic: 0.25,
        dodge: 0.1
    };
}, function() {
    this.passives.avatarOfLoneliness = {
        name: "Avatar of Loneliness [passive]",
        properties: ["passive", "independence/loneliness", "buff", "debuff"],
        description: "Gives strong buffs to other Independence/Loneliness units, self penalty when others present/alive, self boost otherwise",
        points: 30,
        code: () => {
            const darkBoost = [.2, .3, .15];
            const otherBoost = [.25, .25, .1];
            const selfBoost = [Math.floor(.1 * this.base.focus + Number.EPSILON), Math.floor(.1 * this.base.resist + Number.EPSILON), Math.floor(.5 * this.base.presence + Number.EPSILON)];
            const penalty = [-Math.floor(.07 * this.base.accuracy + Number.EPSILON), -Math.floor(.2 * this.base.speed + Number.EPSILON)];
            new Modifier("Avatar of Loneliness", "Gives strong buffs to other Independence/Loneliness units, self penalty when others present/alive, self boost otherwise",
                { caster: this, targets: unitFilter(this.team, "").filter(unit => unit.elements.includes("independence/loneliness") && unit !== this), elements: ["radiance/purity", "independence/loneliness"], darkStats: ["attack", "accuracy", "focus"], darkValues: darkBoost, otherStats: ["defense", "evasion", "resist"], otherValues: otherBoost, boostStats: ["focus", "resist", "presence"], boostValues: selfBoost, penaltyStats: ["accuracy", "speed"], penaltyValues: penalty, bonusArray: [], valueArray: [], listeners: { unitChange: true, positionChange: true, turnEnd: false }, self: false, cancel: false, applied: true, focus: true, passive: true},
                function() {
                    for (const unit of this.vars.targets) {
                        this.vars.bonusArray.push(2 ** elementBonus(unit, this));
                        if (unit.name.includes("Dandelion")) {
                            this.vars.valueArray.push(this.vars.darkStats.map((val, i) => Math.floor(this.vars.darkValues[i] * unit.base[val] * this.vars.bonusArray.at(-1) + Number.EPSILON)));
                            resetStat(unit, this.vars.darkStats, this.vars.valueArray.at(-1));
                        } else {
                            this.vars.valueArray.push(this.vars.otherStats.map((val, i) => Math.floor(this.vars.otherValues[i] * unit.base[val] * this.vars.bonusArray.at(-1) + Number.EPSILON)));
                            resetStat(unit, this.vars.otherStats, this.vars.valueArray.at(-1));
                        }
                    }
                    this.vars.targets.length ? resetStat(this.vars.caster, this.vars.penaltyStats, this.vars.penaltyValues) : resetStat(this.vars.caster, this.vars.boostStats, this.vars.boostValues);
                },
                function(context) {
                    if (this.vars.targets.includes(context.unit)) {
                        if (context.position) {
                            this.vars.listeners.turnEnd = true;
                            eventState.turnEnd.push(this);
                        } else if (context.type) {
                            switch (context.type) {
                                case "downed":
                                    if (!this.vars.self && !this.vars.targets.some(unit => unit.hp > 0).length) {
                                        if (this.vars.applied) { resetStat(this.vars.caster, [ ...this.vars.penaltyStats, ...this.vars.boostStats], [ ...this.vars.penaltyValues.map(val => -val), ...this.vars.boostValues]) }
                                        this.vars.self = true;
                                    }
                                    break;
                                case "revive":
                                    if (this.vars.self && this.vars.targets.some(unit => unit.hp > 0)) {
                                        if (this.vars.applied) { resetStat(this.vars.caster, [ ...this.vars.penaltyStats, ...this.vars.boostStats], [ ...this.vars.penaltyValues.map(val => -val), ...this.vars.boostValues], false) }
                                        this.vars.self = false;
                                    }
                                    break;
                            }
                        } else {
                            const index = this.vars.targets.indexOf(context.unit);
                            if (this.vars.applied) { resetStat(context.unit, this.vars.otherStats, this.vars.valueArray[index], false) }
                            this.vars.valueArray[index] = this.vars.darkStats.map((val, i) => Math.floor(this.vars.darkValues[i] * context.unit.base[val] * this.vars.bonusArray[index] + Number.EPSILON));
                            if (this.vars.applied) { resetStat(context.unit, this.vars.otherStats, this.vars.valueArray[index]) }
                            this.vars.listeners.turnEnd = false;
                            eventState.turnEnd.splice(eventState.turnEnd.indexOf(this), 1);
                        }
                    }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        for (let i = 0; i < this.vars.targets.length; i++) { this.vars.targets[i].name.includes("Dandelion") ? resetStat(this.vars.targets[i], this.vars.darkStats, this.vars.valueArray[i], false) : resetStat(this.vars.targets[i], this.vars.otherStats, this.vars.valueArray[i], false) }
                        !this.vars.self ? resetStat(this.vars.caster, this.vars.penaltyStats, this.vars.penaltyValues, false) : resetStat(this.vars.caster, this.vars.boostStats, this.vars.boostValues, false);
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        for (let i = 0; i < this.vars.targets.length; i++) { this.vars.targets[i].name.includes("Dandelion") ? resetStat(this.vars.targets[i], this.vars.darkStats, this.vars.valueArray[i]) : resetStat(this.vars.targets[i], this.vars.otherStats, this.vars.valueArray[i]) }
                        !this.vars.self ? resetStat(this.vars.caster, this.vars.penaltyStats, this.vars.penaltyValues) : resetStat(this.vars.caster, this.vars.boostStats, this.vars.boostValues);
                        this.vars.applied = true;
                    }
                },
                function(remove = [], add = []) {
                    for (let i = this.vars.targets.length - 1; i >= 0; i--) {
                        this.vars.targets[i].name.includes("Dandelion") ? resetStat(this.vars.targets[i], this.vars.darkStats, this.vars.valueArray[i], false) : resetStat(this.vars.targets[i], this.vars.otherStats, this.vars.valueArray[i], false);
                        if (remove.includes(this.vars.targets[i])) {
                            this.vars.targets.splice(i, 1);
                            this.vars.bonusArray.splice(i, 1);
                            this.vars.valueArray.splice(i, 1);
                        }
                    }
                    for (const unit of add) {
                        this.vars.bonusArray.push(2 ** elementBonus(unit, this));
                        if (unit.name.includes("Dandelion")) {
                            this.vars.valueArray.push(this.vars.darkStats.map((val, i) => Math.floor(this.vars.darkValues[i] * unit.base[val] * this.vars.bonusArray.at(-1) + Number.EPSILON)));
                            resetStat(unit, this.vars.darkStats, this.vars.valueArray.at(-1));
                        } else {
                            this.vars.valueArray.push(this.vars.otherStats.map((val, i) => Math.floor(this.vars.otherValues[i] * unit.base[val] * this.vars.bonusArray.at(-1) + Number.EPSILON)));
                            resetStat(unit, this.vars.otherStats, this.vars.valueArray.at(-1));
                        }
                    }
                    for (let i = 0; i < this.vars.targets.length; i++) {
                        this.vars.targets[i].name.includes("Dandelion") ? resetStat(this.vars.targets[i], this.vars.darkStats, this.vars.valueArray[i]) : resetStat(this.vars.targets[i], this.vars.otherStats, this.vars.valueArray[i]);
                    }
                    if (this.vars.targets.some(unit => unit.hp > 0)) {
                        if (this.vars.applied) { resetStat(this.vars.caster, [ ...this.vars.penaltyStats, ...this.vars.boostStats], [ ...this.vars.penaltyValues.map(val => -val), ...this.vars.boostValues], false) }
                        this.vars.self = false;
                    } else {
                        if (this.vars.applied) { resetStat(this.vars.caster, [ ...this.vars.penaltyStats, ...this.vars.boostStats], [ ...this.vars.penaltyValues.map(val => -val), ...this.vars.boostValues]) }
                        this.vars.self = true;
                    }
                }
            );
        }
    }
});