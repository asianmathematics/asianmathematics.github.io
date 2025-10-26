import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const FourArcher = new Unit("4 (Archer)", [800, 33, 12, 90, 25, 100, 50, 70, 105, "back", 80, 50, 3, 90, 7], ["light/illusion", "harmonic/change", "radiance/purity", "anomaly/synthetic"], function() {
    this.actions.perfectShot = {
        name: "Perfect Shot [mystic]",
        properties: ["mystic", "radiance/purity", "attack"],
        description: "Attacks a single target with increased accuracy and crit chance",
        points: 60,
        target: () => { selectTarget(this.actions.perfectShot, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            this.previousAction[1] = true;
            logAction(`${this.name} shoots a mystic arrow!`, "action");
            attack(this, target, 1, { attacker: { accuracy: this.accuracy + 24, focus: this.focus + 20 } });
        }
    };

    this.actions.multishot = {
        name: "Multi-shot [mana]",
        properties: ["mystic", "mana", "radiance/purity", "attack", "multitarget"],
        cost: { mana: 10 },
        description: "Costs 10 mana\nAttacks up to 4 targets with increased accuracy and crit chance",
        points: 60,
        target: () => {
            if (this.resource.mana < 10) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.multishot, () => { playerTurn(this) }, [4, false, unitFilter("enemy", "front", false)]);
        },
        code: (targets) => {
            this.resource.mana -= 10;
            this.previousAction[1] = true;
            logAction(`${this.name} fires multiple arrows!`, "action");
            attack(this, targets, 1, { attacker: { accuracy: this.accuracy + 22, focus: this.focus + 10 } });
        }
    };

    this.actions.luckyAura = {
        name: "Lucky Aura [mana]",
        properties: ["mystic", "mana", "light/illusion", "harmonic/change", "radiance/purity", "buff"],
        cost: { mana: 50 },
        description: "Costs 50 mana\nIncreases accuracy and crit chance for 4 turns",
        points: 60,
        code: () => {
            if (this.resource.mana < 50) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            const statIncrease = [5, 10, 5, 5, 40];
            this.resource.mana -= 50;
            this.previousAction[1] = true;
            logAction(`${this.name} becomes luckier!`, "buff");
			basicModifier("Lucky Aura", "Increased luck", { caster: this, targets: [this], duration: 5, attributes: ["mystic"], elements: ["light/illusion", "harmonic/change", "radiance/purity"], stats: ["accuracy", "focus", "evasion", "resist", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.laze = {
        name: "Laze",
        properties: ["debuff", "resource"],
        description: `Regain a lot of mana (${this.resource.manaRegen * 5}) and decreases speed, presence, & all defensive stats for 1 turn`,
        points: 60,
        code: () => {
            const statDecrease = [-30, -50, -4, -10, -10];
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.laze, unit: this, resource: ['mana'], value: [this.resource.manaRegen * 5] }) }
            this.resource.mana = Math.min(this.resource.mana + (this.resource.manaRegen * 5), this.base.resource.mana);
            logAction(`${this.name} layed down lazily.`, "action");
            basicModifier("Resting", "Decreased speed, presence, and defensive stats", { caster: this, targets: [this], duration: 1, stats: ["speed", "presence", "defense", "evasion", "resist"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };
});