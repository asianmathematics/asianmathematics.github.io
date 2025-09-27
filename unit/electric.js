import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, resetStat } from '../combatDictionary.js';

export const Electric = new Unit("Electric", [450, 50, 8, 35, 105, 25, 110, 30, 125, 150, "front", 40, 100, 15, 75, 10, 200, 25], ["Light/Illusion", "Harmonic/Change", "Radiance/Purity", "Anomaly/Synthetic"], function() {
    this.actions.electricDischarge = {
        name: "Electric Discharge [mystic, energy]",
        properties: ["mystic", "techno", "energy", "harmonic/change", "attack"],
        cost: { energy: 60 },
        description: "Costs 60 energy\nDeals 5 attacks to a single target with increased crit and damage",
        target: () => {
            if (this.resource.energy < 60) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.electricDischarge, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 60;
            this.previousAction[2] = true;
            logAction(`${this.name} channels a powerful electric discharge into ${target[0].name}!`, "action");
            attack(this, target, 5, { attacker: { accuracy: this.accuracy * 1.2, attack: this.attack * 1.3 } });
        }
    };

    this.actions.sickBeats = {
        name: "Sick Beats [energy]",
        properties: ["techno", "energy", "harmonic/change", "buff"],
        cost: { energy: 40 },
        description: "Costs 40 energy\nBoosts speed and presence of a friendly unit for 3 turns",
        target: () => {
            if (this.resource.energy < 40) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.sickBeats, () => { playerTurn(this) }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            const statIncrease = [1 -((target[0].base.speed + 50) / target[0].base.speed), 1 - ((target[0].base.presence + 70) / target[0].base.presence)];
            this.resource.energy -= 40;
            this.previousAction[2] = true;
            logAction(`${this.name} plays sick beats, energizing ${target[0].name}!`, "buff");
            const self = this;
            createMod("Sick Beats Buff", "Rhythmic performance enhancement",
                { caster: self, targets: target, duration: 4, stats: ["speed", "presence"], values: statIncrease },
                (vars) => { resetStat(vars.targets[0], vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.targets[0] === unit) { vars.duration-- }
                    if (vars.duration === 0) {
                        resetStat(vars.targets[0], vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.recharge = {
        name: "Recharge [mana]",
        properties: ["mystic", "mana", "harmonic/change", "buff"],
        cost: { mana: 30 },
        description: `Costs 30 mana\nConverts mana into a lot of energy (${this.resource.energyRegen * 3})`,
        code: () => {
            if (this.resource.mana < 30) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 30;
            this.previousAction[1] = true;
            logAction(`${this.name} generates electricity!`, "heal");
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + this.resource.energyRegen * 3);
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
            const statIncrease = 2;
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            createMod("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, stats: "evasion", values: statIncrease },
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

    this.actions.block = {
        name: "Block [physical]",
        properties: ["physical", "buff"],
        description: "Increases defense for 1 turn",
        code: () => {
            const statIncrease = 1;
            this.previousAction[0] = true;
            logAction(`${this.name} blocks.`, "buff");
            const self = this;
            createMod("Block", "Defense increased",
                { caster: self, targets: [self], duration: 1, stats: "defense", values: statIncrease },
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
});