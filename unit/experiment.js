import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Experiment = new Unit("Experiment", [700, 62, 9, 70, 20, 70, 20, 45, 80, "front", 80, 70, 7], ["death/darkness", "knowledge/memory", "anomaly/synthetic", "passion/hatred"], function() {
    this.actions.meleeAttack = {
        name: "Melee Attack",
        properties: ["attack"],
        description: "Attacks a single target twice with increased accuracy.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.meleeAttack, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.meleeAttack.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            logAction(`${this.name} deals with ${target[0].name}`, "action");
            attack(this, target, 2, { attacker: { accuracy: this.accuracy + 20 } });
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
        meleeAttack: 0.3,
        strongAttack: 0.65,
        block: 0.05,
    };
})