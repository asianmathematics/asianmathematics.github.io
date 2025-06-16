import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, createMod, resetStat, randTarget } from '../combatDictionary.js';

export const Dandelion = new Unit("Dandelion", [400, 60, 12, 45, 115, 40, 120, 25, 115, 160, "front", 140, 15, 180, 20], function() {
    this.actions.spellAttack = {
        name: "Spell Attack [mystic]",
        description: "Attacks a single target 4 times.",
        target: () => { 
            selectTarget(this.actions.spellAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); 
        },
        code: (target) => {
            this.previousAction = [false, true, false];
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.focusFire = {
        name: "Focus Fire [mana, physical]",
        cost: { mana: 30 },
        description: "Costs 30 mana\nHits a single target twice with increased accuracy and damage",
        target: () => {
            if (this.resource.mana < 30) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.focusFire, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 30;
            this.previousAction = [true, true, false];
            this.attack *= 1.5;
            this.accuracy *= 1.25;
            logAction(`${this.name} focus fires on ${target[0].name}!`, "action");
            attack(this, target, 2);
            resetStat(this, ["attack", "accuracy"]);
        }
    };

    this.actions.danmaku = {
        name: "Danmaku [mana]",
        cost: { mana: 60 },
        description: "Costs 60 mana\nDecreases evasion for 1 turn\nHits up to 4 random enemies 6 times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 60) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 60;
            this.previousAction = [false, true, false];
            this.attack *= .5;
            this.accuracy *= .75;
            logAction(`${this.name} shoots some damaku!`, "action");
            let target = unitFilter("enemy", "front", false);
            while (target.length > 4) { 
                target = target.filter(unit => unit !== randTarget(target, true)); 
            }
            attack(this, target, 6);
            resetStat(this, ["attack", "accuracy"]);
            createMod("Evasion Penalty", "Evasion reduced during danmaku",
                { caster: this, targets: [this], duration: 1, stats: ["evasion"], values: [-0.5] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if(vars.caster === unit) {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                        return true;
                    }
                }
            );
        }
    };

    this.actions.feint = {
        name: "Feint [stamina]",
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nIncreases defense, evasion, and presense for 1 turn", 
        code: () => {
            if (this.resource.stamina < 30) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 30;
            this.previousAction = [true, false, false];
            createMod("Feint", "Defense, evasion, and presence increase",
                { caster: this, targets: [this], duration: 1, stats: ["defense", "evasion", "presence"], values: [.25, 2.5, .75] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                        return true;
                    }
                }
            );
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        description: "Increases evasion for 1 turn",
        code: function() {
            this.previousAction = [true, false, false];
            createMod("Dodge", "Evasion increased",
                { caster: this, targets: [this], duration: 1, stat: "evasion", value: 2 },
                (vars) => {
                    vars.caster.mult[vars.stat] += vars.value;
                    resetStat(vars.caster, [vars.stat]);
                    logAction(`${vars.caster.name} dodges.`, "buff");
                },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        vars.targets.forEach(unit => {
                            unit.mult[vars.stat] -= vars.value;
                            resetStat(unit, [vars.stat]);
                        });
                        return true;
                    }
                }
            );
        }
    };
});