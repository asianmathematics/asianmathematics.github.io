import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Electric = new Unit("Electric", [1400, 80, 35, 140, 82, 175, 80, 120, 150, "front", 120, 90, 8, 60, 7, 150, 12], ["light/illusion", "harmonic/change", "radiance/purity", "anomaly/synthetic"], function() {
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
            this.team === "player" ? selectTarget(this.actions.electricDischarge, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.electricDischarge.code(randTarget(unitFilter("player", "front", false)));
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
            this.team === "player" ? selectTarget(this.actions.sickBeats, () => { playerTurn(this) }, [1, true, unitFilter("player", "", false)]) : this.actions.sickBeats.code(randTarget(unitFilter("enemy", "", false)));
        },
        code: (target) => {
            const bonus = 2 ** elementBonus(target[0], this.actions.sickBeats);
            const statIncrease = [Math.round(20 * bonus), Math.round(10 * bonus), Math.round(100 * bonus)];
            this.resource.energy -= 50;
            this.previousAction[2] = true;
            logAction(`${this.name} plays sick beats, energizing ${target[0].name}!`, "buff");
            basicModifier("Sick Beats Buff", "Rhythmic performance enhancement", { caster: this, target: target[0], duration: 2, attributes: ["techno"], elements: ["harmonic/change"], stats: ["speed", "evasion", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true },
                function(unit) {
                    if (unit === this.vars.target) { removeModifier(this) }
                    else {
                        if (this.vars.applied) { resetStat(this.vars.target, this.vars.stats, this.vars.values, false) }
                        const bonus = 2 ** elementBonus(unit, this);
                        this.vars.target = unit;
                        this.vars.values = [Math.round(20 * bonus), Math.round(10 * bonus), Math.round(100 * bonus)];
                        if (this.vars.applied) { resetStat(unit, this.vars.stats, this.vars.values) }
                    }
                }
            );
        }
    };

    this.actions.emp = {
        name: "EMP [energy]",
        properties: ["techno", "energy", "harmonic/change", "intertia/cold", "debuff", "resource"],
        cost: { energy: 40 },
        description: "Costs 40 energy\nChance to set target&#39;s energy to 0, disable energy regeneration for next turn, and end all techno modifiers it focuses or cast on it",
        points: 60,
        target: () => {
            if (this.resource.energy < 40) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.emp, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.emp.code(randTarget(unitFilter("player", "front", false).filter(u => u.base.resource.energy)));
        },
        code: (target) => {
            if (target.length) {
                this.resource.energy -= 40;
                this.previousAction[2] = true;
                if (target[0].resource.energy !== undefined) {
                    if (resistDebuff(this, target)[0] > 25) {
                        if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.actions.emp, unit: target[0], resource: ['energy'], value: [-target[0].resource.energy] }) }
                        target[0].resource.energy = 0;
                        target[0].previousAction[2] = true;
                        for (const mod of modifiers.filter(m => m?.attributes?.includes("techno") && ((m.vars.caster === target[0] && m.vars.focus) || m.vars?.target === target[0]))) { removeModifier(mod) }
                        for (const mod of modifiers.filter(m => m.vars?.targets?.includes(target[0]) && m?.attributes?.includes("techno"))) { mod.changeTarget(target) }
                        window.updateModifiers();
                        logAction(`${this.name} EMPs ${target[0].name}'s energy!`, "action");
                    } else { logAction(`${target[0].name} resists EMP`, "miss") }
                } else { logAction(`${target[0].name} has no energy to EMP!`, "warning") }
            } else {
                currentAction[currentAction.length - 1] = this.actions.electrify;
                this.actions.electrify.code();
            }
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
            if (eventState.resourceChange.length) {handleEvent('resourceChange', { effect: this.actions.recharge, unit: this, resource: ['energy'], value: [this.resource.energyRegen * 3.5] }) }
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
            logAction(`${this.name} is covered in electricity.`, "buff");
            new Modifier("Electrify", "Counter attack",
                { caster: this, target: this, duration: 2, attributes: ["mystic", "techno"], elements:["harmonic/change", "radiance/purity"], stats: ["resist", "presence"], values: statIncrease, counterMap: {}, listeners: { turnEnd: true, singleDamage: true}, cancel: false, applied: true, focus: true },
                function() { resetStat(this.vars.target, this.vars.stats, this.vars.values) },
                function(context) {
                    if (currentAction.at(-2)?.vars?.counterMap) { return }
                    if (context.event === "turnEnd") {
                        Object.keys(this.vars.counterMap).forEach(k => damage(this.vars.target, [allUnits.find(u => u.name === k)], [Array(this.vars.counterMap[k]).fill(0.5)]));
                        this.vars.counterMap = {};
                    }
                    if (this.vars.applied && this.vars.target === context?.defender && context.damageSingle > 0) { this.vars.counterMap[context.attacker?.vars?.caster?.name || context.attacker.name] ? this.vars.counterMap[context.attacker?.vars?.caster?.name || context.attacker.name]++ : this.vars.counterMap[context.attacker?.vars?.caster?.name || context.attacker.name] = 1 }
                    if (this.vars.caster === context.unit) { this.vars.duration-- }
                    if (this.vars.duration === 0) { return true }
                },
                function(cancel, temp) {
                    if (!temp) {
                        Object.keys(this.vars.counterMap).forEach(k => damage(this.vars.target, [allUnits.find(u => u.name === k)], [Array(this.vars.counterMap[k]).fill(0.5)]));
                        this.vars.counterMap = {};
                    }
                    if (this.vars.cancel && this.vars.applied) {
                        resetStat(this.vars.target, this.vars.stats, this.vars.values, false);
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        resetStat(this.vars.target, this.vars.stats, this.vars.values);
                        this.vars.applied = true;
                    }
                }
            );
        }
    };

    this.actions.actionWeight = {
        electricDischarge: 0.4,
        sickBeats: 0.2,
        emp: 0.25,
        recharge: 0.05,
        electrify: 0.1,
    };
});

Electric.description = "4 star magitech unit with high versatility";