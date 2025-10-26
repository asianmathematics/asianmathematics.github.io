import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Servant = new Unit("Servant", [1800, 60, 24, 110, 35, 125, 65, 160, 60, "front", 200, 160, 17], ["death/darkness", "knowledge/memory", "anomaly/synthetic"], function() {
    this.actions.meleeAttack = {
        name: "Melee Attack",
        properties: ["attack"],
        description: "Attacks a single target twice with increased damage.",
        points: 60,
        target: () => { selectTarget(this.actions.meleeAttack, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) },
        code: (target) => {
            logAction(`${this.name} deals with ${target[0].name}`, "action");
            attack(this, target, 2, { attacker: { attack: this.attack + 8 } });
        }
    };

    this.actions.takingOutTrash = {
        name: "Taking Out Trash [stamina]",
        properties: ["physical", "stamina", "death/darkness", "attack", "autohit"],
        cost: { stamina: 50 },
        description: "Costs 50 stamina\nDirect attack on a single target with near guaranteed critical hit.",
        points: 60,
        target: () => {
            if (this.resource.stamina < 50) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            selectTarget(this.actions.takingOutTrash, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.stamina -= 50;
            this.previousAction[0] = true;
            logAction(`${this.name} takes out the trash!`, "action");
            damage(this, target, [[1 + (this.focus / Math.min(25, target[0].resist / 2))]]);
        }
    };

    this.actions.sneak = {
        name: "Sneak [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nLowers presence and increases crit chance and resist for 1 turn",
        points: 60,
        code: () => {
            if (this.resource.stamina < 30) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [30, 15, -50];
            this.resource.stamina -= 30;
            this.previousAction[0] = true;
            logAction(`${this.name} drew attention away from himself!`, "buff");
            basicModifier("Sneak Adjustment", "Combat focus modification", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["focus", "resist", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
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
            basicModifier("Dodge", "Evasion and resist increased", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
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
            basicModifier("Block", "Defense and resist increased, presence decreased", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["defense", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };
});