import { Unit } from './unit.js';
import { unitCombatData } from './unitCombatData.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, resetStat } from '../combatDictionary.js';

const Dark = new Unit("Dark",
    [550, 75, 18, 50, 115, 45, 120, 35, 125, 175, "front", 150, 18, 250, 30],
    [.013, .015, .01, .012, .007, .018, .01, .011, .008, .012, .011, .006, .013, .007],
    darkActionsInit, unitCombatData.Dark.level, unitCombatData.Dark.power);

const darkActionsInit = function() { 
    this.actions.iceshock = {
        name: "Iceshock [mystic]",
        description: "Attacks a single target 4 times.",
        target: () => { selectTarget(this.actions.spellAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.previousAction[1] = true;
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.absoluteZero = {
        name: "Absolute Zero [physical, mana]",
        cost: { mana: 60 },
        description: "Attacks a single target 6 times.",
        target: () => { selectTarget(this.actions.spellAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.resource.mana -= 30;
            [this.previousAction[0], this.previousAction[1]] = [true, true];
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.danmaku = {
        name: "Danmaku [mana]",
        cost: { mana: 40 },
        description: "Costs 40 mana\nIncreases evasion by +100% for 1 turn\nHits a single target twice with increased accuracy and damage",
        target: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.shootEmUp, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 40;
            this.previousAction[0] = true;
            this.attack *= 2;
            this.accuracy *= 1.5;
            logAction(`${this.name} focus fires on ${target[0].name}!`, "action");
            attack(this, target, 3);
            resetStat(this, ["attack", "accuracy"]);
            const self = this;
            createMod("Shoot 'em Up Evasion", "Temporary evasion boost",
                { caster: self, targets: [self], duration: 1, stats: ["evasion"], values: [1.5] },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.icyHell = {
        name: "Icy Hell [mana]",
        cost: { mana: 100 },
        description: "Costs 80 mana\nDecreases evasion for 1 turn\nHits up to 6 random enemies 10 times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 80) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 80;
            this.previousAction[1] = true;
            this.attack *= .5;
            this.accuracy *= .75;
            logAction(`${this.name} shoots some damaku!`, "action");
            let target = unitFilter("enemy", "front", false);
            while (target.length > 6) { target = target.filter(unit => unit !== target[Math.floor(Math.random() * target.length)]); }
            attack(this, target, 10);
            resetStat(this, ["attack", "accuracy"]);
            const self = this;
            createMod("Evasion Penalty", "Evasion reduced during bullet hell",
                { caster: self, targets: [self], duration: 1, stats: ["evasion"], values: [-0.5] },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, unit) => {
                    if(vars.caster === unit) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        description: "Increases evasion for 1 turn",
        code: () => {
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            createMod("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, stats: ["evasion"], values: [2] },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.quickFeet = {
        name: "Quick Feet [stamina]",
        cost: { stamina: 40 }
        description: "Increases evasion and speed for 3 turns",
        code: () => {
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            createMod("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, stats: ["evasion"], values: [2] },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        cost: { mana: 60 },
        description: "Costs 60 mana\nSets mana of target to 0 and disables mana regeneration for next turn",
        target: () => {
            if (this.resource.mana < 60) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 60;
            this.previousAction[1] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 45) {
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss"); }
            } else { logAction(`${target[0].name} has no magic to dispel!`, "warning"); }
        }
    };

    this.actions.antimagicField = {
        name: "Antimagic Field [mana]",
        cost: { mana: 160 },
        description: "Costs 160 mana\nSets mana of target to 0 and disables mana regeneration, mystic actions, and modifiers for 1 turn",
        target: () => {
            if (this.resource.mana < 160) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 160;
            this.previousAction[1] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 45) {
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss"); }
            } else { logAction(`${target[0].name} has no magic to dispel!`, "warning"); }
        }
    };
}

Dark.level = unitCombatData.Dark.level;
Dark.power = unitCombatData.Dark.power;