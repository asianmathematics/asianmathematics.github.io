import { Unit } from './unit.js';
import { logAction, unitFilter, attack, createMod, resetStat, randTarget } from '../combatDictionary.js';

export const enemy = new Unit("Basic Enemy", [500, 40, 10, 25, 100, 20, 100, 35, 100, 100, "front", 100, 10], function() {
    this.actions.basicAttack = {
        name: "Basic Attack",
        description: "Attacks a single target three times.",
        code: () => {
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} attacks ${target[0].name}`, "action");
            attack(this, target, 3);
        }
    };

    this.actions.strongAttack = {
        name: "Strong Attack [stamina]",
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nAttacks a single target twice with increased damage",
        code: () => {
            this.resource.stamina -= 30;
            this.previousAction = [true, false, false];
            this.attack *= 2;
            this.accuracy *= 1.5;
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} unleashes two powerful strikes against ${target[0].name}!`, "action");
            attack(this, target, 2);
            resetStat(this, ["attack", "accuracy"]);
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

    this.actions.actionWeight = { 
        basicAttack: 0.25, 
        strongAttack: 0.6, 
        dodge: 0.1, 
        block: 0.05 
    };
});