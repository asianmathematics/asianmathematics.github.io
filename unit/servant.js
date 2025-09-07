import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, createMod, resetStat, damage } from '../combatDictionary.js';

export const Servant = new Unit("Servant", [700, 55, 15, 60, 110, 35, 125, 30, 115, 60, "front", 120, 14], ["Death/Darkness", "Knowledge/Memory", "Anomaly/Synthetic"], function() {
    this.actions.meleeAttack = {
        name: "Melee Attack",
        properties: ["attack"],
        description: "Attacks a single target twice with increased damage.",
        target: () => { selectTarget(this.actions.meleeAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.attack *= 2;
            logAction(`${this.name} deals with ${target[0].name}`, "action");
            attack(this, target, 2);
            resetStat(this, ["attack"]);
        }
    };

    this.actions.takingOutTrash = {
        name: "Taking Out Trash [stamina]",
        properties: ["physical", "stamina", "death/darkness", "attack", "autohit"],
        cost: { stamina: 60 },
        description: "Costs 60 stamina\nDirect attack on a single target with guaranteed critical hit.",
        target: () => {
            if (this.resource.stamina < 60) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            selectTarget(this.actions.takingOutTrash, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.stamina -= 60;
            this.previousAction = [true, false, false];
            logAction(`${this.name} takes out the trash!`, "action");
            damage(this, target, [[4]]);
        }
    };

    this.actions.sneak = {
        name: "Sneak [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 45 },
        description: "Costs 45 stamina\nLowers presence and increases accuracy and crit chance for 1 turn",
        code: () => {
            if (this.resource.stamina < 45) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 45;
            this.previousAction = [true, false, false];
            const self = this;
            createMod("Sneak Adjustment", "Combat focus modification",
                { caster: self, targets: [self], duration: 1, stats: ["presence", "accuracy", "focus", "lethality"], values: [-0.5, 0.5, 0.9, 1] },
                (vars) => {
                    vars.stats.forEach((stat, i) => {
                        vars.targets[0].mult[stat] += vars.values[i];
                        resetStat(vars.targets[0], [stat]);
                    });
                    logAction(`${vars.caster.name} enters a hyper-focused state!`, "buff");
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

    this.actions.dodge = {
        name: "Dodge [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases evasion for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 20;
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
                        unit.mult[vars.stat] -= vars.value;
                        resetStat(unit, [vars.stat]);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.block = {
        name: "Block [physical]",
        properties: ["physical", "buff"],
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