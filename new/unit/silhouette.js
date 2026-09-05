import { regenerateResources, specialTarget, enemyTurn, randTarget, selectTarget, showMessage, cleanupGlobalHandlers, attack, crit, damage, heal, hpChange, resistDebuff, resourceChange, unitByStat, kill, summon, elements } from '../combatDictionary.js';
import { Modifier, handleEvent, removeModifier, refreshModifier, basicModifier, auraModifier, stunModifier, blockModifier, attribCancelMod, logAction, resetStat, modifiers, currentAction, eventState } from '../modifier.js'
import { Unit, allUnits } from './unit.js';

export const Silhouette = new Unit("Silhouette", [650, 24, 25, 110, 160, 135, 140, 75, 50, "mid", 80, 80, 10, 100, 16], 3, ["independence/loneliness"]);

Silhouette.description = "3-star physical mystic unit with high hit/resist from attacks/crit/debuffs but low defensive stats and speed, can summon shadows.";

Silhouette.skills = {
    special: [
        {
            name: "Shadow Blade",
            properties: ["physical", "stamina-block", "stamina", "mystic", "mana-block", "mana", "attack"],
            cost: { stamina: 10, mana: 20, position: "front" },
            description: "Makes 4 attacks at a single target with increased accuracy and attack",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) { attack(this, target, 4, { attacker: { attack: { bonus: 36 }, accuracy: { bonus: 50 } } }) }
        },
        {
            name: "Ball of Darkness",
            properties: ["physical", "stamina-block", "stamina", "mystic", "mana", "mana-block", "attack", "multi-target"],
            cost: { stamina: 10, mana: 20, position: "back" },
            description: "Makes an attack at a single target with double accuracy. On hit, randomly targets another enemy with the attack and continues until miss",
            target() { specialTarget(this, allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)) },
            code(target) {
                let hit = attack(this, target, 1, { attacker: { accuracy: { mult: 2 } } }), t = target;
                while (hit[0] > 0) {
                    let list = allUnits.filter(u => u !== t[0] && u.hp && u.position === "front" && u.team !== this.team);
                    hit = list.length ? attack(this, t = randTarget(list, 1, true), 1, { attacker: { accuracy: { mult: 2 } } }) : 0;
                }
            }
        },
        {
            name: "Fear of the Dark",
            properties: ["physical", "stamina-block", "stamina", "mystic", "mana-block", "mana", "buff", "debuff", "positional"],
            cost: { stamina: 15, mana: 25 },
            description: "Increases evasion/focus/presence, gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, lasts 4 turns, 1% chance to fail to give advantage or decrease stats",
            code() {
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { target: this, duration: 5, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 40, focus: 20, presence: 40 }, listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], focus: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders?.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] >= 2) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] >= 2) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Summon Shadow",
            properties: ["mystic", "mana-block", "mana", "summon", "positional"],
            cost: { mana: 60 },
            description: "Summon shadow clone of a ally unit in the same position with 1 star stats for 6 turns, only one of the same clone can be summoned at a time",
            target() { specialTarget(this, allUnits.filter(u => u.position === this.position && u.team === this.team)) },
            code(target) {
                if (!target || !target.length) {
                    logAction("No shadow clones can be summoned!", "warning");
                    resourceChange(this, this.skills.special.cost);
                    this.previousAction[1] = false;
                    return;
                }
                if (allUnits.find(obj => obj.custom?.summoner === this && obj.name === target[0].name + " (Shadow)")) {
                    logAction("A shadow clone of this unit is already summoned!", "warning");
                    resourceChange(this, this.skills.special.cost);
                    this.previousAction[1] = false;
                    return;
                }
                logAction(`${this.name} creates a shadow clone of ${target[0].name}!`, "buff");
                const clone = summon(this, { ...target[0], name: target[0].name + " (Shadow)", base: Object.fromEntries(Object.entries(target[0].base).map(([stat, val]) => [stat, (stat === "position" || stat === "elements") ? val : Math.ceil((val * 4 / 9)/(1+9*(stat === "hp")))])) }, { ...target[0].skills })
                new Modifier("Summon Shadow", "Summon shadow clone of a ally unit in the same position with 1 star stats",
                    { target: clone, duration: 6, properties: ["mystic", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) {
                            if (context.type === "death") return !(this.vars.perm = false);
                            if (context.event === "turnEnd") this.vars.duration--;
                        }
                        if (this.vars.duration <= 0 && this.vars.perm) {
                            this.vars.perm = false;
                            allUnits.splice(allUnits.indexOf(this.vars.target), 1);
                            if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target });
                            for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.target) removeModifier(modifiers[i]);
                            return true;
                        }
                    },
                    function() {},
                    function() {}
                );
            }
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "mana-block", "mana", "conditional", "buff"],
            cost: { mana: 50 },
            description: "Shadow summons gain a star up equivalent stat increase, except for hp and resources, also gains the Fear of the Dark buff if active, lasts 4 turns. If currently active, refreshes duration and refund 10 mana for each turn remaining",
            code() {
                const dur = refreshModifier([{ name: "Friends with the Shadows", vars: { caster: this, target: this, parent: this.skills.special } }], 4)[0];
                dur ? resourceChange(this, { mana: 10*dur }) : logAction(`${this.name} empowers the shadows!`, "buff") || new Modifier("Friends with the Shadows", "Shadow summons gain a star up equivalent stat increase, except for hp and resources, also gains the Fear of the Dark buff if active",
                    { targets: [], duration: 4, properties: ["mystic", "conditional", "buff"], listeners: { turnStart: true, unitChange: true, modifierStart: true, modifierEnd: true }, cancelListeners: ['modifierStart', 'modifierEnd'], focus: true},
                    function() { this.changeTarget([], allUnits.filter(u => u.custom?.summoner === this.vars.caster)) },
                    function(context) {
                        if (context.type === 'summon' && context.unit.custom?.summoner === this.vars.caster) this.changeTarget([], [context.unit]);
                        else if (context.type === 'unsummon' && context.unit.custom?.summoner === this.vars.caster) this.changeTarget([context.unit]);
                        else if (context.event === 'modifierStart' && context.modifier.name === "Fear of the Dark buff" && context.modifier.vars.target === this.vars.caster) for (const target of this.vars.targets) new Modifier("Fear of the Dark buff copy", context.modifier.description, { ...context.modifier.vars, target, listeners: undefined, cancelListeners: undefined}, context.modifier.init, context.modifier.onTurn, context.modifier.cancel, context.modifier.changeTarget);
                        else if (context.event === 'modifierEnd' && context.modifier.name === "Fear of the Dark buff" && context.modifier.vars.target === this.vars.caster && this.vars.child) for (const mod of this.vars.child.filter(m => m.name === "Fear of the Dark buff copy")) removeModifier(mod);
                        if (context.event === 'turnStart' && context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    },
                    function(cancel, temp) {
                        if (!temp) {
                            if (this.vars.cancel && this.vars.applied) {
                                if (this.vars.child) [... this.vars.child].forEach(m => removeModifier(m));
                                this.vars.applied = false;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = false;
                                    eventState[listener].splice(eventState[listener].indexOf(this), 1);
                                }
                            } else if (!this.vars.cancel && !this.vars.applied) {
                                const mod = modifiers.find(m => m.name === "Fear of the Dark buff" && m.vars.caster === this.vars.caster);
                                for (const target of this.vars.targets) {
                                    if (mod) new Modifier("Fear of the Dark buff copy", mod.description, { ...mod.vars, target, stats: { ...mod.vars.stats }, listeners: {}, cancel: false, applied: true }, mod.init, mod.onTurn, mod.cancel, mod.changeTarget);
                                    basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target, properties: ["mystic", "mana", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(target.base[k]/2)])) });
                                }
                                this.vars.applied = true;
                                for (const listener of this.vars.cancelListeners) {
                                    this.vars.listeners[listener] = true;
                                    eventState[listener].push(this);
                                }
                            }
                        }
                    },
                    function(remove = [], add = []) {
                        if (this.vars.applied || !this.vars.start) {
                            if (this.vars.child) this.vars.child.filter(m => remove.includes(m.vars.target)).forEach(m => removeModifier(m));
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                            const mod = modifiers.find(m => m.name === "Fear of the Dark buff" && m.vars.caster === this.vars.caster);
                            for (const target of add) {
                                if (mod) new Modifier("Fear of the Dark buff copy", mod.description, { ...mod.vars, target, stats: { ...mod.vars.stats }, listeners: {}, cancel: false, applied: true }, mod.init, mod.onTurn, mod.cancel, mod.changeTarget);
                                basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase", { caster: this.vars.caster, target, properties: ["mystic", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(target.base[k]/2)])) });
                            }
                        } else {
                            for (let i = this.vars.targets.length - 1; i >= 0; i--) if (remove.includes(this.vars.targets[i])) this.vars.targets.splice(i, 1);
                            this.vars.targets.push(...add);
                        }
                    }
                );
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina-block", "stamina", "mana-gain", "positional", "heal"],
            cost: { stamina: 20 },
            description: `Regen a lot of mana (~35% max mana). If in backline, spends double the cost to moderately heal (~10% max hp)`,
            code() {
                resourceChange(this, { mana: 3.5 * this.manaRegen });
                this.position === 'back' && resourceChange(this, this.skills.special.cost) ? heal(this, [this], [1]) : logAction(`${this.name}'s amulet radiates with power!`, "buff");
            }
        },
        {
            name: "Accursed Lineage",
            properties: ["physical", "stamina-block", "stamina", "mystic", "mana-block", "mana", "conditional", "revive"],
            cost: { stamina: 15, mana: 25 },
            description: `Spends a shadow to revive for the next 5 turns, first revive is free. If currently active, refresh duration and adds another free use`,
            code() {
                if (!refreshModifier([{ name: "Accursed Lineage", vars: { caster: this, target: this, parent: this.skills.special } }], 5, function(m) { return m.vars.uses = 1 })[0]) logAction(`${this.name} hangs around the borders of life and death!`, "buff") || new Modifier("Accursed Lineage", `Spend shadow summon to revive, first revive is free`,
                    { target: this, duration: 5, properties: ["physical", "mystic", "conditional", "revive"], listeners: { turnStart: true, unitChange: true }, cancelListeners: ['unitChange'], uses: 1 },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target && context.type === "downed") {
                            if (this.vars.uses) this.vars.uses--;
                            else {
                                const mod = modifiers.find(m => m.name === "Summon Shadow" && m.vars.caster === this.vars.caster);
                                if (!mod) return; 
                                mod.vars.duration = 0;
                                currentAction.push([mod, mod.vars.caster]);
                                mod.onTurn({});
                                currentAction.pop();
                                removeModifier(mod);
                            }
                            heal(this.vars.caster, [this.vars.target], [3]);
                        }
                        if (context.event === "turnStart" && context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Shadow Shift",
            properties: ["physical", "stamina-block", "stamina", "mystic", "mana-block", "mana", "positional"],
            cost: { stamina: 10, mana: 10 },
            description: "Switch between front and backline positions and immediately gain 2 turns",
            code() {
                this.switchPosition();
                this.timer -= 2000;
            }
        }
    ],
    basic: [
        {
            name: "Shadow Blade",
            properties: ["physical", "stamina-block", "mystic", "mana-block", "attack"],
            cost: { position: "front" },
            description: "Makes 2 attacks at a single target with increased accuracy and attack",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 2, { attacker: { attack: { bonus: 36 }, accuracy: { bonus: 50 } } }) }
        },
        {
            name: "Ball of Darkness",
            properties: ["physical", "stamina-block", "mystic", "mana-block", "attack", "multi-target"],
            cost: { position: "back" },
            description: "Makes an attack at a random target with increased accuracy. On hit, randomly targets another enemy with the attack and continues until miss or all units are hit",
            code() { for (const target of allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team).map(val => ({ val, rand: Math.random() })).sort((a, b) => a.rand - b.rand).map(({ val }) => val)) if (!(attack(this, [target], 1, { attacker: { accuracy: { mult: 2 } } }) > 0)) break; }
        },
        {
            name: "Summon Shadow",
            properties: ["mystic", "mana-block", "mana", "summon", "positional"],
            cost: { mana: 20 },
            description: "Summons a 1 star shadow for 4 turns, can't have more shadows than non-summon allies in the same position",
            code() {
                if (allUnits.filter(u => !u.custom?.summoner && u.position === this.position && u.team === this.team).length <= allUnits.filter(u => u.custom?.summoner === this && u.position === this.position).length) {
                    logAction("Cannot summon more shadows than allies in the same position!", "warning");
                    resourceChange(this, this.skills.basic.cost);
                    this.previousAction[1] = false;
                    return;
                }
                logAction(`${this.name} creates a shadow.`, "action");
                const clone = summon(this, new Unit("Shadow", [290, 13, 11, 49, 66, 60, 60, 30, 24, this.position, 16, 10, 1, 40, 8], 1), shadowSkills)
                new Modifier("Summon Shadow", "Summon 1 star shadow",
                    { target: clone, duration: 4, properties: ["mystic", "summon"], listeners: { turnEnd: true, unitChange: true }, perm: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.target) {
                            if (context.type === "death") return !(this.vars.perm = false);
                            if (context.event === "turnEnd") this.vars.duration--;
                        }
                        if (this.vars.duration <= 0 && this.vars.perm) {
                            this.vars.perm = false;
                            allUnits.splice(allUnits.indexOf(this.vars.target), 1);
                            if (eventState.unitChange.length) handleEvent('unitChange', { type: 'unsummon', unit: this.vars.target});
                            for (let i = modifiers.length - 1; i >= 0; i--) if (modifiers[i].vars.caster === this.vars.target) removeModifier(modifiers[i]);
                            return true;
                        }
                    },
                    function() {},
                    function() {}
                );
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "stamina-block", "stamina", "mana-gain", "positional", "heal"],
            cost: { stamina: 10 },
            description: `Regen a lot of mana (~25% max mana). If in backline, spends double the cost to heal slightly (~5% max hp)`,
            code() {
                resourceChange(this, { mana: 2.5 * this.manaRegen });
                this.position === 'back' && resourceChange(this, this.skills.basic.cost) ? heal(this, [this], [0.5]) : logAction(`${this.name}'s amulet is covered in shadow`, "buff");
            }
        },
        {
            name: "Shadow Shift",
            properties: ["physical", "stamina-block", "mystic", "mana-block", "positional"],
            description: "Switch between front and backline positions and immediately gain next turn",
            code() {
                this.switchPosition();
                this.timer -= 1000;
            }
        }
    ],
    secondary: [
        {
            name: "Shadow Blade",
            properties: ["physical", "mana", "attack"],
            cost: { position: "front" },
            description: "Attacks a single target with increased accuracy and attack",
            code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attacker: { attack: { bonus: 36 }, accuracy: { bonus: 50 } } }) }
        },
        {
            name: "Ball of Darkness",
            properties: ["physical", "mystic", "attack", "multi-target"],
            cost: { position: "back" },
            description: "Attacks a single target with double accuracy, attacks again on hit",
            code() { if (attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attacker: { accuracy: { mult: 2 } } })) attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team)), 1, { attacker: { accuracy: { mult: 2 } } }) }
        },
        {
            name: "Fear of the Dark",
            properties: ["physical", "mystic", "buff", "debuff", "positional"],
            description: "Increases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline, until end of next turn",
            code() {
                if (!refreshModifier([{ name: "Fear of the Dark", vars: { caster: this, target: this, parent: this.skills.secondary } }])) new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline, 1% chance to fail",
                    { target: this, duration: 2, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { turnEnd: true, attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], focus: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders?.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 24) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] > 24) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                        if (context.unit === this.vars.caster) this.vars.duration--;
                        return this.vars.duration <= 0;
                    }
                );
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "mana-gain", "positional", "heal"],
            description: `Regen a lot of mana (~15% max mana). If in backline, disable stamina regen to heal slightly (~5% max hp)`,
            code() {
                resourceChange(this, { mana: 1.5 * this.manaRegen });
                this.position === 'back' ? (this.previousAction[0] = true && heal(this, [this], [.5])) : logAction(`${this.name}'s amulet flickers`, "buff");
            }
        },
        {
            name: "Shadow Shift",
            properties: ["physical", "mystic", "positional"],
            description: "Switch between front and backline positions",
            code() { this.switchPosition() }
        }
    ],
    passive: [
        {
            name: "Fear of the Dark",
            properties: ["physical", "mystic", "buff", "debuff", "positional"],
            reduction: { staminaRegen: 1, manaRegen: 2 },
            description: "Increases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline",
            code() {
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline",
                    { target: this, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 20, focus: 10, presence: 20 }, listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], reduction: this.skills.passive.reduction, focus: true, passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 33) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] > 33) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                    }
                );
            }
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "buff"],
            reduction: { mana: 40 },
            description: "Shadow summons get star up equivalent stats except hp and resources",
            code() {
                auraModifier("Friends with the Shadows", "Shadow summons get star up equivalent stats except hp and resources",
                    { targets: [], properties: ["mystic", "buff"], listeners: { unitChange: true }, reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function(target) { basicModifier("Friends with the Shadows buff", "Star up equivalent stat increase except hp and resources", { target, properties: ["mystic", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(target.base[k]/2)])) }) },
                    (u) => u.custom?.summoner === this
                );
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "mana-gain", "positional", "heal"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen mana (~10% max mana) each turn. If at backline, double reduction to also heal (~5% hp) each turn",
            code() {
                new Modifier("Amulet of Darkness", `Regen mana (~10% max mana)${this.position === 'back' ? ' and heal (~5% hp)' : ''} each turn`,
                    { target: this, properties: this.position === "back" ? ["physical", "mana-gain", "heal"] : ["physical", "mana-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.position === 'back' ? Object.fromEntries(Object.entries(this.skills.passive.reduction).map(([k, v]) => [k, 2*v])) : this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied ){
                            resourceChange(this.vars.target, { mana: this.vars.target.manaRegen });
                            if (this.vars.caster.position === 'back') heal(this.vars.caster, [this.vars.target], [0.5]);
                        }
                    }
                );
            }
        },
        {
            name: "Accursed Lineage",
            properties: ["physical", "mystic", "conditional", "revive"],
            reduction: { stamina: 10, mana: 20 },
            description: `Revives at the cost of unsummmoning a shadow, fails if no shadow to unsummon`,
            code() {
                new Modifier("Accursed Lineage", `Spend shadow summon to revive`,
                    { target: this, properties: ["physical", "mystic", "conditional", "revive"], listeners: { unitChange: true }, cancelListeners: ['unitChange'], reduction: this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit !== this.vars.caster) return;
                        if (this.vars.applied && context.type === "downed") {
                            const mod = modifiers.find(m => m.name === "Summon Shadow" && m.vars.caster === this.vars.caster);
                            if (!mod) return;
                            mod.vars.duration = 0;
                            currentAction.push([mod, mod.vars.caster]);
                            mod.onTurn({});
                            currentAction.pop();
                            removeModifier(mod);
                            heal(this.vars.caster, [this.vars.target], [3]);
                        }
                    }
                );
            }
        }
    ],
    augment: [
        {
            name: "Fear of the Dark",
            properties: ["physical", "mystic", "buff", "debuff", "positional"],
            reduction: { staminaRegen: 1, manaRegen: 2 },
            description: "Increases evasion/focus/presence, chance to gives advantage to attacks at frontline, chance to decreases enemy accuracy or focus of attacks/debuff to self at the backline",
            code() {
                new Modifier("Fear of the Dark", "Gives advantage to attacks at frontline, decreases enemy accuracy or focus of attacks/debuff to self at the backline",
                    { target: this, properties: ["physical", "mystic", "buff", "debuff", "positional"], stats: { evasion: 30, focus: 15, presence: 30 }, listeners: { attackStart: true, resistStart: true }, cancelListeners: ['attackStart', 'resistStart'], reduction: this.skills.augment.reduction, focus: true, passive: true, debuffing: 0 },
                    function() {},
                    function(context) {
                        if (this.vars.caster.position === "back" && context.defenders.includes(this.vars.caster) && !this.vars.debuffing++ && resistDebuff(this.vars.caster, [context.attacker])[this.vars.debuffing = 0] > 33) context.event === "attackStart" ? context.calcMods.attacker = { ...context.calcMods.attacker, accuracy: { ...context.calcMods?.attacker?.accuracy, bonus: (context.calcMods?.attacker?.accuracy?.bonus || 0) - 40} } : context.calcMods.attacker = { ...context.calcMods.attacker, focus: { ...context.calcMods?.attacker?.focus, bonus: (context.calcMods?.attacker?.focus?.bonus || 0) - 40} };
                        else if (this.vars.caster.position === "front" && context.attacker === this.vars.caster && !this.vars.debuffing++) for (const defender of context.defenders) if (resistDebuff(this.vars.caster, [defender])[this.vars.debuffing = 0] > 33) (context.calcMods.all ??= { reroll: 0 }).reroll++;
                    }
                );
            }
        },
        {
            name: "Friends with the Shadows",
            properties: ["mystic", "buff"],
            reduction: { mana: 40 },
            description: "Shadow summons get two star up equivalent stats except hp and resources",
            code() {
                auraModifier("Friends with the Shadows", "Shadow summons get two star up equivalent stats except hp and resources",
                    { targets: [], properties: ["mystic", "buff"], listeners: { unitChange: true }, reduction: this.skills.passive.reduction, focus: true, passive: true },
                    function(target) { basicModifier("Friends with the Shadows buff", "Two star up equivalent stat increase except hp and resources", { target, properties: ["mystic", "buff"], stats: Object.fromEntries(Object.keys(target.mult).map(k => [k, Math.ceil(2.25*target.base[k])])) }) },
                    (u) => u.custom?.summoner === this
                );
            }
        },
        {
            name: "Amulet of Darkness",
            properties: ["physical", "mana-gain", "positional", "heal"],
            reduction: { stamina: 20, staminaRegen: 2 },
            description: "Regen mana (~15% max mana) each turn. If at backline, double reduction to also heal (~7.5% hp) each turn",
            code() {
                new Modifier("Amulet of Darkness", `Regen mana (~15% max mana)${this.position === 'back' ? ' and heal (~5% hp)' : ''} each turn`,
                    { target: this, properties: this.position === "back" ? ["physical", "mana-gain", "heal"] : ["physical", "mana-gain"], listeners: { turnStart: true }, cancelListeners: ['turnStart'], reduction: this.position === 'back' ? Object.fromEntries(Object.entries(this.skills.passive.reduction).map(([k, v]) => [k, 2*v])) : this.skills.passive.reduction, passive: true },
                    function() {},
                    function(context) {
                        if (context.unit === this.vars.caster && this.vars.applied ){
                            resourceChange(this.vars.target, { mana: this.vars.target.manaRegen * 1.5 });
                            if (this.vars.caster.position === 'back') heal(this.vars.caster, [this.vars.target], [0.75]);
                        }
                    }
                );
            }
        },
    ]
}

