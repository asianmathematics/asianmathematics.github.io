import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const ArtificialSolider = new Unit("Artificial Solider", [1200, 60, 20, 85, 30, 80, 30, 90, 110, "front", 120, 80, 8, 50, 5, 70, 7], ["inertia/cold", "anomaly/synthetic", "precision/perfection"], function() {
    this.actions.magicWeapon = {
        name: "Magic Weapon [physical, mystic]",
        properties: ["physical", "mystic", "attack"],
        description: "Attacks a single target twice with increased damage, accuracy, and crit chance.",
        points: 60,
        target: () => { this.team === "player" ? selectTarget(this.actions.magicWeapon, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]) : this.actions.magicWeapon.code(randTarget(unitFilter("player", "front", false))) },
        code: (target) => {
            logAction(`${this.name} deals with ${target[0].name}`, "action");
            attack(this, target, 2, { attacker: { attack: this.attack + 8, accuracy: this.accuracy + 22, focus: this.focus + 10 } });
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
    
    this.actions.reload = {
        name: "Reload",
        properties: ["resource", "debuff"],
        description: `Regains a lot of energy (${this.resource.energyRegen * 3.75}) and decreases speed and evasion for 1 turn`,
        points: 60,
        code: () => {
            const statDecrease = [-10, -20]
            this.previousAction[0] = true;
            logAction(`${this.name} reloads instead of switching to secondary!`, "heal");
            if (eventState.resourceChange.length) {handleEvent('resourceChange', { effect: this.actions.fastReload, unit: this, resource: ['energy'], value: [this.resource.energyRegen * 3.75] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + this.resource.energyRegen * 3.75);
            basicModifier("Reload cooldown", "decreased evasion and speed", { caster: this, target: this, duration: 1, stats: ["evasion", "speed"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };

    this.actions.block = {
        name: "Block",
        properties: ["buff"],
        description: "Slightly increases resist, slightly decreases presence, and increases defense for 1 turn",
        points: 60,
        code: () => {
            const statIncrease = [13, 7, -8];
            logAction(`${this.name} blocks.`, "buff");
            basicModifier("Block", "Defense and resist increased, presence decreased", { caster: this, target: this, duration: 1, attributes: ["physical"], stats: ["defense", "resist", "presence"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.actionWeight = {
        magicWeapon: 0.25,
        energyRifle: 0.6,
        reload: 0.1,
        block: 0.05
    };
})