import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, createMod, resetStat } from '../combatDictionary.js';

export const FourArcher = new Unit("4 (Archer)", [440, 30, 7, 35, 110, 30, 135, 45, 90, 115, "back", 60, 4, 80, 6], function() {
    this.actions.perfectShot = {
        name: "Perfect Shot [mystic]",
        description: "Attacks a single target with increased accuracy and crit",
        target: () => { selectTarget(this.actions.perfectShot, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.previousAction = [false, true, false];
            this.accuracy *= 1.75;
            this.crit *= 2.5;
            logAction(`${this.name} shoots a mystic arrow!`, "action");
            attack(this, target);
            resetStat(this, ["accuracy", "crit"]);
        }
    };

    this.actions.multishot = {
        name: "Multi-shot [mana]",
        cost: { mana: 20 },
        description: "Costs 20 mana\nAttacks up to 3 targets with increased crit",
        target: () => {
            if (this.resource.mana < 20) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.multishot, () => { playerTurn(this); }, [3, false, unitFilter("enemy", "front", false)]);
        },
        code: (targets) => {
            this.resource.mana -= 20;
            this.previousAction = [false, true, false];
            this.crit *= 1.75;
            logAction(`${this.name} fires multiple arrows!`, "action");
            attack(this, targets);
            resetStat(this, ["crit"]);
        }
    };

    this.actions.luckyAura = {
        name: "Lucky Aura [mana]",
        cost: { mana: 40 },
        description: "Costs 40 mana\nIncrease all luck based stats",
        code: () => {
            this.resource.mana -= 40;
            this.previousAction = [false, true, false];
            logAction(`${this.name} becomes luckier!`, "buff");
            const self = this;
						createMod("Lucky Aura", "Increased luck",
                { caster: self, targets: [self], duration: 2, stats: ["accuracy", "crit", "evasion", "resist", "presence"], values: [0.75, 0.75, 0.25, 0.25, 0.25] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if(vars.targets.includes(unit)) {
                        vars.duration--;
                        if(vars.duration <= 0) {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                            return true;
                        }
                    }
                }
            );
        }
    };

    this.actions.imposeLuck = {
        name: "Impose Luck [mana]",
        cost: { mana: 20 },
        description: "Costs 20 mana\nIncreases ally accuracy and crit for 2 turns",
        target: () => {
            if (this.resource.mana < 20) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.imposeLuck, () => { playerTurn(this); }, [3, false, unitFilter("player", "", false)]);
        },
        code: (target) => {
            this.resource.mana -= 20;
            this.previousAction = [false, true, false];
            logAction(`${this.name} targets ${target[0].name} with a luck arrow!`, "buff");
            const self = this;
						createMod("Impose Luck", "Increased accuracy and crit",
                { caster: self, targets: target, duration: 2, stats: ["accuracy", "crit"], values: [0.5, 0.5] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if (vars.targets.includes(unit)) {
                        vars.duration--;
                        if (vars.duration <= 0) {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                            return true;
                        }
                    }
                }
            );
        }
    };

    this.actions.rest = {
        name: "Rest",
        description: "Regain 10 stamina and 12 mana and decreases evasion and speed for 1 turn",
        code: () => {
            this.resource.stamina = Math.min(this.resource.stamina + 10, this.base.resource.stamina);
            this.resource.mana = Math.min(this.resource.mana + 12, this.base.resource.mana);
            const self = this;
						createMod("Resting", "decresed evasion and speed",
                { caster: self, targets: [self], duration: 1, stats: ["evasion", "speed"], values: [-0.5, -0.25] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if (vars.targets[0] === unit) {
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
});