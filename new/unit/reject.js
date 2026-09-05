import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const Reject = new Unit("Reject", [660, 30, 28, 60, 40, 60, 80, 40, 70, "front", 66, 60, 8], 2, ["independence/loneliness"]);

Reject.skills = {
    special: [
        {
            name: "Bite",
            properties: ["physical", "stamina-block", "stamina", "attack"],
            cost: { stamina: 25 },
            description: "Attacks a single target with increased attack, accuracy, and focus",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: 40 }, accuracy: { bonus: 120 }, focus: { bonus: 120 } } }) }
        },
        {
            name: "Regeneration",
            properties: ["physical", "stamina-block", "stamina", "heal"],
            cost: { stamina: 25 },
            description: "Heals a lot (30% max hp)",
            code() { heal(this, [this], [3]) }
        },
        {
            name: "Rejected by All",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases defense/evasion/resist and decreases attack/accuracy/focus/presence for 4 turns",
            code() {
                basicModifier("Rejected by All buff", "Defense, evasion, resist increase", { target: this, duration: 5, properties: ["physical", "buff"], stats: { defense: 30, evasion: 20, resist: 15 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Rejected by All penalty", "Attack, accuracy, focus, and presence decrease", { target: this, duration: 5, properties: ["physical", "penalty"], stats: { attack: -10, accuracy: -15, focus: -30, presence: -30 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Faded Concept",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 10 },
            description: "Increases defense/resist and decreases accuracy/evasion/focus/presence for 4 turns",
            code() {
                basicModifier("Faded Concept buff", "Defense, evasion, resist increase", { target: this, duration: 5, properties: ["physical", "buff"], stats: { defense: 40, resist: 60 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Faded Concept penalty", "Attack, accuracy, focus, and presence decrease", { target: this, duration: 5, properties: ["physical", "penalty"], stats: { accuracy: -15, evasion: -10, focus: -20, presence: -20 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "Bite",
            properties: ["physical", "stamina-block", "attack"],
            description: "Attacks a single target with increased attack, accuracy, and focus",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attacker: { attack: { bonus: 40 }, accuracy: { bonus: 80 } } }) }
        },
        {
            name: "Regeneration",
            properties: ["physical", "stamina-block", "stamina", "heal"],
            cost: { stamina: 15 },
            description: "Heals moderately (25% max hp)",
            code() { heal(this, [this], [2.5]) }
        },
        {
            name: "Rejected by All",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases defense/evasion/resist and decreases accuracy/focus/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Rejected by All buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Rejected by All penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Rejected by All buff", "Defense, evasion, resist increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { defense: 20, evasion: 15, resist: 10 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Rejected by All penalty", "Accuracy, focus, and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { accuracy: -10, focus: -20, presence: -25 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        },
        {
            name: "Faded Concept",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases defense/resist and decreases accuracy/evasion/focus/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Faded Concept buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Faded Concept penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Faded Concept buff", "Defense, evasion, resist increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { defense: 30, resist: 40 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Faded Concept penalty", "Attack, accuracy, focus, and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { accuracy: -10, evasion: -5, focus: -15, presence: -15 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        }
    ],
    secondary: [
        {
            name: "Bite",
            properties: ["physical", "attack"],
            description: "Attacks a single target with increased attack, accuracy, and focus",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attacker: { attack: { bonus: 40 } } }) }
        },
        {
            name: "Regeneration",
            properties: ["physical", "stamina-block", "heal"],
            description: "Heals a bit (17.5% max hp)",
            code() { heal(this, [this], [1.75]) }
        },
        {
            name: "Rejected by All",
            properties: ["physical", "buff", "penalty"],
            description: "Increases defense/evasion/resist and decreases focus/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Rejected by All buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Rejected by All penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Rejected by All buff", "Defense, evasion, resist increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { defense: 15, evasion: 10, resist: 5 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Rejected by All penalty", "Focus and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { focus: -15, presence: -20 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Faded Concept",
            properties: ["physical", "buff", "penalty"],
            description: "Increases defense/resist and decreases accuracy/focus/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Faded Concept buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Faded Concept penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Faded Concept buff", "Defense, evasion, resist increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { defense: 20, resist: 30 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Faded Concept penalty", "Accuracy, focus, and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { accuracy: -5, focus: -10, presence: -10 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "Regeneration",
            properties: ["physical", "heal"],
            description: `Heals (~2.5% max HP) at start of turn`,
            code() {
                new Modifier("Regeneration", `Heals at start of turn`,
                    { target: this, properties: ["physical", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], focus: true, passive: true },
                    function() {},
                    function(context) { if (this.vars.target === context.unit) heal(this.vars.caster, [this.vars.target], [.25]) }
                );
            }
        },
        {
            name: "Rejected by All",
            properties: ["physical", "buff", "penalty"],
            description: "Increases defense/evasion/resist and decreases accuracy/focus/presence",
            code() {
                basicModifier("Rejected by All buff", "Defense, evasion, resist increase", { target: this,properties: ["physical", "buff"], stats: { defense: 15, evasion: 10, resist: 10 }, focus: true });
                basicModifier("Rejected by All penalty", "Focus, and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { focus: -15, presence: -20 }, focus: true, penalty: true });
            }
        },
        {
            name: "Faded Concept",
            properties: ["physical", "buff", "penalty"],
            description: "Increases defense/resist and decreases accuracy/focus/presence",
            code() {
                basicModifier("Faded Concept buff", "Defense, evasion, resist increase", { target: this, properties: ["physical", "buff"], stats: { defense: 25, resist: 15 }, focus: true });
                basicModifier("Faded Concept penalty", "Accuracy, focus, and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { accuracy: -10, focus: -10, presence: -10 }, focus: true, penalty: true });
            }
        }
    ]
}

Reject.defaultSkills = [
    { category: 'special', name: 'Rejected by All' },
    { category: 'basic', name: 'Bite' },
    { category: 'secondary', name: 'Faded Concept' },
    { category: 'passive', name: 'Regeneration' }
];