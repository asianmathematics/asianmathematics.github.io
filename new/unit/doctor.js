import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const Doctor = new Unit("Doctor", [1200, 18, 25, 140, 70, 140, 70, 100, 60, "back", 150, 60, 7, , , 120, 15], 3, ["independence/loneliness"]);

Doctor.description = "3-star techno backline unit wih healing and buff abilities";

Doctor.skills = {
    special: [
        {
            name: "First Aid",
            properties: ["techno", "energy-block", "energy", "heal"],
            cost: { energy: 50 },
            description: "Heal all allies (~10% max HP)",
            code() { 
                const targets = allUnits.filter(u => u.team === this.team);
                if (eventState.targets.length) handleEvent('targets', { selectedTargets: targets, count: targets.length });
                heal(this, targets, Array(targets.length).fill(1));
            }
        },
        {
            name: "Caring is Sharing",
            properties: ["techno", "energy-block", "energy", "buff"],
            cost: { energy: 40 },
            description: "Increases all allies, except self, heal factor by half of heal factor for 3 turns",
            code() { allUnits.filter(u => u.team === this.team).forEach(u => u !== this && basicModifier("Caring is Sharing", "Increased heal factor", { target: u, duration: 3, properties: ["techno", "buff"], stats: { healFactor: this.healFactor / 2 }, listeners: { turnEnd: true } })) }
        },
        {
            name: "Medical Malpractice",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "attack", "dot"],
            cost: { stamina: 10, energy: 20 },
            description: "Attacks target with increased attack, accuracy, and focus and chance to deal critical damage over time until resist",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                if (attack(this, target, 1, { attacker: { attack: { bonus: 30 }, accuracy: { bonus: 100 }, focus: { bonus: 200 } } })[0]) new Modifier("Medical Malpractice", "Critical amage start of turn until resist", 
                    { target: target[0], properties: ["physical", 'techno'], listeners: { turnStart: true}, debuff: function(target) { return resistDebuff(this, [target]) >= 50 } },
                    function() {},
                    function(context) { if (context.unit === this.vars.target) return this.vars.debuff(this.vars.target) ? this.vars.applied && damage(this.vars.caster, [this.vars.target], [[1]]) && false : true }
                );
            }
        },
        {
            name: "Prescription Stimulant",
            properties: ["techno", "energy-block", "energy", "conditional", "buff"],
            cost: { energy: 40 },
            description: "Gives offensive, defensive, or speed stimulants depending on target's stats for all allies, except self, for 3 turns",
            code() {
                const vars = { duration: 3, properties: ["techno", "buff"], listeners: { turnEnd: true } };
                allUnits.filter(u => u.team === this.team).forEach(u => u !== this && (u.attack >= 37.5*1.5**(u.star-3) ? basicModifier("Prescription Stimulant: Offensive", "Attack, accuracy, and focus increase", { ...vars, target: u, stats: { attack: 20, accuracy: 60, focus: 60 } }) : u.defense >= 37.5*1.5**(u.star-3) || u.evasion >= 125*1.5**(u.star-3) ? basicModifier("Prescription Stimulant: Defensive", "Defense, evasion, and presence increase", { ...vars, target: u, stats: { defense: 20, evasion: 60, presence: 150 } }) : basicModifier("Prescription Stimulant: Speed", "Evasion and speed increase", { ...vars, target: u, stats: { evasion: 120, speed: 75 } })));
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases accuracy/focus/speed and decreases defense/resist/presence for 5 turns",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 120, speed: 50 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -10, resist: -30, presence: -60 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "First Aid",
            properties: ["techno", "energy-block", "energy", "heal"],
            cost: { energy: 10 },
            description: "Heal lowest hp ally (~15% max HP)",
            code() { heal(this, unitByStat(allUnits.filter(u => u.team === this.team), 'hp', 'percent', false), [1.5]) }
        },
        {
            name: "Caring is Sharing",
            properties: ["techno", "energy-block", "buff"],
            description: "Increases heal factor of the 3 lowest hp allies, except self, by half of heal factor for 3 turns",
            code() { unitByStat(allUnits.filter(u => u.team === this.team), 'hp', 'percent', false, 3).forEach(u => u !== this && basicModifier("Caring is Sharing", "Increased heal factor", { target: u, duration: 3, properties: ["techno", "buff"], stats: { healFactor: this.healFactor / 2 }, listeners: { turnEnd: true } })) }
        },
        {
            name: "Medical Malpractice",
            properties: ["physical", "stamina-block", "techno", "energy-block", "attack", "dot"],
            description: "Attacks target with increased damage, accuracy, and focus and chance to deal damage over time until resist",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                if (attack(this, target, 1, { attacker: { attack: { bonus: 30 }, accuracy: { bonus: 100 }, focus: { bonus: 50 } } })[0]) new Modifier("Medical Malpractice", "Damage start of turn until resist", 
                    { target: target[0], properties: ["physical", 'techno'], listeners: { turnStart: true }, debuff: function(target) { return resistDebuff(this, [target]) >= 50 } },
                    function() {},
                    function(context) { if (context.unit === this.vars.target) return this.vars.debuff(this.vars.target) ? this.vars.applied && damage(this.vars.caster, [this.vars.target], [[.5]]) && false : true }
                );
            }
        },
        {
            name: "Prescription Stimulant",
            properties: ["techno", "energy-block", "conditional", "buff"],
            description: "Gives offensive, defensive, or speed stimulants depending on target's stats for 4 random allies, except self, for 3 turns",
            code() {
                let vars = { duration: 3, properties: ["techno", "buff"], listeners: { turnEnd: true } }, mod;
                randTarget(allUnits.filter(u => !this && u.team === this.team).filter(u => u !== this), 4, true).forEach(u => (mod = modifiers.find(m => m.name.includes("Prescription Stimulant") && m.vars.caster === this && m.vars.target === u)) ?( mod.vars.duration = 3) && logAction(`${this.name} refreshes ${mod.name}`) : (u.attack >= 37.5*1.5**(u.star-3) ? basicModifier("Prescription Stimulant: Offensive", "Attack, accuracy, and focus increase", { ...vars, target: u, stats: { attack: 20, accuracy: 60, focus: 60 } }) : u.defense >= 37.5*1.5**(u.star-3) || u.evasion >= 125*1.5**(u.star-3) ? basicModifier("Prescription Stimulant: Defensive", "Defense, evasion, and presence increase", { ...vars, target: u, stats: { defense: 20, evasion: 60, presence: 150 } }) : basicModifier("Prescription Stimulant: Speed", "Evasion and speed increase", { ...vars, target: u, stats: { evasion: 120, speed: 75 } })));
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases accuracy/focus/speed and decreases defense/resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Pursuit of Knowledge buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Pursuit of Knowledge penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 30, focus: 100, speed: 40 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Pursuit of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { defense: -5, resist: -20, presence: -40 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        }
    ],
    secondary: [
        {
            name: "First Aid",
            properties: ["techno", "energy-block", "heal"],
            description: "Heal lowest hp ally (~10% max HP)",
            code() { heal(this, unitByStat(allUnits.filter(u => u.team === this.team), 'hp', 'percent', false), [1]) }
        },
        {
            name: "Caring is Sharing",
            properties: ["physical", "buff"],
            description: "Increases heal factor of the lowest hp ally by half of heal factor for 3 turns, if already active, regen resources",
            code() {
                const mods = modifiers.filter(m => m.name === "Caring is Sharing" && m.vars.caster === this).map(m => m.vars.target), targets = allUnits.filter(u => u.team === this.team && !mods.includes(u));
                targets.length ? basicModifier("Caring is Sharing", "Increased heal factor", { target: unitByStat(targets, 'hp', 'percent', false)[0], duration: 3, properties: ["techno", "buff"], stats: { healFactor: this.healFactor / 2 }, listeners: { turnEnd: true } }) : regenerateResources(this) || logAction(`${this.name} rests.`);
            }
        },
        {
            name: "Medical Malpractice",
            properties: ["physical", "techno", "attack", "dot"],
            description: "Attacks target with increased damage and accuracy and chance to deal damage over time until resist",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                if (attack(this, target, 1, { attacker: { attack: { bonus: 20 }, accuracy: { bonus: 50 } } })[0]) new Modifier("Medical Malpractice", "Damage start of turn until resist", 
                    { target: target[0], properties: ["physical", 'techno'], listeners: { turnStart: true}, debuff: function(target) { return resistDebuff(this, [target]) >= 50 } },
                    function() {},
                    function(context) { if (context.unit === this.vars.target) return this.vars.debuff(this.vars.target) ? this.vars.applied && damage(this.vars.caster, [this.vars.target], [[.5]]) && false : true }
                );
            }
        },
        {
            name: "Prescription Stimulant",
            properties: ["techno", "conditional", "buff"],
            description: "Gives offensive, defensive, or speed stimulants depending on target's stats for a random ally, except self, for 3 turns",
            code() {
                let vars = { duration: 3, properties: ["techno", "buff"], listeners: { turnEnd: true } }, mod;
                randTarget(allUnits.filter(u => !this && u.team === this.team), 2, true).forEach(u => (mod = modifiers.find(m => m.name.includes("Prescription Stimulant") && m.vars.caster === this && m.vars.target === u)) ?( mod.vars.duration = 3) && logAction(`${this.name} refreshes ${mod.name}`) : (u.attack >= 37.5*1.5**(u.star-3) ? basicModifier("Prescription Stimulant: Offensive", "Attack, accuracy, and focus increase", { ...vars, target: u, stats: { attack: 20, accuracy: 60, focus: 60 } }) : u.defense >= 37.5*1.5**(u.star-3) || u.evasion >= 125*1.5**(u.star-3) ? basicModifier("Prescription Stimulant: Defensive", "Defense, evasion, and presence increase", { ...vars, target: u, stats: { defense: 20, evasion: 60, presence: 150 } }) : basicModifier("Prescription Stimulant: Speed", "Evasion and speed increase", { ...vars, target: u, stats: { evasion: 120, speed: 75 } })));
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["stamina", "buff", "penalty"],
            description: "Increases focus/speed and decreases resist/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Pursuit of Knowledge buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Pursuit of Knowledge penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Pursuit of Knowledge buff", "Focus and speed increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { focus: 80, speed: 30 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -10, presence: -30 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "First Aid",
            properties: ["techno", "heal"],
            reduction: { energy: 10, energyRegen: 1 },
            description: `Heals lowest hp ally slightly (~5% max HP) at start of turn`,
            code() {
                new Modifier("First Aid", `Heals at start of turn`,
                    { target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.team === this.vars.caster.team), 'hp', 'percent', false), [.5]) }
                );
            }
        },
        {
            name: "Caring is Sharing",
            properties: ["techno", "buff"],
            reduction: { energy: 20, energyRegen: 2 },
            description: "Increases heal factor of all allies except self",
            code() {
                auraModifier("Caring is Sharing", "Increased heal factor for allies",
                    { targets: [], properties: ["techno", "buff"], listeners: { unitChange: true, waveChange: true }, reduction: this.skills.passive.reduction, passive: true },
                    function(target) { basicModifier("Caring is Sharing", "Increased heal factor", { target, properties: ["techno", "buff"], stats: { healFactor: 50 } }) },
                    (u) => u.team === this.team && u !== this
                );
            }
        },
        {
            name: "Prescription Stimulant",
            properties: ["techno", "conditional", "buff"],
            reduction: { energy: 20, energyRegen: 2 },
            description: "Gives offensive, defensive, or speed stimulants depending on target's stats for all allies, except self",
            code() {
                auraModifier("Prescription Stimulant", "Gives offensive, defensive, or speed stimulants depending on target's stats for allies",
                    { targets: [], properties: ["techno", "conditional", "buff"], listeners: { unitChange: true, waveChange: true }, reduction: this.skills.passive.reduction, passive: true },
                    function(target) { target.attack >= 37.5*1.5**(target.star-3) ? basicModifier("Prescription Stimulant: Offensive", "Attack, accuracy, and focus increase", { target, properties: ["techno", "buff"], stats: { attack: 15, accuracy: 40, focus: 40 } }) : target.defense >= 37.5*1.5**(target.star-3) || target.evasion >= 125*1.5**(target.star-3) ? basicModifier("Prescription Stimulant: Defensive", "Defense, evasion, and presence increase", { target, properties: ["techno", "buff"], stats: { defense: 15, evasion: 40, presence: 100 } }) : basicModifier("Prescription Stimulant: Speed", "Evasion and speed increase", { target, properties: ["techno", "buff"], stats: { evasion: 80, speed: 50 } }) },
                    (u) => u.team === this.team && u !== this
                );
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases focus/speed and decreases resist/presence",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Focus and speed increase", { target: this, properties: ["physical", "buff"], stats: { focus: 120, speed: 20 }, passive: true, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { target: this,properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, passive: true, focus: true, penalty: true });
            }
        }
    ],
    augment: [
        {
            name: "First Aid",
            properties: ["techno", "heal"],
            reduction: { energy: 10, energyRegen: 1 },
            description: `Heals lowlest hp ally slightly (~7.5% max HP) at start of turn`,
            code() {
                new Modifier("First Aid", `Heals at start of turn`,
                    { target: this, properties: ["techno", "heal"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.team === this.vars.caster.team), 'hp', 'percent', false), [.75]) }
                );
            }
        },
        {
            name: "Caring is Sharing",
            properties: ["techno", "buff"],
            reduction: { energy: 20, energyRegen: 2 },
            description: "Increases heal factor of all allies except self",
            code() {
                auraModifier("Caring is Sharing", "Increased heal factor for allies",
                    { targets: [], properties: ["techno", "buff"], listeners: { unitChange: true, waveChange: true }, reduction: this.skills.passive.reduction, passive: true },
                    function(target) { basicModifier("Caring is Sharing", "Increased heal factor", { target, properties: ["techno", "buff"], stats: { healFactor: 75 } }) },
                    (u) => u.team === this.team && u !== this
                );
            }
        },
        {
            name: "Prescription Stimulant",
            properties: ["techno", "conditional", "buff"],
            reduction: { energy: 20, energyRegen: 2 },
            description: "Gives offensive, defensive, or speed stimulants depending on target's stats for all allies, except self",
            code() {
                auraModifier("Prescription Stimulant", "Gives offensive, defensive, or speed stimulants depending on target's stats for allies",
                    { targets: [], properties: ["techno", "conditional", "buff"], listeners: { unitChange: true, waveChange: true }, reduction: this.skills.passive.reduction, passive: true },
                    function(target) { target.attack >= 37.5*1.5**(target.star-3) ? basicModifier("Prescription Stimulant: Offensive", "Attack, accuracy, and focus increase", { target, properties: ["techno", "buff"], stats: { attack:215, accuracy: 80, focus: 80 } }) : target.defense >= 37.5*1.5**(target.star-3) || target.evasion >= 125*1.5**(target.star-3) ? basicModifier("Prescription Stimulant: Defensive", "Defense, evasion, and presence increase", { target, properties: ["techno", "buff"], stats: { defense: 25, evasion: 80, presence: 180 } }) : basicModifier("Prescription Stimulant: Speed", "Evasion and speed increase", { target, properties: ["techno", "buff"], stats: { evasion: 140, speed: 90 } }) },
                    (u) => u.team === this.team && u !== this
                );
            }
        },
        {
            name: "Pursuit of Knowledge",
            properties: ["physical","buff", "penalty"],
            description: "Increases accuracy/focus/speed and decreases resist/presence",
            code() {
                basicModifier("Pursuit of Knowledge buff", "Accuracy, focus, and speed increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 30, focus: 120, speed: 30 }, passive: true, focus: true });
                basicModifier("Pursuit of Knowledge penalty", "Resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -10, presence: -20 }, passive: true, focus: true, penalty: true });
            }
        }
    ]
}

Doctor.defaultSkills = [
    { category: 'special', name: 'Medical Malpractice' },
    { category: 'basic', name: 'First Aid' },
    { category: 'secondary', name: 'Pursuit of Knowledge' },
    { category: 'passive', name: 'Prescription Stimulant' },
    { category: 'augment', name: 'Caring is Sharing' }
];