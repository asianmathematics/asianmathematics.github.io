import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from '../combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const Failure = new Unit("Failure", [1400, 40, 40, 60, 140, 150, 50, 80, 140, "front", 160, 60, 8, , , 50, 6], 3);

Failure.skills = {
    special: [
        {
            name: "Self-sabotage",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "psuedo-stat", "activate"],
            cost: { stamina: 10, energy: 10 },
            description: "Increases attack/evasion/focus and decrease defense/accuracy/resist/speed/presence for 5 turns. Activates the backfire effect of each equipped skill, drains resources by the cost of each skill",
            code() {
                basicModifier("Self-sabotage buff", "Attack, evasion, and focus increase", { target: this, duration: 6, properties: ["physical", "techno", "buff"], stats: { attack: 30, evasion: 60, focus: 140 }, listeners: { turnEnd: true } });
                basicModifier("Self-sabotage penalty", "Defense, accuracy, resist, speed, and presence decrease", { target: this, duration: 6, properties: ["physical", "techno", "penalty"], stats: { defense: -15, accuracy: -50, resist: -30, speed: -15, presence: -50 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Tesla Turret",
            properties: ["physical", "stamina-block", "techno", "energy-block", "energy", "psuedo-stat", "attack", "dot"],
            cost: { techno: 10 },
            description: ""
        }
    ]
}