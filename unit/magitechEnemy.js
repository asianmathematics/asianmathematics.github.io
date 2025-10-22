import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const magitechEnemy = new Unit("Magitech Golem", [3000, 60, 45, 150, 20, 150, 100, 80, 260, "front", 300, 120, 12, 150, 15, 150, 15], ["Harmonic/Change", "Inertia/Cold", "Radiance/Purity", "Anomaly/Synthetic"], function() {
    this.actions.arcaneCannon = {
        name: "Arcane Cannon [physical, mana]",
        properties: ["physical", "mystic", "mana", "attack"],
        cost: { mana: 20 },
        description: "Costs 20 mana\nAttacks a single target six times with increased damage",
        points: 60,
        code: () => {
            this.previousAction[0] = this.previousAction[1] = true;
            this.resource.mana -= 20;
            const target = randTarget(unitFilter("player", "", false));
            logAction(`${this.name} fires an arcane cannon at ${target[0].name}!`, "action");
            attack(this, target, 6, { attacker: { attack: this.attack + 24 } });
        }
    };

    this.actions.stanceShift = {
        name: "Stance Shift [stamina, mystic]",
        properties: ["physical", "stamina", "mystic", "inertia/cold", "radiance/purity", "buff"],
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nShifts to fire or ice stance, gaining different bonuses",
        points: 60,
        code: () => {
            const offensiveIncrease = [14, 25];
            const defensiveIncrease = [2, 10];
            this.previousAction[0] = this.previousAction[1] = true;
            this.resource.stamina -= 30;
            if (Math.random() < .5) {
                logAction(`${this.name} shifts to fire stance, becoming more aggressive!`, "buff");
                basicModifier("Fire Stance", "Offensive enhancement", { caster: this, targets: [this], duration: 3, attributes: ["mystic"], elements: ["radiance/purity"], stats: ["attack", "focus"], values: offensiveIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
            } else {
                logAction(`${this.name} shifts to ice stance, becoming more defensive!`, "buff");
                basicModifier("Ice Stance", "Defensive enhancement", { caster: this, targets: [this], duration: 3, attributes: ["mystic"], elements: ["inertia/cold"], stats: ["defense", "resist"], values: defensiveIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
            }
        }
    };

    this.actions.magitechBarrier = {
        name: "Magitech Barrier [stamina, mana, energy]",
        properties: ["physical", "stamina", "mystic", "mana", "techno", "energy", "inertia/cold", "anomaly/synthetic", "buff", "multitarget"],
        cost: { stamina: 30, mana: 30, energy: 30 },
        description: "Costs 30 stamina, 30 mana, & 30 energy\nIncreases defense, resist and decreases presence of all other frontline allies",
        points: 60,
        code: () => {
            const statIncrease = [12, 5, -30];
            this.previousAction = [true, true, true];
            this.resource.stamina -= 30;
            this.resource.mana -= 30;
            this.resource.energy -= 30;
            logAction(`${this.name} creates a protective barrier!`, "buff");
            basicModifier("Magitech Barrier", "Defensive field", { caster: this, targets: unitFilter("enemy", "front", false).filter(unit => unit !== this), duration: 1, attributes: ["physical", "mystic", "techno"], elements: ["inertia/cold", "anomaly/synthetic"], stats: ["defense", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.essenceAbsorption = {
        name: "Essence Absorption",
        properties: ["harmonic/change", "resource"],
        description: `Recovers moderate amounts of mana (${this.resource.manaRegen * .75}) and energy (${this.resource.energyRegen * .75})`,
        points: 60,
        code: () => {
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.essenceAbsorption, unit: this, resource: ['mana', 'energy'], value: [this.resource.manaRegen * .75, this.resource.energyRegen * .75] }) }
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + (this.resource.manaRegen * .75) );
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + (this.resource.energyRegen * .75) );
            logAction(`${this.name} absorbs ambient essence, replenishing resources!`, "heal");
        }
    };

    this.actions.energyWave = {
        name: "Energy Wave [energy]",
        properties: ["techno", "energy", "harmonic/change", "attack", "multitarget"],
        cost: { energy: 25 },
        description: "Costs 25 energy\nAttacks all front-line enemies with slightly increased accuracy and damage",
        points: 60,
        code: () => {
            this.previousAction[2] = true;
            this.resource.energy -= 25;
            logAction(`${this.name} releases an energy wave across the battlefield!`, "action");
            attack(this, unitFilter("player", "front", false), 1, { attacker: { accuracy: this.accuracy + 15, attack: this.attack + 6 } });
        }
    };

    this.actions.coreOverload = {
        name: "Core Overload [mana, energy]",
        properties: ["mystic", "mana","techno", "energy", "attack", "multitarget"],
        cost: { mana: 40, energy: 40 },
        description: "Costs 40 mana & 40 energy\nAttacks all front-line enemies twice with increased accuracy and attack",
        points: 60,
        code: () => {
            this.previousAction[1] = this.previousAction[2] = true;
            this.resource.mana -= 40;
            this.resource.energy -= 40;
            logAction(`${this.name}'s core overloads in a desperate attack!`, "crit");
            attack(this, unitFilter("player", "front", false), 2, { attacker: { attack: this.attack + 12, accuracy: this.accuracy + 30 } });
        }
    };

    this.actions.actionWeight = { 
        arcaneCannon: 0.20, 
        stanceShift: 0.20, 
        magitechBarrier: 0.20, 
        essenceAbsorption: 0.15, 
        energyWave: 0.20, 
        coreOverload: 0.05 
    };
});