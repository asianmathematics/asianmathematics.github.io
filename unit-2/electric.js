import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, resetStat } from '../combatDictionary.js';

export const Electric = new Unit("Electric", [450, 50, 8, 35, 105, 25, 110, 30, 125, 150, "front", 100, 15, 75, 10, 200, 20], function() {
    this.actions.electricDischarge = {
        name: "Electric Discharge [mystic, energy]",
        cost: { energy: 60 },
        description: "Costs 60 energy\nDeals 5 attacks to a single target with increased crit and damage",
        target: () => {
            if (this.resource.energy < 60) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.electricDischarge, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 60;
            this.previousAction = [false, false, true];
            this.lethality *= 1.5;
            this.attack *= 1.3;
            logAction(`${this.name} channels a powerful electric discharge into ${target[0].name}!`, "action");
            attack(this, target, 5);
            resetStat(this, ["lethality", "attack"]);
        }
    };

    this.actions.sickBeats = {
        name: "Sick Beats [energy]",
        cost: { energy: 40 },
        description: "Costs 40 energy\nBoosts speed and presence of a friendly unit for 3 turns",
        target: () => {
            if (this.resource.energy < 40) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.sickBeats, () => { playerTurn(this); }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            this.resource.energy -= 40;
            this.previousAction = [false, false, true];
            logAction(`${this.name} plays sick beats, energizing ${target[0].name}!`, "buff");
            const self = this;
            createMod("Sick Beats Buff", "Rhythmic performance enhancement",
                { caster: self, targets: target, duration: 3, stats: ["speed", "presence"], values: [0.5, 0.7] },
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

    this.actions.recharge = {
        name: "Recharge [mana]",
        cost: { mana: 30 },
        description: "Costs 30 mana\nConverts mana into energy, gaining 75 energy",
        code: () => {
            if (this.resource.mana < 30) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 30;
            this.previousAction = [false, true, false];
            logAction(`${this.name} generates electricity!`, "heal");
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + 75);
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        description: "Increases evasion for 1 turn",
        code: () => {
            this.previousAction = [true, false, false];
            const self = this;
            createMod("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, stat: "evasion", value: 2 },
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

    this.actions.block = {
        name: "Block",
        description: "Increases defense for 1 turn",
        code: () => {
            const self = this;
            createMod("Block", "Defense increased",
                { caster: self, targets: [self], duration: 1, stat: "defense", value: 1 },
                (vars) => {
                    vars.caster.mult[vars.stat] += vars.value;
                    resetStat(vars.caster, [vars.stat]);
                    logAction(`${vars.caster.name} blocks.`, "buff");
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