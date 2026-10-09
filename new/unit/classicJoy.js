import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements, combatSpeedMultiplier } from '../combatDictionary.js';
import { allUnits, Modifier, toggleListeners, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, comma, capital, modifiers, currentAction, eventState } from '../modifier.js';
import { Unit } from './unit.js';

export const ClassicJoy = new Unit("Classical (Joy)", [1300, 50, 45, 180, 160, 200, 140, 140, 170, "mid", 125, 120, 15], 4, ["ingenuity/insanity"]);

ClassicJoy.description = "4-star unit with risky buff/debuff abilities and a lot of offensive abilities. Starts with high stat buffs that slowly decrease and eventually goes negative.";

ClassicJoy.skills = {
    special: [
        {
            name: "Joy",
            properties: ["physical", "stamina-block", "stamina", "disease", "conditional", "buff", "debuff", "pseudo-stat"],
            cost: { stamina: 30 },
            description: "Increases ally defense, accuracy, focus, and resist massively for 10 turns. 20 turns after cast, decreases attack, defense, accuracy, evasion, focus, resist, speed, and presence for 20 turns. If in frontline, drains 10% max hp and can down on self, and can also target enemy frontline to give the stat increase for 6 turns, then the stat decrease after 11 turns that last for 30 turns with 1% chance of failure. Don't take too much though",
            target() { specialTarget(this, allUnits.filter(u => u.type === "physical" && (u.team === this.team || (this.position === "front" && u.position === "front")))); },
            code(target) {
                if (target[0].team !== this.team && resistDebuff(this, target)[0] < 2) {
                    logAction(`${target[0].name} avoids the Joy pill!`, "miss");
                    hpChange(this, [this], [-Math.ceil(this.base.hp/10)]);
                    return;
                }
                logAction(`${this.name} give some joy to ${target[0].name}!`, 'crit');
                const mod = modifiers.find(m => m.name === "Joy" && m.vars.target === target[0]), tracker = modifiers.find(m => m.name === "Joy Tracker");
                if (mod?.vars.parent === this.skills.special) {
                    currentAction.push([mod, mod.vars.caster]);
                    mod.cancel(true, true);
                    mod.vars.duration = 40 + (target[0].team !== this.team);
                    mod.cancel(false, true);
                    currentAction.pop();
                } else {
                    mod ? removeModifier(mod) : tracker.changeTarget([], target);
                    new Modifier("Joy", "Stat increases, then nothing, then stat decrease", 
                        { target: target[0], duration: 40 + (target[0].team !== this.team), properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnEnd: true }, ...((target[0].team !== this.team) ? { debuff: function(target, calcMods) { resistDebuff(this.vars.caster, [target], calcMods) >= 2 } } : {}) },
                        function() { if (!this.vars.cancel) joy(this.vars.target); },
                        function(context) {
                            if (context.unit === this.vars.target) {
                                this.vars.duration--;
                                if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 30 : 35)) removeModifier(this.vars.child[0]);
                                else if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 20 : 30)) withdrawal(this.vars.target);
                            }
                        },
                        function(_, temp) {
                            if (!temp) {
                                if (this.vars.cancel && this.vars.applied) {
                                    (this.vars.child || []).forEach(m => removeModifier(m));
                                    this.vars.applied = false;
                                } else if (!this.vars.cancel && !this.vars.applied) {
                                    if (this.vars.duration > (this.vars.target.team === this.vars.caster.team ? 30 : 35)) joy(this.vars.target);
                                    else if (this.vars.duration < (this.vars.target.team === this.vars.caster.team ? 20 : 30)) withdrawal(this.vars.target);
                                    this.vars.applied = true;
                                }
                            }
                        }
                    );
                }
                if ((tracker.vars.unitMap[target[0].name] += 2+!!mod) >= 64*(1+(target[0].source === ClassicJoy))) toggleListeners(tracker, ['turnEnd']);
                if (target[0].source === ClassicJoy) modifiers.find(m => m.name === "Overdose" && m.vars.target === target[0]).vars.count += 20;
                if (this.position === "front") hpChange(this, [this], [-Math.ceil(this.base.hp/10)]);
            }
        },
        {
            name: "Glycerite Elixir",
            properties: ["physical", "stamina-block", "stamina", "heal", "pseudo-resource", "plant"],
            cost: { stamina: 40 },
            description: "Heals all allies (~10% max HP). Spends all reload and increases the heal (~2.5% max HP) for each reload",
            code() {
                heal(this, allUnits.filter(u => u.team === this.team && u.type === "physical"), .25*(4 + (this.custom?.glyceriteElixir || 0)));
                (this.custom ??= {}).glyceriteElixir = 0;
            }
        },
        {
            name: "Trickshot",
            properties: ["physical", "stamina-block", "stamina", "attack", "multi-target", "pseudo-resource"],
            cost: { stamina: 30, position: "front" },
            description: "Makes 6 attacks with increased accuracy and focus distributed up to 3 targets. Spends all reload to add 2 attacks and additional target option per reload",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 3+(this.custom?.trickshot || 0), false); },
            code(targets) {
                attack(this, targets, targets.map((_, i) => Math.floor((2*(this.custom?.trickshot || 0)+6)/targets.length) + (i < (2*(this.custom?.trickshot || 0)+6)%targets.length)), { attacker: { accuracy: { bonus: 100 }, focus: { bonus: 75 } } });
                (this.custom ??= {}).trickshot = 0;
            }
        },
        {
            name: "Piercing Shot",
            properties: ["physical", "stamina-block", "stamina", "attack", "multi-target", "pseudo-resource"],
            cost: { stamina: 25, position: "back" },
            description: "Makes two attacks with increased attack, accuracy, & focus on a single target and obe on a random target in the opposite position. Can target Backline. Spends all reload to increase number of attacks by amount of reload",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.team !== this.team)); },
            code(target) {
                const target2 = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && u.position !== target[0].position), 1, true);
                attack(this, [target[0], ...target2], [2+Math.floor(this.custom?.piercingShot/2 || 0), ...(target2[0] ? [1+Math.ceil(this.custom?.piercingShot/2 || 0)] : [])], { attacker: { attack: { bonus: 50 }, accuracy: { bonus: 50 }, focus: { bonus: 150 } } });
                (this.custom ??= {}).piercingShot = 0;
            }
        },
        {
            name: "Shotgun",
            properties: ["physical", "stamina-block", "stamina", "attack", "multi-target", "aoe", "pseudo-resource"],
            cost: { stamina: 35, position: "front" },
            description: "Makes 7 attacks to a single target and attacks 5 random targets with decreased attack and accuracy. Spends all reload increase the number of attacks on the random targets by 1 per reload",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)); },
            code(target) {
                attack(this, target, 7);
                attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 6, true), 1+(this.custom?.shotgun || 0), { attack: { bonus: -20 }, accuracy: { bonus: -35 } });
                (this.custom ??= {}).shotgun = 0;
            }
        },
        {
            name: "Cure",
            properties: ["physical", "stamina-block", "stamina", "clean", "pseudo-stat"],
            cost: { stamina: 50, position: "back" },
            description: "Makes up to 3 allies more resistant to joy mutation (except self) and give immunity to physical disease/poison type debuff for 5 turns. Can spend additional reload to add more targets and gain reload if less than 3 allies are targeted",
            target() { specialTarget(this, allUnits.filter(u => u.type === "physical" && u.team === this.team), 3+(this.custom?.cure || 0)); },
            code(targets) {
                logAction(`${this.name} cures ${comma(targets.map(u => u.name))}!`, "buff");
                for (const unit of targets) {
                    if (unit.source !== ClassicJoy) {
                        const tracker = modifiers.find(m => m.name === "Joy Tracker");
                        tracker.changeTarget([], [unit]);
                        tracker.vars.unitMap[unit.name]--;
                    }
                    attribCancelMod("Cure", { target: unit, duration: 5, properties: ["physical", "clean"], listeners: { turnEnd: true } }, "physical", "target", function(mod) { return !(mod.vars.target === this.vars.target || mod.vars.targets?.includes(this.vars.target)) || !mod.vars.properties.includes("debuff") || (!mod.vars.properties.includes("disease") && !mod.vars.properties.includes("poison")) }, false);
                }
                (this.custom ??= {}).cure = (this.custom.cure || 0) + 3 - targets.length;
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina-block", "stamina", "pseudo-resource"],
            cost: { stamina: 30 },
            description: `Reloads all reload skills 4 times`,
            code() {
                this.custom?.glyceriteElixir !== undefined && (this.custom.glyceriteElixir += 4);
                this.custom?.trickshot !== undefined && (this.custom.trickshot += 4);
                this.custom?.piercingShot !== undefined && (this.custom.piercingShot += 4);
                this.custom?.shotgun !== undefined && (this.custom.shotgun += 4);
                this.custom?.cure !== undefined && (this.custom.cure += 4);
                logAction(`${this.name} fills up all reload skills!`, "action");
            }
        },
        {
            name: "Cost of Knowledge",
            properties: ["physical", "stamina-block", "stamina", "buff", "penalty"],
            cost: { stamina: 20 },
            description: "Increases evasion/focus/speed and decreases defense/resist/presence for 6 turns",
            code() {
                basicModifier("Cost of Knowledge buff", "Evasion, focus, and speed increase", { target: this, duration: 6, properties: ["physical", "buff"], stats: { evasion: 90, focus: 180, speed: 75 }, listeners: { turnEnd: true }, focus: true });
                basicModifier("Cost of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, duration: 6, properties: ["physical", "penalty"], stats: { defense: -15, resist: -40, presence: -75 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina-block", "stamina", "positional"],
            cost: { stamina: 10 },
            description: "Switch between front and backline positions and immediately gain next turn and reduce timer by 50% for turn after",
            code() {
                this.switchPosition();
                this.timer -= 1500;
            }
        }
    ],
    basic: [
        {
            name: "Joy",
            properties: ["physical", "stamina-block", "stamina", "disease", "conditional", "buff", "debuff", "pseudo-stat"],
            cost: { stamina: 10 },
            description: "Increases ally defense, accuracy, focus, and resist massively for 9 turns. 17 turns after cast, decreases attack, defense, accuracy, evasion, focus, resist, speed, and presence for 24 turns. If in frontline, drains 5% max hp and can down on self, and has a chance to also target enemy frontline to give the stat increase for 7 turns, then the stat decrease after 13 turns that last for 27 turns. Don't take too much though",
            code() {
                const target = randTarget(allUnits.filter(u => u.type === "physical" && (u.team === this.team || (this.position === "front" && u.position === "front"))));
                if (target[0].team !== this.team && resistDebuff(this, target)[0] < 25) {
                    logAction(`${target[0].name} avoids the Joy pill!`, "miss");
                    hpChange(this, [this], [-Math.ceil(this.base.hp/20)]);
                    return;
                }
                logAction(`${this.name} give some joy to ${target[0].name}!`, 'crit');
                const mod = modifiers.find(m => m.name === "Joy" && m.vars.target === target[0]), tracker = modifiers.find(m => m.name === "Joy Tracker");
                if (mod?.vars.parent === this.skills.basic || mod?.vars.parent === ClassicJoy.skills.special[0]) {
                    currentAction.push([mod, mod.vars.caster]);
                    mod.cancel(true, true);
                    mod.vars.duration = 40 + ((target[0].team === this.team) === !(mod?.vars.parent === ClassicJoy.skills.special[0]));
                    mod.cancel(false, true);
                    currentAction.pop();
                } else {
                    mod ? removeModifier(mod) : tracker.changeTarget([], target);
                    new Modifier("Joy", "Stat increases, then nothing, then stat decrease", 
                        { target: target[0], duration: 40 + (target[0].team === this.team), properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnEnd: true }, ...((target[0].team !== this.team) ? { debuff: function(target, calcMods) { resistDebuff(this.vars.caster, [target], calcMods) >= 25 } } : {}) },
                        function() { if (!this.vars.cancel) joy(this.vars.target); },
                        function(context) {
                            if (context.unit === this.vars.target) {
                                this.vars.duration--;
                                if (this.vars.applied && this.vars.duration === 32 + (this.vars.target.team !== this.vars.caster.team)) removeModifier(this.vars.child[0]);
                                else if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 24 : 27)) withdrawal(this.vars.target);
                            }
                        },
                        function(_, temp) {
                            if (!temp) {
                                if (this.vars.cancel && this.vars.applied) {
                                    (this.vars.child || []).forEach(m => removeModifier(m));
                                    this.vars.applied = false;
                                } else if (!this.vars.cancel && !this.vars.applied) {
                                    if (this.vars.duration > 32 + (this.vars.target.team !== this.vars.caster.team)) joy(this.vars.target);
                                    else if (this.vars.duration < (this.vars.target.team === this.vars.caster.team ? 24 : 27)) withdrawal(this.vars.target);
                                    this.vars.applied = true;
                                }
                            }
                        }
                    );
                }
                if ((tracker.vars.unitMap[target[0].name] += 1+!!mod) >= 64*(1+(target[0].source === ClassicJoy))) toggleListeners(tracker, ['turnEnd']);
                if (target[0].source === ClassicJoy) modifiers.find(m => m.name === "Overdose" && m.vars.target === target[0]).vars.count += 10;
                if (this.position === "front") hpChange(this, [this], [-Math.ceil(this.base.hp/20)]);
            }
        },
        {
            name: "Glycerite Elixir",
            properties: ["physical", "stamina-block", "stamina", "heal", "pseudo-resource", "plant"],
            cost: { stamina: 10 },
            description: "Heal lowest hp ally (~20% max HP). Can spend a reload to increase heal (~10% max hp)",
            code() { heal(this, unitByStat(allUnits.filter(u => u.team === this.team), 'hp', 'percent', false), [2+(this.custom?.glyceriteElixir ? !!this.custom.glyceriteElixir-- : 0)]); }
        },
        {
            name: "Trickshot",
            properties: ["physical", "stamina-block", "attack", "multi-target", "pseudo-resource"],
            cost: { position: "front" },
            description: "Makes 4 attacks with increased accuracy and focus distributed to 1 or 2 targets. Can spend a reload to add 2 attacks and additional target option",
            code() {
                const targets = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), Math.floor(Math.random()*(2+!!this.custom?.trickshot)+1))
                attack(this, targets, (4+2*(this.custom?.trickshot ? !!this.custom.trickshot-- : 0))/targets.length, { attacker: { accuracy: { bonus: 100 }, focus: { bonus: 50 } } });
            }
        },
        {
            name: "Piercing Shot",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource", "multi-target"],
            cost: { position: "back" },
            description: "Attacks a single target with increased attack, accuracy, & focus and random target at the opposite position. Can spend reload to attack first target twice",
            code() {
                const target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team))[0], target2 = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && u.position !== target.position), 1, true);
                attack(this, [target, ...target2], (target2[0] && this.custom?.piercingShot) ? this.custom.piercingShot-- && [2, 1] : 1, { attacker: { attack: { bonus: 50 }, accuracy: { bonus: 50 }, focus: { bonus: 150 } } });
            }
        },
        {
            name: "Shotgun",
            properties: ["physical", "stamina-block", "attack", "multi-target", "aoe", "pseudo-resource"],
            cost: { position: "front" },
            description: "Makes 5 attacks to a single target and attacks 2 random targets with decreased attack and accuracy. Can spend a reload to add an attacks on the main target and add 3 random targets",
            code() {
                attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 5+!!this.custom?.shotgun);
                attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 2+3*(this.custom?.shotgun ? !!this.custom.shotgun-- : 0), true), 1, { attack: { bonus: -20 }, accuracy: { bonus: -35 } });
            }
        },
        {
            name: "Cure",
            properties: ["physical", "stamina-block", "clean", "pseudo-stat"],
            cost: { position: "back" },
            description: "Makes ally more resistant to joy mutation (except self) and give immunity to physical disease/poison type debuff for 6 turns. Can spend a reload to add an additional target",
            code() {
                const targets = randTarget(allUnits.filter(u => u.type === "physical" && u.team === this.team), 1+(this.custom?.cure ? !!this.custom.cure-- : 0), true);
                logAction(`${this.name} cures ${comma(targets.map(u => u.name))}!`, "buff");
                for (const unit of targets) {
                    if (unit.source !== ClassicJoy) {
                        const tracker = modifiers.find(m => m.name === "Joy Tracker");
                        tracker.changeTarget([], [unit]);
                        tracker.vars.unitMap[unit.name]--;
                    }
                    attribCancelMod("Cure", { target: unit, duration: 6, properties: ["physical", "clean"], listeners: { turnEnd: true } }, "physical", "target", function(mod) { return !(mod.vars.target === this.vars.target || mod.vars.targets?.includes(this.vars.target)) || !mod.vars.properties.includes("debuff") || (!mod.vars.properties.includes("disease") && !mod.vars.properties.includes("poison")) }, false);
                }
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina-block", "pseudo-resource"],
            description: `Reloads all reload skills 2 times`,
            code() {
                this.custom?.glyceriteElixir !== undefined && (this.custom.glyceriteElixir += 2);
                this.custom?.trickshot !== undefined && (this.custom.trickshot += 2);
                this.custom?.piercingShot !== undefined && (this.custom.piercingShot += 2);
                this.custom?.shotgun !== undefined && (this.custom.shotgun += 2);
                this.custom?.cure !== undefined && (this.custom.cure += 2);
                logAction(`${this.name} reloads all skills`, "action");
            }
        },
        {
            name: "Cost of Knowledge",
            properties: ["physical", "stamina-block", "buff", "penalty"],
            description: "Increases evasion/focus/speed and decreases defense/resist/presence for 4 turns. If currently active, refreshes duration and allow stamina regen next turn",
            code() {
                const mod = refreshModifier([{ name: "Cost of Knowledge buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Cost of Knowledge penalty", vars: { caster: this, target: this, parent: this.skills.basic } }], 4);
                if (!mod[0]) basicModifier("Cost of Knowledge buff", "Evasion, focus, and speed increase", { target: this, duration: 4, properties: ["physical", "buff"], stats: { evasion: 75, focus: 150, speed: 60 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Cost of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, duration: 4, properties: ["physical", "penalty"], stats: { defense: -10, resist: -30, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
                if (mod[0]+mod[1]) this.previousAction[0] = false;
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina-block", "stamina", "positional"],
            description: "Switch between front and backline positions and immediately gain next turn",
            code() {
                this.switchPosition();
                this.timer -= 1000;
            }
        }
    ],
    secondary: [
        {
            name: "Joy",
            properties: ["physical", "stamina-block", "disease", "conditional", "buff", "debuff", "pseudo-stat"],
            description: "Increases ally defense, accuracy, focus, and resist massively for 7 turns. 13 turns after cast, decreases attack, defense, accuracy, evasion, focus, resist, speed, and presence for 27 turns. If in frontline, drains 5% max hp and can down on self, and has a chance to also target enemy frontline to give the stat increase for 8 turns, then the stat decrease after 15 turns that last for 24 turns. Don't take too much though",
            code() {
                const target = randTarget(allUnits.filter(u => u.type === "physical" && (u.team === this.team || (this.position === "front" && u.position === "front"))));
                if (target[0].team !== this.team && resistDebuff(this, target)[0] < 35) {
                    logAction(`${target[0].name} avoids the Joy pill!`, "miss");
                    hpChange(this, [this], [-Math.ceil(this.base.hp/20)]);
                    return;
                }
                logAction(`${this.name} give some joy to ${target[0].name}!`, 'crit');
                const mod = modifiers.find(m => m.name === "Joy" && m.vars.target === target[0]), tracker = modifiers.find(m => m.name === "Joy Tracker");
                if (mod?.vars.parent === this.skills.secondary || mod?.vars.parent === ClassicJoy.skills.basic[0] || mod?.vars.parent === ClassicJoy.skills.special[0]) {
                    currentAction.push([mod, mod.vars.caster]);
                    mod.cancel(true, true);
                    mod.vars.duration = 40 + (mod?.vars.parent === this.skills.secondary ? -(target[0].team !== this.team) : ((target[0].team === this.team) === !(mod?.vars.parent === ClassicJoy.skills.special[0])));
                    mod.cancel(false, true);
                    currentAction.pop();
                } else {
                    mod ? removeModifier(mod) : tracker.changeTarget([], target);
                    new Modifier("Joy", "Stat increases, then nothing, then stat decrease", 
                        { target: target[0], duration: 40 - (target[0].team !== this.team), properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnEnd: true }, ...((target[0].team !== this.team) ? { debuff: function(target, calcMods) { resistDebuff(this.vars.caster, [target], calcMods) >= 35 } } : {}) },
                        function() { if (!this.vars.cancel) joy(this.vars.target); },
                        function(context) {
                            if (context.unit === this.vars.target) {
                                this.vars.duration--;
                                if (this.vars.applied && this.vars.duration === 16 + (this.vars.target.team === this.vars.caster.team)) removeModifier(this.vars.child[0]);
                                else if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 27 : 24)) withdrawal(this.vars.target);
                            }
                        },
                        function(_, temp) {
                            if (!temp) {
                                if (this.vars.cancel && this.vars.applied) {
                                    (this.vars.child || []).forEach(m => removeModifier(m));
                                    this.vars.applied = false;
                                } else if (!this.vars.cancel && !this.vars.applied) {
                                    if (this.vars.duration > 32 + (this.vars.target.team === this.vars.caster.team)) joy(this.vars.target);
                                    else if (this.vars.duration < (this.vars.target.team === this.vars.caster.team ? 27 : 34)) withdrawal(this.vars.target);
                                    this.vars.applied = true;
                                }
                            }
                        }
                    );
                }
                if ((tracker.vars.unitMap[target[0].name] += 1+!!mod) >= 64*(1+(target[0].source === ClassicJoy))) toggleListeners(tracker, ['turnEnd']);
                if (target[0].source === ClassicJoy) modifiers.find(m => m.name === "Overdose" && m.vars.target === target[0]).vars.count += 10;
                if (this.position === "front") hpChange(this, [this], [-Math.ceil(this.base.hp/20)]);
            }
        },
        {
            name: "Glycerite Elixir",
            properties: ["physical", "stamina-block", "heal", "pseudo-resource", "plant"],
            description: "Heal lowest hp ally (~10% max HP). Can spend a reload to increase heal (~10% max hp)",
            code() { heal(this, unitByStat(allUnits.filter(u => u.team === this.team), 'hp', 'percent', false), [1+(this.custom?.glyceriteElixir ? !!this.custom.glyceriteElixir-- : 0)]); }
        },
        {
            name: "Trickshot",
            properties: ["physical", "attack", "multi-target", "pseudo-resource"],
            cost: { position: "front" },
            description: "Makes 4 attacks with increased accuracy and focus distributed to 1 or 2 targets, requires reload to be used again",
            code() {
                (this.custom ??= {}).trickshot ??= 1;
                if (this.custom.trickshot) {
                    const targets = randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), Math.floor(Math.random()*2+1))
                    attack(this, targets, 4/targets.length, { attacker: { accuracy: { bonus: 50 }, focus: { bonus: 25 } } });
                    this.custom.trickshot--;
                } else {
                    this.custom.trickshot++;
                    logAction(`${this.name} is reloading handguns`);
                }
            }
        },
        {
            name: "Piercing Shot",
            properties: ["physical", "stamina-block", "attack", "pseudo-resource", "multi-target"],
            cost: { position: "back" },
            description: "Attacks a single target with increased attack, accuracy, & focus and random target at the opposite position, requires reload to be used again",
            code() {
                (this.custom ??= {}).piercingShot ??= 1;
                if (this.custom.piercingShot) {
                    const target = randTarget(allUnits.filter(u => u.hp && u.team !== this.team))[0], target2 = randTarget(allUnits.filter(u => u.hp && u.team !== this.team && u.position !== target.position), 1, true);
                    attack(this, [target, ...target2], 1, { attacker: { attack: { bonus: 50 }, accuracy: { bonus: 25 }, focus: { bonus: 75 } } });
                    this.custom.piercingShot--;
                } else {
                    this.custom.piercingShot++;
                    logAction(`${this.name} is reloading a sniper rifle`);
                }
            }
        },
        {
            name: "Shotgun",
            properties: ["physical", "stamina-block", "attack", "multi-target", "aoe", "pseudo-resource"],
            cost: { position: "front" },
            description: "Makes 4 attacks to a single target and attacks 2 random targets with decreased attack and accuracy, requires reload to be used again",
            code() {
                (this.custom ??= {}).shotgun ??= 1;
                if (this.custom.shotgun) {
                    attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 4);
                    attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team), 2, true), 1, { attack: { bonus: -20 }, accuracy: { bonus: -35 } });
                    this.custom.shotgun--;
                } else {
                    this.custom.shotgun++;
                    logAction(`${this.name} is reloading a shotgun`);
                }
            }
        },
        {
            name: "Cure",
            properties: ["physical", "stamina-block", "clean", "pseudo-stat"],
            cost: { position: "back" },
            description: "Makes ally more resistant to joy mutation (except self) and give immunity to physical disease/poison type debuff for 3 turns, require reload to be used again",
            code() {
                (this.custom ??= {}).cure ??= 1;
                if (this.custom.cure) {
                    const target = randTarget(allUnits.filter(u => u.type === "physical" && u.team === this.team), 1+(this.custom?.cure ? !!this.custom.cure-- : 0), true)[0];
                    if (target.source !== ClassicJoy) {
                        const tracker = modifiers.find(m => m.name === "Joy Tracker");
                        tracker.changeTarget([], [target]);
                        tracker.vars.unitMap[target.name]--;
                    }
                    attribCancelMod("Cure", { target, duration: 3, properties: ["physical", "clean"], listeners: { turnEnd: true } }, "physical", "target", function(mod) { return !(mod.vars.target === this.vars.target || mod.vars.targets?.includes(this.vars.target)) || !mod.vars.properties.includes("debuff") || (!mod.vars.properties.includes("disease") && !mod.vars.properties.includes("poison")) }, false);
                    this.custom.cure--;
                } else {
                    this.custom.cure++;
                    logAction(`${this.name} is creating a new cure`);
                }
            }
        },
        {
            name: "Reload",
            properties: ["physical", "pseudo-resource"],
            description: `Reloads all reload skills`,
            code() {
                this.custom?.glyceriteElixir !== undefined && (this.custom.glyceriteElixir++);
                this.custom?.trickshot !== undefined && (this.custom.trickshot++);
                this.custom?.piercingShot !== undefined && (this.custom.piercingShot++);
                this.custom?.shotgun !== undefined && (this.custom.shotgun++);
                this.custom?.cure !== undefined && (this.custom.cure++);
                logAction(`${this.name} quickly reloads all skills.`, "action");
            }
        },
        {
            name: "Cost of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases evasion/focus/speed and decreases defense/resist/presence for 3 turns",
            code() {
                const mod = refreshModifier([{ name: "Cost of Knowledge buff", vars: { caster: this, target: this, parent: this.skills.basic } }, { name: "Cost of Knowledge penalty", vars: { caster: this, target: this, parent: this.skills.basic } }]);
                if (!mod[0]) basicModifier("Cost of Knowledge buff", "Evasion, focus, and speed increase", { target: this, duration: 3, properties: ["physical", "buff"], stats: { evasion: 75, focus: 150, speed: 60 }, listeners: { turnEnd: true }, focus: true });
                if (!mod[1]) basicModifier("Cost of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, duration: 3, properties: ["physical", "penalty"], stats: { defense: -10, resist: -30, presence: -50 }, listeners: { turnEnd: true }, focus: true, penalty: true });
            }
        },
        {
            name: "Switch Position",
            properties: ["physical", "stamina", "positional"],
            description: "Switch between front and backline positions and reduce timer by 25% for next turn",
            code() {
                this.switchPosition();
                this.timer -= 250;
            }
        }
    ],
    passive: [
        {
            name: "Joy",
            properties: ["physical", "disease", "conditional", "buff", "debuff", "pseudo-stat"],
            reduction: { hp: 100 }, 
            description: "Increases ally defense, accuracy, focus, and resist massively for 6 turns. 11 turns after cast, decreases attack, defense, accuracy, evasion, focus, resist, speed, and presence for 30 turns. If in frontline, double reduction, and has a chance to also target enemy frontline to give the stat increase for 9 turns, then the stat decrease after 17 turns that last for 21 turns. Don't take too much though",
            code() {
                new Modifier("Joy Spreader", `Spreads Joy to allies${this.position === "front" ? ' and frontline enemies' : ''}`,
                    { target: this, properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnStart: true }, reduction: this.position === 'front' ? Object.fromEntries(Object.entries(this.skills.passive.reduction).map(([k, v]) => [k, 2*v])) : this.skills.passive.reduction, passive: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        const target = randTarget(allUnits.filter(u => u.type === "physical" && (u.team === this.vars.caster.team || (this.position === "front" && u.position === "front"))));
                        if (target[0].team !== this.vars.caster.team && resistDebuff(this.vars.caster, target)[0] < 45) {
                            logAction(`${target[0].name} avoids the Joy pill!`, "miss");
                            return;
                        }
                        logAction(`${this.vars.caster.name} give some joy to ${target[0].name}!`, 'crit');
                        const mod = modifiers.find(m => m.name === "Joy" && m.vars.target === target[0]), tracker = modifiers.find(m => m.name === "Joy Tracker"), type = mod && Object.values(ClassicJoy.skills).map(s => s[0] === mod.vars.parent );
                        if (type) {
                            currentAction.push([mod, mod.vars.caster]);
                            mod.cancel(true, true);
                            switch(type.indexOf(true)) {
                                case 0:
                                    mod.vars.duration = 40 + (target[0].team !== this.vars.caster.team);
                                    break;
                                case 1:
                                    mod.vars.duration = 40 + (target[0].team === this.vars.caster.team);
                                    break;
                                case 2:
                                    mod.vars.duration = 40 - (target[0].team !== this.vars.caster.team);
                                    break;
                                case 3:
                                    mod.vars.duration = (target[0].team === this.vars.caster.team) ? 41 : 38;
                                    break;
                                case 4:
                                    mod.vars.duration = (target[0].team === this.vars.caster.team) ? 45 : 34;
                                    break;
                                case 5:
                                    mod.vars.duration = 40;
                            }
                            mod.cancel(false, true);
                            currentAction.pop();
                        } else {
                            mod ? removeModifier(mod) : tracker.changeTarget([], target);
                            new Modifier("Joy", "Stat increases, then nothing, then stat decrease", 
                                { target: target[0], duration: (target[0].team === this.vars.caster.team) ? 41 : 38, properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnEnd: true }, ...((target[0].team !== this.vars.caster.team) ? { debuff: function(target, calcMods) { resistDebuff(this.vars.caster, [target], calcMods) >= 45 } } : {}) },
                                function() { if (!this.vars.cancel) joy(this.vars.target); },
                                function(context) {
                                    if (context.unit === this.vars.target) {
                                        this.vars.duration--;
                                        if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 35 : 29)) removeModifier(this.vars.child[0]);
                                        else if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 30 : 21)) withdrawal(this.vars.target);
                                    }
                                },
                                function(_, temp) {
                                    if (!temp) {
                                        if (this.vars.cancel && this.vars.applied) {
                                            (this.vars.child || []).forEach(m => removeModifier(m));
                                            this.vars.applied = false;
                                        } else if (!this.vars.cancel && !this.vars.applied) {
                                            if (this.vars.duration > (this.vars.target.team === this.vars.caster.team ? 35 : 29)) joy(this.vars.target);
                                            else if (this.vars.duration < (this.vars.target.team === this.vars.caster.team ? 30 : 21)) withdrawal(this.vars.target);
                                            this.vars.applied = true;
                                        }
                                    }
                                }
                            );
                        }
                        if ((tracker.vars.unitMap[target[0].name] += 1+!!mod) >= 64*(1+(target[0].source === ClassicJoy))) toggleListeners(tracker, ['turnEnd']);
                        if (target[0].source === ClassicJoy) modifiers.find(m => m.name === "Overdose" && m.vars.target === target[0]).vars.count += 10;
                    }
                );
            }
        },
        {
            name: "Glycerite Elixir",
            properties: ["physical", "heal", "pseudo-resource", "plant"],
            description: "Heal lowest hp ally (~5% max HP). Can spend a reload to increase heal (~10% max hp)",
            code() {
                new Modifier("Glycerite Elixir", "Heal lowest hp ally (~7.5% max HP). Can spend a reload to increase heal (~10% max hp)",
                    { target: this, properties: ["physical", "heal", "pseudo-resource", "plant"], listeners: { turnStart: true }, passive: true, focus: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.team === this.vars.caster.team), 'hp', 'percent', false), [.5+(this.custom?.glyceriteElixir ? !!this.custom.glyceriteElixir-- : 0)]); }
                );
            }
        },
        {
            name: "Shotgun",
            properties: ["physical", "conditional", "attack", "aoe", "pseudo-resource"],
            cost: { position: "front" },
            description: "When damaging a frontline unit, attacks 2 random targets with half attack and accuracy of the attack, requires reload to be used again",
            code() {
                new Modifier("Shotgun", "When damaging a frontline unit, attacks 2 random targets with half attack and accuracy of the attack, requires reload to be used again",
                    { target: this, properties: ["physical", "conditional", "attack", "aoe", "pseudo-resource"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], passive: true, attacking: 0 },
                    function() { (this.custom ??= {}).shotgun ??= 1; },
                    function(context) {
                        if (context.attacker !== this.vars.caster || context.direct || !this.custom.shotgun || this.vars.attacking) return;
                        if (context.damageSingle > this.vars.attacking++) attack(this.vars.caster, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.vars.caster.team), 2, true), 1, { attacker: { ...context.calcMods.attacker, attack: { ...context.calcMods.attacker?.attack, div: (context.calcMods.attacker?.attack?.div || 1) + 1 }, accuracy: { ...context.calcMods.attacker?.accuracy, div: (context.calcMods.attacker?.accuracy?.div || 1) + 1 } } });
                        this.vars.attacking = 0;
                        this.custom.shotgun--;
                    }
                );
            }
        },
        {
            name: "Cure",
            properties: ["physical", "conditional", "clean", "pseudo-stat"],
            cost: { position: "back" },
            description: "When healing a unit other than self, makes unit more resistant to joy mutation, requires reload to be used again",
            code() {
                new Modifier("Cure", "When healing a unit other than self, makes unit more resistant to joy mutation, requires reload to be used again",
                    { target: this, properties: ["physical", "conditional", "clean", "pseudo-stat"], listeners: { singleHeal: true }, cancelListeners: ['singleHeal'], passive: true },
                    function() { (this.custom ??= {}).cure ??= 1; },
                    function(context) {
                        if (context.healer !== this.vars.caster || context.target.source === ClassicJoy || !this.custom.cure) return;
                        if (context.healSingle) {
                            const tracker = modifiers.find(m => m.name === "Joy Tracker");
                            tracker.changeTarget([], [context.target]);
                            tracker.vars.unitMap[context.target.name]--;
                        }
                        this.custom.cure--;
                    }
                );
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            reduction: { stamina: 50, staminaRegen: 7 },
            description: `Reloads all skills each turn`,
            code() {
                new Modifier("Reload", `Reloads all skills each turn`,
                    { target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], reduction: this.skills.passive.reduction, focus: true, passive: true},
                    function() { this.vars.caster.custom = { ...this.vars.caster.custom, glyceriteElixir: +!this.vars.cancel, trickshot: +!this.vars.cancel, piercingShot: +!this.vars.cancel, shotgun: +!this.vars.cancel, cure: +!this.vars.cancel }; },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.vars.caster.custom.glyceriteElixir++;
                            this.vars.caster.custom.trickshot++;
                            this.vars.caster.custom.piercingShot++;
                            this.vars.caster.custom.shotgun++;
                            this.vars.caster.custom.cure++;
                        }
                    }
                );
            }
        },
        {
            name: "Cost of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases evasion/focus/speed and decreases defense/resist/presence for 3 turns",
            code() {
                basicModifier("Cost of Knowledge buff", "Evasion, focus, and speed increase", { target: this, properties: ["physical", "buff"], stats: { evasion: 50, focus: 100, speed: 40 }, passive: true, focus: true });
                basicModifier("Cost of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { defense: -15, resist: -45, presence: -75 }, passive: true, focus: true, penalty: true });
            }
        }
    ],
    augment: [
        {
            name: "Joy",
            properties: ["physical", "disease", "conditional", "buff", "debuff", "pseudo-stat"],
            reduction: { hp: 100 }, 
            description: "Increases ally defense, accuracy, focus, and resist massively for 8 turns. 15 turns after cast, decreases attack, defense, accuracy, evasion, focus, resist, speed, and presence for 30 turns. If in frontline, double reduction, and has a chance to also target enemy frontline to give the stat increase for 7 turns, then the stat decrease after 13 turns that last for 21 turns. Don't take too much though",
            code() {
                new Modifier("Joy Spreader", `Spreads Joy to allies${this.position === "front" ? ' and frontline enemies' : ''}`,
                    { target: this, properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnStart: true }, reduction: this.position === 'front' ? Object.fromEntries(Object.entries(this.skills.augment.reduction).map(([k, v]) => [k, 2*v])) : this.skills.augment.reduction, passive: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        const target = randTarget(allUnits.filter(u => u.type === "physical" && (u.team === this.vars.caster.team || (this.position === "front" && u.position === "front"))));
                        if (target[0].team !== this.vars.caster.team && resistDebuff(this.vars.caster, target)[0] < 45) {
                            logAction(`${target[0].name} avoids the Joy pill!`, "miss");
                            return;
                        }
                        logAction(`${this.vars.caster.name} give some joy to ${target[0].name}!`, 'crit');
                        const mod = modifiers.find(m => m.name === "Joy" && m.vars.target === target[0]), tracker = modifiers.find(m => m.name === "Joy Tracker"), type = mod && Object.values(ClassicJoy.skills).map(s => s[0] === mod.vars.parent);
                        if (type && !type[3]) {
                            currentAction.push([mod, mod.vars.caster]);
                            mod.cancel(true, true);
                            switch(type.indexOf(true)) {
                                case 0:
                                    mod.vars.duration = 40 + (target[0].team !== this.vars.caster.team);
                                    break;
                                case 1:
                                    mod.vars.duration = 40 + (target[0].team === this.vars.caster.team);
                                    break;
                                case 2:
                                    mod.vars.duration = 40 - (target[0].team !== this.vars.caster.team);
                                    break;
                                case 4:
                                    mod.vars.duration = (target[0].team === this.vars.caster.team) ? 45 : 34;
                                    break;
                                case 5:
                                    mod.vars.duration = 40;
                            }
                            mod.cancel(false, true);
                            currentAction.pop();
                        } else {
                            mod ? removeModifier(mod) : tracker.changeTarget([], target);
                            new Modifier("Joy", "Stat increases, then nothing, then stat decrease", 
                                { target: target[0], duration: (target[0].team === this.vars.caster.team) ? 45 : 34, properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnEnd: true }, ...((target[0].team !== this.vars.caster.team) ? { debuff: function(target, calcMods) { resistDebuff(this.vars.caster, [target], calcMods) >= 45 } } : {}) },
                                function() { if (!this.vars.cancel) joy(this.vars.target); },
                                function(context) {
                                    if (context.unit === this.vars.target) {
                                        this.vars.duration--;
                                        if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 37 : 27)) removeModifier(this.vars.child[0]);
                                        else if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 30 : 21)) withdrawal(this.vars.target);
                                    }
                                },
                                function(_, temp) {
                                    if (!temp) {
                                        if (this.vars.cancel && this.vars.applied) {
                                            (this.vars.child || []).forEach(m => removeModifier(m));
                                            this.vars.applied = false;
                                        } else if (!this.vars.cancel && !this.vars.applied) {
                                            if (this.vars.duration > (this.vars.target.team === this.vars.caster.team ? 37 : 27)) joy(this.vars.target);
                                            else if (this.vars.duration < (this.vars.target.team === this.vars.caster.team ? 30 : 21)) withdrawal(this.vars.target);
                                            this.vars.applied = true;
                                        }
                                    }
                                }
                            );
                        }
                        if ((tracker.vars.unitMap[target[0].name] += 1+!!mod) >= 64*(1+(target[0].source === ClassicJoy))) toggleListeners(tracker, ['turnEnd']);
                        if (target[0].source === ClassicJoy) modifiers.find(m => m.name === "Overdose" && m.vars.target === target[0]).vars.count += 10;
                    }
                );
            }
        },
        {
            name: "Glycerite Elixir",
            properties: ["physical", "heal", "pseudo-resource", "plant"],
            description: "Heal lowest hp ally (~7.5% max HP). Can spend a reload to increase heal (~10% max hp)",
            code() {
                new Modifier("Glycerite Elixir", "Heal lowest hp ally (~7.5% max HP). Can spend a reload to increase heal (~10% max hp)",
                    { target: this, properties: ["physical", "heal", "pseudo-resource", "plant"], listeners: { turnStart: true }, passive: true, focus: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.team === this.vars.caster.team), 'hp', 'percent', false), [.75+(this.custom?.glyceriteElixir ? !!this.custom.glyceriteElixir-- : 0)]); }
                );
            }
        },
        {
            name: "Cost of Knowledge",
            properties: ["physical", "buff", "penalty"],
            description: "Increases evasion/focus/speed and decreases defense/resist/presence",
            code() {
                basicModifier("Cost of Knowledge buff", "Evasion, focus, and speed increase", { target: this, properties: ["physical", "buff"], stats: { evasion: 65, focus: 150, speed: 50 }, passive: true, focus: true });
                basicModifier("Cost of Knowledge penalty", "Defense, resist, and presence decrease", { target: this, properties: ["physical", "penalty"], stats: { defense: -5, resist: -15, presence: -25 }, passive: true, focus: true, penalty: true });
            }
        }
    ],
    conditional: [
        {
            name: "Joy",
            properties: ["physical", "disease", "conditional", "buff", "debuff", "pseudo-stat"],
            reduction: { hp: 100 }, 
            description: "Increases ally defense, accuracy, focus, and resist massively for 6 turns. 15 turns after cast, decreases attack, defense, accuracy, evasion, focus, resist, speed, and presence for 25 turns. If in frontline, double reduction, and has a chance to also target enemy frontline to give the stat increase for 9 turns, then the stat decrease after 14 turns that last for 26 turns. Don't take too much though",
            code() {
                new Modifier("Joy Spreader", `Spreads Joy to allies${this.position === "front" ? ' and frontline enemies' : ''}`,
                    { target: this, properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnStart: true }, reduction: this.position === 'front' ? Object.fromEntries(Object.entries(this.skills.conditional.reduction).map(([k, v]) => [k, 2*v])) : this.skills.conditional.reduction, passive: true, focus: true },
                    function() {},
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        const target = randTarget(allUnits.filter(u => u.type === "physical" && (u.team === this.vars.caster.team || (this.position === "front" && u.position === "front"))));
                        if (target[0].team !== this.vars.caster.team && resistDebuff(this.vars.caster, target)[0] < 35) {
                            logAction(`${target[0].name} avoids the Joy pill!`, "miss");
                            return;
                        }
                        logAction(`${this.vars.caster.name} give some joy to ${target[0].name}!`, 'crit');
                        const mod = modifiers.find(m => m.name === "Joy" && m.vars.target === target[0]), tracker = modifiers.find(m => m.name === "Joy Tracker"), type = mod && Object.values(ClassicJoy.skills).map(s => s[0] === mod.vars.parent);
                        if (type && !type[3] && !type[4]) {
                            currentAction.push([mod, mod.vars.caster]);
                            mod.cancel(true, true);
                            switch(type.indexOf(true)) {
                                case 0:
                                    mod.vars.duration = 40 + (target[0].team !== this.vars.caster.team);
                                    break;
                                case 1:
                                    mod.vars.duration = 40 + (target[0].team === this.vars.caster.team);
                                    break;
                                case 2:
                                    mod.vars.duration = 40 - (target[0].team !== this.vars.caster.team);
                                    break;
                                case 5:
                                    mod.vars.duration = 40;
                            }
                            mod.cancel(false, true);
                            currentAction.pop();
                        } else {
                            mod ? removeModifier(mod) : tracker.changeTarget([], target);
                            new Modifier("Joy", "Stat increases, then nothing, then stat decrease", 
                                { target: target[0], duration: 40, properties: ["physical", "disease", "conditional", "buff", "debuff"], listeners: { turnEnd: true }, ...((target[0].team !== this.vars.caster.team) ? { debuff: function(target, calcMods) { resistDebuff(this.vars.caster, [target], calcMods) >= 45 } } : {}) },
                                function() { if (!this.vars.cancel) joy(this.vars.target); },
                                function(context) {
                                    if (context.unit === this.vars.target) {
                                        this.vars.duration--;
                                        if (this.vars.applied && this.vars.duration === (this.vars.target.team === this.vars.caster.team ? 34 : 31)) removeModifier(this.vars.child[0]);
                                        else if (this.vars.applied && this.vars.duration === 25+(this.vars.target.team !== this.vars.caster.team)) withdrawal(this.vars.target);
                                    }
                                },
                                function(_, temp) {
                                    if (!temp) {
                                        if (this.vars.cancel && this.vars.applied) {
                                            (this.vars.child || []).forEach(m => removeModifier(m));
                                            this.vars.applied = false;
                                        } else if (!this.vars.cancel && !this.vars.applied) {
                                            if (this.vars.duration > (this.vars.target.team === this.vars.caster.team ? 34 : 31)) joy(this.vars.target);
                                            else if (this.vars.duration < 25+(this.vars.target.team !== this.vars.caster.team)) withdrawal(this.vars.target);
                                            this.vars.applied = true;
                                        }
                                    }
                                }
                            );
                        }
                        if ((tracker.vars.unitMap[target[0].name] += 1+!!mod) >= 64*(1+(target[0].source === ClassicJoy))) toggleListeners(tracker, ['turnEnd']);
                        if (target[0].source === ClassicJoy) modifiers.find(m => m.name === "Overdose" && m.vars.target === target[0]).vars.count += 10;
                    }
                );
            }
        },
        {
            name: "Glycerite Elixir",
            properties: ["physical", "heal", "pseudo-resource", "plant"],
            description: "Heal lowest hp ally (~5% max HP). Can spend a reload to increase heal (~15% max hp)",
            code() {
                new Modifier("Glycerite Elixir", "Heal lowest hp ally (~5% max HP). Can spend a reload to increase heal (~15% max hp)",
                    { target: this, properties: ["physical", "heal", "pseudo-resource", "plant"], listeners: { turnStart: true }, passive: true, focus: true },
                    function() {},
                    function(context) { if (context.unit === this.vars.caster) heal(this.vars.caster, unitByStat(allUnits.filter(u => u.team === this.vars.caster.team), 'hp', 'percent', false), [.5+1.5*(this.custom?.glyceriteElixir ? !!this.custom.glyceriteElixir-- : 0)]); }
                );
            }
        },
        {
            name: "Shotgun",
            properties: ["physical", "conditional", "attack", "aoe", "pseudo-resource"],
            cost: { position: "front" },
            description: "When damaging a frontline unit, attacks 4 random targets with half attack and accuracy of the attack, requires reload to be used again",
            code() {
                new Modifier("Shotgun", "When damaging a frontline unit, attacks 4 random targets with half attack and accuracy of the attack, requires reload to be used again",
                    { target: this, properties: ["physical", "conditional", "attack", "aoe", "pseudo-resource"], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], passive: true, attacking: 0 },
                    function() { (this.custom ??= {}).shotgun ??= 1; },
                    function(context) {
                        if (context.attacker !== this.vars.caster || context.direct || !this.custom.shotgun || this.vars.attacking) return;
                        if (context.damageSingle > this.vars.attacking++) attack(this.vars.caster, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.vars.caster.team), 4, true), 1, { attacker: { ...context.calcMods.attacker, attack: { ...context.calcMods.attacker?.attack, div: (context.calcMods.attacker?.attack?.div || 1) + 1 }, accuracy: { ...context.calcMods.attacker?.accuracy, div: (context.calcMods.attacker?.accuracy?.div || 1) + 1 } } });
                        this.vars.attacking = 0;
                        this.custom.shotgun--;
                    }
                );
            }
        },
        {
            name: "Cure",
            properties: ["physical", "conditional", "clean", "pseudo-stat"],
            cost: { position: "back" },
            description: "When healing a unit other than self, makes unit more resistant to joy mutation with a chance to double resistance, requires reload to be used again",
            code() {
                new Modifier("Cure", "When healing a unit other than self, makes unit more resistant to joy mutation with a chance to double resistance, requires reload to be used again",
                    { target: this, properties: ["physical", "conditional", "clean", "pseudo-stat"], listeners: { singleHeal: true }, cancelListeners: ['singleHeal'], passive: true },
                    function() { (this.custom ??= {}).cure ??= 1; },
                    function(context) {
                        if (context.healer !== this.vars.caster || context.target.source === ClassicJoy || !this.custom.cure) return;
                        if (context.healSingle) {
                            const tracker = modifiers.find(m => m.name === "Joy Tracker");
                            tracker.changeTarget([], [context.target]);
                            tracker.vars.unitMap[context.target.name] -= resistDebuff(this.vars.caster, [context.target]) >= 50 ? 2 : 1;
                        }
                        this.custom.cure--;
                    }
                );
            }
        },
        {
            name: "Reload",
            properties: ["physical", "stamina", "pseudo-resource"],
            reduction: { stamina: 50, staminaRegen: 7 },
            description: `Reloads all skills twice each turn`,
            code() {
                new Modifier("Reload", `Reloads all skills twice each turn`,
                    { target: this, properties: ["physical", "stamina", "pseudo-resource"], listeners: { turnEnd: true }, cancelListeners: ['turnEnd'], reduction: this.skills.passive.reduction, focus: true, passive: true},
                    function() { this.vars.caster.custom = { ...this.vars.caster.custom, glyceriteElixir: 2*+!this.vars.cancel, trickshot: 2*+!this.vars.cancel, piercingShot: 2*+!this.vars.cancel, shotgun: 2*+!this.vars.cancel, cure: 2*+!this.vars.cancel }; },
                    function(context) {
                        if (context.unit === this.vars.caster) {
                            this.vars.caster.custom.glyceriteElixir += 2;
                            this.vars.caster.custom.trickshot += 2;
                            this.vars.caster.custom.piercingShot += 2;
                            this.vars.caster.custom.shotgun += 2;
                            this.vars.caster.custom.cure += 2;
                        }
                    }
                );
            }
        }
    ]
}

