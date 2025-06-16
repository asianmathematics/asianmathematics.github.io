import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, createMod, resetStat, resistDebuff, modifiers } from '../combatDictionary.js';

export const ClassicJoy = new Unit("Classical (Joy)", [380, 75, 10, 75, 120, 15, 130, 30, 90, 110, "back", 120, 15, undefined, undefined, 90, 10], function() {
    this.actions.rapidFire = {
        name: "Rapid Fire [techno]",
        description: "Attacks a single target twice but increases speed by 40% for 1 turn",
        target: () => {
            selectTarget(this.actions.rapidFire, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (targets) => {
            this.previousAction = [false, false, true];
            attack(this, targets, 2);
            logAction(`${this.name} performs a Rapid Fire, boosting speed for 1 turn!`, "buff");
            createMod("Rapid Fire Speed", "Temporary speed boost",
                { caster: this, targets: [this], duration: 1, stats: ["speed"], values: [0.4] },
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
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] -= vars.values[i];
                            resetStat(unit, [stat]);
                        });
                        return true;
                    }
                }
            );
        }
    };

    this.actions.semiAutomatic = {
        name: "Energy Rifle [energy]",
        cost: { energy: 30 },
        description: "Costs 30 energy\nAttacks a single target 3 times with increased accuracy and crit damage",
        target: () => {
            if (this.resource.energy < 30) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.semiAutomatic, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 30;
            this.previousAction = [false, false, true];
            this.accuracy *= 2;
            this.lethality *= 2.2;
            logAction(`${this.name} fires at ${target[0].name}!`, "action");
            attack(this, target, 4);
            resetStat(this, ["accuracy", "lethality"]);
        }
    };

    this.actions.emp = {
        name: "EMP [energy]",
        cost: { energy: 55 },
        description: "Costs 55 energy\nSets energy of target to 0 and disables energy regeneration for next turn",
        target: () => {
            if (this.resource.energy < 55) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.emp, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 55;
            this.previousAction = [false, false, true];
            const will = resistDebuff(this, target);
            if (target[0].resource.energy !== undefined) {
                if (will[0] > 35) {
                    target[0].resource.energy = 0;
                    target[0].previousAction[2] = true;
                    logAction(`${this.name} disables ${target[0].name}'s energy!`, "action");
                }
                else {
                    logAction(`${target[0].name} resists the emp`, "miss");
                }
            }
            else { 
                logAction(`${target[0].name} has no energy to disable!`, "warning"); 
            }
        }
    };

    this.actions.synthesizeMedicine = {
        name: "Synthesize Medicine [techno]",
        description: "Heals target 80 HP",
        target: () => {
            selectTarget(this.actions.synthesizeMedicine, () => { playerTurn(this); }, [1, true, unitFilter("player", "")]);
        },
        code: (target) => {
            this.previousAction = [false, false, true];
            target[0].hp = Math.min(target[0].base.hp, target[0].hp + 80);
            logAction(`${this.name} heals ${target[0].name} for 80 HP!`, "heal");
        }
    };

    this.actions.joy = {
        name: "Joy [stamina]",
        cost: { stamina: 40 },
        description: "Costs 40 stamina & 50 HP\nDelayed consequences",
        target: () => {
            if (this.resource.stamina < 40) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            selectTarget(this.actions.joy, () => { playerTurn(this); }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            this.resource.stamina -= 40;
            this.hp = Math.max(this.hp - 50, 0);
            const mod = modifiers.find(m => m.name === "Joy" && m.vars.targets.includes(target[0]));
            if (mod) {
                if (mod.vars.duration < 7) {
                    mod.vars.targets.forEach(unit => {
                        mod.vars.debuffs.forEach((stat, i) => {
                            unit.mult[stat] -= mod.vars.debuffValues[i];
                            resetStat(unit, [stat]);
                        });
                        mod.vars.buffs.forEach((stat, i) => {
                            unit.mult[stat] += mod.vars.buffValues[i];
                            resetStat(unit, [stat]);
                        });
                    });
                } 
                mod.vars.duration = 9;
            } else {
                createMod("Joy", "Overall increase?",
                    { caster: this, targets: target, duration: 9, buffs: ["accuracy", "crit", "defense", "resist"], buffValues: [0.25, 0.4, 0.6, 0.4], debuffs: ["attack", "defense", "evasion", "speed", "accuracy"], debuffValues: [-0.25, -0.4, -0.25, -0.1, -0.25] },
                    (vars) => {
                        vars.targets.forEach(unit => {
                            vars.buffs.forEach((stat, i) => {
                                unit.mult[stat] += vars.buffValues[i];
                                resetStat(unit, [stat]);
                            });
                        });
                        logAction(`${vars.caster.name} gives ${vars.targets[0].name} some joy!`, "buff");
                        vars.self = mod;
                    },
                    (vars, unit) => {
                        if (vars.targets[0] === unit) { vars.duration--; }
                        if (vars.duration === 6) {
                            vars.targets.forEach(unit => {
                                vars.buffs.forEach((stat, i) => {
                                    unit.mult[stat] -= vars.buffValues[i];
                                    resetStat(unit, [stat]);
                                });
                                vars.debuffs.forEach((stat, i) => {
                                    unit.mult[stat] += vars.debuffValues[i];
                                    resetStat(unit, [stat]);
                                });
                            });
                            logAction(`${vars.targets[0].name} is feeling the side effects!`, "debuff");
                            vars.self.description = "Long side effect period";
                        }
                        if (vars.duration === 0) {
                            vars.debuffs.forEach((stat, i) => {
                                unit.mult[stat] -= vars.debuffValues[i];
                                resetStat(unit, [stat]);
                            });
                            return true;
                        }
                    }
                );
            }
        }
    };
});