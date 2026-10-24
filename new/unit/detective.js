import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from '../combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const Detective = new Unit("Detective", [750, 28, 27, 50, 150, 180, 140, 90, 75, "front", 80, 60, 7, , , 90, 10], 3);

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
            description: "Decrease target accuracy/focus/resist for a few turns depending on chance and chance to stun target, 1% chance to fail",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                const will = resistDebuff(this, target)[0];
                switch (true) {
                    case will >= 50:
                        stunModifier("Camera Flash: Stun", { target: target[0], duration: 1, properties: ["techno", "stun", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 50; } });
                    case will >= 2:
                        basicModifier("Camera Flash", "Accuracy, focus, and resist decrease", { target: target[0], duration: will > 99 ? 5 : Math.ceil(will/33), properties: ["techno", "debuff"], listeners: { turnEnd: true }, debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; } });
                        break;
                    default:
                        logAction(`${target[0].name} resists the flash!`, "miss");
                }
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
                    this.previousAction[0] = this.previousAction[1] = false;
                    return;
                }
                const mods = modifiers.filter(m => m.name === "Red String" && m.vars.caster === this);
                while (mods.length > 2) removeModifier(mods.shift());
                new Modifier("Red String", "Links frontline units together. If two allies are linked, they share heals and when one takes damage, the higher hp target takes half the damage while the lower hp target takes 25%. If two enemies are linked, they have a chance when one takes damage, the other takes the same amount of damage. If an ally and enemy are linked, chance for heals are redirected to the ally and chance for damage to be redirected to the enemy.",
                    { targets, properties: ["physical", "techno", "conditional", "redirect"], listeners: { singleDamage: true, singleHeal: false }, cancelListeners: ['singleDamage', 'singleHeal'], debuff: function(targets, calcMods) { return resistDebuff(targets, calcMods).map(v => v >= 2 ); }, focus: true },
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
                                            hpChange(context.attacker, [target], [context.damageSingle]);
                                        }
                                    } else if (context.defender.team === this.vars.caster.team) {
                                        if (unitByStat([context.defender, target]) === context.defender) {
                                            context.div = (context.div || 1) + 1;
                                            hpChange(context.attacker, [target], [context.damageSingle/4]);
                                        } else {
                                            context.div = (context.div || 1) + 3;
                                            hpChange(context.attacker, [target], [context.damageSingle/2]);
                                        }
                                    }
                                }
                        } else if (this.vars.targets.includes(context.target) && context.healSingle) {
                            if (context.target.team !== this.vars.team && resistDebuff(this.vars.caster, [context.target])[0] < 25) {
                                    if (this.vars.targets.length < 3) return true;
                                    else this.changeTarget.call(this, [context.target]);
                            } else for (const target of this.vars.targets) if (target !== context.defender && target.team === this.vars.caster.team) {
                                hpChange(context.healer, [target], [context.healSingle]);
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
            description: "Selects random unit. If the target is an ally, increases focus, resist, and presence. If target is an enemy, greatly increases presence and decreases accuracy, evasion, and speed, has a 1% chance of failure. Lasts for 5 turns. Can target backline",
            target() { this.team === "player" ? specialTarget(this, allUnits.toSpliced(allUnits.indexOf(this), 1)) : this.skills.special.code.call(this, randTarget(allUnits.toSpliced(allUnits.indexOf(this), 1), 1, true)); },
            code(target) {
                if (target.team === this.team) basicModifier("Spotlight", "Focus, resist, and presence increase", { target, duration: 5, properties: ["techno", "buff"], stats: { focus: 70, resist: 120, presence: 100 }, listeners: { turnEnd: true }, focus: true });
                else if (resistDebuff(this, [target])[0] >= 2) {
                    basicModifier("Spotlight: presence", "Massive presence increase", { target, duration: 5, properties: ["techno", "buff"], stats: { presence: 200 }, listeners: { turnEnd: true }, focus: true }, 'caster');
                    basicModifier("Spotlight: debuff", "Accuracy, evasion, and speed decrease", { target, duration: 5, properties: ["techno", "debuff"], stats: { accuracy: -40, evasion: -80, speed: -20 }, listeners: { turnEnd: true }, focus: true }, 'caster');
                } else logAction(`${target.name} refuses the spotlight!`, 'miss');
            }
        },
        {
            name: "Bounty",
            properties: ["techno", "energy-block", "energy", "debuff"],
            cost: { energy: 20 },
            description: "Selects random enemy. Increases chance for allies to target the enemy, and enemy has decreased resist from allies attacks/debuffs for 5 turns, 1% chance of failure. If ally is a techno unit, doubles the increased target chance and decrease enemy evasion/presence from attacks/debuffs",
            target() { this.team === "player" ? specialTarget(this, allUnits.filter(u => u.team !== this.team)) : this.skills.special.code.call(this, randTarget(allUnits.filter(u => u.team !== this.team))); },
            code(target) {
                if (resistDebuff(this, [target])[0] >= 2) new Modifier("Bounty", "Increases chance to be targeted, and gains decreased resist from attacks/debuffs. More likely to be targeted by and has decreased evasion/presence from attacks/debuffs from techno units",
                    { target, duration: 5, properties: ["techno", "debuff"], listeners: { turnEnd: true, resistStart: true, attackStart: true }, cancelListeners: ['resistStart', 'attackStart'], debuff: function(target, calcMods) { return resistDebuff(this.vars.caster, [target], calcMods)[0] >= 2; }, focus: true },
                    function() { logAction(`A bounty is made on ${this.vars.target.name}!`, "debuff") },
                    function(context) {
                        let i;
                        for (i = 0; i < (context.defender?.length || 0); i++) if (context.defender[i] === this.vars.target) {
                            (((context.calcMods.defenders ??= [])[i] ??= {}).resist ??= {}).div = (context.calcMods.defenders[i].resist.div || 1) + 1;
                            if (context.attacker.base.energy) (((context.calcMods.defenders ??= [])[i] ??= {})[context.event === 'attackStart' ? 'evasion' : 'presence'] ??= {}).div = (context.calcMods.defenders[i][context.event === 'attackStart' ? 'evasion' : 'presence'].div || 1) + 1;
                        }
                        if (currentAction.at(-2)[1].team === this.vars.caster.team && (i = context.unitList.indexOf(this.vars.caster)) > -1) (((context.targetMods.targets ??= [])[i] ??= {}).presence ??= {}).mult = (context.targetMods.targets[i].presence.mult || 1) + 3*(1+!!currentAction.at(-2)[1].base.energy);
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                )
                else logAction(`No one is interested in ${target.name}'s bounty!`, 'miss')
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
}