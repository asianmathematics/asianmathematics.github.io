import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Electric = new Unit("Electric", [1000, 44, 20, 105, 25, 110, 50, 100, 100, "front", 125, 100, 10, 50, 10, 200, 20], ["light/illusion", "harmonic/change", "radiance/purity", "anomaly/synthetic"], function() {
    this.actions.electricDischarge = {
        name: "Electric Discharge [mystic, energy]",
        properties: ["mystic", "techno", "energy", "harmonic/change", "attack"],
        cost: { energy: 60 },
        description: "Costs 60 energy\nDeals 5 attacks to a single target with increased crit chance and damage",
        points: 60,
        target: () => {
            if (this.resource.energy < 60) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.electricDischarge, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 60;
            this.previousAction[1] = this.previousAction[2] = true;
            logAction(`${this.name} channels a powerful electric discharge into ${target[0].name}!`, "action");
            attack(this, target, 5, { attacker: { focus: this.focus + 50, attack: this.attack + 28 } });
        }
    };

    this.actions.sickBeats = {
        name: "Sick Beats [energy]",
        properties: ["techno", "energy", "harmonic/change", "buff"],
        cost: { energy: 50 },
        description: "Costs 50 energy\nBoosts speed, evasion, and presence of a friendly unit for 2 turns",
        points: 60,
        target: () => {
            if (this.resource.energy < 50) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.sickBeats, () => { playerTurn(this) }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            const statIncrease = [20, 10, 100];
            const bonus = elementBonus(target[0], this.actions.sickBeats)
            if (bonus) { statIncrease.forEach((_, i) => statIncrease[i] *= 2 ** bonus) }
            this.resource.energy -= 50;
            this.previousAction[2] = true;
            logAction(`${this.name} plays sick beats, energizing ${target[0].name}!`, "buff");
            basicModifier("Sick Beats Buff", "Rhythmic performance enhancement", { caster: this, targets: target, duration: 2, attributes: ["techno"], elements: ["harmonic/change"], stats: ["speed", "evasion", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.recharge = {
        name: "Recharge [mana]",
        properties: ["mystic", "mana", "harmonic/change", "resource"],
        cost: { mana: 20 },
        description: `Costs 20 mana\nConverts mana into a lot of energy (${this.resource.energyRegen * 3.5})`,
        points: 60,
        code: () => {
            if (this.resource.mana < 20) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 20;
            this.previousAction[1] = true;
            logAction(`${this.name} generates electricity!`, "heal");
            if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: this.actions.recharge, unit: this, resource: ['energy'], value: [this.resource.energyRegen * 3.5] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + this.resource.energyRegen * 3.5);
        }
    };

    this.actions.electrify = {
        name: "Electrify [mystic, energy]",
        properties: ["mystic", "techno", "energy", "harmonic/change", "radiance/purity", "counterattack", "autohit"],
        cost: { energy: 20 },
        description: "Costs 20 energy\nDeals counter damage whenever a frontline unit hits and increases resist and presence for 1 turn",
        points: 60,
        code: () => {
            if (this.resource.energy < 20) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            const statIncrease  = [15, 105];
            this.resource.energy -= 20;
            this.previousAction[1] = this.previousAction[2] = true;
            logAction(`${this.name} covers himself in electricity.`, "buff");
            new Modifier("Electrify", "Counter attack",
                { caster: this, targets: [this], duration: 1, attributes: ["mystic", "techno"], elements:["harmonic/change", "radiance/purity"], stats: ["resist", "presence"], values: statIncrease, listeners: {turnStart: true, damageStart: true, singleDamage: false}, cancel: false, applied: true, focus: true },
                function() { resetStat(this.vars.caster, this.vars.stats, this.vars.values) },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.caster, this.vars.stats, this.vars.values, false);
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.caster, this.vars.stats, this.vars.values);
                        this.vars.applied = true;
                    }
                    if (this.vars.applied && !this.vars.listeners.singleDamage && context?.defenders?.includes(this.vars.caster) && context?.attacker.position === "front") {
                        this.vars.listeners.singleDamage = eventState.singleDamage.flag = true;
                        eventState.singleDamage.listeners.push(this);
                    } else if ((!this.vars.applied || !context?.defenders || !context.defenders.includes(this.vars.caster) || context.attacker.position !== "front") && this.vars.listeners.singleDamage) {
                        this.vars.listeners.singleDamage = false;
                        eventState.singleDamage.listeners.splice(eventState.singleDamage.listeners.indexOf(this), 1)
                        if (eventState.singleDamage.listeners.length === 0) { eventState.singleDamage.flag = false }
                    }
                    if (this.vars.caster === context?.defender && context?.damageSingle > 0) {
                        const doubleDamage = elementDamage(this.vars.caster, context.attacker, this);
                        const damageSingle = (doubleDamage + 1) * ( Math.ceil(Math.max(((Math.random() / 2) + .75) * (2 * this.vars.caster.attack - context.attacker.defense), .2 * this.vars.caster.attack)));
                        if (eventState.singleDamage.flag) { handleEvent('singleDamage', {attacker: this.vars.caster, defender: context.attacker, damageSingle}) }
                        context.attacker.hp = Math.max(context.attacker.hp - damageSingle, 0);
                        logAction(`${this.vars.caster.name} electricity shocks ${context.attacker.name} dealing ${damageSingle} ${doubleDamage ? "elemental " : ""}damage!`, "hit")
                        if (defenders[i].hp === 0) {
                            for (const mod of modifiers) { if (mod.caster === defenders[i] && mod.focus) { removeModifier(mod) } }
                            if (eventState.unitChange.flag) { handleEvent('unitChange', {type: 'downed', unit: defenders[i]}) }
                        }
                    }
                    if (this.vars.caster === context.unit) { this.vars.duration-- }
                    if (this.vars.duration === 0) { return true }
                }
            );
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        properties: ["physical", "buff"],
        description: "Slightly increases defense and resist, slightly decreases presence, and increases evasion for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [2, 12, 7, -2];
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            basicModifier("Dodge", "Evasion and resist increased", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["defense", "evasion", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };
});