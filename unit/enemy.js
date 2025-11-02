import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const enemy = new Unit("Basic Enemy", [1000, 36, 16, 100, 20, 100, 50, 100, 100, "front", 100, 100, 10], [], function() {
    this.actions.basicAttack = {
        name: "Basic Attack",
        properties: ["attack"],
        description: "Attacks a single target three times.",
        points: 60,
        target: () => { this.actions.basicAttack.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            logAction(`${this.name} attacks ${target[0].name}`, "action");
            attack(this, target, 3);
        }
    };

    this.actions.strongAttack = {
        name: "Strong Attack [stamina]",
        properties: ["physical", "stamina", "attack"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nAttacks a single target 4 times with increased damage",
        points: 60,
        target: () => { this.actions.strongAttack.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} unleashes four powerful strikes against ${target[0].name}!`, "action");
            attack(this, target, 4, { attacker: { attack: this.attack + 24 } });
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

    this.actions.block = {
        name: "Block",
        properties: ["buff"],
        description: "Slightly increases resist, slightly decreases presence, and increases defense for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [13, 7, -8];
            logAction(`${this.name} blocks.`, "buff");
            basicModifier("Block", "Defense and resist increased, presence decreased", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["defense", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.actionWeight = { 
        basicAttack: 0.25, 
        strongAttack: 0.6, 
        dodge: 0.1, 
        block: 0.05 
    };
});