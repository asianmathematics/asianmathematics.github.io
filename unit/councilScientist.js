import { Unit } from './unit.js';
import { Modifier, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const CouncilScientist = new Unit("Science Council Member", [1000, 26, 12, 90, 20, 120, 40, 80, 130, "back", 100, 80, 6, , , 70, 7], ["anomaly/synthetic", "ingenuity/insanity"], function() {
    this.actions.laserTurret = {
        name: "Laser Turret [energy]",
        properties: ["techno", "light/illusion", "harmonic/change", "radiance/purity", "attack", "multitarget"],
        cost: { energy: 20 },
        description: "Costs 20 energy\nAttacks a targets 6 times at increased accuracy",
        points: 60,
        target: () => { this.actions.laserTurret.code(randTarget(unitFilter("player", "front", false), 2)) },
        code: (targets) => {
            this.resource.energy -= 20;
            this.previousAction[2] = true;
            logAction(`${this.name} activates the laser turret!`, "action");
            attack(this, targets, 6, { accuracy: this.accuracy + 20 });
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
                currentAction[currentAction.length - 1] = this.actions.shieldDisruptor;
                this.actions.shieldDisruptor.target(target);
            }
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
            logAction(`${this.name} activates the backup power generation and recovers energy!`, "heal");
        }
    };

    this.actions.actionWeight = {
        laserTurret: 0.5,
        emp: 0.25,
        shieldDisruptor: 0.2,
        backupPower: 0.05
    };
})