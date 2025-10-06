import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Paragon = new Unit("Paragon", [350, 20, 30, 40, 75, 50, 110, 20, 110, 70, "back", 50, 80, 10, undefined, undefined, 250, 30], ["Light/Illusion", "Knowledge/Memory", "Entropy/Goner", "Radiance/Purity", "Anomaly/Synthetic", "Nature/Life", "Precision/Perfection", "Independence/Loneliness", "Passion/Hatred", "Ingenuity/Insanity"], function() {
    this.actions.gun = {
        name: "Gun [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "attack", "buff"],
        cost: { stamina: 20, energy: 40 },
        description: "Costs 20 stamina & 30 energy\nAttacks a target with increased accuracy and crit chance",
        target: () => {
            if (this.resource.stamina < 20 || this.resource.energy < 40) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.gun, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            const statDecrease = [-0.1];
            this.resource.energy -= 20;
            this.resource.energy -= 40;
            this.previousAction[0] = this.previousAction[2] = true;
            logAction(`I'm a healer but...`, "action");
            attack(this, target, 6, { accuracy: this.accuracy * 2, focus: this.focus * 2.5});
            const self = this;
            basicModifier("Speed Penalty", "Speed reduced during gun", { caster: self, targets: [self], duration: 1, attributes: ["physical"], stats: ["speed"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };
    
    this.actions.healingPills = {
        name: "Healing Pills [techno]",
        properties: ["techno", "radiance/purity", "anomaly/synthetic", "nature/life", "heal", "multitarget"],
        cost: { energy: 30 },
        description: "Cost 30 energy\nHeals up to 3 allies somewhat (~20% max HP), doesn\'t heal mystic units",
        target: () => {
            if (this.resource.energy < 30) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            const healable = unitFilter("player", "").filter(u => !u.resource.mana);
            if (healable.length > 0) {showMessage("No available targets, you sure?", "error", "selection") }
            selectTarget(this.actions.healingPills, () => { playerTurn(this) }, [3, false, healable]);
        },
        code: (targets) => {
            this.resource.energy -= 30;
            this.previousAction[2] = true;
            const self = this
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: self.actions.healingPills, units: targets, resource: ['hp'], value: [2 * targets[0].resource.healFactor] }) }
            for (const unit of targets) {unit.hp = Math.min(unit.base.hp, unit.hp + 2 * unit.resource.healFactor)}
            logAction(`${this.name} heals ${targets.map(u => u.name).join(", ")} for ${targets.map(u => 2 * u.resource.healFactor).join(", ")} HP!`, "heal");
        }
    };

    this.actions.disableMagic = {
        name: "Disable Magic [energy]",
        properties: ["techno", "energy", "goner/entropy", "intertia/cold", "independence/loneliness", "passion/hatred", "debuff", "resource"],
        cost: { energy: 80 },
        description: "Costs 60 energy\nSets target's mana to 0, disables mana regeneration for next turn, and ends all mystic modifers it\'s focusing",
        target: () => {
            if (this.resource.energy < 80) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.disableMagic, () => { playerTurn(this) }, [1, false, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 80;
            this.previousAction[2] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 35) {
                    const self = this
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: self.actions.disableMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (const mod of modifiers.filter(m => m.vars.caster === target[0] && m.attributes && m.attributes.includes("mystic"))) { removeModifier(mod) }
                    window.updateModifiers();
                    logAction(`${this.name} disables ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists disable magic`, "miss") }
            } else { logAction(`${target[0].name} has no magic to disable!`, "warning") }
        }
    };

    this.actions.healingDrone = {
        name: "Healing Drone [energy]",
        properties: ["techno", "energy", "radiance/purity", "anomaly/synthetic", "nature/life", "heal"],
        cost: { energy: 120 },
        description: `Costs 120 energy\nModerately heals (~10% max HP) lowest hp ally for 5 turns, doesn\'t heal mystic units.`,
        code: () => {
            if (this.resource.energy < 120) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            this.resource.energy -= 120;
            this.previousAction[2] = true;
            logAction(`${this.name} activate his healing drone!`, "action");
            const self = this;
            new Modifier("Healing Drone", "Heals the lowest hp ally",
                { caster: self, targets: unitFilter("player", "").filter(u => !u.resource.mana), duration: 4, attributes: ["techno"], stats: "hp", listeners: {turnStart: true}, cancel: false, applied: true, focus: true, mod: null },
                (vars) => {
                    vars.mod = modifiers.findLast(m => m.name === "Healing Drone" && m.vars.caster === vars.caster);
                    const heal = vars.targets.filter(u => u.hp < u.base.hp).reduce((min, unit) => { if (!min || unit.hp < min.hp) { return unit } return min }, null);
                    if (heal) {
                        if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: vars.mod, unit: heal, resource: ['hp'], value: [vars.value] }) }
                        heal.hp = Math.min(heal.hp + heal.resource.healFactor, heal.base.hp);
                        logAction(`Healing Drone heals ${heal.name} for ${heal.resource.healFactor} HP!`, "heal");
                    } else { logAction("Healing Drone has no targets to heal!", "warning") }
                },
                (vars, context) => {
                    if (vars.caster === context.unit) {
                        const heal = vars.targets.filter(u => u.hp < u.base.hp).reduce((min, unit) => { if (!min || unit.hp < min.hp) { return unit } return min }, null);
                        if (heal) {
                            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: vars.mod, unit: heal, resource: ['hp'], value: [vars.value] }) }
                            heal.hp = Math.min(heal.hp + heal.resource.healFactor, heal.base.hp);
                            logAction(`Healing Drone heals ${heal.name} for ${heal.resource.healFactor} HP!`, "heal");
                        } else { logAction("Healing Drone has no targets to heal!", "warning") }
                        vars.duration--;
                    }
                    if (vars.duration === 0) { return true }
                }
            );
        }
    };

    this.actions.backupPower = {
        name: "Backup Power [stamina]",
        properties: ["physical", "stamina", "harmonic/change", "anomaly/synthetic", "resource"],
        cost: { stamina: 30 },
        description: `Costs 20 stamina\nRecovers a lot of energy (${this.resource.energyRegen * 3})`,
        code: () => {
            this.previousAction[0] = true;
            this.resource.stamina -= 30;
            const self = this;
            if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: self.actions.backupPower, unit: self, resource: ['energy'], value: [self.resource.energyRegen * 3] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + (this.resource.energyRegen * 3) );
            logAction(`${this.name} activates the backup power generation and recovers ${this.resource.energyRegen * 3} energy!`, "heal");
        }
    };
});