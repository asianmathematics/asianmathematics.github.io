import { Unit } from './unit.js';
import { Modifier, refreshState, updateMod, sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, currentUnit, currentAction, baseElements, elementCombo } from '../combatDictionary.js';

export const mysticEnemy = new Unit("Mystic Fiend", [425, 35, 8, 35, 110, 30, 115, 25, 115, 100, "front", 35, 80, 8, 180, 20], ["Death/Darkness", "Anomaly/Synthetic"], function() {
    this.actions.manaBolt = {
        name: "Mana Bolt [mystic]",
        properties: ["mystic", "attack"],
        cost: { mana: 20 },
        description: "Costs 20 mana\nAttacks a single target twice with increased accuracy",
        code: () => {
            this.previousAction[1] = true;
            this.resource.mana -= 20;
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} fires mana bolts at ${target[0].name}!`, "action");
            attack(this, target, 2, { attacker: { accuracy: this.accuracy * 1.5 } });
        }
    };

    this.actions.curseField = {
        name: "Curse Field [mana]",
        properties: ["mystic", "mana", "anomaly/synthetic", "debuff", "multitarget"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nReduces accuracy and evasion of all front-line enemies",
        code: () => {
            const statDecrease = [-0.15, -0.15];
            this.previousAction[1] = true;
            this.resource.mana -= 40;
            logAction(`${this.name} casts Curse Field!`, "action");
            const self = this;
            new Modifier("Curse Field", "Reduces accuracy and evasion",
                { caster: self, targets: unitFilter("player", "front", false), duration: 'Indefinite', stats: ["accuracy", "evasion"], values: statDecrease },
                (vars) => {
                    vars.targets.forEach(unit => {
                        if (resistDebuff(vars.caster, [unit]) > 50) { resetStat(unit, vars.stats, vars.values) }
                        else { vars.targets.splice(vars.targets.indexOf(unit), 1) }
                    });
                },
                (vars, unit) => {
                    if (vars.targets.includes(unit)) {
                        if (resistDebuff(vars.caster, [unit]) > 30) {
                            resetStat(unit, vars.stats, vars.values);
                            vars.targets.splice(vars.targets.indexOf(unit), 1);
                        }
                    }
                    if (vars.targets.length === 0) { return true }
                }
            );
        }
    };

    this.actions.drainLife = {
        name: "Drain Life [mana]",
        properties: ["mystic", "mana", "death/darkness", "attack", "heal"],
        cost: { mana: 40 },
        description: "Costs 40 mana\nAttacks a single target and heals the caster by damage dealt",
        code: () => {
            this.previousAction[1] = true;
            this.resource.mana -= 40;
            const target = [randTarget(unitFilter("player", "front", false))];
            const hpCheck = target[0].hp;
            logAction(`${this.name} tries to drain ${target[0].name}!`, "action");
            attack(this, target, 1, { attacker: { attack: this.attack * 2, focus: this.focus * 3 } });
            if (hpCheck < target[0].hp) {
                logAction(`${this.name} drains life from ${target[0].name}`, "heal");
                this.hp = Math.min(this.base.hp, this.hp + (hpCheck - target[0].hp));
            }
        }
    };

    this.actions.arcaneShield = {
        name: "Arcane Shield [physical, mana]",
        properties: ["physical", "mystic", "mana", "inertia/cold", "buff"],
        cost: { mana: 25 },
        description: "Costs 25 mana\nIncreases defense and crit resist for 2 turns",
        code: () => {
            const statIncrease = [0.5, 0.3];
            this.previousAction[0] = this.previousAction[1] = true;
            this.resource.mana -= 25;
            const self = this;
            logAction(`${this.name} creates an arcane shield, enhancing their defenses!`, "buff");
            new Modifier("Arcane Shield", "Enhanced defenses",
                { caster: self, targets: [self], duration: 2, stats: ["defense", "resist"], values: statIncrease },
                (vars) => { resetStat(vars.caster, vars.stats, vars.values) },
                (vars, unit) => {
                    if (vars.caster === unit) { vars.duration-- }
                    if (vars.duration === 0) {
                        resetStat(vars.caster, vars.stats, vars.values, false);
                        return true;
                    }
                }
            );
        }
    };

    this.actions.meditate = {
        name: "Meditate [physical]",
        properties: ["physical", "harmonic/change", "resource"],
        description: `Recovers a lot of mana (${this.resource.manaRegen * 3})`,
        code: () => {
            this.previousAction[0] = true;
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + (this.resource.manaRegen * 3) );
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