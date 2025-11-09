import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Dreamer = new Unit("Dreamer", [1200, 60, 16, 125, 35, 175, 85, 100, 150, "back", 80, 40, 4, 100, 16], ["light/illusion", "knowledge/memory", "interia/cold", "independence/loneliness", "ingenuity/insanity"], function() {
    this.actions.knifeSlash = {
        name: "Knife Slash [physical]",
        properties: ["physical", "attack"],
        description: "Attacks a single target with increased accuracy and crit chance.",
        points: 60,
        target: () => { this.actions.knifeSlash.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            this.previousAction[0] = true;
            logAction(`${this.name} slices ${target[0].name}`, "action");
            attack(this, target, 1, { accuracy: this.accuracy + 33, focus: this.focus + 15 });
        }
    };

    this.actions.emotion = {
        name: "Emotion [mystic]",
        properties: ["stamina", "mystic", "harmonic/change", "radiance/purity", "buff", "debuff"],
        cost: { mana: 60 },
        description: "Costs 60 mana\nGains a random emotion for 5 turns",
        points: 60,
        code: () => {
            const happy = [25, 20, -30];
            const angry = [50, -15];
            const sad = [33, -10];
            const afraid = [8, -20];
            this.previousAction[1] = true;
            this.resource.mana -= 60;
            const mod = modifiers.find(m => m.vars.caster === this && (m.name === "Happy" || m.name === "Angry" || m.name === "Sad" || m.name === "Afraid"));
            if (mod) { removeModifier(mod) }
            switch (Math.ceil(Math.random()*10/3)) {
                case 1:
                    logAction(`${this.name} feels Happy!`, "buff");
                    basicModifier("Happy", "Increased crit chance and speed, decreased accuracy", { caster: this, target: this, duration: 6, attributes: ["mystic"], elements: ["radiance/purity"], stats: ["focus", "speed", "accuracy"], values: happy, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
                    break;
                case 2:
                    logAction(`${this.name} feels Angry!`, "buff");
                    basicModifier("Angry", "Increased damage, decreased defense", { caster: this, target: this, duration: 6, attributes: ["mystic"], elements: ["radiance/purity"], stats: ["attack", "defense"], values: angry, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
                    break;
                case 3:
                    logAction(`${this.name} feels Sad!`, "buff");
                    basicModifier("Sad", "Increased defense, decreased speed", { caster: this, target: this, duration: 6, attributes: ["mystic"], elements: ["radiance/purity"], stats: ["defense", "speed"], values: sad, listeners: { turnEnd: true }, cancel: false, applied: true, focus: true });
                    break;
                case 4:
                    logAction(`${this.name} feels Afraid!`, "debuff");
                    basicModifier("Afraid", "Slightly increased damage, greatly decreased defense", { caster: this, target: this, duration: 6, attributes: ["mystic"], elements: ["radiance/purity"], stats: ["attack", "defense"], values: afraid, listeners: { turnEnd: true }, cancel: false, applied: true, focus: false, penalty: true });
            }
        }
    };

    this.actions.dissociation = {
        name: "Dissociation [physical, mana]",
        properties: ["physical", "mystic", "mana", "goner/entropy", "independence/lonliness", "ingenuity/insanity", "buff"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nIncreases evasion and resist, and decreases presence for 2 turns",
        points: 60,
        code: () => {
            const statIncrease = [7, 10, -40];
            this.previousAction[0] = this.previousAction[1] = true;
            this.resource.mana -= 40;
            logAction(`${this.name} dissocates from battle!`, "buff");
            basicModifier("Dissociate", "Enhanced defenses", { caster: this, target: this, duration: 2, attributes: ["mystic"], elements: ["inertia/cold"], stats: ["evasion", "resist", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.laze = {
        name: "Laze",
        properties: ["debuff", "resource"],
        description: `Regain a lot of mana (${this.resource.manaRegen * 5}) and decreases speed, presence, & all defensive stats for 1 turn`,
        points: 60,
        code: () => {
            const statDecrease = [-30, -50, -4, -10, -10];
            if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.actions.laze, unit: this, resource: ['mana'], value: [this.resource.manaRegen * 5] }) }
            this.resource.mana = Math.min(this.resource.mana + (this.resource.manaRegen * 5), this.base.resource.mana);
            logAction(`${this.name} layed down lazily.`, "action");
            basicModifier("Resting", "Decreased speed, presence, and defensive stats", { caster: this, target: this, duration: 1, stats: ["speed", "presence", "defense", "evasion", "resist"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.actionWeight = {
        knifeSlash: 0.6,
        emotion: 0.1,
        dissociation: 0.25,
        laze: 0.05
    };
}, function() {
    this.passives.effect = {
        name: "Effect [passive]",
        properties: ["passive", "harmonic/change", "buff", "debuff"],
        description: "Grants a random effect per turn",
        points: 30,
        code: () => {
            new Modifier( "Effect: none", "Produces one random effect per turn\nCurrent effect: none",
                { caster: this, targets: allUnits.filter(u => u !== this), effectType: null, effectVars: {}, listeners: { turnStart: true, singleDamage: false, unitChange: false }, cancel: false, applied: true, focus: true, passive: true },
                function () {},
                function (context) {
                    if (this.vars.listeners.unitChange && context.unit === this.vars.caster && context.type === "revive") { this.cancel(false) }
                    else if (context.event === "turnStart" && context.unit === this.vars.caster) {
                        if (this.vars.listeners.singleDamage) {
                            this.vars.listeners.singleDamage = false;
                            eventState.singleDamage.splice(eventState.singleDamage.indexOf(this), 1);
                        }
                        if (this.vars.applied && this.vars.effectType && this.vars.effectVars.stats && this.vars.effectVars.values) { resetStat(this.vars.caster, this.vars.effectVars.stats, this.vars.effectVars.values, false) }
                        if (this.vars.applied && this.vars.effectVars?.affectedUnits) { for (const unit of this.vars.effectVars.affectedUnits) { resetStat(unit, this.vars.effectVars.stats, this.vars.effectVars.values, false) } }
                        const effects = ["frog", "umbrella", "hatAndScarf", "yuki-onna", "knife", "medamaude", "fat", "midget", "flute", "neon", "nopperabou", "severedHead", "towel", "cat", "lamp", "bicycle", "longHair", "poopHair", "blondeHair", "triangleKerchief", "witch", "demon", "buyoBuyo", "stoplight"];
                        const effect = effects[Math.floor(Math.random() * effects.length)];
                        this.vars.effectType = effect;
                        this.vars.effectVars = {};
                        let stats = [], values = [];
                        switch (effect) {
                            case "frog":
                                this.name = "Effect: Frog";
                                this.description = "Current effect: Increased speed and presence";
                                stats = ["speed", "presence"];
                                values = [15, 15];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "umbrella":
                                this.name = "Effect: Umbrella";
                                this.description = "Current effect: Decreased other units speed, increased presence";
                                stats = ["speed"];
                                values = [-15];
                                if (this.vars.applied) { 
                                    for (const unit of this.vars.targets) { resetStat(unit, stats, values) }
                                    resetStat(this.vars.caster, ["presence"], [15]);
                                }
                                this.vars.effectVars = { stats, values, affectedUnits: this.vars.targets };
                                break;
                            case "hatAndScarf":
                                this.name = "Effect: Hat & Scarf";
                                this.description = "Current effect: Decreased speed and presence, moves random downed midline ally to back";
                                stats = ["speed", "presence"];
                                values = [-30, -30];
                                if (this.vars.applied) {
                                    resetStat(this.vars.caster, stats, values);
                                    const target = randTarget(unitFilter("enemy", "mid", true).filter(u => u.position === "front"), 1, true)
                                    if (target.length) {
                                        currentAction.push(target.actions.switchPosition);
                                        target.actions.switchPosition.code();
                                        currentAction.pop();
                                    }
                                }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "yuki-onna":
                                this.name = "Effect: Yuki-Onna";
                                this.description = "Current effect: Decreased other units speed, increased presence, strengthens Inertia/Cold units";
                                stats = ["speed"];
                                values = [-15];
                                if (this.vars.applied) {
                                    for (const unit of this.vars.targets) resetStat(unit, stats, values);
                                    resetStat(this.vars.caster, ["presence"], [15]);
                                    for (const unit of allUnits.filter(u => u.elements.includes("inertia/cold"))) { unit.shield.push("harmonic/change", "radience/purity") }
                                }
                                this.vars.effectVars = { stats, values, affectedUnits: this.vars.targets };
                                break;
                            case "knife":
                                this.name = "Effect: Knife";
                                this.description = "Current effect: Random knife attack";
                                if (this.vars.applied) {
                                    currentAction.push(this.vars.caster.actions.knifeSlash);
                                    this.vars.caster.action.knifeSlash.code(randTarget(unitFilter("player", "front", false), 1, true));
                                    currentAction.pop();
                                }
                                break;
                            case "medamaude":
                                this.name = "Effect: Medamaude";
                                this.description = "Current effect: Chance to negate damage";
                                this.vars.effectVars.negate = 1/3;
                                break;
                            case "fat":
                                this.name = "Effect: Fat";
                                this.description = "Current effect: increased presence and defense, decreased evasion";
                                stats = ["presence", "defense", "evasion"];
                                values = [40, 20, -5];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "midget":
                                this.name = "Effect: Midget";
                                this.description = "Current effect: chance to negate damage, increased evasion, decreased presence";
                                stats = ["evasion", "presence"];
                                values = [5, -110];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values, negate: 1/6 };
                                break;
                            case "flute":
                                this.name = "Effect: Flute";
                                this.description = "Current effect: Increased presence, strengthens Harmonic/Change units";
                                stats = ["presence"];
                                values = [300];
                                if (this.vars.applied) {
                                    resetStat(this.vars.caster, stats, values);
                                    for (const unit of allUnits.filter(u => u.elements.includes("harmonic/change"))) { unit.shield.push("goner/entropy", "inertia/change") }
                                }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "neon":
                                this.name = "Effect: Neon";
                                this.description = "Current effect: Increased presence, strengthens Light/Illusion units";
                                stats = ["presence"];
                                values = [300];
                                if (this.vars.applied) {
                                    resetStat(this.vars.caster, stats, values);
                                    for (const unit of allUnits.filter(u => u.elements.includes("light/illusion"))) { unit.shield.push("death/darkness", "knowledge/memory") }
                                }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "nopperabou":
                                this.name = "Effect: Nopperabou";
                                this.description = "Current effect: Increased evasion and presence";
                                stats = ["evasion", "presence"];
                                values = [5, 40];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "severedHead":
                                this.name = "Effect: Severed Head";
                                this.description = "Current effect: Decreased presence and speed, increased evasion";
                                stats = ["presence", "speed", "evasion"];
                                values = [-30, -10, 10];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "towel":
                                this.name = "Effect: Towel";
                                this.description = "Current effect: Increased presence and defense";
                                stats = ["presence", "defense"];
                                values = [30, 9];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "cat":
                                this.name = "Effect: Cat";
                                this.description = "Current effect: Slightly increased luck stats";
                                stats = ["presence", "accuracy", "evasion", "focus", "resist"];
                                values = [5, 5, 1, 5, 1];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "lamp":
                                this.name = "Effect: Lamp";
                                this.description = "Current effect: Increased presence, strengthens Light/Illusion units, weakens Death/Darkness units";
                                stats = ["presence"];
                                values = [300];
                                if (this.vars.applied) {
                                resetStat(this.vars.caster, stats, values);
                                    for (const unit of this.vars.targets.filter(u => u.elements.includes("light/illusion"))) { unit.shield.push("death/darkness", "knowledge/memory") }
                                    for (const unit of this.vars.targets.filter(u => u.elements.includes("death/darkness"))) {
                                        if (unit.shield.includes("nature/life")) { unit.shield.splice(unit.shield.indexOf("nature/life"), 1) }
                                        else if (!unit.absorb.includes("nature/life")) { unit.absorb.push("nature/life") }
                                        if (unit.shield.includes("light/illusion")) { unit.shield.splice(unit.shield.indexOf("light/illusion"), 1) }
                                        else if (!unit.absorb.includes("light/illusion")) { unit.absorb.push("light/illusion") }
                                    }
                                }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "bicycle":
                                this.name = "Effect: Bicycle";
                                this.description = "Current effect: Increased speed and presence";
                                stats = ["speed", "presence"];
                                values = [15, 15];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "longHair":
                                this.name = "Effect: Long Hair";
                                this.description = "Current effect: Increased presence";
                                stats = ["presence"];
                                values = [300];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "poopHair":
                                this.name = "Effect: Poop Hair";
                                const target = randTarget(this.vars.targets, 1, true);
                                this.description = `Current effect: Random target (${target[0].name}) increased presence`;
                                if (this.vars.applied) { resetStat(target[0], ["presence"], [300]) }
                                this.vars.effectVars = { stats: ["presence"], values: [300], affectedUnits: target };
                                break;
                            case "blondeHair":
                                this.name = "Effect: Blonde Hair";
                                this.description = "Current effect: Increased presence";
                                stats = ["presence"];
                                values = [300];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "triangleKerchief":
                                this.name = "Effect: Triangle Kerchief";
                                this.description = "Current effect: Increased evasion, decreased presence";
                                stats = ["evasion", "presence"];
                                values = [10, -220];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "witch":
                                this.name = "Effect: Witch";
                                this.description = "Current effect: Increased evasion and presence";
                                stats = ["evasion", "presence"];
                                values = [5, 40];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "demon":
                                this.name = "Effect: Demon";
                                this.description = "Current effect: 30 damage to random target";
                                if (this.vars.applied) {
                                    const target = randTarget(unitFilter("player", "", false), 1, true)[0]
                                    if (eventState.singleDamage.length) { handleEvent('singleDamage', {attacker: this.vars.caster, defender: target, damageSingle: 30}) }
                                    logAction(`Lightning struck ${target.name}!`, "action")
                                    target.hp = Math.max(target.hp - 30, 0)
                                }
                                break;
                            case "buyoBuyo":
                                this.name = "Effect: Buyo Buyo";
                                this.description = "Current effect: Increased presence";
                                stats = ["presence"];
                                values = [300];
                                if (this.vars.applied) { resetStat(this.vars.caster, stats, values) }
                                this.vars.effectVars = { stats, values };
                                break;
                            case "stoplight":
                                this.name = "Effect: Stoplight";
                                this.description = "Current effect: Random action";
                                if (this.vars.applied) {
                                    const actionKeys = Object.keys(this.vars.caster.actions).filter(key => key !== "actionWeight" && (!key.cost || !Object.keys(key.cost).filter(r => r !== "position").some(this.vars.caster.resource[r] < key.cost[r])));
                                    const action = this.vars.caster.actions[actionKeys[Math.floor(Math.random() * actionKeys.length)]];
                                    currentAction.push(action);
                                    action.target ? action.target() : action.code();
                                    currentAction.pop();
                                }
                                break;
                        }
                    } else if (context.defender === this.vars.caster) {
                        if (resistDebuff(this.vars.caster, [context.attacker]) > 100 * this.vars.effectVars.negate) {
                            if (!context.original) { context.original = context.damageSingle }
                            context.nullify = (context.nullify || 0) + 1;
                            context.damageSingle = 0;
                        }
                    }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        if (this.vars.effectVars?.stats && this.vars.effectVars?.values) { resetStat(this.vars.caster, this.vars.effectVars.stats, this.vars.effectVars.values, false) }
                        if (this.vars.effectVars?.affectedUnits) { for (const unit of this.vars.effectVars.affectedUnits) { resetStat(unit, this.vars.effectVars.stats, this.vars.effectVars.values, false) } }
                        if (this.vars.listeners.damageSingle) {
                            this.vars.listeners.damageSingle = false;
                            eventState.damageSingle.splice(eventState.damageSingle.indexOf(this), 1);
                        }
                        this.vars.listeners.turnStart = false;
                        eventState.turnStart.splice(eventState.turnStart.indexOf(this), 1);
                        this.vars.listeners.unitChange = true;
                        eventState.unitChange.push(this);
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        if (this.vars.effectVars?.stats && this.vars.effectVars?.values) { resetStat(this.vars.caster, this.vars.effectVars.stats, this.vars.effectVars.values) }
                        if (this.vars.effectVars?.affectedUnits) { for (const unit of this.vars.effectVars.affectedUnits) { resetStat(unit, this.vars.effectVars.stats, this.vars.effectVars.values) } }
                        if (this.vars.effectVars.negate) { this.vars.listeners.damageSingle = true }
                        this.vars.listeners.unitChange = false;
                        eventState.unitChange.splice(eventState.unitChange.indexOf(this), 1);
                        this.vars.listeners.turnStart = true;
                        eventState.turnStart.push(this);
                    }
                }
            );
        }
    };
})