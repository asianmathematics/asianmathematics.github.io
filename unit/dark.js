import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, resetStat } from '../combatDictionary.js';

export const Dark = new Unit("Dark", [550, 75, 18, 50, 115, 45, 120, 35, 125, 175, "front", 150, 18, 250, 30], function() {
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

    this.actions.shootEmUp = {
        name: "Shoot 'em up [mana, physical]",
        cost: { mana: 20 },
        description: "Costs 20 mana\nIncreases evasion by +100% for 1 turn\nHits a single target twice with increased accuracy and damage",
        target: () => {
            if (this.resource.mana < 20) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.shootEmUp, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 20;
            this.previousAction = [true, true, false];
            this.attack *= 2;
            this.accuracy *= 1.5;
            logAction(`${this.name} focus fires on ${target[0].name}!`, "action");
            attack(this, target, 3);
            resetStat(this, ["attack", "accuracy"]);
            createMod("Shoot 'em Up Evasion", "Temporary evasion boost",
                { caster: this, targets: [this], duration: 1, stats: ["evasion"], values: [1.5] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                    logAction(`${vars.caster.name}'s evasion surges!`, "buff");
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

    this.actions.bulletHell = {
        name: "Bullet Hell [mana]",
        cost: { mana: 40 },
        description: "Costs 40 mana\nDecreases evasion for 1 turn\nHits up to 6 random enemies 10 times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 40;
            this.previousAction = [false, true, false];
            this.attack *= .5;
            this.accuracy *= .75;
            logAction(`${this.name} shoots some damaku!`, "action");
            let target = unitFilter("enemy", "front", false);
            while (target.length > 6) { 
                target = target.filter(unit => unit !== target[Math.floor(Math.random() * target.length)]); 
            }
            attack(this, target, 10);
            resetStat(this, ["attack", "accuracy"]);
            createMod("Evasion Penalty", "Evasion reduced during bullet hell",
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
            this.previousAction = [false, true, false];
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 45) {
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                }
                else {
                    logAction(`${target[0].name} resists dispel magic`, "miss");
                }
            }
            else { 
                logAction(`${target[0].name} has no magic to dispel!`, "warning"); 
            }
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