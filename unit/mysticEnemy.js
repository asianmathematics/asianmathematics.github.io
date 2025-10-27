import { Unit } from './unit.js';
import { Modifier, refreshState, handleEvent, removeModifier, basicModifier, setUnit, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, elementDamage, elementBonus, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo, eventState } from '../combatDictionary.js';

export const mysticEnemy = new Unit("Mystic Fiend", [1000, 50, 20, 130, 30, 130, 50, 140, 90, "front", 100, 80, 8, 220, 24], ["death/darkness", "anomaly/synthetic"], function() {
    this.actions.manaBolt = {
        name: "Mana Bolt [mystic]",
        properties: ["mystic", "attack"],
        description: "Attacks a single target twice with increased accuracy",
        points: 60,
        code: () => {
            this.previousAction[1] = true;
            const target = randTarget(unitFilter("player", "front", false));
            logAction(`${this.name} fires mana bolts at ${target[0].name}!`, "action");
            attack(this, target, 2, { attacker: { accuracy: this.accuracy + 40 } });
        }
    };

    this.actions.curseField = {
        name: "Curse Field [mana]",
        properties: ["mystic", "mana", "anomaly/synthetic", "debuff", "multitarget"],
        cost: { mana: 25 },
        description: "Costs 25 mana\nReduces accuracy and evasion of all front-line enemies",
        points: 60,
        code: () => {
            const statDecrease = [-24, -5];
            this.previousAction[1] = true;
            this.resource.mana -= 25;
            logAction(`${this.name} casts Curse Field!`, "action");
            new Modifier("Curse Field", "Reduces accuracy and evasion",
                { caster: this, targets: unitFilter("player", "front", false), duration: 'Indefinite', attributes: ["mystic"], elements: ["anomaly/synthetic"], stats: ["accuracy", "evasion"], values: statDecrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true },
                function() {
                    this.vars.targets.forEach(unit => {
                        if (resistDebuff(this.vars.caster, [unit]) > 66.7) { resetStat(unit, this.vars.stats, this.vars.values) }
                        else { this.vars.targets.splice(this.vars.targets.indexOf(unit), 1) }
                    });
                },
                function(context) {
                    if (this.vars.cancel && this.vars.applied) {
                        for (const unit of this.vars.targets) {
                            resetStat(unit, this.vars.stats, this.vars.values, false);
                            this.vars.applied = false;
                        }
                    }
                    else if (!this.vars.cancel && !this.vars.applied) {
                        for (const unit of this.vars.targets) {
                            resetStat(unit, this.vars.stats, this.vars.values);
                            this.vars.applied = true;
                        }
                    }
                    if (this.vars.targets.includes(context?.unit)) {
                        if (resistDebuff(this.vars.caster, [context.unit]) <= 33.3) {
                            if (this.vars.applied) { resetStat(context.unit, this.vars.stats, this.vars.values, false) }
                            this.vars.targets.splice(this.vars.targets.indexOf(context.unit), 1);
                        }
                    }
                    if (this.vars.targets.length === 0) { return true }
                }
            );
        }
    };

    this.actions.drainLife = {
        name: "Drain Life [mana]",
        properties: ["mystic", "mana", "death/darkness", "attack", "heal"],
        cost: { mana: 50 },
        description: "Costs 50 mana\nAttacks a single target and heals the caster by damage dealt",
        points: 60,
        code: () => {
            this.previousAction[1] = true;
            this.resource.mana -= 50;
            const target = randTarget(unitFilter("player", "front", false));
            const hpCheck = target[0].hp;
            logAction(`${this.name} tries to drain ${target[0].name}!`, "action");
            attack(this, target, 1, { attacker: { attack: this.attack + 14, focus: this.focus + 50 } });
            if (hpCheck < target[0].hp) {
                logAction(`${this.name} drains life from ${target[0].name}`, "heal");
                if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.drainLife, unit: this, resource: ['hp'], value: [hpCheck - target[0].hp] }) }
                this.hp = Math.min(this.base.hp, this.hp + (hpCheck - target[0].hp));
            }
        }
    };

    this.actions.arcaneShield = {
        name: "Arcane Shield [physical, mana]",
        properties: ["physical", "mystic", "mana", "inertia/cold", "buff"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nIncreases defense and resist for 2 turns",
        points: 60,
        code: () => {
            const statIncrease = [12, 10];
            this.previousAction[0] = this.previousAction[1] = true;
            this.resource.mana -= 40;
            logAction(`${this.name} creates an arcane shield, enhancing their defenses!`, "buff");
            basicModifier("Arcane Shield", "Enhanced defenses", { caster: this, targets: [this], duration: 2, attributes: ["mystic"], elements: ["inertia/cold"], stats: ["defense", "resist"], values: statIncrease, listeners: {turnEnd: true}, cancel: false, applied: true, focus: true });
        }
    };

    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        properties: ["mystic", "mana", "intertia/cold", "debuff", "resource"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nChance to set target&#39;s mana to 0, disable mana regeneration for next turn, and end all mystic modifiers it focuses or cast on it",
        points: 60,
        code: () => {
            this.resource.mana -= 40;
            this.previousAction[1] = true;
            const target = randTarget(unitFilter("player", "front", false).filter(u => u.base.resource.mana))
            if (target.length) {
                if (resistDebuff(this, target)[0] > 25) {
                    if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.dispelMagic, unit: target[0], resource: ['mana'], value: [-target[0].resource.mana] }) }
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    for (const mod of modifiers.filter(m => m?.attributes?.includes("mystic") && ((m.vars.caster === target[0] && m.vars.focus) || m.vars.targets[0] === target[0]))) { removeModifier(mod) }
                    for (const mod of modifiers.filter(m => m.vars.targets.includes(target[0]) && m?.attributes?.includes("mystic"))) {
                        if (mod.vars.applied) {
                            mod.vars.cancel++;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.dispelMagic, target: mod, cancel: true }) }
                            mod.onTurn.call(mod.vars, {})
                            mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1);
                            mod.vars.cancel--;
                            if (eventState.cancel.flag) {handleEvent('cancel', { effect: this.actions.dispelMagic, target: mod, cancel: false }) }
                            mod.onTurn.call(mod.vars, {})
                        } else { mod.vars.targets.splice(mod.vars.targets.indexOf(target[0]), 1) }
                     }
                    window.updateModifiers();
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                } else { logAction(`${target[0].name} resists dispel magic`, "miss") }
            } else { this.actions.drainLife.code() }
        }
    };

    this.actions.actionWeight = { 
        manaBolt: 0.3, 
        curseField: 0.25, 
        drainLife: 0.2, 
        arcaneShield: 0.15, 
        dispelMagic: 0.1 
    };
});