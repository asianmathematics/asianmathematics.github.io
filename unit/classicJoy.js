import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const ClassicJoy = new Unit("Classical (Joy)", [1000, 60, 16, 160, 20, 170, 50, 120, 120, "back", 120, 110, 20, undefined, undefined, 140, 15], ["death/darkness", "goner/entropy", "anomaly/synthetic", "precision/perfection", "independence/loneliness", "passion/hatred", "ingenuity/insanity"], function() {
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
            this.team === "player" ? selectTarget(this.actions.rapidFire, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.rapidFire.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            this.resource.energy -= 10;
            const statIncrease = [50];
            logAction(`${this.name} performs a Rapid Fire, boosting speed for 1 turn!`, "buff");
            this.previousAction[0] = this.previousAction[2] = true;
            attack(this, target, 2, { attacker: { attack: this.attack + 10 } });
            basicModifier("Rapid Fire Speed", "Temporary speed boost", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["speed"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.energyRifle = {
        name: "Energy Rifle [energy]",
        properties: ["techno", "energy", "radiance/purity", "attack"],
        cost: { energy: 20 },
        description: "Costs 20 energy\nAttacks a single target 4 times with increased accuracy and damage",
        points: 60,
        target: () => {
            if (this.resource.energy < 20) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.energyRifle, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.energyRifle.code(randTarget(unitFilter("player", "front", false)));
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
                    if (eventState.resourceChange.length) {handleEvent('resourceChange', { effect: this.actions.emp, unit: target[0], resource: ['energy'], value: [-target[0].resource.energy] }) }
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
        target: () => { this.team === "player" ? selectTarget(this.actions.synthesizeMedicine, () => { playerTurn(this) }, [1, true, unitFilter("player", "")]) : this.actions.synthesizeMedicine.code(randTarget(unitFilter("enemy", "").filter(unit => unit.hp < unit.base.hp))) },
        code: (target) => {
            if (target.length) {
                this.previousAction[2] = true;
                const bonus = 2 ** elementBonus(target[0], this.actions.synthesizeMedicine);
                if (eventState.resourceChange.length) { handleEvent('resourceChange', { effect: this.actions.synthesizeMedicine, unit: target[0], resource: ['hp'], value: [Math.floor((bonus * .8 * target[0].resource.healFactor) + Number.EPSILON)] }) }
                if (target[0].hp === 0 && eventState.unitChange.length) { handleEvent('unitChange', {type: 'revive', unit: target[0]}) }
                target[0].hp = Math.min(target[0].base.hp, target[0].hp + Math.floor((bonus * .8 * target[0].resource.healFactor) + Number.EPSILON));
                logAction(`${this.name} heals ${target[0].name} for ${Math.floor((bonus * .8 * target[0].resource.healFactor) + Number.EPSILON)} HP!`, "heal");
            } else { this.actions.fastReload.code() }
        }
    };

    this.actions.fastReload = {
        name: "Fast Reload [physical]",
        properties: ["physical", "attack"],
        description: `Regains some of energy (${this.resource.energyRegen * 2})`,
        code: () => {
            this.previousAction[0] = true;
            logAction(`${this.name} reloads instead of switching to secondary!`, "heal");
            if (eventState.resourceChange.length) {handleEvent('resourceChange', { effect: this.actions.fastReload, unit: this, resource: ['energy'], value: [this.resource.energyRegen * 2] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + this.resource.energyRegen * 2);
        }
    };

    this.actions.joy = {
        name: "Joy [stamina]",
        properties: ["physical", "stamina", "death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic", "ingenuity/insanity", "buff", "debuff"],
        cost: { stamina: 10 },
        description: `Costs ${this.base.hp/5} HP & 10 stamina\nStrong buffs and delayed consequences`,
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.joy, () => { playerTurn(this) }, [1, true, unitFilter("player", "", false)]) : this.actions.joy.code(randTarget(unitFilter("enemy", "", false))) },
        code: (target) => {
            if (this.resource.stamina < 10) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 10;
            const statIncrease = [80, 100, 32, 100];
            const statDecrease = [-30, -8, -12, -60, -80, -70];
            const mod = modifiers.find(m => m.name === "Joy" && m.vars?.target === target[0]);
            if (mod) {
                logAction(`${this.name} reapplies Joy on ${target[0].name}!`, "buff");
                removeModifier(mod);
            } else { logAction(`${this.name} gives ${target[0].name} some joy!`, "buff") }
            new Modifier("Joy", "Overall increase?",
                { caster: this, target: target[0], duration: 20, elements: ["death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic", "ingenuity/insanity"], buffs: ["accuracy", "focus", "defense", "resist"], buffValues: statIncrease, debuffs: ["attack", "defense", "evasion", "speed", "accuracy", "presence"], debuffValues: statDecrease, listeners: { turnStart: true, actionStart: false }, cancel: false, applied: true, focus: false, penalty: false },
                function() {
                    const bonus = 1.5 ** elementBonus(this.vars.target, this, { "ingenuity/insanity": 2 });
                    if (bonus !== 1) {
                        for (let i = 0; i < this.vars.buffValues.length; i++) { this.vars.buffValues[i] = Math.floor(this.vars.buffValues[i] * bonus + Number.EPSILON) }
                        for (let i = 0; i < this.vars.debuffValues.length; i++) { this.vars.debuffValues[i] = Math.floor(this.vars.debuffValues[i] * bonus + Number.EPSILON) }
                    }
                    resetStat(this.vars.target, this.vars.buffs, this.vars.buffValues);
                },
                function(context) {
                    if (this.vars.listeners.actionStart && context?.unit === this.vars.target) {
                        if (this.vars.penalty) {
                            for (const element of ["light/illusion", "knowledge/memory", "goner/entropy", "harmonic/change", "inertia/cold", "radiance/purity", "nature/life"]) {
                                if (this.vars.target.shield.includes(element)) { this.vars.target.shield.splice(this.vars.target.shield.indexOf(element), 1) }
                                else if (!this.vars.target.absorb.includes(element)) { this.vars.target.absorb.push(element) }
                            }
                        } else { this.vars.target.shield.push("death/darkness", "goner/entropy", "harmonic/change", "anomaly/synthetic") }
                        this.vars.listeners.actionStart = false;
                        eventState.actionStart.splice(eventState.actionStart.indexOf(this), 1);
                        return;
                    }
                    if (this.vars.target === context?.unit) {
                        this.vars.duration--;
                        if (this.vars.applied) {
                            this.vars.listeners.actionStart = true;
                            eventState.actionStart.push(this);
                        }
                    }
                    if (this.vars.duration === 14) {
                        if (this.vars.applied) {
                            resetStat(this.vars.target, this.vars.buffs, this.vars.buffValues, false);
                            resetStat(this.vars.target, this.vars.debuffs, this.vars.debuffValues);
                        }
                        this.vars.penalty = true;
                        logAction(`${this.vars.target.name} is feeling the side effects!`, "debuff");
                        this.description = "Long side effect period";
                    }
                    if (this.vars.duration <= 0) { return true }
                },
                function() {
                    if (this.vars.cancel && this.vars.applied) {
                        this.vars.penalty ? resetStat(this.vars.target, this.vars.debuffs, this.vars.debuffValues, false) : resetStat(this.vars.target, this.vars.buffs, this.vars.buffValues, false);
                        if (this.vars.listeners.actionStart) {
                            this.vars.listeners.actionStart = false;
                            eventState.actionStart.splice(eventState.actionStart.indexOf(this), 1);
                        }
                        this.vars.applied = false;
                    } else if (!this.vars.cancel && !this.vars.applied) {
                        this.vars.penalty ? resetStat(this.vars.target, this.vars.debuffs, this.vars.debuffValues) : resetStat(this.vars.target, this.vars.buffs, this.vars.buffValues);
                        this.vars.applied = true;
                    }
                }
            );
            let damageSingle = this.base.hp / 5;
            if (eventState.singleDamage.length) { handleEvent('singleDamage', {attacker: this, defender: this, damageSingle: damageSingle }) }
            this.hp = Math.max(this.hp - damageSingle, 0);
            if (this.hp === 0 && eventState.unitChange.length) { handleEvent('unitChange', {type: 'downed', unit: this}) }
        }
    };

    this.actions.actionWeight = {
        rapidFire: 0.3,
        energyRifle: 0.2,
        synthesizeMedicine: 0.15,
        fastReload: 0.15,
        joy: 0.2
    };
});