import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Dandelion = new Unit("Dandelion", [1250, 60, 18, 140, 40, 130, 60, 130, 160, "front", 120, 80, 10, 120, 20], ["death/darkness", "inertia/cold", "independence/loneliness"], function() {
    this.actions.spellAttack = {
        name: "Spell Attack [mystic]",
        properties: ["mystic", "attack"],
        description: "Attacks a single target 4 times.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.spellAttack, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.spellAttack.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            this.previousAction[1] = true;
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action");
            attack(this, target, 4);
        }
    };

    this.actions.focusFire = {
        name: "Focus Fire [mana, physical]",
        properties: ["mystic", "mana", "physical", "attack"],
        cost: { mana: 10 },
        description: "Costs 10 mana\nHits a single target 3 times with increased accuracy and damage",
        points: 60,
        target: () => {
            if (this.resource.mana < 10) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.focusFire, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.focusFire.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            this.resource.mana -= 10;
            this.previousAction[0] = this.previousAction[1] = true;
            logAction(`${this.name} focus fires on ${target[0].name}!`, "action");
            attack(this, target, 3, { attacker: { accuracy: this.accuracy + 30, attack: this.attack + 28 } });
        }
    };

    this.actions.danmaku = {
        name: "Danmaku [mana]",
        properties: ["mystic", "mana", "attack", "debuff", "multitarget"],
        cost: { mana: 50 },
        description: "Costs 50 mana\nAttacks 4 random enemies 6 times with decreased accuracy and damage, decreases evasion for 1 turn",
        points: 60,
        code: () => {
            if (this.resource.mana < 50) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            const statDecrease = [-20];
            this.resource.mana -= 50;
            this.previousAction[1] = true;
            logAction(`${this.name} shoots some danmaku!`, "action");
            attack(this, randTarget(unitFilter(this.team === "player" ? "enemy" : "player", "front", false), 4, true), 6, { attacker: { accuracy: this.accuracy - 36, attack: this.attack - 20, focus: this.focus - 50 } });
            basicModifier("Evasion Penalty", "Evasion reduced during bullet hell", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["evasion"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.feint = {
        name: "Feint [stamina]",
        properties: ["physical", "stamina", "light/illusion", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nGreatly increases defense, evasion, and presence for 1 turn",
        points: 60,
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [12, 20, 100];
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} draws attention to himself!`, "action");
            basicModifier("Feint", "Defense, evasion, and presence increase", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        properties: ["physical", "buff"],
        description: "Slightly increases defense and resist, slightly decreases presence, and increases evasion for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [2, 12, 7, -2];
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            basicModifier("Dodge", "Evasion and resist increased", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.actionWeight = {
        spellAttack: 0.3,
        focusFire: 0.25,
        danmaku: 0.15,
        feint: 0.2,
        dodge: 0.1
    };
});