ClassicJoy.traits = [
    {
        name: "Overdose",
        properties: ["trait", "physical", "disease", "conditional", "buff", "debuff"],
        description: "Starts with massively increased stats that slowly decrease over time and continue even after going negative. Can apply joy to self to undo some stat reduction but speeds up stat reduction. Also more resistant to mutation from joy",
        code() {
            new Modifier("Overdose", "Starts with massively increased stats that slowly decrease over time and continue even after going negative. Can apply joy to self to undo some stat reduction but speeds up stat reduction. Also more resistant to mutation from joy",
                { target: this, properties: ["physical", "disease", "conditional", "buff"], stats: { attack: 40, defense: 120, accuracy: 280, evasion: 140, focus: 200, resist: 340, speed: 100, presence: 40 }, listeners: { turnEnd: true }, trait: true, passive: true, count: 20 },
                function() { Object.defineProperty(this.vars, "properties", { get: () => ["physical", "disease", "conditional", this.vars.count < 0 ? "debuff" : "buff"], configureable: true, enumerable: true })},
                function(context) {
                    if (context.unit === this.vars.target) {
                        this.cancel(true, true);
                        this.vars.count--;
                        this.vars.stats = Object.fromEntries(Object.entries({ attack: 40, defense: 120, accuracy: 280, evasion: 140, focus: 200, resist: 340, speed: 100, presence: 40 }).map(([k, v]) => [k, v*Math.min(this.vars.count, 40)/20]));
                        this.cancel(false, true);
                    }
                }
            );
            if (!modifiers.some(m => m.name === "Mutant Fatal Strike")) new Modifier("Mutant Fatal Strike", "Chance to kill after damage from joy mutant",
                { caster: { name: "system" }, targets: [], properties: ["physical", "fatal"], listeners: { turnEnd: false, singleDamage: false, unitChange: true, waveChange: true}, perm: true, unitMap: [] },
                function() {},
                function(context) {
                    if (context.wave) {
                        this.vars.targets = this.vars.targets.filter(u => allUnits.includes(u));
                        if (!this.vars.targets.length && this.vars.listeners.singleDamage) toggleListeners(this, [], ['singleDamage']);
                    } else if (context.type && context.unit?.name.includes(" (Mutant)")) {
                        if (context.type === "death") {
                            this.vars.targets.splice(this.vars.targets.indexOf(context.unit), 1);
                            if (!this.vars.targets.length && this.vars.listeners.singleDamage) toggleListeners(this, [], ['singleDamage']);
                        } else if (context.type === "summon") {
                            this.vars.targets.push(context.unit);
                            if (!this.vars.list && !this.vars.listeners.singleDamage) toggleListeners(this, ['singleDamage']);
                        }
                    } else if (this.vars.targets.includes(context.attacker) && context.damageSingle) {
                        if (!this.vars.unitMap.some(a => a[0] === context.attacker && a[1] === context.defender)) this.vars.unitMap.push([context.attacker, context.defender]);
                        if (!this.vars.listeners.turnEnd) toggleListeners(this, ['turnEnd']);
                    } else if (context.event === "turnEnd") {
                        for (const arr of this.vars.unitMap) if (resistDebuff(arr[0], arr[1]) >= 65 +5*(arr[1].star-arr[0].star)) kill(arr[0], arr[1]);
                        toggleListeners(this, [], ['turnEnd']);
                    }
                }
            )
        }
    },
    {
        name: "Mutation Vaccine",
        properties: ["trait", "physical", "pseudo-stat"],
        description: "Increases resistance to self mutation when joy mutant is killed",
        code() {
            let tracker = modifiers.find(m => m.name === "Joy Tracker");
            tracker ? tracker.changeTarget([], [this]) : tracker = new Modifier("Joy Tracker", "Tracks how much joy each unit took for mutation",
                { caster: { name: "system" }, targets: [this], properties: ["physical", "disease", "pseudo-stat"], listeners: { turnEnd: false, unitChange: true, waveChange: true }, perm: true, unitMap: {} },
                function() { this.vars.unitMap[currentAction.at(-2)[1].name] = 0; },
                function(context) {
                    if (context.wave) {
                        this.vars.targets = this.vars.targets.filter(u => allUnits.includes(u));
                        this.vars.unitMap = Object.fromEntries(Object.entries(this.vars.unitMap).filter(([n]) => this.vars.targets.some(u => u.name === n)));
                    } else if (!context.type && context.unit) {
                        for (const unit of this.vars.targets) if (this.vars.unitMap[unit.name] >= 32*(1+(unit.source === ClassicJoy))*(1+!!unit.hp)) {
                            summon({ team: "monster" }, { ...unit, name: unit.name + " (Mutant)", base: { ...unit.base, hp: unit.base.hp*10, attack: unit.base.attack*3, defense: 19, focus: 25, resist: 25, speed: 10, presence: unit.base.presence*4 }}, unit.skills, unit.position);
                            this.changeTarget([unit]);
                        }
                        toggleListeners(this, [], ['turnEnd']);
                    } else if (context.type && this.vars.targets.includes(context.unit)) {
                        if (context.type === "downed") toggleListeners(this, ['turnEnd']);
                        if (context.type === "death") {
                            summon({ name: "system", team: "monster" }, { ...context.unit, name: context.unit.name + " (Mutant)", base: { ...context.unit.base, hp: context.unit.base.hp*10, attack: context.unit.base.attack*3, defense: 19, focus: 25, resist: 25, speed: 10 }}, context.unit.skills, context.unit.position);
                            this.changeTarget([context.unit]);
                        }
                    }
                }, 
                function() {},
                function(remove = [], add = []) {
                    for (const unit of remove) {
                        const i = this.vars.targets.indexOf(unit);
                        if (i > -1) this.vars.targets.splice(i, 1);
                        delete this.vars.unitMap[unit.name];
                    }
                    for (const unit of add) {
                        const i = this.vars.targets.indexOf(unit);
                        if (i === -1) {
                            this.vars.targets.push(unit);
                            this.vars.unitMap[unit.name] = (this.vars.unitMap[unit.name] || 0) + (unit.source !== ClassicJoy);
                        }
                    }
                }
            );
            if (this.team !== "monster") new Modifier("Mutation Vaccine", "Increases resistance to self mutation when joy mutant is killed",
                { targets: [], properties: ["physical", "pseudo-stat"], listeners: { unitChange: true, waveChange: true }, passive: true, trait: true },
                function() {},
                function(context) {
                    if (context.wave) {
                        if (this.vars.applied) tracker.vars.unitMap[this.vars.caster.name] -= this.vars.targets.filter(u => !allUnits.includes(u)).length;
                        this.vars.targets = allUnits.filter(u => u.team === "monster");
                    } else if (context.unit.team === "monster") {
                        if (context.type === "death") {
                            if (this.vars.applied) tracker.vars.unitMap[this.vars.caster.name]--;
                            this.vars.targets.splice(this.vars.targets.indexOf(context.unit), 1);
                        } else if (context.type === "summon") this.vars.targets.push(context.unit);
                    }
                }
            );
        }
    }
];

