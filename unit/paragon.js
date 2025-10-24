import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const Paragon = new Unit("Paragon", [2600, 55, 80, 200, 50, 250, 45, 175, 140, "back", 260, 120, 15, undefined, undefined, 250, 35], ["Light/Illusion", "Knowledge/Memory", "Entropy/Goner", "Radiance/Purity", "Anomaly/Synthetic", "Nature/Life", "Precision/Perfection", "Independence/Loneliness", "Passion/Hatred", "Ingenuity/Insanity"], function() {
    this.actions.gun = {
        name: "Gun [stamina, energy]",
        properties: ["physical", "stamina", "techno", "energy", "attack", "buff"],
        cost: { stamina: 10, energy: 10 },
        description: "Costs 10 stamina & 10 energy\nAttacks a target 4 times with increased accuracy and crit chance, decreases speed for 1 turn",
        points: 60,
        target: () => {
            if (this.resource.stamina < 10 || this.resource.energy < 10) {
                showMessage("Not enough resources!", "error", "selection");
                return;
            }
            selectTarget(this.actions.gun, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            const statDecrease = [-10];
            this.resource.energy -= 10;
            this.resource.energy -= 10;
            this.previousAction[0] = this.previousAction[2] = true;
            logAction(`I'm a healer but...`, "action");
            attack(this, target, 4, { accuracy: this.accuracy + 65, focus: this.focus + 30 });
            basicModifier("Speed Penalty", "Speed reduced during gun", { caster: this, targets: [this], duration: 1, attributes: ["physical"], stats: ["speed"], values: statDecrease, listeners: {turnStart: true}, cancel: false, applied: true, focus: false, penalty: true });
        }
    };
    
    this.actions.healingPills = {
        name: "Healing Pills [physical, energy]",
        properties: ["physical", "techno", "energy", "radiance/purity", "anomaly/synthetic", "nature/life", "heal", "multitarget"],
        cost: { energy: 25 },
        description: "Cost 25 energy\nHeals up to 3 allies moderately (~10% max HP), doesn&#39;t heal mystic units",
        points: 60,
        target: () => {
            if (this.resource.energy < 25) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            const healable = unitFilter("player", "").filter(u => !u.resource.mana);
            if (healable.length > 0) { showMessage("No available targets", "error", "selection") }
            selectTarget(this.actions.healingPills, () => { playerTurn(this) }, [3, false, healable]);
        },
        code: (targets) => {
            this.resource.energy -= 25;
            this.previousAction[0] = this.previousAction[2] = true;
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.healingPills, units: targets, resource: ['hp'], value: targets.map(u => u.resource.healFactor) }) }
            for (const unit of targets) { 
                unit.hp = Math.min(unit.base.hp, unit.hp + unit.resource.healFactor);
            }
            logAction(`${this.name} heals ${targets.map(u => u.name).join(", ")} for ${targets.map(u => u.resource.healFactor).join(", ")} HP!`, "heal");
        }
    };

    this.actions.disableMagic = {
        name: "Disable Magic [energy]",
        properties: ["techno", "energy", "intertia/cold", "debuff", "resource"],
        cost: { energy: 40 },
        description: "Costs 40 energy\nChance to set target&#39;s mana to 0, disable mana regeneration for next turn, and end all mystic modifiers it focuses or cast on it",
        points: 60,
        target: () => {
            if (this.resource.energy < 40) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.disableMagic, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 40;
            this.previousAction[2] = true;
            const will = resistDebuff(this, target);
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 25) {
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.disableMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (const mod of modifiers.filter(m => m?.attributes?.includes("mystic") && ((m.vars.caster === target[0] && m.vars.focus) || m.vars.targets[0] === target[0]))) { removeModifier(mod) }
                    for (const mod of modifiers.filter(m => m.vars.targets.includes(target[0]) && m?.attributes?.includes("mystic"))) { 
                        if (mod.vars.applied) {
                            mod.vars.cancel++;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.disableMagic, target: mod, cancel: true }) }
                            mod.onTurn.call(mod.vars, {})
                            mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1);
                            mod.vars.cancel--;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.disableMagic, target: mod, cancel: false }) }
                            mod.onTurn.call(mod.vars, {})
                        } else { mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1) }
                     }
                    window.updateModifiers();
                    logAction(`${this.name} disables ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists disable magic`, "miss") }
            } else { logAction(`${target[0].name} has no magic to disable!`, "warning") }
        }
    };

    this.actions.healingDrone = {
        name: "Healing Drone [energy]",
        properties: ["techno", "energy", "radiance/purity", "anomaly/synthetic", "nature/life", "heal"],
        cost: { energy: 35 },
        description: `Costs 35 energy\nModerately heals (~10% max HP) lowest hp ally for 4 turns, doesn&#39;t heal mystic units.`,
        points: 60,
        code: () => {
            if (this.resource.energy < 35) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            this.resource.energy -= 35;
            this.previousAction[2] = true;
            logAction(`${this.name} activate his healing drone!`, "action");
            new Modifier("Healing Drone", "Heals the lowest hp ally",
                { caster: this, targets: unitFilter("player", "").filter(u => !u.base.resource.mana), duration: 3, attributes: ["techno"], stats: ["hp"], listeners: {turnStart: true}, cancel: false, applied: true, focus: false },
                function() {
                    const heal = this.vars.targets.filter(u => u.hp < u.base.hp).reduce((min, unit) => { if (!min || unit.hp < min.hp) { return unit } return min }, null);
                    if (heal) {
                        if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.vars.mod, unit: heal, resource: ['hp'], value: [heal.resource.healFactor] }) }
                        heal.hp = Math.min(heal.hp + heal.resource.healFactor, heal.base.hp);
                        logAction(`Healing Drone heals ${heal.name} for ${heal.resource.healFactor} HP!`, "heal");
                    } else { logAction("Healing Drone has no targets to heal!", "warning") }
                },
                function(context) {
                    if (this.vars.caster === context?.unit) {
                        const heal = this.vars.targets.filter(u => u.hp < u.base.hp).reduce((min, unit) => { if (!min || unit.hp < min.hp) { return unit } return min }, null);
                        if (heal) {
                            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.vars.mod, unit: heal, resource: ['hp'], value: [heal.resource.healFactor] }) }
                            heal.hp = Math.min(heal.hp + heal.resource.healFactor, heal.base.hp);
                            logAction(`Healing Drone heals ${heal.name} for ${heal.resource.healFactor} HP!`, "heal");
                        } else { logAction("Healing Drone has no targets to heal!", "warning") }
                        this.vars.duration--;
                    }
                    if (this.vars.duration === 0) { return true }
                }
            );
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
            if (eventState.resourceChange.flag) {handleEvent('resourceChange', { effect: this.actions.backupPower, unit: this, resource: ['energy'], value: [Math.floor(this.resource.energyRegen * 3.5 + Number.EPSILON)] }) }
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + Math.floor(this.resource.energyRegen * 3.5 + Number.EPSILON));
            logAction(`${this.name} activates the backup power generation and recovers ${Math.floor(this.resource.energyRegen * 3.5 + Number.EPSILON)} energy!`, "heal");
        }
    };
});