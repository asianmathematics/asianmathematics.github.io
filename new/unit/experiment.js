import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const Experiment = new Unit("Experiment", [700, 24, 10, 70, 45, 70, 45, 45, 80, "front", 80, 70, 7], 2, ["independence/loneliness"]);

Experiment.skills = {
    special: [
        {
            name: "Tooth and Nail",
            properties: ["physical", "stamina-block", "stamina", "attack"],
            cost: { stamina: 30 },
            description: "Attacks a single target 3 times with increased attack and accuracy",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) { attack(this, target, 3, { attacker: { attack: { bonus: 25 }, accuracy: { bonus: 35 } } }) }
        },
        {
            name: "Brain Eating",
            properties: ["physical", "stamina-block", "stamina", "attack", "fatal"],
            cost: { stamina: 50 },
            description: "Makes an attack on alive target. If attack reduced half of target's current hp or target is downed, chance to kill target",
            target() { specialTarget(this, allUnits.filter(u => u.position === "front" && u.team !== this.team)) },
            code(target) {
                if ((!target[0].hp || attack(this, target)[0] >= target[0].hp) && resistDebuff(this, target)[0] > 50) {
                    allUnits.splice(allUnits.indexOf(target[0]), 1);
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit: target[0] });
                    for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === target[0]) removeModifier(modifiers[i]);
                    logAction(`${this.name} consumes ${target[0].name}!`);
                } else logAction(`${this.name} fails to consume ${target[0].name}!`, "miss");
            }
        },
        {
            name: "Imperfect Abomination",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increase attack/focus/presence and decreased defense/accuracy/evasion for 4 turns",
            code() {
                basicModifier("Imperfect Abomination buff", "Attack, focus, and presence increase", { target: this, duration: 5, properties: ["physical", "buff"], stats: { attack: 16, focus: 60, presence: 80 }, listeners: { turnEnd: true } });
                basicModifier("Imperfect Abomination penalty", "Defense, accuracy, and evasion decrease", { target: this, duration: 5, properties: ["physical", "penalty"], stats: { defense: -5, accuracy: -20, evasion: -10 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increase attack/accuracy/focus and decreased evasion/resist/presence for 4 turns",
            code() {
                basicModifier("Forced Mercenary buff", "Attack, accuracy, and focus increase", { target: this, duration: 5, properties: ["physical", "buff"], stats: { attack: 8, accuracy: 40, focus: 40 }, listeners: { turnEnd: true } });
                basicModifier("Forced Mercenary penalty", "Evasion, resist, and presence decrease", { target: this, duration: 5, properties: ["physical", "penalty"], stats: { evasion: -10, resist: -15, presence: -40 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "Tooth and Nail",
            properties: ["physical", "stamina-block", "attack"],
            description: "Attacks a single target 3 times",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 3) }
        },
        {
            name: "Brain Eating",
            properties: ["physical", "stamina-block", "stamina", "attack", "fatal"],
            cost: { stamina: 30 },
            description: "Makes an attack on alive target. If attack reduced half of target's current hp or target is downed, chance to kill target",
            code() {
                const target = randTarget(allUnits.filter(u => u.position === "front" && u.team !== this.team));
                if ((!target[0].hp || (attack(this, target) && !target[0].hp)) && resistDebuff(this, target)[0] > 75) {
                    allUnits.splice(allUnits.indexOf(target[0]), 1);
                    if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit: target[0] });
                    for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === target[0]) removeModifier(modifiers[i]);
                    logAction(`${this.name} consumes ${target[0].name}!`);
                } else logAction(`${this.name} fails to consume ${target[0].name}!`, "miss");
            }
        },
        {
            name: "Imperfect Abomination",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increase attack/focus/presence and decreased accuracy/evasion for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Imperfect Abomination buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Imperfect Abomination penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Imperfect Abomination buff", "Attack, focus, and presence increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 12, focus: 30, presence: 40 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Imperfect Abomination penalty", "Accuracy and evasion decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { accuracy: -10, evasion: -5 }, listeners: { turnEnd: true }, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increase attack/accuracy/focus and decreased evasion/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Forced Mercenary buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Forced Mercenary penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Forced Mercenary buff", "Attack, accuracy, and focus increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 6, accuracy: 20, focus: 20 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Forced Mercenary penalty", "Evasion, resist, and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { evasion: -5, resist: -10, presence: -20 }, listeners: { turnEnd: true }, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        }
    ],
    secondary: [
        {
            name: "Tooth and Nail",
            properties: ["physical", "attack"],
            description: "Attacks a single target 2 times",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2) }
        },
        {
            name: "Imperfect Abomination",
            properties: ["physical", "buff", "penalty"],
            description: "Increase focus/presence and decreased accuracy for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Imperfect Abomination buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Imperfect Abomination penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Imperfect Abomination buff", "Focus, and presence increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { focus: 30, presence: 40 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Imperfect Abomination penalty", "Accuracy decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { accuracy: -5 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["physical", "buff", "penalty"],
            description: "Increase accuracy/focus and decreased resist/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Forced Mercenary buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Forced Mercenary penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Forced Mercenary buff", "Accuracy, and focus increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 20, focus: 20 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Forced Mercenary penalty", "Resist, and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -5, presence: -10 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "Brain Eating",
            properties: ["physical", "stamina", "fatal"],
            description: "When downing a unit or skipping a turn, chance to kill target or randomly downed frontline unit",
            code() {
                new Modifier("Brain Eating", "When downing a unit or skipping a turn, chance to kill target or randomly downed frontline unit",
                    { target: this, properties: ["physical", "fatal"], listeners: { unitChange: true, actionStart: true, turnEnd: false }, cancelListeners: ['unitChange', 'actionStart', 'turnEnd'], focus: true, passive: true, unit: null },
                    function() {},
                    function(context) {
                        if (context.event === 'turnEnd') {
                            if (allUnits.indexOf(this.vars.unit) > -1 && !this.vars.unit.hp) {
                                allUnits.splice(allUnits.indexOf(this.vars.unit), 1);
                                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit: this.vars.unit });
                                for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.unit) removeModifier(modifiers[i]);
                            }
                            this.vars.unit = null;
                            this.vars.listeners.turnEnd = false;
                        }
                        if (context.action === 'skip' && context.unit === this.vars.caster) {
                            const unit = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.vars.caster.team), 1, true)[0];
                            if (unit && resistDebuff(this.vars.caster, [unit])[0] > 85) {
                                allUnits.splice(allUnits.indexOf(unit), 1);
                                if (eventState.unitChange.length) handleEvent('unitChange', { type: 'death', unit });
                                for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === unit) removeModifier(modifiers[i]);
                            }
                        } else if (context.type === 'downed' && currentAction.at(-2)[1] === this.vars.caster && resistDebuff(this.vars.caster, [context.unit])[0] > 85) {
                            this.vars.unit = context.unit;
                            this.vars.listeners.turnEnd = true;
                        }
                    }
                );
            }
        },
        {
            name: "Imperfect Abomination",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increase focus/presence and decreased accuracy",
            code() {
                basicModifier("Imperfect Abomination buff", "Focus, and presence increase", { target: this, properties: ["physical", "buff"], stats: { focus: 20, presence: 30 }, passive: true });
                basicModifier("Imperfect Abomination penalty", "Accuracy decrease", { target: this, properties: ["physical", "penalty"], stats: { accuracy: -10 }, passive: true, penalty: true });
            }
        },
        {
            name: "Forced Mercenary",
            properties: ["physical", "stamina", "buff", "penalty"],
            description: "Increase accuracy/focus and decreased resist/presence",
            code() {
                basicModifier("Forced Mercenary buff", "Accuracy, and focus increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 10, focus: 10 }, passive: true});
                basicModifier("Forced Mercenary penalty", "Resist, and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -5, presence: -20 }, passive: true, penalty: true });
            }
        }
    ]
}

Experiment.defaultSkills = [
    { category: 'special', name: 'Brain Eating' },
    { category: 'basic', name: 'Tooth and Nail' },
    { category: 'secondary', name: 'Forced Mercenary' },
    { category: 'passive', name: 'Imperfect Abomination' }
];