Silhouette.frontDefaultSkills = [
    { category: 'special', name: 'Friends with the Shadows' },
    { category: 'basic', name: 'Summon Shadow' },
    { category: 'secondary', name: 'Shadow Shift' },
    { category: 'passive', name: 'Accursed Lineage' },
    { category: 'augment', name: 'Fear of the Dark' }
];

Silhouette.backDefaultSkills = [
    { category: 'special', name: 'Friends with the Shadows' },
    { category: 'basic', name: 'Summon Shadow' },
    { category: 'secondary', name: 'Shadow Shift' },
    { category: 'passive', name: 'Accursed Lineage' },
    { category: 'augment', name: 'Fear of the Dark' }
];

Silhouette.switchPosition = function(silent = false) {
    if (this.position === "back") {
        this.position = "front";
        this.base = { ...this.base, accuracy: 140, evasion: 95, focus: 170, resist: 100, speed: 85 };
        this.skills = {...this.frontSkills}
    } else {
        this.position = "back";
        this.base = { ...this.base, accuracy: 110, evasion: 160, focus: 135, resist: 140, speed: 75 };
        this.skills = {...this.backSkills}
    }
    logAction(`${this.name} shifts to the ${this.position}line.`, "info");
    resetStat(this, ["accuracy", "evasion", "focus", "resist", "speed"]);
    if (!silent && eventState.positionChange.length) handleEvent('positionChange', { unit: this, position: this.position });
}

