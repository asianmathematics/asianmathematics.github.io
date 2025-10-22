import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const ClassicJoy = new Unit("Classical (Joy)", [1200, 64, 16, 160, 18, 170, 50, 120, 124, "back", 120, 120, 20, undefined, undefined, 140, 15], ["Death/Darkness", "Goner/Entropy", "Anomaly/Synthetic", "Independence/Loneliness", "Ingenuity/Insanity"], function() {
    this.actions.rapidFire = {
        name: "Rapid Fire [physical, energy]",
        properties: ["physical", "techno", "energy", "attack", "buff"],
        cost: { energy: 10 },
        description: "Costs 10 energy\nAttacks a single target 2 times with slightly increased damage and increases speed for 1 turn",
        points: 60,
        target: () => {
            if (this.resource.energy < 10) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.rapidFire, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 10;
            const statIncrease = [50];
            logAction(`${this.name} performs a Rapid Fire, boosting speed for 1 turn!`, "buff");
            this.previousAction[0] = this.previousAction[2] = true;
            attack(this, target, 2, { attacker: { attack: this.attack + 10 } });
            basicModifier("Rapid Fire Speed", "Temporary speed boost", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["speed"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.energyRifle = {
        name: "Energy Rifle [energy]",
        properties: ["techno", "energy", "attack"],
        cost: { energy: 20 },
        description: "Costs 20 energy\nAttacks a single target 4 times with increased accuracy and damage",
        points: 60,
        target: () => {
            if (this.resource.energy < 20) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.energyRifle, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 20;
            this.previousAction[2] = true;
            logAction(`${this.name} fires at ${target[0].name}!`, "action");
            attack(this, target, 4, { attacker: { accuracy: this.accuracy + 35, attack: this.attack + 10 } });
        }
    };

    /*put on another unit
    this.actions.emp = {
        name: "EMP [energy]",
        properties: ["techno", "energy", "inertia/cold", "debuff", "resource"],
        cost: { energy: 55 },
        description: "Costs 55 energy\nSets energy of target to 0 and disables energy regeneration for next turn",
        target: () => {
            if (this.resource.energy < 55) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.emp, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 55;
            this.previousAction[2] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.energy !== undefined) {
                if (will[0] > 35) {
                    if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: this.actions.emp, unit: target[0], resource: ['energy'], value: [-target[0].resource.energy] }) }
                    target[0].resource.energy = 0;
                    target[0].previousAction[2] = true;
                    logAction(`${this.name} disables ${target[0].name}'s energy!`, "action");
                } else { logAction(`${target[0].name} resists the emp`, "miss") }
            } else { logAction(`${target[0].name} has no energy to disable!`, "warning") }
        }
    };*/

    this.actions.synthesizeMedicine = {
        name: "Synthesize Medicine [techno]",
        properties: ["techno", "anomaly/synthetic", "heal"],
        description: "Moderately heals target (~8% max HP)",
        points: 60,
        target: () => { selectTarget(this.actions.synthesizeMedicine, () => { playerTurn(this) }, [1, true, unitFilter("player", "")]) },
        code: (target) => {
            this.previousAction[2] = true;
            let elementBonus = 0;
            if (target[0].elements.includes("Anomaly/Synthetic")) { elementBonus++ }
            if (target[0].elements.includes("Radiance/Purity") || target[0].elements.includes("Nature/Life")) { elementBonus-- }
            if (eventState.elementEffect.flag) { handleEvent('elementEffect', { effect: this.actions.synthesizeMedicine, target: target[0], elementBonus }) }
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.synthesizeMedicine, unit: target[0], resource: ['hp'], value: [Math.floor(((2 ** elementBonus) * .8 * target[0].resource.healFactor) + Number.EPSILON)] }) }
            target[0].hp = Math.min(target[0].base.hp, target[0].hp + Math.floor(((2 ** elementBonus) * .8 * target[0].resource.healFactor) + Number.EPSILON));
            logAction(`${this.name} heals ${target[0].name} for ${Math.floor(((2 ** elementBonus) * .8 * target[0].resource.healFactor) + Number.EPSILON)} HP!`, "heal");
        }
    };

    this.actions.fastReload = {
        name: "Fast Reload [physical]",
        properties: ["physical", "attack"],
        description: `Regains some of energy (${this.resource.energyRegen * 2})`,
        code: () => {
            this.previousAction[0] = true;
            logAction(`${this.name} reloads instead of switching to his secondary!`, "heal");
            if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: this.actions.fastReload, unit: this, resource: ['energy'], value: [this.resource.energyRegen * 2] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + this.resource.energyRegen * 2);
        }
    };

    this.actions.joy = {
        name: "Joy [stamina]",
        properties: ["physical", "stamina", "death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic", "ingenuity/insanity", "buff", "debuff"],
        cost: { stamina: 10 },
        description: `Costs ${this.base.hp/5} HP & 10 stamina\nDelayed consequences`,
        points: 60,
        target: () => { selectTarget(this.actions.joy, () => { playerTurn(this) }, [1, true, unitFilter("player", "", false)]) },
        code: (target) => {
            if (this.resource.stamina < 10) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 10;
            const statIncrease = [80, 100, 32, 100];
            const statDecrease = [-30, -8, -12, -60, -80, -70];
            const mod = modifiers.find(m => m.name === "Joy" && m.vars.targets.includes(target[0]));
            if (mod) {
                logAction(`${this.name} reapplies Joy on ${target[0].name}!`, "buff");
                removeModifier(mod);
            } else { logAction(`${this.name} gives ${target[0].name} some joy!`, "buff") }
            new Modifier("Joy", "Overall increase?",
                { caster: this, targets: target, duration: 20, elements: ["death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic", "ingenuity/insanity"], buffs: ["accuracy", "focus", "defense", "resist"], buffValues: statIncrease, debuffs: ["attack", "defense", "evasion", "speed", "accuracy", "presence"], debuffValues: statDecrease, listeners: { turnStart: true, actionStart: false }, cancel: false, applied: true, focus: false, penality: false },
                function() {
                    let elementBonus = 0;
                    if (this.vars.targets[0].elements.includes("Death/Darkness")) { elementBonus++ }
                    if (this.vars.targets[0].elements.includes("Anomaly/Synthetic")) { elementBonus++ }
                    if (this.vars.targets[0].elements.includes("Light/Illusion") || this.vars.targets[0].elements.includes("Radiance/Purity")) { elementBonus-- }
                    if (this.vars.targets[0].elements.includes("Radiance/Purity") || this.vars.targets[0].elements.includes("Nature/Life")) { elementBonus-- }
                    if (this.vars.targets[0].elements.includes("Ingenuity/Insanity")) { elementBonus += 2 }
                    if (eventState.elementEffect.flag) { handleEvent('elementEffect', { effect: this, target: this.vars.targets[0], elementBonus }) }
                    if (elementBonus !== 0) {
                        for (let i = 0; i < this.vars.buffValues.length; i++) { this.vars.buffValues[i] = Math.floor(this.vars.buffValues[i] * (1.5 ** elementBonus) + Number.EPSILON) }
                        for (let i = 0; i < this.vars.debuffValues.length; i++) { this.vars.debuffValues[i] = Math.floor(this.vars.debuffValues[i] * (1.5 ** elementBonus) + Number.EPSILON) }
                    }
                    resetStat(this.vars.targets[0], this.vars.buffs, this.vars.buffValues);
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        if (this.vars.penality) { resetStat(this.vars.targets[0], this.vars.debuffs, this.vars.debuffValues, false) }
                        else { resetStat(this.vars.targets[0], this.vars.buffs, this.vars.buffValues, false) }
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        if (this.vars.penality) { resetStat(this.vars.targets[0], this.vars.debuffs, this.vars.debuffValues) }
                        else { resetStat(this.vars.targets[0], this.vars.buffs, this.vars.buffValues) }
                        this.vars.applied = true;
                    }
                    if (this.vars.listeners.actionStart && context?.unit === this.vars.targets[0]) {
                        if (this.vars.penality) {
                            for (const element of ["light/illusion", "knowledge/memory", "goner/entropy", "harmonic/change", "inertia/cold", "radiance/purity", "nature/life"]) {
                                if (this.vars.targets[0].shield.includes(element)) { this.vars.targets[0].shield.splice(this.vars.targets[0].shield.indexOf(element), 1) }
                                else if (!this.vars.targets[0].absorb.includes(element)) { this.vars.targets[0].absorb.push(element) }
                            }
                        } else { this.vars.targets[0].shield.push("death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic") }
                        this.vars.listeners.actionStart = false;
                        eventState.actionStart.listeners.splice(eventState.actionStart.listeners.indexOf(this), 1)
                        if (eventState.actionStart.listeners.length === 0) { eventState.actionStart.flag = false }
                        return;
                    }
                    if (this.vars.targets[0] === context?.unit) {
                        this.vars.duration--;
                        if (this.vars.applied) {
                            this.vars.listeners.actionStart = eventState.actionStart.flag = true;
                            eventState.actionStart.listeners.push(this);
                        }
                    }
                    if (this.vars.duration === 14) {
                        if (this.vars.applied) {
                            resetStat(this.vars.targets[0], this.vars.buffs, this.vars.buffValues, false);
                            resetStat(this.vars.targets[0], this.vars.debuffs, this.vars.debuffValues);
                        }
                        this.vars.penality = true;
                        logAction(`${this.vars.targets[0].name} is feeling the side effects!`, "debuff");
                        this.description = "Long side effect period";
                    }
                    if (this.vars.duration === 0) { return true }
                }
            );
            let damageSingle = this.base.hp / 5;
            if (eventState.singleDamage.flag) { handleEvent('singleDamage', {attacker: this, defender: this, damageSingle: damageSingle }) }
            this.hp = Math.max(this.hp - damageSingle, 0);
            if (this.hp === 0 && eventState.unitChange.flag) { handleEvent('unitChange', {type: 'downed', unit: this}) }
        }
    };
});