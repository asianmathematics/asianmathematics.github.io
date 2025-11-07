import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const ChaosAgent = new Unit("Agent Of Chaos", [1000, 50, 30, 125, 30, 125, 70, 150, 140, "back", 100, 80, 10, 60, 5, 60, 5], ["light/illusion", "knowledge/memory", "goner/entropy", "anomaly/synthetic", "ingenuity/insanity"], function() {
    this.actions.magicWeapon = {
        name: "Magic Weapon [physical, mystic]",
        properties: ["physical", "mystic", "attack"],
        description: "Attacks a single target twice with increased damage, accuracy, and crit chance.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.shadowBlade, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.shadowBlade.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            logAction(`${this.name} deals with ${target[0].name}`, "action");
            attack(this, target, 2, { attacker: { attack: this.attack + 8, accuracy: this.accuracy + 22, focus: this.focus + 10 } });
        }
    };
    
    this.actions.gun = {
        name: "Gun [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "attack", "debuff"],
        cost: { stamina: 10, energy: 10 },
        description: "Costs 10 stamina & 10 energy\nAttacks a target 4 times with increased accuracy and crit chance, decreases speed for 1 turn",
        points: 60,
        target: () => {
            if (this.resource.stamina < 10 || this.resource.energy < 10) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            this.team === "player" ? selectTarget(this.actions.gun, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.gun.code(randTarget(unitFilter("player", "front", false)));
        },
        code: (target) => {
            const statDecrease = [-10];
            this.resource.stamina -= 10;
            this.resource.energy -= 10;
            this.previousAction[0] = this.previousAction[2] = true;
            logAction(`I'm a healer but...`, "action");
            attack(this, target, 4, { accuracy: this.accuracy + 65, focus: this.focus + 30 });
            basicModifier("Speed Penalty", "Speed reduced during gun", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["speed"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.shieldDisruptor = {
        name: "Shield Disruptor [energy]",
        properties: ["techno", "energy", "harmonic/change", "anomaly/synthetic", "debuff"],
        cost: { energy: 30 },
        description: "Costs 30 energy\nChance to reduce defense and resist of target for 2 turns",
        points: 60,
        target: () => { this.actions.shieldDisruptor.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            this.previousAction[2] = true;
            this.resource.energy -= 30;
            const statDecrease = [-13, -15];
            if (resistDebuff(this, target)[0] > 20) {
                logAction(`${this.name} disrupts ${target[0].name}'s defenses!`, "action");
                basicModifier("Shield Disruption", "Defense reduction", { caster: this, target: target[0], duration: 2, attributes: ["techno"], elements: ["harmonic/change", "anomaly/synthetic"], stats: ["defense", "resist"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
            } else { logAction(`${this.name} fails to hack into ${target[0].name}'s defenses!`, "miss") }
        }
    };

    this.actions.backupPower = {
        name: "Backup Power [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "anomaly/synthetic", "resource"],
        cost: { stamina: 20 },
        description: `Costs 20 stamina\nRecovers a lot of energy (${Math.floor(this.resource.energyRegen * 3.5 + Number.EPSILON)})`,
        points: 60,
        code: () => {
            this.previousAction[0] = true;
            this.resource.stamina -= 20;
            if (eventState.resourceChange.length) {handleEvent('resourceChange', { effect: this.actions.backupPower, unit: this, resource: ['energy'], value: [Math.floor(this.resource.energyRegen * 3.5 + Number.EPSILON)] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + Math.floor(this.resource.energyRegen * 3.5 + Number.EPSILON));
            logAction(`${this.name} activates the backup power generation and recovers ${Math.floor(this.resource.energyRegen * 3.5 + Number.EPSILON)} energy!`, "heal");
        }
    };

    this.actions.sneak = {
        name: "Sneak [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nLowers presence and increases crit chance and resist for 1 turn",
        points: 60,
        code: () => {
            if (this.resource.stamina < 30) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [30, 15, -50];
            this.resource.stamina -= 30;
            this.previousAction[0] = true;
            logAction(`${this.name} drew attention away!`, "buff");
            basicModifier("Sneak", "Combat focus modification", { caster: this, target: this, duration: 2, attributes: ["physical"], stats: ["focus", "resist", "presence"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.actionWeight = {
        magicWeapon: 0.2,
        gun: 0.4,
        shieldDisruptor: 0.25,
        backupPower: 0.1,
        sneak: 0.05
    };
})