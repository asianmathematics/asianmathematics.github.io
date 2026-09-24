import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { allUnits, Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const Electric = new Unit("Electric", [1400, 30, 42, 140, 164, 175, 160, 140, 150, "front", 120, 80, 7, 60, 7, 150, 20], 4);

Electric.description = "4-star physical magitech unit with a lot of buff/debuff abilities and self buff skills";

Electric.skills = {
    special: [
        {
            name: "Electrostatic Discharge",
            properties: ["physical", "stamina-block", "stamina", "mystic", "mana-block", "mana", "techno", "energy-block", "energy", "attack", "conditional", "stun"],
            cost: { stamina: 15, mana: 5, energy: 40 },
            description: "Makes 12 attacks to a single target with increased focus. Adds a chance to stun for 1 turn if Paralytic Shock is active and increases accuracy and focus if Generate Charge or High Tech Headphones is active",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const mod = [modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this && m.vars.applied), modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied), modifiers.find(m => m.name === "Paralytic Shock" && m.vars.caster === this && m.vars.applied)];
                attack(this, target, 12, { attacker: { accuracy: { bonus: 50+(mod[0]?.vars.bonus[0] || 0)+(mod[1]?.vars.bonus[0] || 0)}, focus: { bonus: 75+(mod[0]?.vars.bonus[1] || 0)+(mod[1]?.vars.bonus[1] || 0) }} });
                if (mod[2] && resistDebuff(this, target)[0] >= mod[2].vars.bonus) stunModifier("Electrostatic Discharge: Stun", { target: target[0], duration: 1, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= mod[1].vars.bonus; } });
                basicModifier("Electrostatic Discharge", "Buffs certain skills", { target: this, duration: 2, properties: ["physical", "mystic", "techno"], listeners: { turnEnd: true }, focus: true , bonus: { accuracy: { mult: 2 }, focus: { mult: 3 } } });
            }
        },
        {
            name: "Sick Beats",
            properties: ["techno", "energy-block", "energy", "buff", "conditional"],
            cost: { energy: 40 },
            description: "Increases all allies, except self, speed and presence for 3 turns. Increases accuracy and focus if High Tech Headphones is active and increases evasion and resist if Electromagnetic Interference is active.",
            code() {
                for (const unit of allUnits.filter(u => u.team === this.team)) if (!refreshModifier([{ name: "Sick Beats", vars: { caster: this, target: unit, parent: this.skills.special } }])[0]) new Modifier("Sick Beats", "Speed and presence increase",
                    { target: unit, duration: 3, properties: ["techno", "buff", "conditional"], stats: { accuracy: 0, evasion: 0, focus: 0, resist: 0, speed: 80, presence: 200 }, listeners: { turnEnd: true, modifierStart: true, modifierEnd: true, cancel: true }, focus: true },
                    function() {
                        let mod;
                        if (mod = modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.accuracy += mod.vars.bonus[0];
                            this.vars.stats.focus += mod.vars.bonus[1];
                        }
                        if (mod = modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.evasion += mod.vars.bonus[0];
                            this.vars.stats.resist += mod.vars.bonus[1];
                        }
                        this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier?.caster === this.vars.caster) {
                            if (context.modifier.name === "High Tech Headphones") {
                                this.cancel(true, true);
                                this.vars.stats.accuracy += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.focus += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            if (context.modifier.name === "Electromagnetic Interference") {
                                this.cancel(true, true);
                                this.vars.stats.evasion += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.resist += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Electromagnetic Interference",
            properties: ["mystic", "mana-block", "mana", "techno", "energy-block", "energy", "debuff", "cancel", "conditional"],
            cost: { mana: 10, energy: 40 },
            description: "Ends non-passive techno modifiers target is focusing, cancels techno modifiers on target, and disables energy regen until resist at end of turn, 1% chance to fail. Adds additional targets depending on how many Sick Beat are active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 1+Math.floor(Math.sqrt(2*modifiers.filter(m => m.name.includes("Sick Beats") && m.vars.caster === this && m.vars.applied).length))); },
            code(targets) { targets.forEach(u => resistDebuff(this, [u])[0] >= 2 && attribCancelMod("Electromagnetic Interference", { target: u, properties: ["mystic", "techno", "debuff", "cancel", "energy-block"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; }, focus: true, bonus: [75, 90, 1] }, "techno", function(target) { return resistDebuff(this.vars.caster, [target])[0] < 25-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2] || 0); }, function (mod) { return mod.vars.caster === this.vars.caster; })); }
        },
        {
            name: "Paralytic Shock",
            properties: ["physical", "stamina-block", "stamina", "mystic", "mana-block", "mana", "techno", "energy-block", "energy", "stun", "conditional", "attack"],
            cost: { stamina: 15, mana: 5, energy: 40 },
            description: "Stuns target until resist at end of turn, 1% chance to fail. Can make an attack and skip chance to fail on hit if Electrostatic Discharge is active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const mod = modifiers.find(m => m.name === "Electrostatic Discharge" && m.vars.caster === this && m.vars.applied);
                if ((mod && attack(this, target, 1, { attacker: mod.vars.bonus })[0]) || resistDebuff(this, target)[0] >= 2) stunModifier("Paralytic Shock", { target: target[0], properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; }, bonus: 35 }, function(target) { return resistDebuff(this.vars.caster, [target])[0] < 35-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2]); });
            }
        },
        {
            name: "Generate Charge",
            properties: ["mystic", "mana-block", "mana", "energy-gain", "conditional"],
            cost: { mana: 20 },
            description: "Regen a lot of energy (~40% max energy). Increases energy gain if Electromagnetic Interference is active",
            code() {
                resourceChange(this, { energy: this.energyRegen*(4+(modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2] || 0)) }, true);
                basicModifier("Generate Charge", "Buffs certain skills", { target: this, duration: 2, properties: ["mystic", "techno"], listeners: { turnEnd: true }, focus: true, bonus: [50, 75] });
            }
        },
        {
            name: "High Tech Headphones",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "buff", "conditional"],
            cost: { stamina: 10, energy: 30 },
            description: "Increases accuracy, evasion, focus, resist, and speed for 6 turns. Increases duration by 2 turns if Generate Charge is active and an additional turn when Generate Charge is activated while this is active",
            code() {
                new Modifier("High Tech Headphones", "Accuracy, evasion, focus, resist, and speed increase",
                    { target: this, duration: 7+(2*modifiers.some(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied)), properties: ["physical", "techno"], listeners: { turnEnd: true, modifierStart: true }, stats: { accuracy: 80, evasion: 60, focus: 120, resist: 100, speed: 40 }, focus: true, bonus: [100, 60, 15] },
                    function() {},
                    function(context) {
                        if (context.modifier?.name === "Generate Charge" && context.modifier.vars.caster === this.vars.caster) this.vars.duration++;
                        if (this.vars.target === context.unit) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        }
    ],
    basic: [
        {
            name: "Electrostatic Discharge",
            properties: ["physical", "stamina-block", "mystic", "techno", "energy-block", "energy", "attack", "conditional", "stun"],
            cost: { energy: 20 },
            description: "Makes 7 attacks to a single target with increased focus. Adds a chance to stun for 1 turn if Paralytic Shock is active and increases accuracy and focus if High Tech Headphones is active",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), mod = [modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this && m.vars.applied), modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied), modifiers.find(m => m.name === "Paralytic Shock" && m.vars.caster === this && m.vars.applied)];
                attack(this, target, 7, { attacker: { accuracy: { bonus: (mod[0]?.vars.bonus[0] || 0)+(mod[1]?.vars.bonus[0] || 0) }, focus: { bonus: 50+(mod[0]?.vars.bonus[1] || 0)+(mod[1]?.vars.bonus[1] || 0) }} });
                if (mod[2] && resistDebuff(this, target)[0] >= mod[2].vars.bonus) stunModifier("Electrostatic Discharge: Stun", { target: target[0], duration: 1, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= mod[1].vars.bonus; } });
                basicModifier("Electrostatic Discharge", "Buffs certain skills", { target: this, duration: 2, properties: ["physical", "mystic", "techno"], listeners: { turnEnd: true }, focus: true, bonus: { focus: { mult: 3 } } });
            }
        },
        {
            name: "Sick Beats",
            properties: ["techno", "energy-block", "energy", "buff", "conditional"],
            description: "Increases 4 random ally's speed and presence for 4 turns. Increases accuracy and focus if High Tech Headphones is active and increases evasion and resist if Electromagnetic Interference is active.",
            code() {
                for (const unit of randTarget(allUnits.filter(u => u !== this && u.team === this.team), 4, true)) if (!refreshModifier([{ name: "Sick Beats", vars: { caster: this, target: unit, parent: this.skills.basic } }], 4)[0]) new Modifier("Sick Beats", "Speed and presence increase",
                    { target: unit, duration: 4, properties: ["techno", "buff", "conditional"], stats: { accuracy: 0, evasion: 0, focus: 0, resist: 0, speed: 60, presence: 150 }, listeners: { turnEnd: true, modifierStart: true, modifierEnd: true, cancel: true }, focus: true },
                    function() {
                        for (const mod of modifiers) {
                            if (mod.vars.caster === this.vars.caster && mod.vars.applied) {
                                if (mod.name === "High Tech Headphones") {
                                    this.vars.stats.accuracy += mod.vars.bonus[0];
                                    this.vars.stats.focus += mod.vars.bonus[1];
                                } else if (mod.name === "Electromagnetic Interference") {
                                    this.vars.stats.evasion += mod.vars.bonus[0];
                                    this.vars.stats.resist += mod.vars.bonus[1];
                                }
                            }
                        }
                        this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier?.caster === this.vars.caster) {
                            if (context.modifier.name === "High Tech Headphones") {
                                this.cancel(true, true);
                                this.vars.stats.accuracy += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.focus += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            if (context.modifier.name === "Electromagnetic Interference") {
                                this.cancel(true, true);
                                this.vars.stats.evasion += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.resist += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Electromagnetic Interference",
            properties: ["mystic", "mana-block", "techno", "energy-block", "energy", "debuff", "cancel", "conditional"],
            cost: { energy: 20 },
            description: "Chance to end non-passive techno modifiers target is focusing, cancel techno modifiers on target, and disable energy regen until resist at end of turn. Adds additional targets depending on how many Sick Beat are active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() { randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 1+Math.floor(Math.sqrt(2*modifiers.filter(m => m.name.includes("Sick Beats") && m.vars.caster === this && m.vars.applied).length))).forEach(u => resistDebuff(this, [u])[0] >= 25 && attribCancelMod("Electromagnetic Interference", { target: u, properties: ["mystic", "techno", "debuff", "cancel", "energy-block"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 25; }, focus: true, bonus: [50, 60, .5] }, "techno", function(target) { return resistDebuff(this.vars.caster, [target])[0] < 25-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2] || 0); }, function (mod) { return mod.vars.caster === this.vars.caster; })); }
        },
        {
            name: "Paralytic Shock",
            properties: ["physical", "stamina-block", "mystic", "techno", "energy-block", "energy", "stun", "conditional", "attack"],
            cost: { energy: 20 },
            description: "Chance to stun target until resist at end of turn. Can make an attack and skip chance to fail on hit if Electrostatic Discharge is active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), mod = modifiers.find(m => m.name === "Electrostatic Discharge" && m.vars.caster === this && m.vars.applied);
                if ((mod && attack(this, target, 1, { attacker: mod.vars.bonus })[0]) || resistDebuff(this, target)[0] >= 35) stunModifier("Paralytic Shock", { target: target[0], properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 35; }, bonus: 35 }, function(target) { return resistDebuff(this.vars.caster, [target])[0] < 35-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2]); });
            }
        },
        {
            name: "Generate Charge",
            properties: ["mystic", "mana-block", "mana", "energy-gain", "conditional"],
            cost: { mana: 10 },
            description: "Regen a lot of energy (~30% max energy). Increases energy gain if Electromagnetic Interference is active",
            code() {
                resourceChange(this, { energy: this.energyRegen*(3+(modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2] || 0)) }, true);
                basicModifier("Generate Charge", "Buffs certain skills", { target: this, duration: 2, properties: ["mystic", "techno"], listeners: { turnEnd: true }, focus: true, bonus: [30, 50] });
            }
        },
        {
            name: "High Tech Headphones",
            properties: ["physical", "stamina-block", "techno", "energy-block", "energy", "buff", "conditional"],
            description: "Increases accuracy, evasion, focus, resist, and speed for 3 turns. Increases duration by 2 turns if Generate Charge is active and an additional turn when Generate Charge is activated while this is active. If currently active, adds 3 more turns to duration",
            code() {
                if (refreshModifier([{ name: "High Tech Headphones", vars: { caster: this, target: this, parent: this.skills.basic } }], -3)[0]) new Modifier("High Tech Headphones", "Accuracy, evasion, focus, resist, and speed increase",
                        { target: this, duration: 4+(2*modifiers.some(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied)), properties: ["physical", "techno"], listeners: { turnEnd: true, modifierStart: true }, stats: { accuracy: 55, evasion: 40, focus: 80, resist: 65, speed: 30 }, focus: true, bonus: [75, 40, 10] },
                        function() {},
                        function(context) {
                            if (context.modifier?.name === "Generate Charge" && context.modifier.vars.caster === this.vars.caster) this.vars.duration++;
                            if (this.vars.target === context.unit) this.vars.duration--;
                            return this.vars.duration <= 0;
                        }
                    );
            }
        }
    ],
    secondary: [
        {
            name: "Electrostatic Discharge",
            properties: ["physical", "mystic", "techno", "energy-block", "energy", "attack", "conditional", "stun"],
            description: "Makes 4 attacks to a single target with increased focus. Adds a chance to stun for 1 turn if Paralytic Shock is active and increases accuracy and focus if High Tech Headphones is active",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), mod = [modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this && m.vars.applied), modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied), modifiers.find(m => m.name === "Paralytic Shock" && m.vars.caster === this && m.vars.applied)];
                attack(this, target, 4, { attacker: { accuracy: { bonus: (mod[0]?.vars.bonus[0] || 0)+(mod[1]?.vars.bonus[0] || 0) }, focus: { bonus: 25+(mod[0]?.vars.bonus[1] || 0)+(mod[1]?.vars.bonus[1] || 0) } } });
                if (mod[2] && resistDebuff(this, target)[0] >= mod[2].vars.bonus) stunModifier("Electrostatic Discharge: Stun", { target: target[0], duration: 1, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= mod[1].vars.bonus; } });
                basicModifier("Electrostatic Discharge", "Buffs certain skills", { target: this, duration: 2, properties: ["physical", "mystic", "techno"], listeners: { turnEnd: true }, focus: true, bonus: { focus: { mult: 2 } } });
            }
        },
        {
            name: "Sick Beats",
            properties: ["techno", "energy-block", "energy", "buff", "conditional"],
            description: "Increases a random ally's speed and presence for 4 turns. Increases accuracy and focus if High Tech Headphones is active and increases evasion and resist if Electromagnetic Interference is active.",
            code() {
                for (const unit of randTarget(allUnits.filter(u => u !== this && u.team === this.team), 1, true)) if (!refreshModifier([{ name: "Sick Beats", vars: { caster: this, target: unit, parent: this.skills.secondary } }])[0]) new Modifier("Sick Beats", "Speed and presence increase",
                    { target: unit, duration: 4, properties: ["techno", "buff", "conditional"], stats: { accuracy: 0, evasion: 0, focus: 0, resist: 0, speed: 40, presence: 100 }, listeners: { turnEnd: true, modifierStart: true, modifierEnd: true, cancel: true }, focus: true },
                    function() {
                        for (const mod of modifiers) {
                            if (mod.vars.caster === this.vars.caster && mod.vars.applied) {
                                if (mod.name === "High Tech Headphones") {
                                    this.vars.stats.accuracy += mod.vars.bonus[0];
                                    this.vars.stats.focus += mod.vars.bonus[1];
                                } else if (mod.name === "Electromagnetic Interference") {
                                    this.vars.stats.evasion += mod.vars.bonus[0];
                                    this.vars.stats.resist += mod.vars.bonus[1];
                                }
                            }
                        }
                        this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier?.caster === this.vars.caster) {
                            if (context.modifier.name === "High Tech Headphones") {
                                this.cancel(true, true);
                                this.vars.stats.accuracy += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.focus += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            if (context.modifier.name === "Electromagnetic Interference") {
                                this.cancel(true, true);
                                this.vars.stats.evasion += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.resist += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                        }
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Electromagnetic Interference",
            properties: ["mystic", "techno", "energy-block", "energy", "debuff", "cancel", "conditional"],
            description: "Chance to end non-passive techno modifiers target is focusing, cancel techno modifiers on target, and disable energy regen until resist at end of turn. Adds additional targets depending on how many Sick Beat are active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() { randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 1+Math.floor(Math.sqrt(2*modifiers.filter(m => m.name.includes("Sick Beats") && m.vars.caster === this && m.vars.applied).length))).forEach(u => resistDebuff(this, [u])[0] >= 40 && attribCancelMod("Electromagnetic Interference", { target: u, properties: ["mystic", "techno", "debuff", "cancel", "energy-block"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 40; }, focus: true, bonus: [25, 30, .25] }, "techno", function(target) { return resistDebuff(this.vars.caster, [target])[0] < 40-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2] || 0); }, function (mod) { return mod.vars.caster === this.vars.caster; })); }
        },
        {
            name: "Paralytic Shock",
            properties: ["physical", "mystic", "techno", "energy-block", "energy", "stun", "conditional", "attack"],
            description: "Chance to stun target until resist at end of turn. Can make an attack and skip chance to fail on hit if Electrostatic Discharge is active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), mod = modifiers.find(m => m.name === "Electrostatic Discharge" && m.vars.caster === this && m.vars.applied);
                if ((mod && attack(this, target, 1, { attacker: mod.vars.bonus })[0]) || resistDebuff(this, target)[0] >= 50) stunModifier("Paralytic Shock", { target: target[0], properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 50; }, bonus: 50 }, function(target) { return resistDebuff(this.vars.caster, [target])[0] < 50-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2]); });
            }
        },
        {
            name: "Generate Charge",
            properties: ["mystic", "mana-block", "mana", "energy-gain", "conditional"],
            description: "Regen a lot of energy (~20% max energy). Increases energy gain if Electromagnetic Interference is active",
            code() {
                resourceChange(this, { energy: this.energyRegen*(2+(modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2] || 0)) }, true);
                basicModifier("Generate Charge", "Buffs certain skills", { target: this, duration: 2, properties: ["mystic", "techno"], listeners: { turnEnd: true }, focus: true, bonus: [15, 25] });
            }
        },
        {
            name: "High Tech Headphones",
            properties: ["physical", "techno", "energy", "buff", "conditional"],
            description: "Increases accuracy, evasion, focus, resist, and speed for 2 turns. Increases duration by 2 turns if Generate Charge is active and an additional turn when Generate Charge is activated while this is active. If currently active, adds 2 more turns to duration",
            code() {
                if (!refreshModifier([{ name: "High Tech Headphones", vars: { caster: this, target: this, parent: this.skills.secondary } }], -2)[0]) new Modifier("High Tech Headphones", "Accuracy, evasion, focus, resist, and speed increase",
                        { target: this, duration: 3+(2*modifiers.some(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied)), properties: ["physical", "techno"], listeners: { turnEnd: true, modifierStart: true }, stats: { accuracy: 30, evasion: 25, focus: 40, resist: 35, speed: 20 }, focus: true, bonus: [50, 20, 5] },
                        function() {},
                        function(context) {
                            if (context.modifier?.name === "Generate Charge" && context.modifier.vars.caster === this.vars.caster) this.vars.duration++;
                            if (this.vars.target === context.unit) this.vars.duration--;
                            return this.vars.duration <= 0;
                        }
                    );
            }
        }
    ],
    passive: [
        {
            name: "Electrostatic Discharge",
            properties: ["physical", "mystic", "techno", "counter-attack", "auto-hit", "conditional", "stun"],
            reduction: { stamina: 10, energy: 30, energyRegen: 4 },
            description: "When hit with an attack against a frontline unit, deals counterdamage to the attacker. Adds a chance to stun for 1 turn if Paralytic Shock is active and increases damage if Generate Charge or High Tech Headphones is active",
            code() {
                new Modifier("Electrostatic Discharge", "Deals counterdamage when hit by frontline unit",
                    { target: this, properties: ["physical", "mystic", "techno", "counter-attack", "auto-hit", "conditional", "stun"], listeners: { turnEnd: true, singleDamage: true }, cancelListeners: ["turnEnd", "singleDamage"], reduction: this.skills.passive.reduction, focus: true, counterMap: {}, bonus: { focus: { mult: 3 } }, passive: true },
                    function() {},
                    function(context) {
                        if (currentAction.at(-2)?.[0].vars?.counterMap) return;
                        if (context.unit) {
                            Object.keys(this.vars.counterMap).forEach((k, i) => damage(this.vars.target, [allUnits.find(u => u.name === k)], [Array(this.vars.counterMap[k]).fill(0.5)], { attacker: { damage: (modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2] || 0)+(modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied)?.vars.bonus[0]/2 || 0) } }) && (i = modifiers.find(m => m.name === "Paralytic Shock" && m.vars.caster === this && m.vars.applied)) && resistDebuff(this, [k])[0] >= i.vars.bonus && stunModifier("Electrostatic Discharge: Stun", { target: k, duration: 1, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= i.vars.bonus; } }) );
                            this.vars.counterMap = {};
                        }
                        if (this.vars.target === context.defender && context.attacker.position === "front" && context.damageSingle) this.vars.counterMap[currentAction.at(-2)[1].name] = (this.vars.counterMap[currentAction.at(-2)[1].name] ?? 0) + 1;
                    },
                    function(_, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                Object.keys(this.vars.counterMap).forEach(k => damage(this.vars.target, [allUnits.find(u => u.name === k)], [Array(this.vars.counterMap[k]).fill(0.5)]));
                                this.vars.counterMap = {};
                                this.vars.applied = false;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Sick Beats",
            properties: ["techno", "energy", "buff", "conditional"],
            description: "At start of turn, increases speed and presence of a number of random alive allies by each third of filled energy. Increases accuracy and focus if High Tech Headphones is active and increases evasion and resist if Electromagnetic Interference is active.",
            code() {
                new Modifier("Sick Beats", "Speed and presence increase of allies",
                    { targets: [], properties: ["techno", "buff", "conditional"], stats: { accuracy: 0, evasion: 0, focus: 0, resist: 0, speed: 30, presence: 80 }, disableStatChange: true, listeners: { turnStart: true, modifierStart: true, modifierEnd: true, cancel: true }, focus: true, passive: true },
                    function() {
                        let mod;
                        if (mod = modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.accuracy += mod.vars.bonus[0];
                            this.vars.stats.focus += mod.vars.bonus[1];
                        }
                        if (mod = modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.evasion += mod.vars.bonus[0];
                            this.vars.stats.resist += mod.vars.bonus[1];
                        }
                        this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier?.caster === this.vars.caster) {
                            if (context.modifier.name === "High Tech Headphones") {
                                this.cancel(true, true);
                                this.vars.stats.accuracy += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.focus += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            if (context.modifier.name === "Electromagnetic Interference") {
                                this.cancel(true, true);
                                this.vars.stats.evasion += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.resist += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                            this.vars.child?.forEach(m => m.description = this.description.slice(0, -10));
                        }
                        if (context.unit === this.vars.caster) this.changeTarget(this.vars.targets, randTarget(allUnits.filter(u => u.hp && u !== this.vars.caster && u.team === this.vars.caster.team), Math.floor(3*this.vars.caster.energy/this.vars.caster.base.energy), true));
                    },
                    function(_, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                [...(this.vars.child || [])].forEach(m => removeModifier(m));
                                this.vars.applied = false;
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.targets.forEach(u => basicModifier("Sick Beats buff", this.description.slice(0, -10), { target: u, properties: ["techno", "buff"], stats: this.vars.stats }));
                                this.vars.applied = true;
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied) {
                            this.vars.child?.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            add.forEach(u => basicModifier("Sick Beats buff", this.description.slice(0, -10), { target: u, properties: ["techno", "buff"], stats: this.vars.stats }));
                        }
                        this.vars.targets = [...this.vars.targets.filter(target => !remove.includes(target)), ...add];
                    }
                );
            }
        },
        {
            name: "Electromagnetic Interference",
            properties: ["mystic", "techno", "energy-block", "energy", "debuff", "cancel", "conditional"],
            description: "At start of turn, chooses a target and has a chance to end non-passive techno modifiers target is focusing, cancel techno modifiers on target, and disable energy regen until resist at end of turn. Maximum active target depending on how many Sick Beat are active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() {
                new Modifier("Electromagnetic Interference", "Chance to apply cancel modifiers to targets at start of turn",
                    { targets: [], properties: ["mystic", "techno", "debuff", "cancel", "mana-block"], listeners: { turnEnd: true }, debuff: function(targets, calcMods) { return resistDebuff(this.vars.caster, targets, calcMods).forEach(w => w >= 50); }, focus: true, bonus: [20, 20, .25], passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.child?.length < Math.floor(Math.sqrt(2*modifiers.filter(m => m.name.includes("Sick Beats") && m.vars.caster === this && m.vars.applied).length+1))) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.vars.caster.team));
                            if (this.vars.debuff.call(this, target)[0]) this.changeTarget([], target);
                        }
                    },
                    function(_, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                [...(this.vars.child || [])].forEach(m => removeModifier(m));
                                this.vars.applied = false;
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.targets.forEach(u => attribCancelMod("Electromagnetic Interference", { target: u, properties: ["mystic", "techno", "debuff", "cancel", "energy-block"], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 50; } }, "techno", function(target) { return resistDebuff(this.vars.caster, [target])[0] < 50-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2] || 0); }, function (mod) { return mod.vars.caster === this.vars.caster; }));
                                this.vars.applied = true;
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied) {
                            this.vars.child?.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            add.forEach(u => attribCancelMod("Electromagnetic Interference", { target: u, properties: ["mystic", "techno", "debuff", "cancel", "energy-block"], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 50; } }, "techno", function(target) { return resistDebuff(this.vars.caster, [target])[0] < 50-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2] || 0); }, function (mod) { return mod.vars.caster === this.vars.caster; }));
                        }
                        this.vars.targets = [...this.vars.targets.filter(target => !remove.includes(target)), ...add];
                    }
                );
            }
        },
        {
            name: "Paralytic Shock",
            properties: ["physical", "mystic", "techno", "energy-block", "energy", "stun", "conditional", "attack"],
            reduction: { mana: 10, energy: 30, energyRegen: 4 },
            description: "At start of turn, chooses a target and has a chance to stun target until resist at end of turn. Can make an attack and skip chance to fail on hit if Electrostatic Discharge is active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() {
                new Modifier("Paralytic Shock", "Chance to stun a target at start of turn",
                    { target: null, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnStart: true }, reduction: this.skills.passive.reduction, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 65-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2] || 0); }, bonus: 65, fail: false, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.vars.caster.team))[0], mod = modifiers.find(m => m.name === "Electrostatic Discharge" && m.vars.caster === this.vars.caster && m.vars.applied), will = (mod ? attack(this.vars.caster, [target], 1, mod.vars.bonus)[0] : 0) || this.vars.debuff.call(this, target);
                            if (target !== this.vars.target) this.changeTarget(target);
                            if (this.vars.fail && will) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && !will) this.cancel(this.vars.fail = true);
                        }
                    },
                    function(_, temp) {
                        if (!this.vars.target) {
                            this.vars.applied = !this.vars.cancel;
                            return;
                        }
                        if (this.vars.cancel && this.vars.applied) {
                            this.vars.applied = false;
                            if (eventState.stun.length) handleEvent("stun", { unit: this.vars.target, stun: false, temp });
                            this.vars.target.stun--;
                            for (const mod of this.vars.modifiers) {
                                currentAction.push([mod, mod.vars.caster]);
                                mod.cancel(false);
                                currentAction.pop();
                            }
                            this.vars.modifiers = [];
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            this.vars.applied = true;
                            if (eventState.stun.length) handleEvent("stun", { unit: this.vars.target, stun: true, temp });
                            this.vars.target.stun++;
                            for (const mod of this.vars.modifiers = modifiers.filter(m => m.vars.caster === this.vars.target && m.vars.focus)) {
                                currentAction.push([mod, mod.vars.caster]);
                                mod.cancel();
                                currentAction.pop();
                            }
                        }
                    },
                    function(unit) {
                        if (this.vars.target === unit) {
                            this.cancel(true, true);
                            unit = null;
                            this.cancel(false, true);
                        } else {
                            if (this.vars.applied) {
                                this.cancel(true, true);
                                this.vars.target = unit;
                                this.cancel(false, true);
                            } else this.vars.target = unit;
                        }
                    }
                );
            }
        },
        {
            name: "Generate Charge",
            properties: ["mystic", "mana", "energy-gain", "conditional"],
            reduction: { mana: 15, manaRegen: 2 },
            description: "Regen energy (~15% max energy). Increases energy gain if Electromagnetic Interference is active",
            code() {
                new Modifier("Backup Power", `Regen energy (~15% max energy) each turn`,
                    { target: this, properties: ["physical", "energy-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.passive.reduction, bonus: [10, 20], focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.target, { energy: this.vars.target.energyRegen*(1.5+(modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2] || 0)) }, true); }
                );
            }
        },
        {
            name: "High Tech Headphones",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "buff", "conditional"],
            description: "Increases accuracy, evasion, focus, resist, and speed. Increases stat increases if Generate Charge is active",
            code() {
                new Modifier("High Tech Headphones", "Accuracy, evasion, focus, resist, and speed increase",
                    { target: this, properties: ["physical", "techno"], listeners: { modifierStart: true, modifierEnd: true, cancel: true }, stats: { accuracy: 25, evasion: 20, focus: 35, resist: 30, speed: 15 }, focus: true, bonus: [25, 10, 5], passive: true },
                    function() {
                        const mod = modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied);
                        if (mod) for (const stat in this.vars.stats) this.vars.stats[stat] += (mod.vars.bonus[0]+mod.vars.bonus[1])/5;
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier.caster === this.vars.caster && context.modifier.name === "Generate Charge") {
                            this.cancel(true, true);
                            for (const stat in this.vars.stats) this.vars.stats[stat] += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*(context.modifier.vars.bonus[0]+context.modifier.vars.bonus[1])/5;
                            this.cancel(false, true);
                        }
                    }
                );
            }
        }
    ],
    augment: [
        {
            name: "Sick Beats",
            properties: ["techno", "energy", "buff", "conditional"],
            description: "At start of turn, increases speed and presence of a number of random alive allies by each third of filled energy. Increases accuracy and focus if High Tech Headphones is active and increases evasion and resist if Electromagnetic Interference is active.",
            code() {
                new Modifier("Sick Beats", "Speed and presence increase of allies",
                    { targets: [], properties: ["techno", "buff", "conditional"], stats: { accuracy: 0, evasion: 0, focus: 0, resist: 0, speed: 50, presence: 120 }, disableStatChange: true, listeners: { turnStart: true, modifierStart: true, modifierEnd: true, cancel: true }, focus: true, passive: true },
                    function() {
                        let mod;
                        if (mod = modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.accuracy += mod.vars.bonus[0];
                            this.vars.stats.focus += mod.vars.bonus[1];
                        }
                        if (mod = modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.evasion += mod.vars.bonus[0];
                            this.vars.stats.resist += mod.vars.bonus[1];
                        }
                        this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier?.caster === this.vars.caster) {
                            if (context.modifier.name === "High Tech Headphones") {
                                this.cancel(true, true);
                                this.vars.stats.accuracy += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.focus += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            if (context.modifier.name === "Electromagnetic Interference") {
                                this.cancel(true, true);
                                this.vars.stats.evasion += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0];
                                this.vars.stats.resist += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1];
                                this.cancel(false, true);
                            }
                            this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                            this.vars.child?.forEach(m => m.description = this.description.slice(0, -10));
                        }
                        if (context.unit === this.vars.caster) this.changeTarget(this.vars.targets, randTarget(allUnits.filter(u => u.hp && u !== this.vars.caster && u.team === this.vars.caster.team), Math.floor(3*this.vars.caster.energy/this.vars.caster.base.energy), true));
                    },
                    function(_, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                [...(this.vars.child || [])].forEach(m => removeModifier(m));
                                this.vars.applied = false;
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.targets.forEach(u => basicModifier("Sick Beats buff", this.description.slice(0, -10), { target: u, properties: ["techno", "buff"], stats: this.vars.stats }));
                                this.vars.applied = true;
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied) {
                            this.vars.child?.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            add.forEach(u => basicModifier("Sick Beats buff", this.description.slice(0, -10), { target: u, properties: ["techno", "buff"], stats: this.vars.stats }));
                        }
                        this.vars.targets = [...this.vars.targets.filter(target => !remove.includes(target)), ...add];
                    }
                );
            }
        },
        {
            name: "Generate Charge",
            properties: ["mystic", "mana", "energy-gain", "conditional"],
            reduction: { mana: 15, manaRegen: 2 },
            description: "Regen energy (~20% max energy). Increases energy gain if Electromagnetic Interference is active",
            code() {
                new Modifier("Backup Power", `Regen energy (~15% max energy) each turn`,
                    { target: this, properties: ["physical", "energy-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.augment.reduction, bonus: [20, 40], focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.target, { energy: this.vars.target.energyRegen*(2+(modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2] || 0)) }, true); }
                );
            }
        },
        {
            name: "High Tech Headphones",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "buff", "conditional"],
            description: "Increases accuracy, evasion, focus, resist, and speed. Increases stat increases if Generate Charge is active",
            code() {
                new Modifier("High Tech Headphones", "Accuracy, evasion, focus, resist, and speed increase",
                    { target: this, properties: ["physical", "techno"], listeners: { modifierStart: true, modifierEnd: true, cancel: true }, stats: { accuracy: 35, evasion: 30, focus: 45, resist: 40, speed: 25 }, focus: true, bonus: [75, 30, 10], passive: true },
                    function() {
                        const mod = modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied);
                        if (mod) for (const stat in this.vars.stats) this.vars.stats[stat] += (mod.vars.bonus[0]+mod.vars.bonus[1])/5;
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier.caster === this.vars.caster && context.modifier.name === "Generate Charge") {
                            this.cancel(true, true);
                            for (const stat in this.vars.stats) this.vars.stats[stat] += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*(context.modifier.vars.bonus[0]+context.modifier.vars.bonus[1])/5;
                            this.cancel(false, true);
                        }
                    }
                );
            }
        }
    ],
    conditional: [
        {
            name: "Electrostatic Discharge",
            properties: ["physical", "mystic", "techno", "counter-attack", "auto-hit", "conditional", "stun"],
            reduction: { stamina: 10, energy: 30, energyRegen: 4 },
            description: "When hit with an attack against a frontline unit, deals counterdamage to the attacker. Adds a chance to stun for 1 turn if Paralytic Shock is active and increases damage if Generate Charge or High Tech Headphones is active",
            code() {
                new Modifier("Electrostatic Discharge", "Deals counterdamage when hit by frontline unit",
                    { target: this, properties: ["physical", "mystic", "techno", "counter-attack", "auto-hit", "conditional", "stun"], listeners: { turnEnd: true, singleDamage: true }, cancelListeners: ["turnEnd", "singleDamage"], reduction: this.skills.conditional.reduction, focus: true, counterMap: {}, bonus: { focus: { mult: 3 } }, passive: true },
                    function() {},
                    function(context) {
                        if (currentAction.at(-2)?.[0].vars?.counterMap) return;
                        if (context.unit) {
                            Object.keys(this.vars.counterMap).forEach((k, i) => damage(this.vars.target, [allUnits.find(u => u.name === k)], [Array(this.vars.counterMap[k]).fill(0.5)], { attacker: { damage: (modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2]*1.5 || 0)+(modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied)?.vars.bonus[0] || 0) } }) && (i = modifiers.find(m => m.name === "Paralytic Shock" && m.vars.caster === this && m.vars.applied)) && resistDebuff(this, [k])[0] >= i.vars.bonus-10 && stunModifier("Electrostatic Discharge: Stun", { target: k, duration: 1, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= i.vars.bonus-10; } }) );
                            this.vars.counterMap = {};
                        }
                        if (this.vars.target === context.defender && context.attacker.position === "front" && context.damageSingle) this.vars.counterMap[currentAction.at(-2)[1].name] = (this.vars.counterMap[currentAction.at(-2)[1].name] ?? 0) + 1;
                    },
                    function(_, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                Object.keys(this.vars.counterMap).forEach((k, i) => damage(this.vars.target, [allUnits.find(u => u.name === k)], [Array(this.vars.counterMap[k]).fill(0.5)], { attacker: { damage: (modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2]*1.5 || 0)+(modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied)?.vars.bonus[0] || 0) } }) && (i = modifiers.find(m => m.name === "Paralytic Shock" && m.vars.caster === this && m.vars.applied)) && resistDebuff(this, [k])[0] >= i.vars.bonus-10 && stunModifier("Electrostatic Discharge: Stun", { target: k, duration: 1, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= i.vars.bonus-10; } }) );
                                this.vars.counterMap = {};
                                this.vars.applied = false;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.applied = true;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    }
                );
            }
        },
        {
            name: "Sick Beats",
            properties: ["techno", "energy", "buff", "conditional"],
            description: "At start of turn, increases speed and presence of a number of random alive allies by each third of filled energy. Increases accuracy and focus if High Tech Headphones is active and increases evasion and resist if Electromagnetic Interference is active.",
            code() {
                new Modifier("Sick Beats", "Speed and presence increase of allies",
                    { targets: [], properties: ["techno", "buff", "conditional"], stats: { accuracy: 0, evasion: 0, focus: 0, resist: 0, speed: 30, presence: 80 }, disableStatChange: true, listeners: { turnStart: true, modifierStart: true, modifierEnd: true, cancel: true }, focus: true, passive: true },
                    function() {
                        let mod;
                        if (mod = modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.accuracy += mod.vars.bonus[0]*2;
                            this.vars.stats.focus += mod.vars.bonus[1]*2;
                        }
                        if (mod = modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this.vars.caster && m.vars.applied)) {
                            this.vars.stats.evasion += mod.vars.bonus[0]*2;
                            this.vars.stats.resist += mod.vars.bonus[1]*2;
                        }
                        this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier?.caster === this.vars.caster) {
                            if (context.modifier.name === "High Tech Headphones") {
                                this.cancel(true, true);
                                this.vars.stats.accuracy += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0]*2;
                                this.vars.stats.focus += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1]*2;
                                this.cancel(false, true);
                            }
                            if (context.modifier.name === "Electromagnetic Interference") {
                                this.cancel(true, true);
                                this.vars.stats.evasion += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[0]*2;
                                this.vars.stats.resist += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*context.modifier.vars.bonus[1]*2;
                                this.cancel(false, true);
                            }
                            this.description = Object.keys(this.vars.stats).filter(s => this.vars.stats[s]).join(", ") + " increase";
                            this.vars.child?.forEach(m => m.description = this.description.slice(0, -10));
                        }
                        if (context.unit === this.vars.caster) this.changeTarget(this.vars.targets, randTarget(allUnits.filter(u => u.hp && u !== this.vars.caster && u.team === this.vars.caster.team), Math.floor(3*this.vars.caster.energy/this.vars.caster.base.energy), true));
                    },
                    function(_, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                [...(this.vars.child || [])].forEach(m => removeModifier(m));
                                this.vars.applied = false;
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.targets.forEach(u => basicModifier("Sick Beats buff", this.description.slice(0, -10), { target: u, properties: ["techno", "buff"], stats: this.vars.stats }));
                                this.vars.applied = true;
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied) {
                            this.vars.child?.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            add.forEach(u => basicModifier("Sick Beats buff", this.description.slice(0, -10), { target: u, properties: ["techno", "buff"], stats: this.vars.stats }));
                        }
                        this.vars.targets = [...this.vars.targets.filter(target => !remove.includes(target)), ...add];
                    }
                );
            }
        },
        {
            name: "Electromagnetic Interference",
            properties: ["mystic", "techno", "energy-block", "energy", "debuff", "cancel", "conditional"],
            description: "At start of turn, chooses a target and has a chance to end non-passive techno modifiers target is focusing, cancel techno modifiers on target, and disable energy regen until resist at end of turn. Maximum active target depending on how many Sick Beat are active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() {
                new Modifier("Electromagnetic Interference", "Chance to apply cancel modifiers to targets at start of turn",
                    { targets: [], properties: ["mystic", "techno", "debuff", "cancel", "mana-block"], listeners: { turnEnd: true }, debuff: function(targets, calcMods) { return resistDebuff(this.vars.caster, targets, calcMods).forEach(w => w >= 40); }, focus: true, bonus: [20, 20, .25], passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.child?.length < Math.floor(modifiers.filter(m => m.name.includes("Sick Beats") && m.vars.caster === this && m.vars.applied).length/2)+1) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.vars.caster.team));
                            if (this.vars.debuff.call(this, target)[0]) this.changeTarget([], target);
                        }
                    },
                    function(_, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                [...(this.vars.child || [])].forEach(m => removeModifier(m));
                                this.vars.applied = false;
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                this.vars.targets.forEach(u => attribCancelMod("Electromagnetic Interference", { target: u, properties: ["mystic", "techno", "debuff", "cancel", "energy-block"], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 40; } }, "techno", function(target) { return resistDebuff(this.vars.caster, [target])[0] < 40-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2]*7/5 || 0); }, function (mod) { return mod.vars.caster === this.vars.caster; }));
                                this.vars.applied = true;
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied) {
                            this.vars.child?.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            add.forEach(u => attribCancelMod("Electromagnetic Interference", { target: u, properties: ["mystic", "techno", "debuff", "cancel", "energy-block"], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 40; } }, "techno", function(target) { return resistDebuff(this.vars.caster, [target])[0] < 40-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2]*7/5 || 0); }, function (mod) { return mod.vars.caster === this.vars.caster; }));
                        }
                        this.vars.targets = [...this.vars.targets.filter(target => !remove.includes(target)), ...add];
                    }
                );
            }
        },
        {
            name: "Paralytic Shock",
            properties: ["physical", "mystic", "techno", "energy-block", "energy", "stun", "conditional", "attack"],
            reduction: { mana: 10, energy: 30, energyRegen: 4 },
            description: "At start of turn, chooses a target and has a chance to stun target until resist at end of turn. Can make an attack and skip chance to fail on hit if Electrostatic Discharge is active and makes end of turn debuff harder to resist if High Tech Headphones is active",
            code() {
                new Modifier("Paralytic Shock", "Chance to stun a target at start of turn",
                    { target: null, properties: ["physical", "mystic", "techno", "stun"], listeners: { turnStart: true }, reduction: this.skills.conditional.reduction, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 45-(modifiers.find(m => m.name === "High Tech Headphones" && m.vars.caster === this.vars.caster && m.vars.applied)?.vars.bonus[2]*7/5 || 0); }, bonus: 45, fail: false, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.vars.caster.team))[0], mod = modifiers.find(m => m.name === "Electrostatic Discharge" && m.vars.caster === this.vars.caster && m.vars.applied), will = (mod ? attack(this.vars.caster, [target], 1, mod.vars.bonus)[0] : 0) || this.vars.debuff.call(this, target);
                            if (target !== this.vars.target) this.changeTarget(target);
                            if (this.vars.fail && will) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && !will) this.cancel(this.vars.fail = true);
                        }
                    },
                    function(_, temp) {
                        if (!this.vars.target) {
                            this.vars.applied = !this.vars.cancel;
                            return;
                        }
                        if (this.vars.cancel && this.vars.applied) {
                            this.vars.applied = false;
                            if (eventState.stun.length) handleEvent("stun", { unit: this.vars.target, stun: false, temp });
                            this.vars.target.stun--;
                            for (const mod of this.vars.modifiers) {
                                currentAction.push([mod, mod.vars.caster]);
                                mod.cancel(false);
                                currentAction.pop();
                            }
                            this.vars.modifiers = [];
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            this.vars.applied = true;
                            if (eventState.stun.length) handleEvent("stun", { unit: this.vars.target, stun: true, temp });
                            this.vars.target.stun++;
                            for (const mod of this.vars.modifiers = modifiers.filter(m => m.vars.caster === this.vars.target && m.vars.focus)) {
                                currentAction.push([mod, mod.vars.caster]);
                                mod.cancel();
                                currentAction.pop();
                            }
                        }
                    },
                    function(unit) {
                        if (this.vars.target === unit) {
                            this.cancel(true, true);
                            unit = null;
                            this.cancel(false, true);
                        } else {
                            if (this.vars.applied) {
                                this.cancel(true, true);
                                this.vars.target = unit;
                                this.cancel(false, true);
                            } else this.vars.target = unit;
                        }
                    }
                );
            }
        },
        {
            name: "Generate Charge",
            properties: ["mystic", "energy-gain", "conditional"],
            reduction: { mana: 15, manaRegen: 2 },
            description: "Regen energy (~15% max energy). Increases energy gain if Electromagnetic Interference is active",
            code() {
                new Modifier("Backup Power", `Regen energy (~15% max energy) each turn`,
                    { target: this, properties: ["physical", "energy-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.skills.conditional.reduction, bonus: [10, 20], focus: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.target, { energy: this.vars.target.energyRegen*(1.5+(modifiers.find(m => m.name === "Electromagnetic Interference" && m.vars.caster === this && m.vars.applied)?.vars.bonus[2]*2 || 0)) }, true); }
                );
            }
        },
        {
            name: "High Tech Headphones",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "buff", "conditional"],
            description: "Increases accuracy, evasion, focus, resist, and speed. Increases stat increases if Generate Charge is active",
            code() {
                new Modifier("High Tech Headphones", "Accuracy, evasion, focus, resist, and speed increase",
                    { target: this, properties: ["physical", "techno"], listeners: { modifierStart: true, modifierEnd: true, cancel: true }, stats: { accuracy: 25, evasion: 20, focus: 35, resist: 30, speed: 15 }, focus: true, bonus: [50, 20, 10], passive: true },
                    function() {
                        const mod = modifiers.find(m => m.name === "Generate Charge" && m.vars.caster === this && m.vars.applied);
                        if (mod) for (const stat in this.vars.stats) this.vars.stats[stat] += 2*(mod.vars.bonus[0]+mod.vars.bonus[1])/5;
                    },
                    function(context) {
                        if (context.temp || context.modifier === this) return;
                        if (context.modifier.caster === this.vars.caster && context.modifier.name === "Generate Charge") {
                            this.cancel(true, true);
                            for (const stat in this.vars.stats) this.vars.stats[stat] += ((context.event === "modifierStart") || (context.cancel === false) ? 1 : -1)*(context.modifier.vars.bonus[0]+context.modifier.vars.bonus[1])/5;
                            this.cancel(false, true);
                        }
                    }
                );
            }
        }
    ]
};


