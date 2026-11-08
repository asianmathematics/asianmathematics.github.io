import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from '../combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const Detective = new Unit("Detective", [750, 28, 27, 50, 150, 180, 140, 90, 75, "front", 80, 60, 7, , , 90, 10], 3, ["independence/loneliness", "ingenuity/insanity"]);

Detective.description = "3-star physical techno frontline unit with high debuff capabilities and abilities to bypass tanks.";

Detective.skills = {
    special: [
        {
            name: "Self Defense",
            properties: ["physical", "stamina-block", "stamina", "attack"],
            cost: { stamina: 20 },
            description: "Makes 3 attacks with increased attack and focus",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) { attack(this, target, 3, { attacker: { attack: { bonus: 20 }, focus: { mult: 3 } } } ) }
        },
        {
            name: "Camera Flash",
            properties: ["techno", "energy-block", "energy", "debuff", "stun"],
            cost: { energy: 30 },
            description: "Decrease target accuracy/focus/resist for a few turns depending on chance and stuns target, 1% chance to fail",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const will = resistDebuff(this, target)[0];
                if (will >= 2) {
                    stunModifier("Camera Flash: Stun", { target: target[0], duration: will > 99 ? 2 : 1, properties: ["techno", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 50; } });
                    basicModifier("Camera Flash", "Accuracy, focus, and resist decrease", { target: target[0], duration: will > 99 ? 7 : Math.ceil(will/20), properties: ["techno", "debuff"], stats: { accuracy: -40, focus: -75, resist: -60 }, listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; } });
                } else logAction(`${target[0].name} resists the flash!`, "miss");
            }
        },
        {
            name: "Red String",
            properties: ["physical", "stamina-block", "stamina", "techno", "energy-block", "energy", "conditional", "redirect"],
            cost: { stamina: 15, energy: 25 },
            description: "Links two frontline units together, 1% chance to fail for each enemy link. If two allies are linked, they share heals and when one takes damage, the higher hp target takes half the damage while the lower hp target takes 25%. If two enemies are linked, they have a chance when one takes damage, the other takes the same amount of damage. If an ally and enemy are linked, chance for heals are redirected to the ally and chance for damage to be redirected to the enemy. Last until resist or more than 3 links are made.",
            target() { specialTarget(this, allUnits.filter(u => u.position === "front"), 2); },
            code(targets) {
                if ((targets = targets.filter(u => u.team === this.team || resistDebuff(this, [u])[0] >= 2)).length < 2) {
                    logAction("Not enough targets selected!", "warning");
                    resourceChange(this, this.skills.special.cost);
                    this.previousAction[0] = this.previousAction[2] = false;
                    return;
                }
                const mods = modifiers.filter(m => m.name === "Red String" && m.vars.caster === this);
                while (mods.length > 2) removeModifier(mods.shift());
                new Modifier("Red String", "Links frontline units together. If two allies are linked, they share heals and when one takes damage, the higher hp target takes half the damage while the lower hp target takes 25%. If two enemies are linked, they have a chance when one takes damage, the other takes the same amount of damage. If an ally and enemy are linked, chance for heals are redirected to the ally and chance for damage to be redirected to the enemy.",
                    { targets, properties: ["physical", "techno", "conditional", "redirect"], listeners: { singleDamage: true, singleHeal: false }, cancelListeners: ['singleDamage', 'singleHeal'], debuff: function(targets, calcMods) { return resistDebuff(this.vars.caster, targets, calcMods).map(v => v >= 2 ); }, focus: true },
                    function() { if (this.vars.targets.some(u => u.team === this.vars.caster.team)) this.vars.listeners.singleHeal = true; },
                    function(context) {
                        if (context.direct) return;
                        if (this.vars.targets.includes(context.defender) && context.damageSingle) {
                                if (context.defender.team !== this.vars.caster.team && resistDebuff(this.vars.caster, [context.defender])[0] < 25) {
                                    if (this.vars.targets.length < 3) return true;
                                    else this.changeTarget.call(this, [context.defender]);
                                } else for (const target of this.vars.targets) if (target !== context.defender) {
                                    if (target.team !== this.vars.caster.team) {
                                        if (resistDebuff(this.vars.caster, [target])[0] < 25) {
                                            if (this.vars.targets.length < 3) return true;
                                            else this.changeTarget.call(this, [context.defender]);
                                        } else {
                                            if (context.defender.team === this.vars.caster.team) context.nil = (context.nil || 0) + 1;
                                            hpChange(this.vars.caster, [target], [-context.damageSingle]);
                                        }
                                    } else if (context.defender.team === this.vars.caster.team) {
                                        if (unitByStat([context.defender, target])[0] === context.defender) {
                                            context.div = (context.div || 1) + 1;
                                            hpChange(this.vars.caster, [target], [-context.damageSingle/4]);
                                        } else {
                                            context.div = (context.div || 1) + 3;
                                            hpChange(this.vars.caster, [target], [-context.damageSingle/2]);
                                        }
                                    }
                                }
                        } else if (this.vars.targets.includes(context.target) && context.healSingle) {
                            if (context.target.team !== this.vars.caster.team && resistDebuff(this.vars.caster, [context.target])[0] < 25) {
                                    if (this.vars.targets.length < 3) return true;
                                    else this.changeTarget.call(this, [context.target]);
                            } else for (const target of this.vars.targets) if (target !== context.target && target.team === this.vars.caster.team) {
                                hpChange(this.vars.caster, [target], [context.healSingle]);
                                if (context.target.team !== this.vars.caster.team) context.nil = (context.nil || 0) + 1;
                            }
                        }
                    }, undefined,
                    function(remove = [], add = []) {
                        if (this.vars.targets.length + add.length - remove.length < 2) removeModifier(this);
                        else {
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                        }
                    }
                );
            }
        },
        {
            name: "Spotlight",
            properties: ["techno", "energy-block", "energy", "conditional", "buff", "debuff"],
            cost: { energy: 30 },
            description: "Selects alive random unit. If the target is an ally, increases focus, resist, and presence. If target is an enemy, greatly increases presence and decreases accuracy, evasion, and speed, has a 1% chance of failure. Lasts for 6 turns. Can target backline",
            target() { this.team === "player" ? specialTarget(this, allUnits.filter(u => u.hp && u !== this)) : this.skills.special.code.call(this, randTarget(allUnits.filter(u => u.hp && u !== this), 1, true)); },
            code(target) {
                if (target[0].team === this.team) basicModifier("Spotlight: buff", "Focus, resist, and presence increase", { target: target[0], duration: 6, properties: ["techno", "buff"], stats: { focus: 80, resist: 150, presence: 100 }, listeners: { turnStart: true }, focus: true }, 'caster');
                else if (resistDebuff(this, target)[0] >= 2) {
                    basicModifier("Spotlight: presence", "Massive presence increase", { target: target[0], duration: 6, properties: ["techno", "buff"], stats: { presence: 200 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; }, focus: true }, 'caster');
                    basicModifier("Spotlight: debuff", "Accuracy, evasion, and speed decrease", { target: target[0], duration: 6, properties: ["techno", "debuff"], stats: { accuracy: -40, evasion: -80, speed: -20 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; }, focus: true }, 'caster');
                } else logAction(`${target[0].name} refuses the spotlight!`, 'miss');
            }
        },
        {
            name: "Bounty",
            properties: ["techno", "energy-block", "energy", "debuff"],
            cost: { energy: 20 },
            description: "Selects random enemy. Increases chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs for 6 turns, 1% chance of failure. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs. Can target backline",
            target() { this.team === "player" ? specialTarget(this, allUnits.filter(u => u.hp && u.team !== this.team)) : this.skills.special.code.call(this, randTarget(allUnits.filter(u => u.hp && u.team !== this.team), 1, true)); },
            code(target) {
                if (resistDebuff(this, target)[0] >= 2) new Modifier("Bounty", "Increases chance to be targeted, and gains decreased resist from attacks/debuffs. More likely to be targeted by and has decreased evasion/presence from attacks/debuffs from techno units",
                    { target: target[0], duration: 6, properties: ["techno", "debuff"], listeners: { turnStart: true, resistStart: true, attackStart: true, targetStart: true }, cancelListeners: ['resistStart', 'attackStart', 'targetStart'], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; }, focus: true },
                    function() { logAction(`A bounty is made on ${this.vars.target.name}!`, "debuff") },
                    function(context) {
                        let i;
                        for (i = 0; i < (context.defenders?.length || 0); i++) if (context.defenders[i] === this.vars.target) {
                            (((context.calcMods.defenders ??= [])[i] ??= {}).resist ??= {}).div = (context.calcMods.defenders[i].resist.div || 1) + 2;
                            if (context.attacker.base.energy) (((context.calcMods.defenders ??= [])[i] ??= {})[context.event === 'attackStart' ? 'evasion' : 'presence'] ??= {}).div = (context.calcMods.defenders[i][context.event === 'attackStart' ? 'evasion' : 'presence'].div || 1) + 2;
                        }
                        if (context.targetMods && currentAction.at(-2)[1].team === this.vars.caster.team && (i = context.unitList.indexOf(this.vars.target)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 3*(1+!!currentAction.at(-2)[1].base.energy);
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
                else logAction(`No one is interested in ${target[0].name}'s bounty!`, 'miss')
            }
        },
        {
            name: "Investigative Journalism",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 30 },
            description: "Increases attack/focus/speed/presence and decreases defense/accuracy/evasion/resist for 5 turns",
            code() {
                basicModifier("Investigative Journalism buff", "Attack, focus, speed, and presence increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { attack: 15, focus: 140, speed: 35, presence: 60 }, listeners: { turnEnd: true } });
                basicModifier("Investigative Journalism penalty", "Defense, accuracy, evasion, and resist decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -15, accuracy: -30, evasion: -50, resist: -60 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    basic: [
        {
            name: "Self Defense",
            properties: ["physical", "stamina-block", "attack"],
            description: "Makes 3 attacks with increased focus",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 3, { attacker: { focus: { mult: 3 } } } ) }
        },
        {
            name: "Camera Flash",
            properties: ["techno", "energy-block", "debuff", "stun"],
            description: "Chance to decrease target accuracy/focus/resist for a few turns depending on chance and smaller chance to stun target",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team))[0], will = resistDebuff(this, [target])[0];
                switch (true) {
                    case will >= 30:
                        stunModifier("Camera Flash: Stun", { target, duration: 1, properties: ["techno", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 40; } });
                    case will >= 10:
                        basicModifier("Camera Flash", "Accuracy, focus, and resist decrease", { target, duration: will > 99 ? 6 : Math.floor(will/33) + 1, properties: ["techno", "debuff"], stats: { accuracy: -30, focus: -50, resist: -50 }, listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 25; } });
                        break;
                    default:
                        logAction(`${target.name} resists the flash!`, "miss");
                }
            }
        },
        {
            name: "Red String",
            properties: ["physical", "stamina-block", "techno", "energy-block", "conditional", "redirect"],
            description: "Links two frontline units together, 1% chance to fail for each enemy link. If two allies are linked, they share heals and when one takes damage, both targets take half of the original damage. If two enemies are linked, they have a chance when one takes damage, the other takes half the amount of damage. If an ally and enemy are linked, chance for half of the heal to be redirected to the ally and chance for half of the damage to be redirected to the enemy. Last until resist or more than 5 links are made.",
            code() {
                const targets = randTarget(allUnits.filter(u => u.position === "front"), 2).filter(u => u.team === this.team || resistDebuff(this, [u])[0] >= 35);
                if (targets.length < 2) {
                    logAction("Not enough targets selected!", "warning");
                    this.previousAction[0] = this.previousAction[2] = false;
                    return;
                }
                const mods = modifiers.filter(m => m.name === "Red String" && m.vars.caster === this);
                while (mods.length > 4) removeModifier(mods.shift());
                new Modifier("Red String", "Links frontline units together. If two allies are linked, they share heals and when one takes damage, both targets take half of the original damage. If two enemies are linked, they have a chance when one takes damage, the other takes half the amount of damage. If an ally and enemy are linked, chance for half of the heal to be redirected to the ally and chance for half of the damage to be redirected to the enemy.",
                    { targets, properties: ["physical", "techno", "conditional", "redirect"], listeners: { singleDamage: true, singleHeal: false }, cancelListeners: ['singleDamage', 'singleHeal'], debuff: function(targets, calcMods) { return resistDebuff(this.vars.caster, targets, calcMods).map(v => v >= 2 ); }, focus: true },
                    function() { if (this.vars.targets.some(u => u.team === this.vars.caster.team)) this.vars.listeners.singleHeal = true; },
                    function(context) {
                        if (context.direct) return;
                        if (this.vars.targets.includes(context.defender) && context.damageSingle) {
                                if (context.defender.team !== this.vars.caster.team && resistDebuff(this.vars.caster, [context.defender])[0] < 35) {
                                    if (this.vars.targets.length < 3) return true;
                                    else this.changeTarget.call(this, [context.defender]);
                                } else for (const target of this.vars.targets) if (target !== context.defender) {
                                    if (target.team !== this.vars.caster.team) {
                                        if (resistDebuff(this.vars.caster, [target])[0] < 35) {
                                            if (this.vars.targets.length < 3) return true;
                                            else this.changeTarget.call(this, [context.defender]);
                                        } else {
                                            if (context.defender.team === this.vars.caster.team) context.div = (context.div || 1) + 1;
                                            hpChange(this.vars.caster, [target], [-context.damageSingle/2]);
                                        }
                                    } else if (context.defender.team === this.vars.caster.team) {
                                        context.div = (context.div || 1) + 1;
                                        hpChange(this.vars.caster, [target], [-context.damageSingle/2]);
                                    }
                                }
                        } else if (this.vars.targets.includes(context.target) && context.healSingle) {
                            if (context.target.team !== this.vars.caster.team && resistDebuff(this.vars.caster, [context.target])[0] < 35) {
                                    if (this.vars.targets.length < 3) return true;
                                    else this.changeTarget.call(this, [context.target]);
                            } else for (const target of this.vars.targets) if (target !== context.target && target.team === this.vars.caster.team) {
                                hpChange(this.vars.caster, [target], [context.healSingle/2]);
                                if (context.target.team !== this.vars.caster.team) context.div = (context.div || 1) + 1;
                            }
                        }
                    }, undefined,
                    function(remove = [], add = []) {
                        if (this.vars.targets.length + add.length - remove.length < 2) removeModifier(this);
                        else {
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                        }
                    }
                );
            }
        },
        {
            name: "Spotlight",
            properties: ["techno", "energy-block", "conditional", "buff", "debuff"],
            description: "Selects random alive unit. If the target is an ally, increases focus, resist, and presence. If target is an enemy, chance to greatly increase presence and decreases accuracy, evasion, and speed. Lasts for 3 turns. If cast again on the same target, refreshes duration and allow energy regen next turn. Can target backline",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u !== this), 1, true)[0];
                if (target.team === this.team) refreshModifier([{ name: "Spotlight: buff", vars: { caster: this, target, parent: this.skills.basic } }])[0] ? this.previousAction[2] = false : basicModifier("Spotlight: buff", "Focus, resist, and presence increase", { target, duration: 3, properties: ["techno", "buff"], stats: { focus: 50, resist: 100, presence: 75 }, listeners: { turnStart: true }, focus: true }, 'caster');
                else if (resistDebuff(this, [target])[0] >= 35) {
                    const mod = refreshModifier([{ name: "Spotlight: presence", vars: { caster: this, target, parent: this.skills.basic } }, { name: "Spotlight: debuff", vars: { caster: this, target, parent: this.skills.basic } }]);
                    if (!mod[0]) basicModifier("Spotlight: presence", "Massive presence increase", { target, duration: 3, properties: ["techno", "buff"], stats: { presence: 150 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 35; }, focus: true }, 'caster');
                    if (!mod[1]) basicModifier("Spotlight: debuff", "Accuracy, evasion, and speed decrease", { target, duration: 3, properties: ["techno", "debuff"], stats: { accuracy: -30, evasion: -60, speed: -15 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 35; }, focus: true }, 'caster');
                    if (mod[0]+mod[1]) this.previousAction[2] = false;
                } else logAction(`${target.name} refuses the spotlight!`, 'miss');
            }
        },
        {
            name: "Bounty",
            properties: ["techno", "energy-block","debuff"],
            description: "Selects random enemy. Chance to increase chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs for 3 turns. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs. Can target backline. If cast again on the same target, refreshes duration and allow energy regen next turn",
            code() {
                const target = randTarget(allUnits.filter(u => u.team !== this.team), 1, true)[0];
                if (resistDebuff(this, [target])[0] >= 20) refreshModifier([{ name: "Bounty", vars: { caster: this, target, parent: this.skills.basic } }])[0] ? this.previousAction[2] = false : new Modifier("Bounty", "Increases chance to be targeted, and gains decreased resist from attacks/debuffs. More likely to be targeted by and has decreased evasion/presence from attacks/debuffs from techno units",
                    { target, duration: 3, properties: ["techno", "debuff"], listeners: { turnStart: true, resistStart: true, attackStart: true, targetStart: true }, cancelListeners: ['resistStart', 'attackStart', 'targetStart'], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 20; }, focus: true },
                    function() { logAction(`A bounty is made on ${this.vars.target.name}!`, "debuff") },
                    function(context) {
                        let i;
                        for (i = 0; i < (context.defenders?.length || 0); i++) if (context.defenders[i] === this.vars.target) {
                            (((context.calcMods.defenders ??= [])[i] ??= {}).resist ??= {}).div = (context.calcMods.defenders[i].resist.div || 1) + 1;
                            if (context.attacker.base.energy) (((context.calcMods.defenders ??= [])[i] ??= {})[context.event === 'attackStart' ? 'evasion' : 'presence'] ??= {}).div = (context.calcMods.defenders[i][context.event === 'attackStart' ? 'evasion' : 'presence'].div || 1) + 1;
                        }
                        if (context.targetMods && currentAction.at(-2)[1].team === this.vars.caster.team && (i = context.unitList.indexOf(this.vars.target)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 2*(1+!!currentAction.at(-2)[1].base.energy);
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
                else logAction(`No one is interested in ${target.name}'s bounty!`, 'miss')
            }
        },
        {
            name: "Investigative Journalism",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases attack/focus/speed/presence and decreases defense/accuracy/evasion/resist for 2 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Investigative Journalism buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Investigative Journalism penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Investigative Journalism buff", "Attack, focus, speed, and presence increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { attack: 10, focus: 100, speed: 25, presence: 40 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Investigative Journalism penalty", "Defense, accuracy, evasion, and resist decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { defense: -10, accuracy: -20, evasion: -30, resist: -40 }, listeners: { turnEnd: true }, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        }
    ],
    secondary: [
        {
            name: "Self Defense",
            properties: ["physical", "attack"],
            description: "Makes 2 attacks with increased focus",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2, { attacker: { focus: { mult: 3 } } } ) }
        },
        {
            name: "Camera Flash",
            properties: ["techno", "debuff", "stun"],
            description: "Chance to decrease target accuracy/focus/resist for a few turns depending on chance and smaller chance to stun target",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team))[0], will = resistDebuff(this, [target])[0];
                switch (true) {
                    case will >= 45:
                        stunModifier("Camera Flash: Stun", { target, duration: 1, properties: ["techno", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 65; } });
                    case will >= 15:
                        basicModifier("Camera Flash", "Accuracy, focus, and resist decrease", { target, duration: will > 99 ? 4 : Math.ceil(will/50), properties: ["techno", "debuff"], stats: { accuracy: -20, focus: -25, resist: -20 }, listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 35; } });
                        break;
                    default:
                        logAction(`${target.name} resists the flash!`, "miss");
                }
            }
        },
        {
            name: "Spotlight",
            properties: ["techno", "conditional", "buff", "debuff"],
            description: "Selects random alive unit. If the target is an ally, increases focus, resist, and presence. If target is an enemy, chance to greatly increase presence and decreases accuracy, evasion, and speed. Lasts for 2 turns",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u !== this && (u.team === this.team || u.position === "front")), 1, true)[0];
                if (target.team === this.team) refreshModifier([{ name: "Spotlight: buff", vars: { caster: this, target, parent: this.skills.secondary } }], 2)[0] || basicModifier("Spotlight: buff", "Focus, resist, and presence increase", { target, duration: 2, properties: ["techno", "buff"], stats: { focus: 40, resist: 75, presence: 50 }, listeners: { turnStart: true }, focus: true }, 'caster');
                else if (resistDebuff(this, [target])[0] >= 30) {
                    const mod = refreshModifier([{ name: "Spotlight: presence", vars: { caster: this, target, parent: this.skills.secondary } }, { name: "Spotlight: debuff", vars: { caster: this, target, parent: this.skills.secondary } }], 2);
                    if (!mod[0]) basicModifier("Spotlight: presence", "Massive presence increase", { target, duration: 2, properties: ["techno", "buff"], stats: { presence: 100 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 30; }, focus: true }, 'caster');
                    if (!mod[1]) basicModifier("Spotlight: debuff", "Accuracy, evasion, and speed decrease", { target, duration: 2, properties: ["techno", "debuff"], stats: { accuracy: -20, evasion: -40, speed: -10 }, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 50; }, focus: true }, 'caster');
                } else logAction(`${target.name} refuses the spotlight!`, 'miss');
            }
        },
        {
            name: "Bounty",
            properties: ["techno", "debuff"],
            description: "Selects random alive enemy. Chance to increase chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs for 2 turns. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && u.position === "front"))[0];
                if (resistDebuff(this, [target])[0] >= 30 && !refreshModifier([{ name: "Bounty", vars: { caster: this, target, parent: this.skills.secondary } }], 2)[0]) new Modifier("Bounty", "Increases chance to be targeted, and gains decreased resist from attacks/debuffs. More likely to be targeted by and has decreased evasion/presence from attacks/debuffs from techno units",
                    { target, duration: 2, properties: ["techno", "debuff"], listeners: { turnStart: true, resistStart: true, attackStart: true, targetStart: true }, cancelListeners: ['resistStart', 'attackStart', 'targetStart'], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 30; }, focus: true },
                    function() { logAction(`A bounty is made on ${this.vars.target.name}!`, "debuff") },
                    function(context) {
                        let i;
                        for (i = 0; i < (context.defenders?.length || 0); i++) if (context.defenders[i] === this.vars.target) {
                            (((context.calcMods.defenders ??= [])[i] ??= {}).resist ??= {}).bonus = (context.calcMods.defenders[i].resist.bonus || 0) - 35;
                            if (context.attacker.base.energy) (((context.calcMods.defenders ??= [])[i] ??= {})[context.event === 'attackStart' ? 'evasion' : 'presence'] ??= {}).bonus = (context.calcMods.defenders[i][context.event === 'attackStart' ? 'evasion' : 'presence'].bonus || 0) - 35;
                        }
                        if (context.targetMods && currentAction.at(-2)[1].team === this.vars.caster.team && (i = context.unitList.indexOf(this.vars.target)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + (1+!!currentAction.at(-2)[1].base.energy);
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
                else logAction(`No one is interested in ${target.name}'s bounty!`, 'miss')
            }
        },
        {
            name: "Investigative Journalism",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/focus/speed/presence and decreases defense/accuracy/evasion/resist for 2 turns",
            code() {
                const mod = refreshModifier([{ name: "Investigative Journalism buff", vars: { caster: this, target: this, parent: this.skills.secondary } }, { name: "Investigative Journalism penalty", vars: { caster: this, target: this, parent: this.skills.secondary } }], 2);
                if (!mod[0]) basicModifier("Investigative Journalism buff", "Attack, focus, speed, and presence increase", { target: this, duration: 2, properties: ["physical", "buff"], stats: { attack: 5, focus: 60, speed: 15, presence: 30 }, listeners: { turnEnd: true } });
                if (!mod[1]) basicModifier("Investigative Journalism penalty", "Defense, accuracy, evasion, and resist decrease", { target: this, duration: 2, properties: ["physical", "penalty"], stats: { defense: -5, accuracy: -10, evasion: -30, resist: -20 }, listeners: { turnEnd: true }, penalty: true });
            }
        }
    ],
    passive: [
        {
            name: "Spotlight",
            properties: ["techno", "conditional", "buff", "debuff"],
            description: "Selects random alive unit at start of turn. If the target is an ally, increases focus, resist, and presence. If target is an enemy, chance to greatly increase presence and decreases accuracy, evasion, and speed. Can target backline",
            code() {
                new Modifier("Spotlight", "Selects random alive unit at start of turn. If the target is an ally, increases focus, resist, and presence. If target is an enemy, chance to greatly increase presence and decreases accuracy, evasion, and speed",
                    { target: null, properties: ["techno", "conditional", "buff", "debuff"], stats: {}, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 35; }, passive: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u !== this.vars.caster), 1, true), will = resistDebuff(this.vars.caster, target)[0];
                            if (target[0] !== this.vars.target) this.changeTarget(target[0]);
                            if (this.vars.caster.team !== target[0].team) {
                                if (this.vars.fail && will > 35) this.cancel(this.vars.fail = false);
                                if (!this.vars.fail && will <= 35) this.cancel(this.vars.fail = true);
                            } else if (this.vars.fail) this.cancel(this.vars.fail = false);
                        }
                    }, undefined,
                    function(unit) {
                        if (this.vars.target === unit) unit = null;
                        if (this.vars.applied) {
                            this.cancel(true, true);
                            if (unit) this.vars.stats = unit.team === this.vars.caster.team ? { focus: 20, resist: 50, presence: 25 } : { presence: 75, accuracy: -10, evasion: -20, speed: -5 };
                            this.vars.target = unit;
                            this.cancel(false, true);
                        } else {
                            if (unit) this.vars.stats = unit.team === this.vars.caster.team ? { focus: 20, resist: 50, presence: 25 } : { presence: 75, accuracy: -10, evasion: -20, speed: -5 };
                            this.vars.target = unit;
                        }
                    }
                );
            }
        },
        {
            name: "Bounty",
            properties: ["techno", "debuff"],
            description: "Selects random alive enemy. Chance to increase chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs",
            code() {
                new Modifier("Bounty", "Selects random alive enemy. Chance to increase chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs",
                    { target: null, properties: ["techno", "conditional", "debuff"], listeners: { turnStart: true, resistStart: true, attackStart: true, targetStart: true }, cancelListeners: ['resistStart', 'attackStart', 'targetStart'], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 25; }, passive: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.team !== this.vars.caster.team), 1, true), will = resistDebuff(this.vars.caster, target)[0];
                            if (target !== this.vars.target) this.changeTarget(target[0]);
                            if (this.vars.fail && will > 25) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 25) this.cancel(this.vars.fail = true);
                        }
                        if (!this.vars.target) return;
                        let i;
                        for (i = 0; i < (context.defenders?.length || 0); i++) if (context.defenders[i] === this.vars.target) {
                            (((context.calcMods.defenders ??= [])[i] ??= {}).resist ??= {}).bonus = (context.calcMods.defenders[i].resist.bonus || 0) - 25;
                            if (context.attacker.base.energy) (((context.calcMods.defenders ??= [])[i] ??= {})[context.event === 'attackStart' ? 'evasion' : 'presence'] ??= {}).bonus = (context.calcMods.defenders[i][context.event === 'attackStart' ? 'evasion' : 'presence'].bonus || 0) - 25;
                        }
                        if (context.targetMods && currentAction.at(-2)[1].team === this.vars.caster.team && (i = context.unitList.indexOf(this.vars.target)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + (1+!!currentAction.at(-2)[1].base.energy);
                    }, undefined,
                    function(unit) { this.vars.target = this.vars.target === unit ? null : unit; }
                );
            }
        },
        {
            name: "Investigative Journalism",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/focus/speed/presence and decreases defense/accuracy/evasion/resist",
            code() {
                basicModifier("Investigative Journalism buff", "Attack, focus, speed, and presence increase", { target: this, properties: ["physical", "buff"], stats: { attack: 5, focus: 30, speed: 5, presence: 15 }, passive: true });
                basicModifier("Investigative Journalism penalty", "Defense, accuracy, evasion, and resist decrease", { target: this, properties: ["physical", "penalty"], stats: { defense: -10, accuracy: -20, evasion: -60, resist: -40 }, passive: true, penalty: true });
            }
        }
    ],
    augment: [
        {
            name: "Spotlight",
            properties: ["techno", "conditional", "buff", "debuff"],
            description: "Selects random alive unit at start of turn. If the target is an ally, increases focus, resist, and presence. If target is an enemy, chance to greatly increase presence and decreases accuracy, evasion, and speed. Can target backline",
            code() {
                new Modifier("Spotlight", "Selects random alive unit at start of turn. If the target is an ally, increases focus, resist, and presence. If target is an enemy, chance to greatly increase presence and decreases accuracy, evasion, and speed",
                    { target: null, properties: ["techno", "conditional", "buff", "debuff"], stats: {}, listeners: { turnStart: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 35; }, passive: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u !== this.vars.caster), 1, true), will = resistDebuff(this.vars.caster, target)[0];
                            if (target[0] !== this.vars.target) this.changeTarget(target[0]);
                            if (this.vars.caster.team !== target[0].team) {
                                if (this.vars.fail && will > 35) this.cancel(this.vars.fail = false);
                                if (!this.vars.fail && will <= 35) this.cancel(this.vars.fail = true);
                            } else if (this.vars.fail) this.cancel(this.vars.fail = false);
                        }
                    }, undefined,
                    function(unit) {
                        if (this.vars.target === unit) unit = null;
                        if (this.vars.applied) {
                            this.cancel(true, true);
                            if (unit) this.vars.stats = unit.team === this.vars.caster.team ? { focus: 30, resist: 75, presence: 50 } : { presence: 150, accuracy: -20, evasion: -40, speed: -10 };
                            this.vars.target = unit;
                            this.cancel(false, true);
                        } else {
                            if (unit) this.vars.stats = unit.team === this.vars.caster.team ? { focus: 30, resist: 75, presence: 50 } : { presence: 150, accuracy: -20, evasion: -40, speed: -10 };
                            this.vars.target = unit;
                        }
                    }
                );
            }
        },
        {
            name: "Bounty",
            properties: ["techno", "debuff"],
            description: "Selects random alive enemy. Chance to increase chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs",
            code() {
                new Modifier("Bounty", "Selects random alive enemy. Chance to increase chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs",
                    { target: null, properties: ["techno", "conditional", "debuff"], listeners: { turnStart: true, resistStart: true, attackStart: true, targetStart: true }, cancelListeners: ['resistStart', 'attackStart', 'targetStart'], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 25; }, passive: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            const target = randTarget(allUnits.filter(u => u.hp && u.team !== this.vars.caster.team), 1, true), will = resistDebuff(this.vars.caster, target)[0];
                            if (target !== this.vars.target) this.changeTarget(target[0]);
                            if (this.vars.fail && will > 25) this.cancel(this.vars.fail = false);
                            if (!this.vars.fail && will <= 25) this.cancel(this.vars.fail = true);
                        }
                        if (!this.vars.target) return;
                        let i;
                        for (i = 0; i < (context.defenders?.length || 0); i++) if (context.defenders[i] === this.vars.target) {
                            (((context.calcMods.defenders ??= [])[i] ??= {}).resist ??= {}).bonus = (context.calcMods.defenders[i].resist.bonus || 0) - 45;
                            if (context.attacker.base.energy) (((context.calcMods.defenders ??= [])[i] ??= {})[context.event === 'attackStart' ? 'evasion' : 'presence'] ??= {}).bonus = (context.calcMods.defenders[i][context.event === 'attackStart' ? 'evasion' : 'presence'].bonus || 0) - 45;
                        }
                        if (context.targetMods && currentAction.at(-2)[1].team === this.vars.caster.team && (i = context.unitList.indexOf(this.vars.target)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 2*(1+!!currentAction.at(-2)[1].base.energy);
                    }, undefined,
                    function(unit) { this.vars.target = this.vars.target === unit ? null : unit; }
                );
            }
        },
        {
            name: "Investigative Journalism",
            properties: ["physical", "buff", "penalty"],
            description: "Increases attack/focus/speed/presence and decreases defense/accuracy/evasion/resist",
            code() {
                basicModifier("Investigative Journalism buff", "Attack, focus, speed, and presence increase", { target: this, properties: ["physical", "buff"], stats: { attack: 10, focus: 45, speed: 15, presence: 20 }, passive: true });
                basicModifier("Investigative Journalism penalty", "Defense, accuracy, evasion, and resist decrease", { target: this, properties: ["physical", "penalty"], stats: { defense: -5, accuracy: -10, evasion: -30, resist: -20 }, passive: true, penalty: true });
            }
        }
    ]
}

Detective.defaultSkills = [
    { category: 'special', name: 'Red String' },
    { category: 'basic', name: 'Camera Flash' },
    { category: 'secondary', name: 'Spotlight' },
    { category: 'passive', name: 'Bounty' },
    { category: 'augment', name: 'Investigative Journalism' }
];