const shadowSkills = {
    special: {
        name: "Proliferate",
        properties: ["mystic", "mana-block", "summon"],
        description: "If a target with a Strength Drain debuff is downed, create a new shadow",
        code() {
            const mod = modifiers.find(m => m.name === "Strength Drain debuff" && !m.vars.target.hp && m.vars.caster === this);
            mod ? summon(this, this, this.skills) && !logAction(`${this.name} proliferates!`, "action") && removeModifier(mod) : logAction(`${this.name} fails to proliferate!`, "miss");
        }
    },
    basic: {
        name: "Strike",
        properties: ["mystic", "attack"],
        description: "Attacks a single target",
        code() { attack(this, randTarget(allUnits.filter(u => u.hp && u.position === "front" && u.team !== this.team))) }
    },
    passive: {
        name: "Strength Drain",
        properties: ["mystic", "debuff"],
        description: "On hit, reduce target attack until caster is out of combat, 1% chance to fail",
        code() {
            new Modifier("Strength Drain", "On hit, reduce target attack until caster is out of combat, 1% chance to fail",
                { target: this, properties: ['mystic', 'debuff'], listeners: { singleDamage: true }, cancelListeners: ['singleDamage'], passive: true },
                function() {},
                function(context) {
                    if (context.attacker === this.vars.caster && context.damageSingle > 0) {
                        const will = resistDebuff(this.vars.caster, [context.defender]);
                        if (will >= 2) {
                            const mod = modifiers.find(m => m.name = "Strength Drain debuff" && m.vars.caster === this.vars.caster && m.vars.target === context.defender);
                            if (mod) {
                                mod.cancel(true, true);
                                mod.vars.stats.attack -= will > 99 ? 6 : Math.ceil(will/25);
                                mod.cancel(false, true);
                            } else basicModifier("Strength Drain debuff", "Reduce target attack until caster is out of combat", { target: context.defender, properties: ['mystic', 'debuff'], stats: { attack: -(will > 99 ? 6 : Math.ceil(will/25)) }, debuff: function(target) { return resistDebuff(this.vars.caster.vars.caster, [target])[0] >= 2 } });
                        }
                    }
                }
            );
        }
    }
}