Electric.defaultSkills = [
    { category: 'special', name: 'Sick Beats' },
    { category: 'basic', name: 'Electrostatic Discharge' },
    { category: 'secondary', name: 'High Tech Headphones' },
    { category: 'passive', name: 'Electromagnetic Interference' },
    { category: 'augment', name: 'Generate Charge' },
    { category: 'conditional', name: 'Paralytic Shock' }
];

Electric.synergy = [
    {
        name: "Timelinear Teamwork",
        properties: ["synergy", "physical", "buff"],
        description: "Boosts the stats of ally timelinears",
        targets: ["Mannequin", "Silhouette"],
        code() {
            new Modifier("Timelinear Teamwork", "Boosts the stats of ally timelinears",
                { targets: [], properties: ["physical", "buff"], listeners: { waveChange: true }, stats: {}, disableStatChange: true, passive: true, synergy: true },
                function() {},
                function() {
                    if (this.vars.listeners) {
                        eventState.waveChange.splice(eventState.waveChange.indexOf(this), 1);
                        delete this.vars.listeners;
                    }
                    if (!this.vars.applied) return;
                    for (const unit of allUnits) if (unit.team === this.vars.caster.team && !unit.custom?.summoner) switch (unit.source.name) {
                        case "Mannequin":
                            this.vars.targets.push(unit);
                            basicModifier("Timelinear Teamwork: Mannequin buff", "Defense, resist, and presence increase", { target: unit, properties: ["physical", "buff"], stats: { defense: 16, resist: 55, presence: 50 }, synergy: true });
                            this.vars.stats.accuracy = (this.vars.stats.accuracy ?? 0) + 35;
                            this.vars.stats.speed = (this.vars.stats.speed ?? 0) + 36;
                            break;
                        case "Silhouette":
                            this.vars.targets.push(unit);
                            basicModifier("Timelinear Teamwork: Silhouette buff", "Attack, Defense, and presence increase", { target: unit, properties: ["physical", "buff"], stats: { attack: 13, defense: 17, presence: 50 }, synergy: true });
                            this.vars.stats.evasion = (this.vars.stats.evasion ?? 0) + 32;
                            this.vars.stats.focus = (this.vars.stats.focus ?? 0) + 39;
                            break;
                    }
                    if (!this.vars.targets.length) return !(this.vars.synergy = false);
                    basicModifier("Timelinear Teamwork: buff", Object.keys(this.vars.stats).join(', ') + " increase", { target: this.vars.caster, properties: ["physical", "buff"], stats: this.vars.stats, synergy: true });
                },
                function(_, temp) {
                    if (!temp) {
                        if (this.vars.cancel && this.vars.applied) {
                            [...(this.vars.child || [])].forEach(m => removeModifier(m));
                            this.vars.applied = false;
                        } else if (!this.vars.cancel && !this.vars.applied) {
                            this.vars.applied = true;
                            this.vars.targets = [];
                            this.vars.stats = {};
                            this.onturn();
                        }
                    }
                }
            );
        }
    }
]