import { selectTarget, playerTurn, unitFilter, showMessage, attack, applyMod, getModifiersDisplay, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, modifierId } from './combatDictionary.js';

class Unit {
    constructor(name, stat, actionsInit) {
        this.name = name;
        this.base = {
            hp: stat[0],
            attack: stat[1],
            defense: stat[2],
            pierce: stat[3],
            lethality: stat[4],
            accuracy: stat[5],
            evasion: stat[6],
            crit: stat[7],
            resist: stat[8],
            speed: stat[9],
            presence: stat[10],
            position: stat[11],
            resource: {
                stamina: stat[12],
                staminaRegen: stat[13],
            }
        };
        this.mult = {
            attack: 1,
            defense: 1,
            pierce: 1,
            lethality: 1,
            accuracy: 1,
            evasion: 1,
            crit: 1,
            resist: 1,
            speed: 1,
            presence: 1,
            resource: {
                staminaRegen: 1,
            }
        };
        if (stat[14]) { 
            this.base.resource.mana = stat[14];
            this.base.resource.manaRegen = stat[15];
            this.mult.resource.manaRegen = 1;
        }
        if (stat[16]) { 
            this.base.resource.energy = stat[16];
            this.base.resource.energyRegen = stat[17];
            this.mult.resource.energyRegen = 1;
        }
        this.actionInit = actionsInit;
    }
}

