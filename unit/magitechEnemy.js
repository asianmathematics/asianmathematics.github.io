import { Unit } from './unit.js';
import { logAction, unitFilter, attack, createMod, resetStat, randTarget } from '../combatDictionary.js';

export const magitechEnemy = new Unit("Magitech Golem", [550, 45, 15, 30, 100, 15, 95, 45, 90, 140, "front", 90, 9, 120, 12, 120, 12], ["Harmonic/Change", "Inertia/Cold", "Radiance/Purity", "Anomaly/Synthetic"], function() {
    this.actions.arcaneCannon = {
        name: "Arcane Cannon [mana, techno]",
        properties: ["mystic", "mana", "techno", "attack"],
        cost: { mana: 20 },
        description: "Costs 20 mana\nAttacks a single target twice with increased damage",
        code: () => {
            this.previousAction = [false, true, true];
            this.resource.mana -= 20;
            this.attack *= 1.5;
            const target = [randTarget(unitFilter("player", "", false))];
            logAction(`${this.name} fires an arcane cannon at ${target[0].name}!`, "action");
            attack(this, target, 2);
            resetStat(this, ["attack"]);
        }
    };

    this.actions.elementalShift = {
        name: "Elemental Shift [mystic]",
        properties: ["mystic", "inertia/cold", "radiance/purity", "buff"],
        description: "Shifts to fire or ice element, gaining different bonuses",
        code: () => {
            this.previousAction = [false, true, false];
            const self = this;
            if (Math.random() < .5) {
                logAction(`${this.name} shifts to fire element, becoming more aggressive!`, "buff");
                createMod("Fire Element", "Offensive enhancement",
                    { caster: self, targets: [self], duration: 2, stats: ["attack", "speed"], values: [0.3, 0.2] },
                    (vars) => {
                        vars.stats.forEach((stat, i) => {
                            vars.caster.mult[stat] += vars.values[i];
                            resetStat(vars.caster, [stat]);
                        });
                    },
                    (vars, unit) => {
                        if (vars.targets.includes(unit)) {
                            vars.duration--;
                            if (vars.duration <= 0) {
                                vars.stats.forEach((stat, i) => {
                                    vars.caster.mult[stat] -= vars.values[i];
                                    resetStat(vars.caster, [stat]);
                                });
                                return true;
                            }
                        }
                    }
                );
            } else {
                logAction(`${this.name} shifts to ice element, becoming more defensive!`, "buff");
                createMod("Ice Element", "Defensive enhancement",
                    { caster: self, targets: [self], duration: 2, stats: ["defense", "resist"], values: [0.3, 0.2] },
                    (vars) => {
                        vars.stats.forEach((stat, i) => {
                            vars.caster.mult[stat] += vars.values[i];
                            resetStat(vars.caster, [stat]);
                        });
                    },
                    (vars, unit) => {
                        if (vars.targets.includes(unit)) {
                            vars.duration--;
                            if (vars.duration <= 0) {
                                vars.stats.forEach((stat, i) => {
                                    vars.caster.mult[stat] -= vars.values[i];
                                    resetStat(vars.caster, [stat]);
                                });
                                return true;
                            }
                        }
                    }
                );
            }
        }
    };

    this.actions.magitechBarrier = {
        name: "Magitech Barrier [mana, energy]",
        properties: ["mystic", "mana", "techno", "energy", "inertia/cold", "anomaly/synthetic", "buff", "multitarget"],
        cost: { mana: 25, energy: 25 },
        description: "Costs 25 mana & 25 energy\nIncreases defense of all allies",
        code: () => {
            this.resource.mana -= 25;
            this.resource.energy -= 25;
            createMod("Magitech Barrier", "Defensive field",
                { caster: this, targets: unitFilter("enemy", "", false), duration: 1, stat: "defense", value: 0.25 },
                (vars) => {
                    vars.targets.forEach(unit => {
                        unit.mult[vars.stat] += vars.value;
                        resetStat(unit, [vars.stat]);
                    });
                    logAction(`${vars.caster.name} creates a protective barrier!`, "buff");
                },
                (vars, unit) => {
                    if(vars.caster === unit) {
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

    this.actions.essenceAbsorption = {
        name: "Essence Absorption",
        properties: ["harmonic/change", "resource"],
        description: "Recovers 40 mana and energy",
        code: () => {
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + 40);
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + 40);
            logAction(`${this.name} absorbs ambient essence, replenishing resources!`, "heal");
        }
    };

    this.actions.energyWave = {
        name: "Energy Wave [energy]",
        properties: ["techno", "energy", "harmonic/change", "attack", "multitarget"],
        cost: { energy: 30 },
        description: "Costs 30 energy\nAttacks all front-line enemies with reduced accuracy and damage",
        code: () => {
            this.previousAction = [false, false, true];
            this.resource.energy -= 30;
            this.accuracy *= 0.8;
            this.attack *= 0.8;
            logAction(`${this.name} releases an energy wave across the battlefield!`, "action");
            attack(this, unitFilter("player", "front", false));
            resetStat(this, ["accuracy", "attack"]);
        }
    };

    this.actions.coreOverload = {
        name: "Core Overload [mana, energy]",
        properties: ["mystic", "mana","techno", "energy", "attack", "multitarget"],
        cost: { mana: 40, energy: 40 },
        description: "Costs 40 mana & 40 energy\nOnly usable when below 30% HP, otherwise does Arcane Cannon\nAttacks all front-line enemies with increased attack",
        code: () => {
            if (this.hp >= this.base.hp * 0.3) {
                this.actions.arcaneCannon.code();
                return;
            }
            this.previousAction = [false, true, true];
            this.resource.mana -= 40;
            this.resource.energy -= 40;
            this.attack *= 2;
            logAction(`${this.name}'s core overloads in a desperate attack!`, "crit");
            attack(this, unitFilter("player", "front", false));
            resetStat(this, ["attack"]);
        }
    };

    this.actions.actionWeight = { 
        arcaneCannon: 0.10, 
        elementalShift: 0.20, 
        magitechBarrier: 0.20, 
        essenceAbsorption: 0.15, 
        energyWave: 0.10, 
        coreOverload: 0.25 
    };
});