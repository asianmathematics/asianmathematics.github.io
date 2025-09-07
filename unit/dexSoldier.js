import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, createMod, resetStat } from '../combatDictionary.js';

export const DexSoldier = new Unit("DeX (Soldier)", [900, 50, 20, 20, 90, 20, 95, 50, 85, 150, "front", 200, 25], ["Harmonic/Change", "Inertia/Cold", "Radiance/Purity"], function() {
    this.actions.hammer = {
        name: "Hammer [physical]",
        properties: ["physical", "attack", "buff"],
        description: "Attacks a single target with increased damage and accuracy and increases speed for 1 turn.",
        target: () => { selectTarget(this.actions.hammer, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.attack *= 3;
            this.accuracy *= 2;
            logAction(`${this.name} swings a hammer at ${target[0].name}`, "action");
            attack(this, target);
            const self = this;
            createMod("Hammer Speed", "Temporary speed boost",
                { caster: self, targets: [self], duration: 1, stat: "speed", value: .5 },
                (vars) => {
                    vars.caster.mult[vars.stat] += vars.value;
                    resetStat(vars.caster, [vars.stat]);
                },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        unit.mult[vars.stat] -= vars.value;
                        resetStat(unit, [vars.stat]);
                        return true;
                    }
                }
            );
            resetStat(this, ["attack", "accuracy"]);
        }
    };

    this.actions.quake = {
        name: "Quake [stamina]",
        properties: ["physical", "stamina", "attack", "multitarget"],
        cost: { stamina: 40 },
        description: "Costs 40 stamina\nAttacks all frontline twice at reduced damage and acccuracy.",
        code: () => {
            if (this.resource.stamina < 40) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 40;
            this.previousAction = [true, false, false];
            this.attack *= .5;
            this.accuracy *= .75;
            logAction(`${this.name} hits the groud to create a tremor!`, "action");
            attack(this, unitFilter("enemy", "front", false), 2);
            resetStat(this, ["attack", "accuracy"]);
        }
    };

    this.actions.determination = {
        name: "Determination [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "inertia/cold", "radiance/purity", "heal", "buff"],
        cost: { stamina: 80 },
        description: "Costs 80 stamina\nHeals 60hp this turn and the next 2 turns",
        code: () => {
            if (this.resource.stamina < 80) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 80;
            this.hp = Math.min(this.hp + 60, this.base.hp);
            this.previousAction = [true, false, false];
            logAction(`...but ${this.name} refused!`, "action");
            const self = this;
            createMod("Determination", "Healing over time",
                { caster: self, targets: [self], duration: 2, stats: ["hp"], values: [60] },
                (vars) => { logAction(`${vars.caster.name} slowly regains hp!`, "buff"); },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        caster.hp = Math.min(caster.hp + vars.values[0], caster.base.hp);
                        vars.duration--;
                        if (vars.duration === 0) { return true; }
                    }
                }
            );
        }
    };

    this.actions.guard = {
        name: "Guard [stamina]",
        properties: ["physical", "stamina", "inertia/cold", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases defense and presence for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 20;
            this.previousAction = [true, false, false];
            logAction(`${this.name} protects the team!`, "action");
            const self = this;
            createMod("Guard", "Defense and presence increase",
                { caster: self, targets: [self], duration: 1, stats: ["defense", "presence"], values: [1, 1] },
                (vars) => {
                    vars.stats.forEach((stat, i) => {
                        vars.targets[0].mult[stat] += vars.values[i];
                        resetStat(vars.targets[0], [stat]);
                    });
                },
                (vars, unit) => {
                    if (vars.caster === unit) {
                        vars.stats.forEach((stat, i) => {
                            vars.targets[0].mult[stat] -= vars.values[i];
                            resetStat(vars.targets[0], [stat]);
                        });
                        return true;
                    }
                }
            );
        }
    };

    this.actions.block = {
        name: "Block [physical]",
        properties: ["buff"],
        description: "Increases defense for 1 turn",
        code: () => {
            this.previousAction = [true, false, false];
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
                        unit.mult[vars.stat] -= vars.value;
                        resetStat(unit, [vars.stat]);
                        return true;
                    }
                }
            );
        }
    };
});