const darkActionsInit = function() {
    this.actions.spellAttack = {
        name: "Spell Attack [mystic]",
        description: "Attacks a single target 4 times with mystic damage.",
        target: () => { selectTarget(this.actions.spellAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.previousAction = [false, true, false];
            for (let i = 4; i > 0; i--) { attack(this, target); }
            selectTarget(this.actions.spellAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        }
    };

    this.actions.shootEmUp = {
        name: "Shoot 'em up [mana, physical]",
        cost: { mana: 20 },
        description: "Costs 20 mana\nIncreases evasion by +100% for 1 turn\nHits a single target twice with x2 attack power and x1.5 accuracy",
        target: () => {
            if (this.resource.mana < 20) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.shootEmUp, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.mana -= 20;
            this.previousAction = [true, true, false];
            applyMod([this], "evasion", 1, 1);
            this.attack *= 2;
            this.accuracy *= 1.5;
            attack(this, target);
            attack(this, target);
            resetStat(this, ["attack", "accuracy"]);
        }
    };

    this.actions.bulletHell = {
        name: "Bullet Hell [mana]",
        cost: { mana: 40 },
        description: "Costs 40 mana\nDecreases evasion by 50% for 1 turn\nHits up to 4 random enemies 8 times with x.5 attack and x.75 accuracy",
        code: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 40;
            this.previousAction = [false, true, false];
            applyMod([this], "evasion", -.5, 1);
            this.attack *= .5;
            this.accuracy *= .75;
            let target = unitFilter("enemy", "front", false);
            while (target.length > 4) { target = target.filter(unit => unit !== randTarget(target)) }
            for (let i = 8; i > 0; i--) { attack(this, target); }
            resetStat(this, ["attack", "accuracy"]);
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        description: "Increases evasion by +200% for 1 turn",
        code: () => {
            this.previousAction = [true, false, false];
            applyMod([this], "evasion", 2, 1);
        }
    };
};

const electricActionsInit = function() {
    this.actions.electricDischarge = {
        name: "Electric Discharge [mystic, energy]",
        cost: { energy: 60 },
        description: "Costs 60 energy\nDeals several high damage attacks to a single target with increased pierce and lethality",
        target: () => {
            if (this.resource.energy < 60) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.electricDischarge, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 60;
            this.previousAction = [false, false, true];
            this.pierce *= 2;
            this.lethality *= 1.5;
            this.attack *= 1.3;
            for (let i = 5; i > 0; i--) { attack(this, target); }
            resetStat(this, ["pierce", "lethality", "attack"]);
        }
    };

    this.actions.sickBeats = {
        name: "Sick Beats [energy]",
        cost: { energy: 40 },
        description: "Costs 40 energy\nBoosts speed and presence of a friendly unit for 3 turns",
        target: () => {
            if (this.resource.energy < 40) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.sickBeats, () => { playerTurn(this); }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            this.resource.energy -= 40;
            this.previousAction = [false, false, true];
            applyMod(target, "speed", 0.5, 3);
            applyMod(target, "presence", 0.7, 3);
        }
    };

    this.actions.recharge = {
        name: "Recharge [mana]",
        cost: { mana: 30 },
        description: "Costs 30 mana\nConverts mana into energy, gaining 75 energy",
        code: () => {
            if (this.resource.mana < 30) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 30;
            this.previousAction = [false, true, false];
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + 75);
        }
    };

    this.actions.block = {
        name: "Block",
        description: "Increases defense by +100% for 1 turn",
        code: () => {
            applyMod([this], "defense", 1, 1);
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        description: "Increases evasion by +200% for 1 turn",
        code: () => {
            this.previousAction = [true, false, false];
            applyMod([this], "evasion", 2, 1);
        }
    };
};

const servantActionsInit = function() {
    this.actions.meleeAttack = {
        name: "Melee Attack",
        description: "Attacks a single target twice with x2 damage.",
        target: () => { selectTarget(this.actions.meleeAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.attack *= 2;
            attack(this, target);
            attack(this, target);
            resetStat(this, ["attack"]);
        }
    };

    this.actions.takingOutTrash = {
        name: "Taking Out Trash [stamina]",
        cost: { stamina: 60 },
        description: "Costs 60 stamina\nDirect attack on a single target with guaranteed critical hit.",
        target: () => {
            if (this.resource.stamina < 60) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            selectTarget(this.actions.takingOutTrash, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.stamina -= 60;
            this.previousAction = [true, false, false];
            damage(this, target, [4]);
        }
    };

    this.actions.dodge = {
        name: "Dodge [physical]",
        description: "Increases evasion by +200% for 1 turn",
        code: () => {
            this.previousAction = [true, false, false];
            applyMod([this], "evasion", 2, 1);
        }
    };

    this.actions.block = {
        name: "Block",
        description: "Increases defense by +100% for 1 turn",
        code: () => {
            applyMod([this], "defense", 1, 1);
        }
    };
};

const enemyActionsInit = function() {
    this.actions.actionWeight = { basicAttack: .25, strongAttack: .6, dodge: .1, block: .05 };
    this.actions.basicAttack = () => {
        let target = [randTarget(unitFilter("player", "front", false))];
        attack(this, target);
        attack(this, target);
        attack(this, target);
    };
    this.actions.strongAttack = () => {
        if (this.resource.stamina >= 30) {
            this.resource.stamina -= 30;
            this.previousAction = [true, false, false];
            this.attack *= 2;
            let target = [randTarget(unitFilter("player", "front", false))];
            attack(this, target);
            attack(this, target);
            resetStat(this, ["attack"]);
        }
    };
    this.actions.dodge = () => {
        this.previousAction = [true, false, false];
        applyMod([this], "evasion", 2, 1);
    };
    this.actions.block = () => {
        applyMod([this], "defense", 1, 1);
    };
};

const Dark = new Unit("Dark", [400, 60, 12, 7, 45, 115, 45, 140, 40, 20, 175, "front", 150, 18, 200, 25], darkActionsInit);
const Electric = new Unit("Electric", [450, 50, 8, 12, 35, 105, 40, 120, 35, 25, 150, "front", 100, 15, 75, 10, 200, 20], electricActionsInit);
const Servant = new Unit("Servant", [700, 55, 15, 6, 60, 110, 35, 170, 30, 15, 60, "front", 120, 14], servantActionsInit);
const enemy = new Unit("Basic Enemy", [500, 40, 10, 4, 25, 100, 20, 100, 33, 10, 100, "front", 100, 10], enemyActionsInit);

Object.freeze(Dark);
Object.freeze(Electric);
Object.freeze(Servant);
Object.freeze(enemy);

export { Dark, Electric, Servant, enemy };