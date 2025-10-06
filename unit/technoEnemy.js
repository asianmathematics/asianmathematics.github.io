import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const technoEnemy = new Unit("Techno Drone", [475, 40, 12, 20, 105, 20, 90, 40, 110, 110, "mid", 50, 80, 10, undefined, undefined, 150, 15], ["Harmonic/Change", "Anomaly/Synthetic"], function() {
    this.actions.laserBlast = {
        name: "Laser Blast [energy]",
        properties: ["techno", "energy", "light/illusion", "harmonic/change", "radiance/purity", "attack", "multitarget"],
        cost: { energy: 25 },
        description: "Costs 25 energy\nAttacks up to 2 targets 2 times",
        code: () => {
            this.previousAction[2] = true;
            this.resource.energy -= 25;
            logAction(`${this.name} fires laser beams!`, "action");
            let target = unitFilter("player", "front", false);
            if (target.length > 2) { target = randTarget(target, 2) }
            attack(this, target, 2);
        }
    };

    this.actions.shieldDisruptor = {
        name: "Shield Disruptor [energy]",
        properties: ["techno", "energy", "harmonic/change", "anomaly/synthetic", "debuff"],
        cost: { energy: 35 },
        description: "Costs 35 energy\nReduces defense and resist of target for 2 turns",
        code: () => {
            this.previousAction[2] = true;
            this.resource.energy -= 35;
            const target = [randTarget(unitFilter("player", "front", false))];
            const statDecrease = [((target[0].base.defense - 3)/target[0].base.defense) - 1, ((target[0].base.resist - 10)/target[0].base.resist) - 1];
            logAction(`${this.name} disrupts ${target[0].name}'s defenses!`, "action");
            const self = this;
            basicModifier("Shield Disruption", "Defense reduction", { caster: self, targets: target, duration: 2, attributes: ["energy"], elements: ["harmonic/change", "anomaly/synthetic"], stats: ["defense", "resist"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.naniteRepair = {
        name: "Nanite Repair [energy]",
        properties: ["techno", "energy", "harmonic/change", "anomaly/synthetic", "heal"],
        cost: { energy: 40 },
        description: "Costs 40 energy\Heals an ally somewhat (~20% of max HP), does Laser Blast if no ally needs healing",
        code: () => {
            const allies = unitFilter("enemy", "", false).filter(unit => unit.hp < unit.base.hp);
            if (allies.length > 0) {
                this.previousAction[2] = true;
                this.resource.energy -= 40;
                const target = [randTarget(allies)];
                let elementBonus = 0;
                if (target[0].elements.includes("Harmonic/Change")) { elementBonus++ }
                if (target[0].elements.includes("Anomaly/Synthetic")) { elementBonus++ }
                if (target[0].elements.includes("Goner/Entropy") || target[0].elements.includes("Inertia/Cold")) { elementBonus-- }
                if (target[0].elements.includes("Radiance/Purity") || target[0].elements.includes("Nature/Life")) { elementBonus-- }
                if (elementBonus < 0) { elementBonus = 2 ** elementBonus }
                else { elementBonus++ }
                const self = this;
                if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: self.actions.naniteRepair, unit: target[0], resource: ['hp'], value: [target[0].resource.healFactor * elementBonus] }) }
                target[0].hp = Math.min(target[0].base.hp, target[0].hp + (target[0].resource.healFactor * elementBonus));
                logAction(`${this.name} repairs ${target[0].name}!`, "heal");
            } else { this.actions.laserBlast.code(); }
        }
    };

    this.actions.overcharge = {
        name: "Overcharge [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "harmonic/change", "anomaly/synthetic", "buff", "resource"],
        cost: { stamina: 10, energy: 30 },
        description: "Costs 10 stamina & 30 energy\nIncreases attack and speed for 2 turns",
        code: () => {
            const statIncrease = [0.4, 0.3];
            this.previousAction[0] = this.previousAction[2] = true;
            this.resource.stamina -= 10;
            this.resource.energy -= 30;
            logAction(`${this.name}'s systems overcharge!`, "buff");
            const self = this;
            basicModifier("Overcharge Boost", "Power surge", { caster: self, targets: [self], duration: 2, attributes: ["physical", "energy"], elements: ["harmonic/change", "anomaly/synthetic"], stats: ["attack", "speed"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.backupPower = {
        name: "Backup Power [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "anomaly/synthetic", "resource"],
        cost: { stamina: 30 },
        description: `Costs 40 stamina\nRecovers a lot of energy (${this.resource.energyRegen * 3})`,
        code: () => {
            this.previousAction[0] = true;
            this.resource.stamina -= 30;
            const self = this;
            if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: self.actions.backupPower, unit: self, resource: ['energy'], value: [self.resource.energyRegen * 3] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + (this.resource.energyRegen * 3) );
            logAction(`${this.name} activates the backup power generation and recovers energy!`, "heal");
        }
    };

    this.actions.switchPosition = {
        name: "Switch Position [physical]",
        properties: ["physical", "position"],
        description: "Switch between front and back line positions",
        code: () => {
            this.previousAction[0] = true;
            const self = this;
            if (eventState.positionChange.flag) {handleEvent('positionChange', { unit: self, position: self.position === "back" ? "front" : "back" }) }
            if (this.position === "back") {
                this.position = "front";
                logAction(`${this.name} moves to the frontline.`, "info");
                this.base.defense = 10;
                this.base.lethality = 26;
                this.base.evasion = 16;
                this.base.speed = 115;
                this.base.presence = 125;
                this.actions.actionWeight = {
                    laserBlast: 0.2, 
                    shieldDisruptor: 0.3, 
                    naniteRepair: 0.25, 
                    overcharge: 0.2, 
                    backupPower: 0, 
                    switchPosition: 0.05, 
                    dodge: 0.1 
                };
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.defense = 12;
                this.base.lethality = 20;
                this.base.evasion = 20;
                this.base.speed = 110;
                this.base.presence = 110;
                this.actions.actionWeight = {
                    laserBlast: 0.5, 
                    shieldDisruptor: 0, 
                    naniteRepair: 0, 
                    overcharge: 0.25, 
                    backupPower: 0.2, 
                    switchPosition: 0.05, 
                    dodge: 0 
                };
            }
            resetStat(this, ["defense", "lethality", "evasion", "speed", "presence"]);
        }
    };

    this.actions.dodge = {
        name: "Dodge [stamina]",
        properties: ["physical", "stamina", "buff"],
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nIncreases evasion for 1 turn",
        code: () => {
            if (this.resource.stamina < 20) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            const statIncrease = [2];
            this.resource.stamina -= 20;
            this.previousAction[0] = true;
            logAction(`${this.name} dodges.`, "buff");
            const self = this;
            basicModifier("Dodge", "Evasion increased", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["evasion"], values: statIncrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.actionWeight = {
        laserBlast: 0.5, 
        shieldDisruptor: 0, 
        naniteRepair: 0, 
        overcharge: 0.25, 
        backupPower: 0.2, 
        switchPosition: 0.05, 
        dodge: 0 
    };
});