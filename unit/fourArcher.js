import { Unit } from './unit.js';
import { logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, createMod, resetStat } from '../combatDictionary.js';

export const FourArcher = new Unit("4 (Archer)", [440, 40, 7, 35, 110, 30, 135, 45, 90, 115, "back", 40, 60, 4, 80, 6], ["Light/Illusion", "Harmonic/Change", "Radiance/Purity", "Anomaly/Synthetic"], function() {
    this.actions.perfectShot = {
        name: "Perfect Shot [mystic]",
        properties: ["mystic", "radiance/purity", "attack"],
        description: "Attacks a single target with increased accuracy and crit chance",
        target: () => { selectTarget(this.actions.perfectShot, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            this.previousAction[1] = true;
            logAction(`${this.name} shoots a mystic arrow!`, "action");
            attack(this, target, 1, { attacker: { accuracy: this.accuracy * 1.75, focus: this.focus * 2.5 } });
        }
    };

    this.actions.multishot = {
        name: "Multi-shot [mana]",
        properties: ["mystic", "mana", "radiance/purity", "attack", "multitarget"],
        cost: { mana: 20 },
        description: "Costs 20 mana\nAttacks up to 3 targets with increased accuracy and crit chance",
        target: () => {
            if (this.resource.mana < 20) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.multishot, () => { playerTurn(this) }, [3, false, unitFilter("enemy", "front", false)]);
        },
        code: (targets) => {
            this.resource.mana -= 20;
            this.previousAction[1] = true;
            logAction(`${this.name} fires multiple arrows!`, "action");
            attack(this, targets, 1, { attacker: { accuracy: this.accuracy * 1.25, focus: this.focus * 1.75 } });
        }
    };

    this.actions.luckyAura = {
        name: "Lucky Aura [mana]",
        properties: ["mystic", "mana", "light/illusion", "harmonic/change", "radiance/purity", "buff"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nIncrease all luck based stats for 3 turns",
        code: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 40;
            this.previousAction = [false, true, false];
            logAction(`${this.name} becomes luckier!`, "buff");
            const self = this;
			createMod("Lucky Aura", "Increased luck",
                { caster: self, targets: [self], duration: 4, stats: ["accuracy", "focus", "evasion", "resist", "presence"], values: [0.75, 0.75, 0.25, 0.25, 0.25] },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.caster === unit) { vars.duration-- }
                    if (vars.duration === 0) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.imposeLuck = {
        name: "Impose Luck [mana]",
        properties: ["mystic", "mana", "light/illusion", "harmonic/change", "radiance/purity", "buff"],
        cost: { mana: 20 },
        description: "Costs 20 mana\nIncreases ally accuracy and crit chance for 2 turns",
        target: () => {
            if (this.resource.mana < 20) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.imposeLuck, () => { playerTurn(this) }, [3, false, unitFilter("player", "", false)]);
        },
        code: (target) => {
            const statIncrease = [0.5, 0.5];
            this.resource.mana -= 20;
            this.previousAction[1] = true;
            logAction(`${this.name} targets ${target[0].name} with a luck arrow!`, "buff");
            const self = this;
            createMod("Impose Luck", "Increased accuracy and crit chance",
                { caster: self, targets: target, duration: 3, stats: ["accuracy", "focus"], values: statIncrease },
                (vars) => { resetStat(vars.targets[0], vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.targets[0] === unit) {
                        vars.duration--;
                        if (vars.duration === 0) {
                            resetStat(vars.targets[0], vars.stats, vars.values, false);
                            return true;
                        }
                    }
                },
            );
        }
    };

    this.actions.rest = {
        name: "Rest",
        properties: ["physical", "stamina", "mana", "debuff", "resource"],
        description: `Regain some stamina (${this.resource.staminaRegen * 2.5}) and mana (${this.resource.manaRegen * 2}) and decreases evasion and speed for 1 turn`,
        code: () => {
            const statDecrease = [-0.5, -0.25];
            this.resource.stamina = Math.min(this.resource.stamina + (this.resource.staminaRegen * 2.5), this.base.resource.stamina);
            this.resource.mana = Math.min(this.resource.mana + (this.resource.manaRegen * 2), this.base.resource.mana);
            logAction(`${this.name} layed down lazily.`, "action");
            const self = this;
            createMod("Resting", "decreased evasion and speed",
                { caster: self, targets: [self], duration: 1, stats: ["evasion", "speed"], values: statDecrease },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.caster === unit) { vars.duration-- }
                    if (vars.duration === 0) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                } 
            );
        }
    };
});