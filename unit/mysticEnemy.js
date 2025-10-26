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

    this.actions.meditate = {
        name: "Meditate [physical]",
        properties: ["physical", "harmonic/change", "resource"],
        description: `Recovers some mana (${this.resource.manaRegen * 2})`,
        points: 60,
        code: () => {
            this.previousAction[0] = true;
            if (eventState.resourceChange.flag) { handleEvent('resourceChange', { effect: this.actions.meditate, unit: this, resource: ['mana'], value: [this.resource.manaRegen * 2] }) }
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + (this.resource.manaRegen * 2));
            logAction(`${this.name} meditates and recovers mana!`, "heal");
        }
    };

    this.actions.actionWeight = { 
        manaBolt: 0.3, 
        curseField: 0.25, 
        drainLife: 0.2, 
        arcaneShield: 0.15, 
        meditate: 0.1 
    };
});