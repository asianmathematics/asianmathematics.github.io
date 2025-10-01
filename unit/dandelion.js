import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Dandelion = new Unit("Dandelion", [400, 60, 12, 45, 115, 40, 120, 25, 115, 160, "front", 44, 140, 15, 180, 20], ["Death/Darkness", "Inertia/Cold", "Independence/Loneliness"], function() {
    this.actions.spellAttack = {
        name: "Spell Attack [mystic]",
        properties: ["mystic", "attack"],
        description: "Attacks a single target 4 times.",
        target: () => { selectTarget(this.actions.spellAttack, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            this.previousAction[1] = true;
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.focusFire = {
        name: "Focus Fire [mana, physical]",
        properties: ["mystic", "mana", "physical", "attack"],
        cost: { mana: 30 },
        description: "Costs 30 mana\nHits a single target twice with increased accuracy and damage",
        target: () => {
            if (this.resource.mana < 30) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.focusFire, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 30;
            this.previousAction[0] = this.previousAction[1] = true;
            logAction(`${this.name} focus fires on ${target[0].name}!`, "action");
            attack(this, target, 2, { attacker: { accuracy: this.accuracy * 1.25, attack: this.attack * 1.5 } });
        }
    };

    this.actions.bulletHell = {
        name: "Bullet Hell [mana]",
        properties: ["mystic", "mana", "attack", "debuff", "multitarget"],
        cost: { mana: 60 },
        description: "Costs 60 mana\nDecreases evasion for 1 turn\nHits up to 4 random enemies 6 times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 60) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            const statDecrease = [-0.5];
            this.resource.mana -= 60;
            this.previousAction[1] = true;
            logAction(`${this.name} shoots some damaku!`, "action");
            let target = unitFilter("enemy", "front", false);
            if (target.length > 4) { target = randTarget(target, 4, true) }
            attack(this, target, 6, { attacker: { accuracy: this.accuracy * 0.75, attack: this.attack * 0.5 } });
            const self = this;
            basicModifier("Evasion Penalty", "Evasion reduced during bullet hell", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["evasion"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.feint = {
        name: "Feint [stamina]",
        properties: ["physical", "stamina", "light/illusion", "buff"],
        cost: { stamina: 40 },
        description: "Costs 40 stamina\nIncreases defense, evasion, and presense for 1 turn", 
        code: () => {
            if (this.resource.stamina < 40) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [0.5, 1.5, 2]
            this.resource.stamina -= 40;
            this.previousAction[0] = true;
            logAction(`${this.name} draws attention to himself!`, "action");
            const self = this;
            basicModifier("Feint", "Defense, evasion, and presence increase", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
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
            const statIncrease = [2];
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            basicModifier("Dodge", "Evasion increased", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["evasion"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };
});