import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const technoEnemy = new Unit("Techno Drone", [950, 44, 15, 125, 20, 115, 65, 120, 90, "mid", 90, 80, 8, undefined, undefined, 150, 12], ["harmonic/change", "anomaly/synthetic"], function() {
    this.actions.laserBlast = {
        name: "Laser Blast [techno]",
        properties: ["techno", "light/illusion", "harmonic/change", "radiance/purity", "attack", "multitarget"],
        description: "Attacks up to 2 targets 2 times",
        points: 60,
        code: () => {
            this.previousAction[2] = true;
            logAction(`${this.name} fires laser beams!`, "action");
            let target = unitFilter("player", "front", false);
            if (target.length > 2) { target = randTarget(target, 2) }
            attack(this, target, 2);
        }
    };

    this.actions.shieldDisruptor = {
        name: "Shield Disruptor [energy]",
        properties: ["techno", "energy", "harmonic/change", "anomaly/synthetic", "debuff"],
        cost: { energy: 60 },
        description: "Costs 60 energy\nReduces defense and resist of target for 2 turns",
        code: () => {
            this.previousAction[2] = true;
            this.resource.energy -= 60;
            const target = randTarget(unitFilter("player", "front", false));
            const statDecrease = [-12, -10];
            logAction(`${this.name} disrupts ${target[0].name}'s defenses!`, "action");
            basicModifier("Shield Disruption", "Defense reduction", { caster: this, targets: target, duration: 2, attributes: ["techno"], elements: ["harmonic/change", "anomaly/synthetic"], stats: ["defense", "resist"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.naniteRepair = {
        name: "Nanite Repair [energy]",
        properties: ["techno", "energy", "harmonic/change", "anomaly/synthetic", "heal"],
        cost: { energy: 50 },
        description: "Costs 50 energy\Heals an ally somewhat (~20% of max HP), does Laser Blast if no ally needs healing",
        code: () => {
            const allies = unitFilter("enemy", "", false).filter(unit => unit.hp < unit.base.hp);
            if (allies.length > 0) {
                this.previousAction[2] = true;
                this.resource.energy -= 50;
                const target = randTarget(allies);
                let elementBonus = 0;
                if (target[0].elements.includes("Harmonic/Change")) { elementBonus++ }
                if (target[0].elements.includes("Anomaly/Synthetic")) { elementBonus++ }
                if (target[0].elements.includes("Goner/Entropy") || target[0].elements.includes("Inertia/Cold")) { elementBonus-- }
                if (target[0].elements.includes("Radiance/Purity") || target[0].elements.includes("Nature/Life")) { elementBonus-- }
                elementBonus = 2 ** elementBonus;
                if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.naniteRepair, unit: target[0], resource: ['hp'], value: [target[0].resource.healFactor * elementBonus] }) }
                target[0].hp = Math.min(target[0].base.hp, target[0].hp + (target[0].resource.healFactor * elementBonus));
                logAction(`${this.name} repairs ${target[0].name}!`, "heal");
            } else { this.actions.laserBlast.code(); }
        }
    };

    this.actions.overcharge = {
        name: "Overcharge [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "harmonic/change", "anomaly/synthetic", "buff", "resource"],
        cost: { stamina: 10, energy: 30 },
        description: "Costs 10 stamina & 30 energy\nIncreases attack and speed for 3 turns",
        code: () => {
            const statIncrease = [6, 50];
            this.previousAction[0] = this.previousAction[2] = true;
            this.resource.stamina -= 10;
            this.resource.energy -= 30;
            logAction(`${this.name}'s systems overcharge!`, "buff");
            basicModifier("Overcharge Boost", "Power surge", { caster: this, targets: [this], duration: 4, attributes: ["physical", "techno"], elements: ["harmonic/change", "anomaly/synthetic"], stats: ["attack", "speed"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.backupPower = {
        name: "Backup Power [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "anomaly/synthetic", "resource"],
        cost: { stamina: 20 },
        description: `Costs 20 stamina\nRecovers a lot of energy (${Math.floor(this.resource.energyRegen * 4.5 + Number.EPSILON)})`,
        points: 60,
        code: () => {
            this.previousAction[0] = true;
            this.resource.stamina -= 20;
            if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: this.actions.backupPower, unit: this, resource: ['energy'], value: [Math.floor(this.resource.energyRegen * 4.5 + Number.EPSILON)] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + Math.floor(this.resource.energyRegen * 4.5 + Number.EPSILON));
            logAction(`${this.name} activates the backup power generation and recovers energy!`, "heal");
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

    this.actions.switchPosition = {
        name: "Switch Position [physical]",
        properties: ["physical", "position"],
        description: "Switch between front and back line positions",
        code: () => {
            this.previousAction[0] = true;
            if (eventState.positionChange.flag) {handleEvent('positionChange', { unit: this, position: this.position === "back" ? "front" : "back" }) }
            if (this.position === "back") {
                this.position = "front";
                logAction(`${this.name} moves to the frontline.`, "info");
                this.base.defense = 15;
                this.base.evasion = 15;
                this.base.speed = 140;
                this.base.presence = 120;
                this.actions.actionWeight = {
                    laserBlast: 0,
                    shieldDisruptor: 0.3,
                    naniteRepair: 0.5,
                    overcharge: 0,
                    backupPower: 0,
                    dodge: 0.1,
                    switchPosition: 0.1
                };
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.defense = 20;
                this.base.evasion = 20;
                this.base.speed = 120;
                this.base.presence = 90;
                this.actions.actionWeight = {
                    laserBlast: 0.5,
                    shieldDisruptor: 0,
                    naniteRepair: 0,
                    overcharge: 0.25,
                    backupPower: 0.2,
                    dodge: 0,
                    switchPosition: 0.05
                };
            }
            resetStat(this, ["defense", "evasion", "speed", "presence"]);
        }
    };

    this.actions.actionWeight = {
        laserBlast: 0.5,
        shieldDisruptor: 0,
        naniteRepair: 0,
        overcharge: 0.25,
        backupPower: 0.2,
        dodge: 0,
        switchPosition: 0.05
    };
});