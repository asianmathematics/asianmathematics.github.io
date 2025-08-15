import { Unit } from './unit.js';
import { unitCombatData } from './unitCombatData.js';
import { modifiers, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, resetStat, handleEvent } from '../combatDictionary.js';

const Dark = new Unit("Dark",
    [550, 75, 18, 50, 115, 45, 120, 35, 125, 175, "front", 150, 18, 250, 30],
    [.013, .015, .01, .012, .007, .018, .01, .011, .008, .012, .011, .006, .013, .007],
    darkActionsInit, darkPassivesInit, ["Death/Darkness", "Inertia/Cold", "Independence/Loneliness"], unitCombatData.Dark.level, unitCombatData.Dark.power);

const darkActionsInit = function() { 
    this.actions.iceshock = {
        name: "Iceshock [mystic]",
        properties: ["mystic", "inertia/cold", "attack"],
        description: "Attacks a single target multiple times.",
        target: () => { selectTarget(this.actions.iceshock, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)], this); },
        code: (target) => {
            const actionLevel = Math.max(-127, Math.min(128, this.level + (this.mysticLevelMod || 0)));
            const numAttacks = Math.max(1, 3 + Math.floor((actionLevel - 16) / 32));
            const statIncrease = [0.6 + Math.floor((actionLevel - 8) / 64) * 0.4, 0.8 + Math.floor((actionLevel - 32) / 32) * 0.2];
            this.attack *= statIncrease[0];
            this.accuracy *= statIncrease[1];
            this.previousAction[1] = true;
            logAction(`${this.name} fires magic projectiles at ${target[0].name} (${numAttacks} attacks, Action Level: ${actionLevel})`, "action");
            attack(this, target, numAttacks);
            resetStat(this, ["attack", "accuracy"]);
        }
    };

    this.actions.absoluteZero = {
        name: "Absolute Zero [physical, mana]",
        properties: ["physical", "mystic", "mana", "inertia/cold", "goner/entropy", "attack", "debuff"],
        cost: { mana: 30 },
        description: "Costs 30 mana\nAttacks a single target multiple times and chances to decrease its evasion and speed for 1 turn",
        target: () => { 
            if (this.resource.mana < 30) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.absoluteZero, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)], this);
        },
        code: (target) => {
            const actionLevel = Math.max(-127, Math.min(128, this.level + (this.mysticLevelMod || 0) + (this.physicalLevelMod || 0)));
            const numAttacks = Math.max(1, 2 + Math.floor((actionLevel - 16) / 32));
            const statIncrease = [0.7 + Math.floor((actionLevel - 32) / 64) * 0.3, 0.9 + Math.floor((actionLevel - 8) / 64) * 0.1];
            const debuffValue = [-0.4 * (1 + Math.floor((actionLevel - 32) / 32) * 0.5), -0.2 * (1 + Math.floor((actionLevel - 64) / 64) * 0.5)];
            const willCheck = 55 + Math.floor(actionLevel / 16);
            this.attack *= statIncrease[0];
            this.accuracy *= statIncrease[1];
            this.resource.mana -= 30;
            [this.previousAction[0], this.previousAction[1]] = [true, true];
            logAction(`${this.name} saps the surrounding energy around ${target[0].name}`, "action");
            attack(this, target, numAttacks);
            const will = resistDebuff(this, target);
            if (will[0] < willCheck) {
                logAction(`${target[0].name} is frozen!`, "action");
                createMod("Absolute Zero", "evasion and speed reduced",
                    { caster: this, targets: target, duration: 1, attribute: ["mystic"], element: ["inertia/cold", "goner/entropy"], stats: ["evasion", "speed"], values: debuffValue, listeners: { turnStart: true }, suppressed: false, applied: true, focus: true },
                    (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                    (vars, context) => {
                        if (vars.suppressed && vars.applied) {
                            resetStat(vars.caster, vars.stats, vars.values, false);
                            vars.applied = false;
                        }
                        else if (!vars.suppressed && !vars.applied) { 
                            resetStat(vars.caster, vars.stats, vars.values);
                            vars.applied = true;
                        }
                        if (vars.targets[0] === context.turn) {
                            if (vars.applied) { resetStat(vars.caster, vars.stats, vars.values, false) }
                            return true;
                        }
                    }
                );
            } else { logAction(`${target[0].name} resists the freeze!`, "miss"); }
        }
    };

    this.actions.danmaku = {
        name: "Danmaku [mana]",
        properties: ["mystic", "mana", "attack", "debuff", "multitarget"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nDecreases evasion for 1 turn\nHits a random number of enemies multiple times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            const actionLevel = Math.max(-127, Math.min(128, this.level + (this.mysticLevelMod || 0)));
            const numAttacks = Math.max(1, 5 + Math.floor((actionLevel - 28) / 32));
            const numTargets = Math.max(1, 4 + Math.floor((actionLevel - 24) / 16));
            const statIncrease = [.5 + (actionLevel - 4) / 32, .75 + (actionLevel - 4) / 32];
            const debuffValue = [-0.5 * (1 - Math.min(1, (actionLevel - 6) / 64))];
            this.resource.mana -= 40;
            this.previousAction[1] = true;
            this.attack *= statIncrease[0];
            this.accuracy *= statIncrease[1];
            logAction(`${this.name} shoots some danmaku!`, "action");
            attack(this, randTarget(unitFilter("enemy", "front", false), numTargets, true), numAttacks);
            resetStat(this, ["attack", "accuracy"]);
            const self = this;
            createMod("Evasion Penalty", "Evasion reduced during bullet hell",
                { caster: self, targets: [self], duration: debuffDuration, stats: ["evasion"], values: debuffValue, listeners: { turnStart: true }, suppressed: false, applied: true },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, context) => {
                    if (vars.suppressed && vars.applied) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        vars.applied = false;
                    }
                    else if (!vars.suppressed && !vars.applied) { 
                        resetStat(vars.caster, vars.stats, vars.values);
                        vars.applied = true;
                    }
                    if (vars.caster === context.turn) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.icyHell = {
        name: "Icy Hell [mana]",
        properties: ["mystic", "mana", "inertia/cold", "death/darkness", "attack", "debuff", "multitarget"],
        cost: { mana: 100 },
        description: "Costs 100 mana\nHits up to 6 random enemies 6 times with decreased damage with a chance to decrease their evasion and speed for 1 turn",
        code: () => {
            if (this.resource.mana < 100) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
             const actionLevel = Math.max(-127, Math.min(128, this.level + (this.mysticLevelMod || 0)));
            const numTargets = Math.max(2, 4 + Math.floor((actionLevel - 24) / 32));
            const numAttacks = Math.max(2, 4 + Math.floor((actionLevel - 48) / 16));
            const statIncrease = 0.6 + Math.floor((actionLevel - 32) / 64) * 0.2;
            const debuffValue = [-0.2 * (1 + Math.floor((actionLevel - 32) / 32) * 0.5), -0.1 * (1 + Math.floor((actionLevel - 64) / 64) * 0.5)];
            const willCheck = 65 + Math.floor(actionLevel / 24);
            this.resource.mana -= 100;
            this.previousAction[1] = true;
            this.attack *= statIncrease;
            logAction(`${this.name} shoots some damaku!`, "action");
            attack(this, randTarget(unitFilter("enemy", "front", false), numTargets, true), numAttacks);
            resetStat(this, ["attack"]);
            const will = resistDebuff(this, target);
            for (let i = 0; i < target.length; i++) { if (will[i] > willCheck) { target.splice(i, 1); } }
            createMod("Icy Hell", "evasion and speed reduced",
                { caster: this, targets: target, duration: 1, attribute: ["mystic"], element: ["inertia/cold", "death/darkness"], stats: ["evasion", "speed"], values: debuffValue, listeners: { turnStart: true }, suppressed: false, applied: true, focus: true },
                (vars) => { for (const unit of vars.targets) { resetStat(unit, vars.stats, vars.values) } },
                (vars, context) => {
                    if (vars.suppressed && vars.applied) {
                        for (const unit of vars.targets) {
                            if (unit === context.turn) {
                                resetStat(unit, vars.stats, vars.values, false);
                            }
                        }
                        vars.applied = false;
                    }
                    else if (!vars.suppressed && !vars.applied) {
                        for (const unit of vars.targets) {
                            if (unit === context.turn) {
                                resetStat(unit, vars.stats, vars.values);
                            }
                        }
                        vars.applied = true;
                    }
                    if (vars.targets.includes(context.turn)) {
                        resetStat(context.turn, vars.stats, vars.values, false);
                        target.splice(target.indexOf(context.turn), 1);
                        if (target.length === 0) { return true }
                    }
                }
            );
        }
    };

    this.actions.dodge = {
        name: "Dodge [stamina]",
        properties: ["stamina", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases evasion for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const actionLevel = Math.max(-127, Math.min(128, this.level + (this.physicalLevelMod || 0)));
            const buffValue = [2 + Math.floor(actionLevel / 32)];
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            createMod("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, attribute: ["physical"], stats: ["evasion"], values: buffValue, listeners: { turnStart: true }, focus: true },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, context) => {
                    if (vars.suppressed && vars.applied) {
                        for (const unit of vars.targets) {
                            if (unit === context.turn) {
                                resetStat(unit, vars.stats, vars.values, false);
                            }
                        }
                        vars.applied = false;
                    }
                    else if (!vars.suppressed && !vars.applied) {
                        for (const unit of vars.targets) {
                            if (unit === context.turn) {
                                resetStat(unit, vars.stats, vars.values);
                            }
                        }
                        vars.applied = true;
                    }
                    if (vars.caster === context.turn) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.quickFeet = {
        name: "Quick Feet [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "buff"],
        cost: { stamina: 60 },
        description: "Costs 60 stamina\nIncreases evasion and speed for several turns",
        code: () => {
            if (this.resource.stamina < 60) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
             const actionLevel = Math.max(-127, Math.min(128, this.level + (this.physicalLevelMod || 0)));
            const buffValue = [3 + Math.floor(actionLevel / 32), 0.5 + Math.floor(actionLevel / 64) * 0.1];
            const duration = 3 + Math.floor(actionLevel / 64);
            this.resource.stamina -= 60;
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            createMod("Quick Feet", "Evasion and speed increased",
                { caster: self, targets: [self], duration: duration, attribute: ["physical"], element: ["harmonic/change"], stats: ["evasion", "speed"], values: buffValue, listeners: { turnStart: true }, suppressed: false, applied: true, focus: true },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, context) => {
                    if (vars.suppressed && vars.applied) {
                        for (const unit of vars.targets) {
                            if (unit === context.turn) {
                                resetStat(unit, vars.stats, vars.values, false);
                            }
                        }
                        vars.applied = false;
                    }
                    else if (!vars.suppressed && !vars.applied) {
                        for (const unit of vars.targets) {
                            if (unit === context.turn) {
                                resetStat(unit, vars.stats, vars.values);
                            }
                        }
                        vars.applied = true;
                    }
                    if (vars.caster === context.turn) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        properties: ["mystic", "mana", "inertia/cold", "debuff", "resource"],
        cost: { mana: 60 },
        description: "Costs 60 mana\nSets mana of target to 0 and disables mana regeneration for its next turn",
        target: () => {
            if (this.resource.mana < 60) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)], this);
        },
        code: (target) => {
            const actionLevel = Math.max(-127, Math.min(128, this.level + (this.mysticLevelMod || 0)));
            const willCheck = 35 + Math.floor(actionLevel / 8);
            this.resource.mana -= 60;
            this.previousAction[1] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > willCheck) {
                    handleEvent('resourceChange', { unit: target[0], resource: 'mana', value: -target[0].resource.mana });
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (let i = modifiers.length - 1; i >= 0; i--) {
                        const modifier = modifiers[i];
                        if (modifier.vars.targets.includes(target[0]) && modifier.vars.attribute.includes("mystic")) {
                            logAction(`${target[0].name}'s mystic modifier "${modifier.name}" is dispelled!`, "debuff");
                            modifiers.splice(i, 1);
                        }
                    }
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss"); }
            } else { logAction(`${target[0].name} has no magic to dispel!`, "warning"); }
        }
    };

    this.actions.antimagicField = {
        name: "Antimagic Field [mana]",
        properties: ["mystic", "mana", "inertia/cold", "debuff", "resource", "suppression"],
        cost: { mana: 160 },
        description: "Costs 160 mana\nSets target's mana to 0, disables mana regeneration, suppresses all mystic modifiers, and blocks mystic actions for 1 turn",
        target: () => {
            if (this.resource.mana < 160) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.antimagicField, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)], this);
        },
        code: (target) => {
            this.resource.mana -= 160;
            this.previousAction[1] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 45) {
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    logAction(`${this.name} creates an antimagic field around ${target[0].name}!`, "action");
                    createMod("Antimagic Field", "Suppresses mystic abilities and modifiers",
                        { caster: this, targets: target, duration: 1, attribute: ["mystic"], element: ["inertia/cold"], suppressedModifiers: [], listeners: { actionStart: true, modifierStart: true }, suppressed: false, applied: true, focus: true },
                        (vars) => {
                            logAction(`${vars.targets[0].name} is surrounded by an antimagic field!`, "debuff");
                            for (let i = modifiers.length - 1; i >= 0; i--) {
                                const modifier = modifiers[i];
                                if (modifier.vars.targets.includes(vars.targets[0]) &&
                                    modifier.vars.attribute.includes("mystic") &&
                                    modifier.name !== "Antimagic Field") {
                                    vars.suppressedModifiers.push({ modifier: modifier, remainingDuration: modifier.vars.duration});
                                    logAction(`${vars.targets[0].name}'s mystic modifier "${modifier.name}" is suppressed!`, "debuff");
                                    modifiers.splice(i, 1);
                                }
                            }
                        },
                        (vars, context) => {
                            if (vars.caster === context.turn) {
                                vars.suppressedModifiers.forEach(suppressed => {
                                    suppressed.modifier.vars.duration = suppressed.remainingDuration;
                                    modifiers.push(suppressed.modifier);
                                    logAction(`${vars.targets[0].name}'s mystic modifier "${suppressed.modifier.name}" is restored!`, "buff");
                                });
                                logAction(`The antimagic field around ${vars.targets[0].name} dissipates!`, "buff");
                                return true;
                            }
                            if (context.modifier.vars.attribute.includes("mystic") && context.modifier.vars.targets.includes(vars.targets[0])) {
                                for (let i = modifiers.length - 1; i >= 0; i--) {
                                    const modifier = modifiers[i];
                                    if (modifier.vars.targets.includes(vars.targets[0]) && 
                                        modifier.vars.attribute && 
                                        modifier.vars.attribute.includes("mystic") &&
                                        modifier.name !== "Antimagic Field" &&
                                        !vars.suppressedModifiers.some(s => s.modifier === modifier)) {
                                        vars.suppressedModifiers.push({ modifier: modifier, remainingDuration: modifier.vars.duration });
                                        logAction(`${vars.targets[0].name}'s new mystic modifier "${modifier.name}" is suppressed!`, "debuff");
                                        modifiers.splice(i, 1);
                                    }
                                }
                            }
                        }
                    );
                } else { logAction(`${target[0].name} resists the antimagic field`, "miss"); }
            } else { logAction(`${target[0].name} has no magic to suppress!`, "warning"); }
        }
    };

    this.actions.perfectFreeze = {
        name: "Perfect Freeze [mana]",
        properties: ["mystic", "mana", "inertia/cold", "debuff", "stun"],
        cost: { mana: 90 },
        description: "Costs 90 mana\nStuns a single target for 1 turn.",
        target: () => {
            if (this.resource.mana < 90) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.perfectFreeze, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)], this);
        },
        code: (target) => {
            this.resource.mana -= 90;
            this.previousAction[1] = true;
            const will = resistDebuff(this, target);
            if (will[0] > 50) {
                logAction(`${this.name} freezes time for ${target[0].name}!`, "action");
                createMod("Stun", "Stunned and cannot act",
                    { caster: this, targets: target, duration: 1, attribute: ["inertia/cold"], element: ["mystic"], listeners: { turnStart: true }, suppressed: false, applied: true, focus: true },
                    (vars) => { vars.targets[0].stun = true; },
                    (vars, context) => {
                        if (vars.targets[0] === context.turn) {
                            vars.targets[0].stun = false;
                            logAction(`${vars.targets[0].name} is no longer stunned!`, "buff");
                            return true;
                        }
                    }
                );
            } else { logAction(`${target[0].name} resists the freeze!`, "miss") }
        }
    };

    this.actions.timeStop = {
        name: "Time Stop [mana]",
        properties: ["mystic", "mana", "inertia/cold", "goner/entropy", "buff", "multiturn"],
        cost: { mana: 200 },
        description: "Costs 200 mana\nBecomes immune to all modifiers and gains extra turns.",
        code: () => {
            if (this.resource.mana < 200) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 200;
            this.previousAction[1] = true;
            logAction(`${this.name} stops time!`, "buff");
            const self = this;
            createMod("Time Stop", "Immune to all modifiers not from caster and takes extra turns",
                { caster: self, targets: [self], duration: 3, attribute: ["mystic"], element: ["goner/entropy"], listeners: { modifierActivate: true, turnEnd: true }, suppressed: false, applied: true, focus: true },
                (vars) => { },
                (vars, context) => {
                    if (context.eventType === "modifierActivate" && context.modifier.vars.caster !== vars.caster) {
                        if (vars.caster.timeStop) {
                            logAction(`${vars.caster.name} is immune to modifiers due to Time Stop!`, "buff");
                        }
                    }
                    if (context.turn) {
                        vars.duration--;
                        playerTurn(vars.caster);
                        logAction(`${vars.caster.name} takes an extra turn due to Time Stop!`, "buff");
                        if (vars.duration <= 0) {
                            vars.caster.timeStop = false;
                            delete vars.caster.timeStopTurns;
                            logAction(`${vars.caster.name}'s Time Stop ends!`, "debuff");
                            return true;
                        }
                    }
                }
            );
        }
    };
}
const darkPassivesInit = function() {
    this.passives.distract = {
        name: "Distract [passive]",
        properties: ["passive", "physical", "light/illusion", "buff", "resource"],
        description: "Increases evasion and presence when stamina at least 50",
        code: () => {
            createMod("Distract", "Increases evasion and presence when stamina at least 50",
                { caster: this, targets: [this], duration: Infinity, attribute: ["physical"], element: ["light/illusion"], listeners: { turnEnd: true, resourceChange: true }, passiveType: "conditional", active: true, statBoosts: { evasion: 0.3, presence: 0.2 } },
                (vars) => { resetStat(vars.caster, Object.keys(vars.statBoosts), Object.values(vars.statBoosts)) },
                (vars, context) => {
                    if (vars.caster === context.turn) {
                        if (vars.active !== (vars.caster.resource.stamina >= 50)) {
                            if (!vars.active) {
                                vars.active = true;
                                resetStat(vars.caster, Object.keys(vars.statBoosts), Object.values(vars.statBoosts));
                                logAction(`${vars.caster.name}'s Distracts the enemies!`, "buff");
                            } else {
                                vars.active = false;
                                resetStat(vars.caster, Object.keys(vars.statBoosts), Object.values(vars.statBoosts), false);
                                logAction(`${vars.caster.name}'s stamina is too low to Distract!`, "debuff");
                            }
                        }
                    }
                    if (vars.caster === context.unit && context.resource === "stamina") {
                        if (vars.caster.resource.stamina+context.value < 50 && vars.active) {
                            vars.active = false;
                            resetStat(vars.caster, Object.keys(vars.statBoosts), Object.values(vars.statBoosts), false);
                            logAction(`${vars.caster.name}'s stamina is too low to Distract!`, "debuff");
                        }
                        if (vars.caster.resource.stamina+context.value >= 50 && !vars.active) {
                            vars.active = true;
                            resetStat(vars.caster, Object.keys(vars.statBoosts), Object.values(vars.statBoosts));
                            logAction(`${vars.caster.name}'s Distracts the enemies!`, "buff");
                        }
                    }
                }
            );
        }
    }

    this.passives.centerstage = {
        name: "Center Stage [passive]",
        properties: ["passive", "physical", "light/illusion", "buff", "debuff"],
        description: "Reduces max stamina by 100, increases defense, evasion, crit, resist, and presence",
        code: () => {
            createMod("Center Stage", "Reduces max stamina by 100, increases defense, evasion, crit, resist, and presence",
                { caster: this, targets: [this], duration: Infinity, attribute: ["physical"], element: ["light/illusion"], statBoosts: { defense: 0.4, evasion: 0.2, crit: 0.3, resist: 0.2, presence: 0.5 } },
                (vars) => {
                    vars.caster.base.resource.stamina -= 100;
                    vars.caster.resource.stamina = Math.min(vars.caster.resource.stamina, vars.caster.base.resource.stamina);
                    resetStat(vars.caster, Object.keys(vars.statBoosts), Object.values(vars.statBoosts));
                },
                (vars, context) => {}
            );
        }
    }

    this.passives.counterspell = {
        name: "Counterspell [passive]",
        properties: ["passive", "mystic", "inertia/cold", "debuff", "resource"],
        description: "Nullifies enemy mystic actions after Dark's turn and costs mana equal to action cost (min 10)",
        code: () => {
            createMod("Counterspell", "Nullifies enemy mystic actions after Dark's turn, costs mana equal to action cost (min 10)",
                { caster: this, targets: [this], duration: Infinity, attribute: ["mystic"], element: ["inertia/cold"], listeners: { actionStart: true }, canCounterspell: false },
                (vars) => { },
                (vars, context) => {
                    if (vars.caster === context.unit) { vars.canCounterspell = true }
                    if (vars.canCounterspell && context.unit.team === "enemy" && context.unit.actions[context.action].properties.includes("mystic")) {
                        const manaCost = Math.max(10, context.unit.actions[context.action].cost?.mana || 0);
                        if (vars.caster.resource.mana >= manaCost) {
                            handleEvent('resourceChange', { unit: vars.caster, resource: 'mana', value: -manaCost });
                            vars.caster.resource.mana -= manaCost;
                            logAction(`${vars.caster.name} counterspells ${context.unit.name}'s ${context.unit.actions[context.action].name}! (Cost: ${manaCost} mana)`, "action");
                        } else { logAction(`${vars.caster.name} lacks mana to counterspell!`, "warning") }
                    }
                }
            );
        }
    }

    this.passives.continuousCounterspell = {
        name: "Continuous Counterspell [passive]",
        properties: ["passive", "mystic", "inertia/cold", "debuff"],
        description: "Reduces enemy mystic action levels progressively, costs 160 mana",
        code: () => {
            createMod("Continuous Counterspell", "Reduces enemy mystic action levels progressively, costs 160 mana",
                { caster: this, targets: [this], duration: Infinity, attribute: ["mystic"], element: ["inertia/cold"], listeners: { actionStart: true }, actionCount: 0 },
                (vars) => {
                    vars.caster.base.resource.mana -= 160;
                    vars.caster.resource.mana = Math.min(vars.caster.resource.mana, vars.caster.base.resource.mana);
                },
                (vars, context) => {
                    if (vars.caster === context.unit) { vars.actionCount = 0 }
                    if (vars.canCounterspell && context.unit.team === "enemy" && context.unit.actions[context.action].properties.includes("mystic")) {
                        context.unit.mysticLevelMod -= vars.caster * (.5 ** (vars.actionCount - 1));
                        vars.actionCount++;
                    }
                }
            );
        }
    }

    this.passives.independence = {
        name: "Independence [passive]",
        properties: ["passive", "independence/loneliness", "buff"],
        description: "Boosts Independence/Loneliness units, or self if none available",
        code: () => {
            createMod("Independence", "Boosts Independence/Loneliness units, or self if none available",
                { caster: this, targets: unitFilter(vars.caster.team, "", false).filter(target => target.element.includes("independence/loneliness") && !this), duration: Infinity, element: ["independence/loneliness"], listeners: { unitChange: true }, self: false },
                (vars) => {
                    if (vars.targets.length > 0) {
                    vars.targets.forEach(target => {
                        if (target.name === "Dandelion") {
                            const boost = { attack: 0.2, crit: 0.3, speed: 0.1, presence: 0.2 };
                            resetStat(target, Object.keys(boost), Object.values(boost));
                        } else {
                            const boost = { defense: 0.3, resist: 0.2, speed: 0.1, presence: 0.2 };
                            resetStat(target, Object.keys(boost), Object.values(boost));
                        }
                    });
                } else {
                    const selfBoost = { attack: 0.4, defense: 0.4, crit: 0.4, resist: 0.4, speed: 0.2, presence: 0.3 };
                    resetStat(vars.caster, Object.keys(selfBoost), Object.values(selfBoost));
                }
                },
                (vars, context) => { 
                    if (vars.targets.includes(context.unit)) {
                        switch (context.type) {
                            case "downed":
                                if (unitFilter(vars.caster.team, "", false).filter(target => target.element.includes("independence/loneliness") && !vars.caster).length === 0) {
                                    vars.self = true;
                                    const selfBoost = { attack: 0.4, defense: 0.4, crit: 0.4, resist: 0.4, speed: 0.2, presence: 0.3 };
                                    resetStat(vars.caster, Object.keys(selfBoost), Object.values(selfBoost));
                                }
                                break;
                            case "revive":
                                if (vars.self) {
                                    const selfBoost = { attack: 0.4, defense: 0.4, crit: 0.4, resist: 0.4, speed: 0.2, presence: 0.3 };
                                    resetStat(vars.caster, Object.keys(selfBoost), Object.values(selfBoost), false);
                                    vars.self = false;
                                }
                                break;
                            
                        }
                    }
                }
            );
        }
    }

    this.passives.avatarOfLoneliness = {
        name: "Avatar of Loneliness [passive]",
        properties: ["passive", "independence/loneliness", "buff", "debuff"],
        description: "Stronger Independence/Loneliness boosts, self penalty when others present",
        code: () => {
            createMod("Avatar of Loneliness [Passive]", "Stronger Independence/Loneliness boosts, self penalty when others present",
                { caster: this, targets: unitFilter(vars.caster.team, "", false).filter(target => target.element.includes("independence/loneliness") && !this), duration: Infinity, element: ["independence/loneliness"], listeners: { unitChange: true }, self: false },
                (vars) => { 
                    if (vars.targets.length > 0) {
                    const selfPenalty = { hp: -0.2, attack: -0.2, defense: -0.2, crit: -0.2, resist: -0.2, speed: -0.1, presence: -0.2 };
                    resetStat(vars.caster, Object.keys(selfPenalty), Object.values(selfPenalty));
                    vars.targets.forEach(target => {
                        if (target.name === "Dandelion") {
                            const boost = { attack: 0.4, crit: 0.5, speed: 0.2, presence: 0.3, defense: 0.1 };
                            resetStat(target, Object.keys(boost), Object.values(boost));
                        } else {
                            const boost = { defense: 0.5, resist: 0.4, speed: 0.2, presence: 0.3, attack: 0.1 };
                            resetStat(target, Object.keys(boost), Object.values(boost));
                        }
                    });
                } else {
                    vars.self = true;
                    const selfBoost = { hp: 0.3, attack: 0.6, defense: 0.6, crit: 0.6, resist: 0.6, speed: 0.3, presence: 0.5 };
                    resetStat(vars.caster, Object.keys(selfBoost), Object.values(selfBoost));
                }
                },
                (vars, context) => { 
                    if (vars.targets.includes(context.unit)) {
                        switch (context.type) {
                            case "downed":
                                if (unitFilter(vars.caster.team, "", false).filter(target => target.element.includes("independence/loneliness") && !vars.caster).length === 0) {
                                    const selfPenalty = { hp: -0.2, attack: -0.2, defense: -0.2, crit: -0.2, resist: -0.2, speed: -0.1, presence: -0.2 };
                                    resetStat(vars.caster, Object.keys(selfPenalty), Object.values(selfPenalty), false);
                                    vars.self = true;
                                    const selfBoost = { attack: 0.4, defense: 0.4, crit: 0.4, resist: 0.4, speed: 0.2, presence: 0.3 };
                                    resetStat(vars.caster, Object.keys(selfBoost), Object.values(selfBoost));
                                }
                                break;
                            case "revive":
                                if (vars.self) {
                                    const selfBoost = { attack: 0.4, defense: 0.4, crit: 0.4, resist: 0.4, speed: 0.2, presence: 0.3 };
                                    resetStat(vars.caster, Object.keys(selfBoost), Object.values(selfBoost), false);
                                    vars.self = false;
                                    const selfPenalty = { hp: -0.2, attack: -0.2, defense: -0.2, crit: -0.2, resist: -0.2, speed: -0.1, presence: -0.2 };
                                    resetStat(vars.caster, Object.keys(selfPenalty), Object.values(selfPenalty));
                                }
                                break;

                        }
                    }
                }
            );
        }
    }
}

Dark.level = unitCombatData.Dark.level;
Dark.power = unitCombatData.Dark.power;