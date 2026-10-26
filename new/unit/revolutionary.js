import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from '../combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const Revolutionary = new Unit("Revolutionary", [900, 50, 25, 140, 140, 160, 80, 100, 55, "mid", 100, 120, 14], 3, ["passion/hatred"]);

Revolutionary.skills = {
    special: [
        {
            name: "Focus Fire",
            properties: ["physical", "stamina-block", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40 },
            description: "Attacks a single target 3 times with increased attack/accuracy/focus, adds a hit and extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const bonus = this.custom?.reload?.focusFire ? +!!this.custom.reload.focusFire-- : 0;
                attack(this, target, 3+bonus, { attacker: { attack: { bonus: 25*(2 + bonus) }, accuracy: { bonus: 50 }, focus: { bonus: 60 } } });
            }
        },
        {
            name: "Flashbang",
            properties: ["physical", "stamina-block", "stamina", "debuff", "stun"],
            cost: { stamina: 40, position: "front" },
            description: "Decrease target accuracy/evasion/speed for a few turns depending on chance and stuns target for 2 turns, 1% chance to fail, increases stun duration by 1 if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const will = resistDebuff(this, target)[0];
                if (will >= 2) {
                    basicModifier("Flashbang debuff", "Accuracy, evasion, and speed decrease", { target: target[0], duration: will > 99 ? 7 : Math.ceil(will/20), properties: ["physical", "debuff"], stats: { accuracy: -30, evasion: -60, speed: -25 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; } });
                    stunModifier("Flashbang", { target: target[0], duration: this.custom?.reload?.flashbang ? this.custom.reload.flashbang-- && 3 : 2, properties: ["physical", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; } });
                } else logAction(`${target[0].name} resists the flashbang!`, "miss");
            }
        },
        {
            name: "Snipe",
            properties: ["physical", "stamina-block", "stamina", "attack", "pseudo-resource"],
            cost: { stamina: 40, position: "back" },
            description: "Attacks a single target with increased attack/accuracy/focus, can target backline, adds extra attack if reloaded",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.team !== this.team)); },
            code(target) { attack(this, target, 1, { attacker: { attack: { bonus: this.custom?.reload?.snipe ? this.custom.reload.snipe-- && 180 : 120 }, accuracy: { bonus: 50 }, focus: { bonus: 60 } } }); }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina-block", "stamina", "pseudo-resource"],
            cost: { stamina: 50 },
            description: `Ignore reload mechanic for next 5 turns, reloads attacks afterwards. If currently active, refreshes duration and refund 10 stamina for each turn remaining`,
            code() {
                const dur = refreshModifier([{ name: "Reload", vars: { caster: this, target: this, parent: this.skills.special }}], 5)[0];
                dur ? resourceChange(this, { stamina: 10*dur }) : new Modifier("Reload", `Ignores reload mechanic`,
                    { target: this, duration: 5, properties: ["physical", "pseudo-resource"], listeners: { turnStart: true }, focus: true },
                    function() {
                        if (this.vars.cancel) return;
                        this.custom?.reload?.dualWield !== undefined && (this.custom.reload.dualWield = 1);
                        this.custom?.reload?.snipe !== undefined && (this.custom.snipe = 1);
                        this.custom?.reload?.focusFire !== undefined && (this.custom.focusFire = 1);
                        logAction(`${this.vars.target.name} reloads all weapons!`, "buff");
                    },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.custom?.reload?.dualWield !== undefined && (this.custom.reload.dualWield = 1);
                            this.custom?.reload?.snipe !== undefined && (this.custom.reload.snipe = 1);
                            this.custom?.reload?.focusFire !== undefined && (this.custom.reload.focusFire = 1);
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "stamina-block", "stamina", "debuff"],
            cost: { stamina: 20 },
            description: "Decreases target evasion, focus, and resist and increase chance for caster to be targeted by target for a few turns, 1% chance to fail, can target backline if at frontline",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.team !== this.team && (this.position === "front" || u.position === "front"))); },
            code(target) {
                let will = resistDebuff(this, target)[0];
                if (will >= 2) {
                    logAction(`${this.name} taunts ${target[0].name}!`, "debuff");
                    new Modifier("Taunt", "Decreases target evasion, focus, and resist and increase chance for caster to be targeted by target",
                       { target: target[0], duration: will > 99 ? 6 : Math.ceil(will/25), properties: ["physical", "debuff"], stats: { evasion: -40, focus: -70, resist: -50 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; } },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.indexOf(this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 1;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration <= 0;
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
            description: "Attacks a single target 2 times with increased attack/accuracy/focus, increases attack and add a hit if reloaded",
            code() {
                const bonus = this.custom?.reload?.focusFire ? +!!this.custom.reload.focusFire-- : 0;
                attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2+bonus, { attacker: { attack: { bonus: 10*(2+bonus) }, accuracy: { bonus: 30 }, focus: { bonus: 40 } } });
            }
        },
        {
            name: "Flashbang",
            properties: ["physical", "stamina-block", "debuff", "stun"],
            cost: { position: "front" },
            description: "Chance to decrease target evasion/speed for a few turns depending on chance and smaller chance to stun target for 1 turn",
            code() {
                ((this.custom ??= {}).reload ??= {}).flashbang ??= 1;
                if (this.custom.reload.flashbang) {
                    this.custom.reload.flashbang--;
                    const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), will = resistDebuff(this, target)[0];
                    switch (true) {
                        case will >= 15:
                            stunModifier("Flashbang", { target: target[0], duration: 1, properties: ["physical", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 50; } });
                        case will >= 5:
                            basicModifier("Flashbang debuff", "Evasion, and speed decrease", { target: target[0], duration: will > 99 ? 6 : Math.ceil(will/25), properties: ["physical", "debuff"], stats: { evasion: -30, speed: -15 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 20; } });
                            break;
                        default:
                            logAction(`${target[0].name} resists the flashbang!`, "miss");
                    }
                } else {
                    this.custom.reload.flashbang++;
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
                ((this.custom ??= {}).reload ??= {}).snipe ??= 1;
                if (this.custom.reload.snipe) this.custom.reload.snipe--, attack(this, randTarget(allUnits.filter(u => u.hp && u.team !== this.team)), 1, { attacker: { attack: { bonus: 60 }, accuracy: { bonus: 35 }, focus: { bonus: 40 } } });
                else {
                    this.custom.reload.snipe++;
                    this.previousAction[0] = false;
                    logAction(`${this.name} is reloading a weapon`);
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
                    new Modifier("Taunt", "Decreases target focus and resist and doubles the chance for caster to be targeted by target",
                       { target: target[0], duration: 1, properties: ["physical", "debuff"], stats: { focus: -50, resist: -20 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 20; } },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.indexOf(this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 1;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration <= 0;
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
                this.custom?.reload?.flashbang !== undefined && (this.custom.reload.flashbang = 2);
                this.custom?.reload?.snipe !== undefined && (this.custom.reload.snipe = 2);
                this.custom?.reload?.focusFire !== undefined && (this.custom.reload.focusFire = 2);
                logAction(`${this.name} reloads all attacks.`, "action");
            }
        },
        {
            name: "Taunt",
            properties: ["physical", "debuff"],
            description: "Chance to decrease target focus and double the chance for caster to be targeted by target for a 1 turn",
            code() {
                let target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), will = resistDebuff(this, target)[0];
                if (will >= 33) {
                    logAction(`${this.name} distracts ${target[0].name}`, "debuff");
                    new Modifier("Taunt", "Decreases target focus and doubles the chance for caster to be targeted by target",
                       { target: target[0], duration: 1, properties: ["physical", "debuff"], stats: { focus: -20 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] > 33; } },
                        function() {},
                        function(context) {
                            let i;
                            if (context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.indexOf(this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 1;
                            if (context.unit === this.vars.caster) this.vars.duration--;
                            return this.vars.duration <= 0;
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
                const mod = refreshModifier([{ name: "Private Military buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Private Military penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Private Military buff", "Attack and evasion increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { attack: 20, evasion: 40 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Private Military penalty", "Presence decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { presence: -20 }, listeners: { turnEnd: true }, penalty: true });
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "positional"],
            description: "Switch between front and backline positions",
            code() { this.switchPosition(); }
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
                   { target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], cost: this.skills.passive.cost, focus: true, passive: true },
                    function() { (this.vars.caster.custom ??= {}).reload = { flashbang: !this.vars.cancel, snipe: !this.vars.cancel, focusFire: !this.vars.cancel }; },
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied) {
                            if (!this.vars.caster.custom.reload.flashbang && resourceChange(this.vars.caster, this.vars.cost, false, false)) this.vars.caster.custom.reload.flashbang = 1;
                            if (!this.vars.caster.custom.reload.snipe && resourceChange(this.vars.caster, this.vars.cost, false, false)) this.vars.caster.custom.reload.snipe = 1;
                            if (!this.vars.caster.custom.reload.focusFire && resourceChange(this.vars.caster, this.vars.cost, false, false)) this.vars.caster.custom.reload.focusFire = 1;
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
                   { target: null, properties: ["physical", "debuff"], stats: { focus: -50, resist: -30 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, passive: true, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] > 33; }, fail: false },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && (this.position === "front" || u.position === "front"))), will = resistDebuff(this.vars.caster, target)[0];
                            if (target !== this.vars.target) this.changeTarget(target[0]);
                            if (this.vars.fail && will > 33) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 33) this.cancel(this.vars.fail = true);
                        }
                        let i;
                        if (this.vars.target && context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.indexOf(this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 1;
                    }, undefined,
                    function(unit) {
                        if (!this.vars.target) resetStat(unit, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                        else if (this.vars.target === unit) unit = null;
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
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 60, focus: 60 }, passive: true });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -30, presence: -60 }, passive: true, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { target: this, properties: ["physical", "buff"], stats: { attack: 25, evasion: 40 }, passive: true });
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
                   { target: null, properties: ["physical", "debuff"], stats: { focus: -80, resist: -50 }, listeners: { turnStart: true, targetStart: true }, cancelListeners: ['targetStart'], focus: true, passive: true, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] > 33; }, fail: false },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && (this.position === "front" || u.position === "front"))), will = resistDebuff(this.vars.caster, target)[0];
                            if (target !== this.vars.target) this.changeTarget(target[0]);
                            if (this.vars.fail && will > 33) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 33) this.cancel(this.vars.fail = true);
                        }
                        let i;
                        if (this.vars.target && context.event === 'targetStart' && context.targetMods && currentAction.at(-2)[1] === this.vars.target && (i = context.unitList.indexOf(this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 1;
                    }, undefined,
                    function(unit) {
                        if (!this.vars.target) resetStat(unit, Object.keys(this.vars.stats), Object.values(this.vars.stats));
                        else if (this.vars.target === unit) unit = null;
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
                basicModifier("Made to Serve buff", "Accuracy and focus increase", { target: this, properties: ["physical", "buff"], stats: { accuracy: 80, focus: 80 }, passive: true });
                basicModifier("Made to Serve penalty", "resist and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { resist: -20, presence: -40 }, passive: true, penalty: true });
            }
        },
        {
            name: "Private Military",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/evasion and decreases resist/presence",
            code() {
                basicModifier("Private Military buff", "Attack and evasion increase", { target: this, properties: ["physical", "buff"], stats: { attack: 40, evasion: 60 }, passive: true });
                basicModifier("Private Military penalty", "Presence decrease", { target: this, properties: ["physical", "penalty"], stats: { presence: -20 }, passive: true, penalty: true });
            }
        }
    ]
};

Revolutionary.frontDefaultSkills = [
    { category: 'special', name: 'Flashbang' },
    { category: 'basic', name: 'Focus Fire' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Made to Serve' },
    { category: 'augment', name: 'Private Military' }
];

Revolutionary.backDefaultSkills = [
    { category: 'special', name: 'Snipe' },
    { category: 'basic', name: 'Focus Fire' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Made to Serve' },
    { category: 'augment', name: 'Private Military' }
];

Revolutionary.switchPosition = function(silent = false) {
    if (this.position === "back") {
        this.position = "front";
        this.base = { ...this.base, attack: 60, evasion: 100, resist: 65, speed: 120, presence: 105 };
        this.skills = {...this.frontSkills};
    } else {
        this.position = "back";
        this.base = { ...this.base, attack: 50, evasion: 140, resist: 80, speed: 100, presence: 55 };
        this.skills = {...this.backSkills};
    }
    logAction(`${this.name} moves to the ${this.position}line.`, "info");
    resetStat(this, ["attack", "evasion", "resist", "speed", "presence"]);
    if (!silent && eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
};