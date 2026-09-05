import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const Revolutionary = new Unit("Revolutionary", [850, 50, 20, 130, 90, 150, 65, 90, 55, "mid", 75, 150, 18], 3, ["passion/hatred"]);

Revolutionary.skills = {
    special: [
        {
            name: "Focus Fire",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource"],
            cost: { stamina: 40 },
            description: "Attacks a single target 4 times with increased attack/accuracy/focus, adds two attacks and extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                const bonus = this.custom?.focusFire ? !!this.custom.focusFire-- : 0;
                attack(this, target, 4 + 2*bonus, { attacker: { attack: { bonus: 50*(1 + bonus) }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
            }
        },
        {
            name: "Flashbang",
            properties: ["physical", "stamina-block", "stamina", "debuff", "stun"],
            cost: { stamina: 40, position: "front" },
            description: "Decrease target accuracy/evasion/speed for a few turns depending on chance and stuns target for 1 turn, 1% chance to fail, increases stun duration by 1 if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                const will = resistDebuff(this, target)[0];
                if (will >= 2) {
                    basicModifier("Flashbang debuff", "Accuracy, evasion, and speed decrease", { target: target[0], duration: will > 99 ? 6 : Math.ceil(will/25), properties: ["physical", "debuff"], stats: { accuracy: -30, evasion: -60, speed: -25 }, listeners: { turnStart: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } });
                    stunModifier("Flashbang", { target: target[0], duration: this.custom?.flashbang ? this.custom.flashbang-- && 2 : 1, properties: ["physical", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } });
                } else logAction(`${target[0].name} resists the flashbang!`, "miss");
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina-block", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40, position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, adds extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.team !== this.team)) },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: this.custom?.snipe ? this.custom.snipe-- && 90 : 60 }, accuracy: { bonus: 70 }, focus: { bonus: 80 } } }) }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina-block", "stamina", "pseudo-resource"],
            cost: { stamina: 50 },
            description: `Ignore reload mechanic for next 5 turns, reloads attacks afterwards. If currently active, refreshes duration and refund 10 stamina for each turn remaining`,
            code() {
                const dur = refreshModifier([{ name: "Reload", vars: { caster: this, target: this, parent: this.skills.special }}], 5)[0];
                dur ? resourceChange(this, { stamina: 10*dur }) : logAction(`${this.name}'s weapons turn automatic!`, "buff") || new Modifier("Reload", `Ignores reload mechanic`,
                    { target: this, duration: 5, properties: ["physical", "pseudo-resource"], listeners: { turnStart: true }, focus: true },
                    function() {
                        this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
                        this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                        this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                        logAction(`${this.vars.target.name} reloads all weapons!`, "buff");
                    },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.custom?.dualWield !== undefined && (this.custom.dualWield = 1);
                            this.custom?.snipe !== undefined && (this.custom.snipe = 1);
                            this.custom?.focusFire !== undefined && (this.custom.focusFire = 1);
                            this.vars.duration--;
                        }
                        if (this.vars.duration <= 0);
                    }
                );
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "stamina-block", "stamina", "debuff"],
            cost: { stamina: 20 },
            description: "Decreases target evasion, focus, and resist and increase chance for caster to be targeted by target for a few turns, 1% chance to fail, can target backline if at frontline",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                let will = resistDebuff(this, target)[0];
                if (will >= 2) {
                    logAction(`${this.name} taunts ${target[0].name}!`, "debuff");
                    new Modifier("Taunt", "Decreases target evasion, focus, and resist and increase chance for caster to be targeted by target",
                       { target: target[0], duration: will > 99 ? 6 : Math.ceil(will/25), properties: ["physical", "debuff"], stats: { evasion: -20, focus: -35, resist: -25 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 2 } },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult++;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration > 0;
                        }
                    );
                } else logAction(`${this.name} fails to taunt ${target[0].name}!`, "miss");
            }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 30 },
            description: "Increases accuracy/focus and decreases resist/presence for 5 turns",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { accuracy: 160, focus: 160 }, listeners: { turnEnd: true } });
                basicModifier("Made to Serve penalty", "Resist and presence decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { resist: -40, presence: -80 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases attack/evasion and decreases resist/presence for 5 turns",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 45, evasion: 80 }, listeners: { turnEnd: true } });
                basicModifier("Private Military penalty", "Resist and presence decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { resist: -30, presence: -60 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina-block", "stamina", "positional"],
            cost: { stamina: 10 },
            description: "Switch between front and backline positions and immediately gain next turn",
            code() {
                this.switchPosition();
                this.timer -= 1000;
            }
        }
    ],
    basic: [
        {
            name: "Focus Fire",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource"],
            description: "Attacks a single target 2 times with increased attack/accuracy/focus, adds an extra attack and attack if reloaded",
            code() {
                const bonus = this.custom?.focusFire ? !!this.custom.focusFire-- : 0;
                attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2 + bonus, { attacker: { attack: { bonus: 25*(1 + bonus) }, accuracy: { bonus: 15 }, focus: { bonus: 20 } } });
            }
        },
        {
            name: "Flashbang",
            properties: ["physical", "stamina-block", "debuff", "stun"],
            cost: { position: "front" },
            description: "Chance to decrease target evasion/speed for a few turns depending on chance and smaller chance to stun target for 1 turn",
            code() {
                (this.custom ??= {}).flashbang ??= 1;
                if (this.custom.flashbang) {
                    this.custom.flashbang--;
                    const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), will = resistDebuff(this, target)[0];
                    switch (true) {
                        case will >= 50:
                            stunModifier("Flashbang", { target: target[0], duration: 1, properties: ["physical", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 75 } });
                        case will >= 20:
                            basicModifier("Flashbang debuff", "Evasion, and speed decrease", { target: target[0], duration: will > 99 ? 4 : Math.ceil(will/50), properties: ["physical", "debuff"], stats: { evasion: -30, speed: -15 }, listeners: { turnStart: true }, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 20 } });
                            break;
                        default:
                            logAction(`${target[0].name} resists the flashbang!`, "miss");
                    }
                } else {
                    this.custom.flashbang++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} pulls out another flashbang!`, "info");
                }
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource"],
            cost: { position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, requires reload to be used again",
            code() {
                (this.custom ??= {}).snipe ??= 1;
                if (this.custom.snipe) this.custom.snipe--, attack(this, randTarget(allUnits.filter(u => u.hp && u.team !== this.team)), 1, { attacker: { attack: { bonus: 30 }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
                else {
                    this.custom.snipe++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} is reloading a weapon!`, "info");
                }
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "stamina-block", "debuff"],
            description: "Chance to decrease target focus and resist and double the chance for caster to be targeted by target for a 1 turn, can target backline if at frontline",
            code() {
                let target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && (this.position === "front" || u.position === "front"))), will = resistDebuff(this, target)[0];
                if (will >= 20) {
                    logAction(`${this.name} distracts ${target[0].name}`, "debuff");
                    new Modifier("Taunt", "Decreases target focus, and resist and doubles the chance for caster to be targeted by target",
                       { target: target[0], duration: 1, properties: ["physical", "debuff"], stats: { focus: -25, resist: -10 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 20 } },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration > 0;
                        }
                    );
                } else logAction(`${this.name} fails to distract ${target[0].name}`, "miss");
            }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Made to Serve buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Made to Serve penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Made to Serve buff", "Accuracy and focus increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { accuracy: 120, focus: 120 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Made to Serve penalty", "Resist and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { resist: -30, presence: -60 }, listeners: { turnEnd: true }, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Private Military buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Private Military penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Private Military buff", "Attack and evasion increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 30, evasion: 60 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Private Military penalty", "Resist and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, listeners: { turnEnd: true }, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina-block", "positional"],
            description: "Switch between front & backline positions and reduce timer by 50% for next turn",
            code() {
                this.switchPosition();
                this.timer -= 500;
            }
        }
    ],
    secondary: [
        {
            name: "Reload",
            properties: ["physical", "pseudo-resource"],
            description: `Reloads all attacks`,
            code() {
                this.custom?.flashbang !== undefined && (this.custom.flashbang = 2);
                this.custom?.snipe !== undefined && (this.custom.snipe = 2);
                this.custom?.focusFire !== undefined && (this.custom.focusFire = 2);
                logAction(`${this.name} reloads all attacks.`, "action");
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "debuff"],
            description: "Chance to decrease target focus and double the chance for caster to be targeted by target for a 1 turn",
            code() {
                let target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), will = resistDebuff(this, target)[0];
                if (will > 33) {
                    logAction(`${this.name} distracts ${target[0].name}`, "debuff");
                    new Modifier("Taunt", "Decreases target evasion, focus, and resist and doubles the chance for caster to be targeted by target",
                       { target: target[0], duration: 1, properties: ["physical", "debuff"], stats: { focus: -10 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] > 33 } },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration > 0;
                        }
                    );
                } else logAction(`${this.name} fails to distract ${target[0].name}`, "miss");
            }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Made to Serve buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Made to Serve penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Made to Serve buff", "Accuracy and focus increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { accuracy: 80, focus: 80 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Made to Serve penalty", "Resist and presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/evasion and decreases presence for 1 turn",
            code() {
                const mod = refreshModifier([{ name: "Made to Serve buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Made to Serve penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Private Military buff", "Attack and evasion increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { attack: 20, evasion: 40 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Private Military penalty", "Presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { presence: -20 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "positional"],
            description: "Switch between front and backline positions",
            code() { this.switchPosition() }
        }
    ],
    passive: [
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            cost: { stamina: 10 },
            description: `Spends stamina to instantly reload attacks, doesn't reload if stamina is too low`,
            code() {
                new Modifier("Reload", `Ignores reload mechanic`,
                   { target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], cost: this.skills.passive.cost, focus: true, passive: true},
                    function() { this.vars.caster.custom = { flashbang: 1, snipe: 1, focusFire: 1 } },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (!this.vars.caster.custom.flashbang && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.flashbang = 1;
                            if (!this.vars.caster.custom.snipe && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.snipe = 1;
                            if (!this.vars.caster.custom.focusFire && resourceChange(this.vars.caster, this.vars.cost, false)) this.vars.caster.custom.focusFire = 1;
                        }
                    }
                );
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "debuff"],
            description: "Start of turn, chooses a target and has a chance to decrease target focus and resist and double the chance for caster to be targeted by target, can target backline if at frontline",
            code() {
                new Modifier("Taunt", "Decreases target focus, and resist and double the chance for caster to be targeted by target",
                   { target: null, duration: 1, properties: ["physical", "debuff"], stats: { focus: -25, resist: -15 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, passive: true, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] > 33 }, fail: false },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            let target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && (this.position === "front" || u.position === "front"))), will = resistDebuff(this.vars.caster, target)[0];
                            this.changeTarget(target[0]);
                            if (this.vars.fail && will > 33) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 33) this.cancel(this.vars.fail = true);
                        }
                        let i;
                        if (this.vars.target && context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                    }, undefined,
                    function(unit) {
                        if (!this.vars.target) resetStat(unit, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                        if (this.vars.applied) {
                            this.cancel(true, true);
                            this.vars.target = unit;
                            this.cancel(false, true);
                        } else this.vars.target = unit;
                    }
                );
            }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 60 } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -30, presence: -60 }, passive: true, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { target: this, properties: ["physical", "buff"], stats: { attack: 25, evasion: 40 } });
                basicModifier("Private Military penalty", "Resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, passive: true, penalty: true });
            }
        }
    ],
    augment: [
        {
            name: "Taunt",
            properties: ["physical", "debuff"],
            description: "Start of turn, chooses a target and has a chance to decrease target focus and resist and double the chance for caster to be targeted by target, can target backline if at frontline",
            code() {
                new Modifier("Taunt", "Decreases target focus, and resist and double the chance for caster to be targeted by target",
                   { target: null, duration: 1, properties: ["physical", "debuff"], stats: { focus: -40, resist: -25 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, passive: true, debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] > 33 }, fail: false },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            let target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && (this.position === "front" || u.position === "front"))), will = resistDebuff(this.vars.caster, target)[0];
                            this.changeTarget(target[0]);
                            if (this.vars.fail && will > 33) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 33) this.cancel(this.vars.fail = true);
                        }
                        let i;
                        if (this.vars.target && context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.findIndex(u => u === this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= { mult: 1 }).mult += 1;
                    }, undefined,
                    function(unit) {
                        if (!this.vars.target) resetStat(unit, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                        if (this.vars.applied) {
                            this.cancel(true, true);
                            this.vars.target = unit;
                            this.cancel(false, true);
                        } else this.vars.target = unit;
                    }
                );
            }
        },
        {
            name: "Made to Serve",
            properties: ["physical", "buff", "penalty"],
            description: "Increases accuracy/focus and decreases resist/presence",
            code() {
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 80, focus: 80 } });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, passive: true, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { target: this, properties: ["physical", "buff"], stats: { attack: 40, evasion: 60 } });
                basicModifier("Private Military penalty", "Presence decrease", { target: this, properties: ["physical", "penalty"], stats: { presence: -20 }, passive: true, penalty: true });
            }
        }
    ]
}

Revolutionary.frontDefaultSkills = [
    { category: 'special', name: 'Focus Fire' },
    { category: 'basic', name: 'Flashbang' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Made to Serve' },
    { category: 'augment', name: 'Private Military' }
];

Revolutionary.backDefaultSkills = [
    { category: 'special', name: 'Focus Fire' },
    { category: 'basic', name: 'Snipe' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Made to Serve' },
    { category: 'augment', name: 'Private Military' }
];

Revolutionary.switchPosition = function(silent = false) {
    if (this.position === "back") {
        this.position = "front";
        this.base = { ...this.base, attack: 60, evasion: 50, resist: 50, speed: 110, presence: 105 };
        this.skills = {...this.frontSkills}
    } else {
        this.position = "back";
        this.base = { ...this.base, attack: 50, evasion: 90, resist: 65, speed: 90, presence: 55 };
        this.skills = {...this.backSkills}
    }
    logAction(`${this.name} moves to the ${this.position}line.`, "info");
    resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
    if (!silent && eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
}