ClassicJoy.frontDefaultSkills = [
    { category: 'special', name: 'Joy' },
    { category: 'basic', name: 'Trickshot' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Reload' },
    { category: 'augment', name: 'Glycerite Elixir' },
    { category: 'conditional', name: 'Shotgun' }
];

ClassicJoy.backDefaultSkills = [
    { category: 'special', name: 'Joy' },
    { category: 'basic', name: 'Piercing Shot' },
    { category: 'secondary', name: 'Switch Position' },
    { category: 'passive', name: 'Reload' },
    { category: 'augment', name: 'Glycerite Elixir' },
    { category: 'conditional', name: 'Cure' }
];

ClassicJoy.switchPosition = function(silent = false) {
    if (this.position === "back") {
        this.position = "front";
        this.base = { ...this.base, attack: 70, defense: 30, accuracy: 210, evasion: 125, resist: 110, speed: 170 };
        this.skills = {...this.frontSkills};
    } else {
        this.position = "back";
        this.base = { ...this.base, attack: 50, defense: 45, accuracy: 180, evasion: 160, resist: 140, speed: 140 };
        this.skills = {...this.backSkills};
    }
    logAction(`${this.name} moves to the ${this.position}line.`, "info");
    resetStat(this, ["attack", "defense", "accuracy", "evasion", "resist", "speed"]);
    if (!silent && eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
};

const joy = (u) => basicModifier("Joy buff", "Defense, accuracy, focus, and resist increase", { target: u, properties: ["physical", "disease", "buff"], stats: { defense: 90, accuracy: 120, focus: 150, resist: 200 } });
const withdrawal = (u) => basicModifier("Joy withdrawl", "Attack, defense, accuracy, evasion, focus, resist, speed, and presence decrease", { target: u, properties: ["physical", "disease", "debuff"], stats: { attack: -40, defense: -22, accuracy: -165, evasion: -135, focus: -45, resist: -45, speed: -90, presence: -45 } });
