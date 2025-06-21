import { Unit } from './unit.js';
import { logAction, unitFilter, attack, createMod, resetStat, randTarget, resistDebuff } from '../combatDictionary.js';

export const mysticEnemy = new Unit("Mystic Fiend", [425, 35, 8, 35, 110, 30, 115, 25, 115, 100, "front", 80, 8, 180, 20], function() {
    this.actions.manaBolt = {
        name: "Mana Bolt [mystic]",
        cost: { mana: 20 },
        description: "Costs 20 mana\nAttacks a single target twice with increased accuracy",
        code: () => {
            this.previousAction = [false, true, false];
            this.resource.mana -= 20;
            this.accuracy *= 1.5;
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} fires mana bolts at ${target[0].name}!`, "action");
            attack(this, target, 2);
            resetStat(this, ["accuracy"]);
        }
    };

    this.actions.curseField = {
        name: "Curse Field [mana]",
        cost: { mana: 40 },
        description: "Costs 40 mana\nReduces accuracy and evasion of all front-line enemies",
        code: () => {
            this.resource.mana -= 40;
            createMod("Curse Field", "Reduces accuracy and evasion",
                { caster: this, targets: unitFilter("player", "front", false), duration: 'Indefinite', stats: ["accuracy", "evasion"], values: [-0.15, -0.15] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        if(resistDebuff(vars.caster, [unit]) > 50) {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] += vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        }
                        else { 
                            vars.targets.splice(vars.targets.indexOf(unit), 1); 
                        }
                    });
                    logAction(`${vars.caster.name} casts Curse Field!`, "action");
                },
                (vars, unit) => {
                    if (vars.targets.includes(unit)) {
                        if(resistDebuff(vars.caster, [unit]) > 30) {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                            vars.targets.splice(vars.targets.indexOf(unit), 1);
                        }
                    }
                    if(vars.targets.length === 0) { 
                        return true; 
                    }
                }
            );
        }
    };

    this.actions.drainLife = {
        name: "Drain Life [mystic]",
        cost: { mana: 30 },
        description: "Costs 30 mana\nAttacks a single target and heals the caster",
        code: () => {
            this.previousAction = [false, true, false];
            this.resource.mana -= 30;
            const target = [randTarget(unitFilter("player", "front", false))];
            const hpCheck = target[0].hp;
            logAction(`${this.name} tries to drain ${target[0].name}!`, "action");
            attack(this, target);
            if (hpCheck < target[0].hp) {
                logAction(`${this.name} drains life from ${target[0].name}`, "heal");
                this.hp = Math.min(this.base.hp, this.hp + 25);
            }
        }
    };

    this.actions.arcaneShield = {
        name: "Arcane Shield [physical, mana]",
        cost: { mana: 25 },
        description: "Costs 25 mana\nIncreases defense and crit resist for 2 turns",
        code: () => {
            this.previousAction = [true, true, false];
            this.resource.mana -= 25;
            logAction(`${this.name} creates an arcane shield, enhancing their defenses!`, "buff");
            createMod("Arcane Shield", "Enhanced defenses",
                { caster: this, targets: [this], duration: 2, stats: ["defense", "resist"], values: [0.5, 0.3] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars) => {
                    vars.duration--;
                    if(vars.duration <= 0) {
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

    this.actions.meditate = {
        name: "Meditate [physical]",
        description: "Recovers 50 mana",
        code: () => {
            this.previousAction = [true, false, false];
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + 50);
            logAction(`${this.name} meditates and recovers mana!`, "heal");
        }
    };

    this.actions.actionWeight = { 
        manaBolt: 0.3, 
        curseField: 0.25, 
        drainLife: 0.2, 
        arcaneShield: 0.15, 
        meditate: 0.1 
    };
});