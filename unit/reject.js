import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Reject = new Unit("Reject", [600, 38, 8, 60, 10, 60, 40, 40, 70, "front", 66, 60, 8], ["death/darkness", "goner/entropy", "anomaly/synthetic"], function() {
    this.actions.bite = {
        name: "Bite [stamina]",
        properties: ["physical", "stamina", "attack"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nAttacks a single target increased damage, accuracy, and crit chance",
        points: 60,
        target: () => { this.actions.bite.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} bites ${target[0].name}!`, "action");
            attack(this, target, 1, { attacker: { attack: this.attack + 12, accuracy: this.accuracy + 33, focus: this.focus + 15 } });
        }
    };

    this.actions.regeneration = {
        name: "Regeneration [stamina]",
        properties: ["techno", "energy", "harmonic/change", "anomaly/synthetic", "heal"],
        cost: { stamina: 25 },
        description: `Costs 25 energy\nHeals an self somewhat (${this.resource.healFactor * 1.5} HP), does bite if doesn't need healing`,
        points: 60,
        code: (target) => {
            if (this.hp < this.base.hp) {
                this.previousAction[2] = true;
                this.resource.energy -= 25;
                if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.actions.naniteRepair, unit: target[0], resource: ['hp'], value: [target[0].resource.healFactor * 1.5] }) }
                target[0].hp = Math.min(target[0].base.hp, target[0].hp + Math.floor(target[0].resource.healFactor * 1.5));
                logAction(`${this.name} regenerates!`, "heal");
            } else {
                currentAction[currentAction.length - 1] = this.actions.bite;
                this.actions.bite.target();
            }
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
        bite: 0.25,
        regeneration: 0.7,
        block: 0.05,
    };
})