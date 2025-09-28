import { Unit } from './unit.js';
import { Modifier, refreshState, updateMod, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo } from '../combatDictionary.js';

export const ClassicJoy = new Unit("Classical (Joy)", [380, 60, 8, 60, 110, 15, 120, 30, 90, 110, "back", 40, 120, 15, undefined, undefined, 90, 10], ["Death/Darkness", "Goner/Entropy", "Anomaly/Synthetic", "Independence/Loneliness", "Ingenuity/Insanity"], function() {
    this.actions.rapidFire = {
        name: "Rapid Fire [physical, techno]",
        properties: ["physical", "techno", "attack", "buff"],
        description: "Attacks a single target twice but increases speed for 1 turn",
        target: () => { selectTarget(this.actions.rapidFire, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            const statIncrease = 0.4;
            this.previousAction[0] = this.previousAction[2] = true;
            attack(this, target, 2);
            logAction(`${this.name} performs a Rapid Fire, boosting speed for 1 turn!`, "buff");
            const self = this;
            new Modifier("Rapid Fire Speed", "Temporary speed boost",
                { caster: self, targets: [self], duration: 1, stats: "speed", values: statIncrease },
                (vars) => { resetStat(vars.caster, [vars.stats], [vars.values]) },
                (vars, unit) => {
                    if (vars.caster === unit) { vars.duration-- }
                    if (vars.duration === 0) {
                        resetStat(vars.caster, [vars.stats], [vars.values], false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.energyRifle = {
        name: "Energy Rifle [energy]",
        properties: ["techno", "energy", "attack"],
        cost: { energy: 30 },
        description: "Costs 30 energy\nAttacks a single target 3 times with increased accuracy and crit damage",
        target: () => {
            if (this.resource.energy < 30) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.energyRifle, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 30;
            this.previousAction[2] = true;
            logAction(`${this.name} fires at ${target[0].name}!`, "action");
            attack(this, target, 4, { attacker: { accuracy: this.accuracy * 1.5, lethality: this.lethality * 1.7 } });
        }
    };

    this.actions.emp = {
        name: "EMP [energy]",
        properties: ["techno", "energy", "inertia/cold", "debuff", "resource"],
        cost: { energy: 55 },
        description: "Costs 55 energy\nSets energy of target to 0 and disables energy regeneration for next turn",
        target: () => {
            if (this.resource.energy < 55) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.emp, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 55;
            this.previousAction[2] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.energy !== undefined) {
                if (will[0] > 35) {
                    target[0].resource.energy = 0;
                    target[0].previousAction[2] = true;
                    logAction(`${this.name} disables ${target[0].name}'s energy!`, "action");
                } else { logAction(`${target[0].name} resists the emp`, "miss") }
            } else { logAction(`${target[0].name} has no energy to disable!`, "warning") }
        }
    };

    this.actions.synthesizeMedicine = {
        name: "Synthesize Medicine [techno]",
        properties: ["techno", "nature/life", "heal"],
        description: "Moderately heals target (~10% max HP)",
        target: () => { selectTarget(this.actions.synthesizeMedicine, () => { playerTurn(this) }, [1, true, unitFilter("player", "")]) },
        code: (target) => {
            this.previousAction = [false, false, true];
            target[0].hp = Math.min(target[0].base.hp, target[0].hp + target[0].resource.healFactor);
            logAction(`${this.name} heals ${target[0].name} for ${target[0].resource.healFactor} HP!`, "heal");
        }
    };

    this.actions.joy = {
        name: "Joy [stamina]",
        properties: ["physical", "stamina", "death/darkness", "harmonic/change", "ingenuity/insanity", "buff", "debuff"],
        cost: { stamina: 40 },
        description: "Costs 40 stamina & 10% HP\nDelayed consequences",
        target: () => {
            if (this.resource.stamina < 40) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            selectTarget(this.actions.joy, () => { playerTurn(this) }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            const statIncrease = [1 - ((target[0].base.accuracy + 25) / target[0].base.accuracy), 1 - ((target[0].base.focus + 40) / target[0].base.focus), 1 - ((target[0].base.defense + 5) / target[0].base.defense), 1 - ((target[0].base.resist + 15) / target[0].base.resist)];
            const statDecrease = [1 - ((target[0].base.attack - 10) / target[0].base.attack), 1 - ((target[0].base.defense - 5) / target[0].base.defense), 1 - ((target[0].base.evasion - 5) / target[0].base.evasion), 1 - ((target[0].base.speed - 10) / target[0].base.speed), 1 - ((target[0].base.accuracy - 25) / target[0].base.accuracy)];
            this.previousAction[0] = true;
            this.resource.stamina -= 40;
            this.hp = Math.max(this.hp - (.1 * this.base.hp), 0);
            const mod = modifiers.find(m => m.name === "Joy" && m.vars.targets.includes(target[0]));
            if (mod) {
                if (mod.vars.duration < 7) {
                    resetStat(target[0], mod.vars.debuffs, mod.vars.debuffValues, false);
                    resetStat(target[0], mod.vars.buffs, mod.vars.buffValues);
                } 
                mod.vars.duration = 9;
            } else {
                logAction(`${this.name} gives ${target[0].name} some joy!`, "buff");
                new Modifier("Joy", "Overall increase?",
                    { caster: this, targets: target, duration: 9, buffs: ["accuracy", "focus", "defense", "resist"], buffValues: statIncrease, debuffs: ["attack", "defense", "evasion", "speed", "accuracy"], debuffValues: statDecrease },
                    (vars) => { resetStat(vars.targets[0], vars.buffs, vars.buffValues) },
                    (vars, unit) => {
                        if (vars.targets[0] === unit) { vars.duration-- }
                        if (vars.duration === 6) {
                            resetStat(vars.targets[0], mod.vars.buffs, mod.vars.buffValues, false);
                            resetStat(vars.targets[0], mod.vars.debuffs, mod.vars.debuffValues);
                            logAction(`${vars.targets[0].name} is feeling the side effects!`, "debuff");
                            vars.self.description = "Long side effect period";
                        }
                        if (vars.duration === 0) {
                            resetStat(vars.targets[0], mod.vars.debuffs, mod.vars.debuffValues, false);
                            return true;
                        }
                    }
                );
            }
        }
    };
});