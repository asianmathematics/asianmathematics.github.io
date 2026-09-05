import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const FourArcher = new Unit("4 (Archer)", [800, 36, 16, 50, 80, 70, 140, 85, 160, "back", 110, 40, 7, 160, 24], 3, ["perfection/precision"]);

FourArcher.description = "3-star mystic backline unit with high crit/debuff resist but low in everything else, capable of manipulating RNG to buff self and debuff enemies."

FourArcher.skills = {
    special: [
        {
            name: "Perfect Shot",
            properties: ["mystic", "mana-block", "mana", "attack", "auto-hit", "auto-crit"],
            cost: { mana: 40 },
            description: "Deals a critical hit to a single target, 99% chance to ignore half of defense",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) { damage(this, target, [[4]], { defenders: [{ defense: { div: resistDebuff(this, target)[0] < 2 ? 1 : 2 } }] }) }
        },
        {
            name: "Unnatural Luck",
            properties: ["mystic", "mana-block", "mana", "buff", "debuff"],
            cost: { mana: 20 },
            description: "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has disadvantage until end of next turn, 1% chance to fail to give disadvantage",
            code() {
                logAction(`${this.name}'s luck is on a another level!`, "buff");
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has disadvantage, 1% chance to fail to give disadvantage",
                    { target: this, duration: 2, properties: ["mystic", "buff", "debuff"], listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], debuffing: 0 },
                    function() {},
                    function(context) {
                        if (context.event !== "turnEnd") {
                            if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            if (context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] >= 2) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                        } else if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Lazing Around",
            properties: ["physical", "stamina-block", "stamina", "mana-gain", "penalty", "resource"],
            cost: { stamina: 10 },
            description: "Reduces speed until next turn then regain mana (~55% max mana)",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana",
                    { target: this, duration: 1, properties: ["physical", "mana-gain", "penalty", "resource"], stats: { speed: -15 }, listeners: { turnStart: true }, penalty: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 5.5 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Rebound Arc",
            properties: ["mystic", "mana-block", "mana", "buff"],
            cost: { mana: 40 },
            description: "Missed attacks have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy for 4 turns",
            code() {
                logAction(`${this.name}'s arrows starts to curve!`, "buff");
                new Modifier("Rebound Arc", "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy",
                    { target: this, duration: 5, properties: ["mystic", "buff"], listeners: { turnEnd: true, singleAttack: true, singleDamage: true }, cancelListeners: ['singleAttack', 'singleDamage'], attacking: false },
                    function() {},
                    function(context) {
                        if (this.vars.attacking) return;
                        if (context.event === "singleAttack" && context.attacker === this.vars.caster && context.hitSingle <= 0) {
                            this.vars.attacking = true;
                            let target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                            if (resistDebuff(this.vars.caster, target)[0] > 70) crit(this.vars.caster, target, [[this.accuracy/2]]);
                        } else if (context.event === "singleDamage" && context.attacker === this.vars.caster && (currentAction.at(-2)[0].properties?.includes("auto-hit") || currentAction.at(-2)[0].vars?.properties?.includes("auto-hit")) && context.critical < 1) {
                            this.vars.attacking = true;
                            attack(this.vars.caster, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, context.calcMods);
                        }
                        this.vars.attacking = false;
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "mana-block", "mana", "buff"],
            cost: { mana: 40 },
            description: "Increases all alive allies, except self, accuracy/evasion/focus/resist/presence for one of their turns",
            code() { for (const unit of allUnits.filter(u => u !== this && u.hp && u.team === this.team)) basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { target: unit, duration: 2, properties: ["mystic", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true } }) }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana-block", "mana", "attack", "auto-hit", "buff", "debuff"],
            cost: { mana: 20 },
            description: "Makes a guaranteed hit to a single target, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                attack(this, target, 1, { max: [[.5]] });
                let will = resistDebuff(this, target);
                new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                    { target: this, duration: will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.ceil(will[0]/33), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                    function() { return !this.vars.duration },
                    function(context) {
                        if (context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        return this.vars.duration <= 0;
                    }
                );
                will = resistDebuff(this, target);
                new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                    { target: target[0], duration: will[0] > 99 ? 7 : Math.floor(will[0]/25), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 25 } },
                    function() { return !this.vars.duration },
                    function(context) {
                        if (context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Multi-shot",
            properties: ["mystic", "mana-block", "mana", "attack", "multi-target"],
            cost: { mana: 40 },
            description: "Makes a guaranteed hit on up to 4 targets",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 4, false) },
            code(targets) { attack(this, targets, 1, { max: Array.from({ length: targets.length }, () => [0.5]) }) }
        }
    ],
    basic: [
        {
            name: "Perfect Shot",
            properties: ["mystic", "mana-block", "attack", "auto-hit"],
            description: "Makes a guaranteed hit to a single target, 99% chance to ignore some defense",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                attack(this, target, 1, { max: [[.5]], defenders: [{ defense: { bonus: resistDebuff(this, target)[0] < 2 ? 0 : -15 } }] });
            }
        },
        {
            name: "Lazing Around",
            properties: ["physical", "stamina-block", "mana-gain", "penalty", "resource"],
            description: "Reduces speed until next turn then regain mana (~45% max mana)",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana",
                    { target: this, duration: 1, properties: ["physical", "mana-gain", "penalty", "resource"], stats: { speed: -15 }, listeners: { turnStart: true }, penalty: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 4.5 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "mana-block", "buff"],
            description: "Increases 4 random ally accuracy/evasion/focus/resist/presence for one of their turns",
            code() { for (const target of randTarget(allUnits.filter(u => u.hp && u.team === this.team), 4, true)) basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { target, duration: 2, properties: ["mystic", "mana", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true } }) }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "mana-block", "mana", "attack", "auto-hit", "buff", "debuff"],
            description: "Attacks a single target. On hit, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                if (attack(this, target, 1)[0] > 0) {
                    let will = resistDebuff(this, target);
                    new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                        { target: this, duration: will[0] > 99 ? 7 : Math.ceil(will[0]/25), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                        function() { return !this.vars.duration },
                        function(context) {
                            if (context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                            return this.vars.duration <= 0;
                        }
                    );
                    will = resistDebuff(this, target);
                    new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                        { target: target[0], duration: will[0] > 99 ? 4 : Math.floor(will[0]/33), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], debuff: function(target) { return resistDebuff(this.vars.caster, [target])[0] >= 33 } },
                        function() { return !this.vars.duration },
                        function(context) {
                            if (context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                            return this.vars.duration <= 0;
                        }
                    );
                }
            }
        },
        {
            name: "Multi-shot",
            properties: ["mystic", "mana-block", "attack", "multi-target"],
            description: "Makes an attack on up to 4 targets",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 4), 1) }
        }
    ],
    secondary: [
        {
            name: "Perfect Shot",
            properties: ["mystic", "attack", "auto-hit"],
            description: "Makes a non-crit guaranteed hit to a single target",
            code() { damage(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), [[.5]]) }
        },
        {
            name: "Lazing Around",
            properties: ["mystic", "mana-gain", "penalty", "resource"],
            description: "Reduces speed until next turn then regain mana (~30% max mana)",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana",
                    { target: this, duration: 1, properties: ["physical", "mana-gain", "penalty", "resource"], stats: { speed: -15 }, listeners: { turnStart: true }, penalty: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            if (this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 3 });
                            this.vars.duration--;
                        }
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one of their turns",
            code() { basicModifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence", { target: randTarget(allUnits.filter(u => u.hp && u.team === this.team), 1, true)[0], duration: 2, properties: ["mystic", "mana", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true } }) }
        }
    ],
    passive: [
        {
            name: "Unnatural Luck",
            properties: ["mystic", "buff", "debuff"],
            reduction: { mana: 40, manaRegen: 8 },
            description: "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage until end of next turn",
            code() {
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage",
                    { target: this, properties: ["mystic", "buff", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], reduction: this.skills.passive.reduction, passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 50) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                    }
                );
            }
        },
        {
            name: "Lazing Around",
            properties: ["physical", "mana-gain", "penalty", "resource"],
            description: "Reduce speed and regen mana (~10% max mana) each turn",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana.",
                    { target: this, properties: ["physical", "mana-gain", "penalty", "resource"], stats: { speed: -25 }, penalty: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster && this.vars.applied) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen }) }
                );
            }
        },
        {
            name: "Rebound Arc",
            properties: ["mystic", "mana", "buff"],
            cost: { mana: 10 },
            description: "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy, spend mana after use",
            code() {
                new Modifier("Rebound Arc", "Missed attack have a chance to hit a random enemy and non-crit guaranteed hits can make an attack to pierce a random enemy",
                    { target: this, properties: ["mystic", "mana", "buff"], listeners: { singleAttack: true, singleDamage: true }, cancelListeners: ['singleAttack', 'singleDamage'], cost: this.skills.passive.cost, passive: true, attacking: false },
                    function() {},
                    function(context) {
                        if (this.vars.attacking) return;
                        if (context.event === "singleAttack" && context.attacker === this.vars.caster && context.hitSingle <= 0 && resourceChange(this.vars.caster, this.vars.cost, false)) {
                            this.vars.attacking = true;
                            let target = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team));
                            if (resistDebuff(this.vars.caster, target)[0] > 70) crit(this.vars.caster, target, [[this.accuracy/4]]);
                        } else if (context.event === "singleDamage" && context.attacker === this.vars.caster && (currentAction.at(-2)[0].properties?.includes("auto-hit") || currentAction.at(-2)[0].vars?.properties?.includes("auto-hit")) && context.critical < 1 && resourceChange(this.vars.caster, this.vars.cost, false)) {
                            this.vars.attacking = true;
                            attack(this.vars.caster, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, context.calcMods);
                        }
                        this.vars.attacking = false;
                    }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one of their turns",
            code() {
                new Modifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence",
                    { target: null, properties: ["mystic", "buff"], stats: { accuracy: 5, evasion: 20, focus: 10, resist: 20, presence: 20 }, listeners: { turnStart: true }, passive: true },
                    function() { this.changeTarget(randTarget(allUnits.filter(u => u.hp && u.team === this.team), 1, true)[0]) },
                    function (context) { if (context.unit === this.vars.caster) this.changeTarget(randTarget(allUnits.filter(u => u.hp && u.team === this.team))[0]) }
                );
            }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "buff", "debuff"],
            reduction: { mana: 40, manaRegen: 8 },
            description: "On hit with any attack, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
            code() {
                new Modifier("Luck Arrow", "On hit with any attack, chance to give self advantage to next few attacks/debuffs and chance to give disadvantage to target's next few attacks/debuffs",
                    { target: this, properties: ["mystic", "buff", "debuff"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], reduction: this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && context.singleDamage) {
                            const will = resistDebuff(this.vars.caster, [context.defender, context.defender]);
                            if (!refreshModifier([{ name: "Luck Arrow buff", vars: { caster: this.vars.caster, target: this.vars.caster } }], -(will[0] > 99 ? 7 : Math.ceil(will[0])/25))[0]) new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                                { target: this.vars.caster, duration: will[0] > 99 ? 7 : Math.ceil(will[0]/25), properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                                    return this.vars.duration <= 0;
                                }
                            );
                            if (!refreshModifier([{ name: "Luck Arrow debuff", vars: { caster: this.vars.caster, target: context.defender } }], -(will[1] > 99 ? 4 : Math.floor(will[1])/33))[0]) new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                                { target: context.defender, duration: will[1] > 99 ? 4 : Math.floor(will[1]/33), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], debuff: function(target) { return resistDebuff(this.vars.caster.vars.caster, [target])[0] >= 33 } },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                                    return this.vars.duration <= 0;
                                }
                            );
                        }
                    }
                );
            }
        },
        {
            name: "Multi-shot",
            properties: ["mystic", "attack", "multi-target"],
            reduction: { mana: 40, manaRegen: 8 },
            description: "On damage, chance to split the attack to 3 other targets",
            code(targets) {
                new Modifier("Multi-shot", "When making an attack, chance to split the attack towards up to 3 other targets",
                    { target: this, properties: ["mystic", "attack", "multi-target"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], reduction: this.skills.passive.reduction, passive: true, attacking: 0},
                    function() {},
                    function(context) {
                        if (this.vars.attacking) return;
                        let list;
                        if (context.attacker === this.vars.caster && context.damageSingle > 0 && (list = allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team).filter(u => u !== context.defender)).length && resistDebuff(this.vars.caster, [context.defender])[this.vars.attacking++] > 33) attack(this.vars.caster, randTarget(list, 3), 1, context.calcMods);
                        this.vars.attacking = 0;
                    }
                );
             }
        }
    ],
    augment: [
        {
            name: "Unnatural Luck",
            properties: ["mystic", "buff", "debuff"],
            reduction: { mana: 40, manaRegen: 8 },
            description: "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage until end of next turn",
            code() {
                new Modifier("Unnatural Luck", "Rolls all attacks/debuffs with advantage and opponent's attacks/debuffs to self has chance to debuff to disadvantage",
                    { target: this, properties: ["mystic", "buff", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], reduction: this.skills.augment.reduction, passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (context.attacker === this.vars.caster) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.defenders?.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[--this.vars.debuffing] > 25) for (let i = 0; i < context.defenders.length; i++) if (context.defenders[i] === this.vars.caster) ((context.calcMods.defenders ??= [])[i] ??= { reroll: 0 }).reroll--;
                    }
                );
            }
        },
        {
            name: "Lazing Around",
            properties: ["physical", "mana-gain", "penalty", "resource"],
            description: "Reduce speed and regen mana (~15% max mana) each turn",
            code() {
                new Modifier("Lazing Around", "Reduces speed and regen mana",
                    { target: this, properties: ["physical", "mana-gain", "penalty", "resource"], stats: { speed: -15 }, listeners: { turnStart: true }, cancelListeners: ['turnStart'], penalty: true, passive: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) resourceChange(this.vars.caster, { mana: this.vars.caster.manaRegen * 1.5 }) }
                );
            }
        },
        {
            name: "Lucky Aura",
            properties: ["mystic", "buff"],
            description: "Increases a random alive ally accuracy/evasion/focus/resist/presence for one turn",
            code() {
                new Modifier("Lucky Aura", "Increases accuracy/evasion/focus/resist/presence",
                    { target: null, properties: ["mystic", "buff"], stats: { accuracy: 25, evasion: 45, focus: 35, resist: 40, presence: 40 }, listeners: { turnStart: true }, passive: true },
                    function() { this.changeTarget(randTarget(allUnits.filter(u => u.hp && u.team === this.team)[0])) },
                    function (context) { if (context.unit === this.vars.caster) this.changeTarget(randTarget(allUnits.filter(u => u.hp && u.team === this.team))[0]) },
                );
            }
        },
        {
            name: "Luck Arrow",
            properties: ["mystic", "buff", "debuff"],
            reduction: { mana: 40, manaRegen: 8 },
            description: "On hit with any attack, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
            code() {
                new Modifier("Luck Arrow", "On hit with any attack, gives self advantage to next few attacks/debuffs depending on chance and chance to give disadvantage to target's next few attacks/debuffs, 1% chance to fail to give advantage",
                    { target: this, properties: ["mystic", "buff", "debuff"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], reduction: this.skills.augment.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && context.singleDamage) {
                            const will = resistDebuff(this.vars.caster, [context.defender, context.defender]);
                            if (!refreshModifier([{ name: "Luck Arrow buff", vars: { caster: this.vars.caster, target: this.vars.caster } }], -(will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.floor(will[0]/33) + 1))[0]) new Modifier("Luck Arrow buff", "Gives advantage to next few attacks/debuffs",
                                { target: this.vars.caster, duration: will[0] < 2 ? 0 : will[0] > 99 ? 7 : Math.floor(will[0]/33) + 1, properties: ["mystic", "buff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'] },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.caster) this.vars.duration--, (context.calcMods.all ??= { reroll: 0 }).reroll++;
                                    return this.vars.duration <= 0;
                                }
                            );
                            if (!refreshModifier([{ name: "Luck Arrow debuff", vars: { caster: this.vars.caster, target: context.defender } }], -(will[1] > 99 ? 7 : Math.floor(will[1]/25)))[0]) new Modifier("Luck Arrow debuff", "Gives disadvantage to target's next few attacks/debuffs",
                                { target: context.defender, duration: will[1] > 99 ? 7 : Math.floor(will[1]/25), properties: ["mystic", "debuff"], listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], debuff: function(target) { return resistDebuff(this.vars.caster.vars.caster, [target])[0] >= 33 } },
                                function() { return !this.vars.duration },
                                function(context) {
                                    if (this.vars.applied && context.attacker === this.vars.target) this.vars.duration--, context.calcMods.all ? context.calcMods.all.reroll = (context.calcMods.all.reroll || 0) - 1 : context.calcMods.all = { reroll: -1 };
                                    return this.vars.duration <= 0;
                                }
                            );
                        }
                    }
                );
            }
        }
    ]
}

FourArcher.defaultSkills = [
    { category: 'special', name: 'Rebound Arc' },
    { category: 'basic', name: 'Perfect Shot' },
    { category: 'secondary', name: 'Lucky Aura' },
    { category: 'passive', name: 'Unnatural Luck' },
    { category: 'augment', name: 'Luck Arrow' }
];
