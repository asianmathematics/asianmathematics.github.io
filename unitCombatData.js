import { selectTarget, playerTurn, unitFilter, showMessage, attack, applyMod, getModifiersDisplay, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers, modifierId } from './combatDictionary.js';
const Dark = {
    name: "Dark",
    baseStats: {
        hp: 600,
        attack: 60,
        defense: 10,
        pierce: 6,
        lethality: 40,
        accuracy: 100,
        evasion: 50,
        crit: 150,
        resist: 40,
        speed: 20,
        presence: 175,
        position: "front",
        resource: {
            stamina: 150,
            staminaRegen: 15,
            mana: 200,
            manaRegen: 30,
        }
    },
    mult: {
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
            manaRegen: 1,
        },
    },
    actionInit: function() {
        this.actions.spellAttack = {
            name: "Spell Attack [mystic]",
            cost: { mana: 0, },
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
            cost: { stamina: 0, mana: 20 },
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
        }
        this.actions.dodge = {
            name: "Dodge [physical]",
            cost: { stamina: 0 },
            description: "Increases evasion by +200% for 1 turn",
            code: () => {
                this.previousAction = [true, false, false];
                applyMod([this], "evasion", 2, 1);
            }
        }
    }
}

const enemy = {
    name: "Basic Enemy",
    baseStats: {
        hp: 900,
        attack: 40,
        defense: 10,
        pierce: 4,
        lethality: 25,
        accuracy: 100,
        evasion: 20,
        crit: 100,
        resist: 30,
        speed: 10,
        presence: 100,
        position: "front",
        resource: {
            stamina: 100,
            staminaRegen: 10,
        }
    },
    mult: {
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
        },
    },
    actionInit: function() {
        this.actions.actionWeight = { basicAttack: .3, strongAttack: .7, }
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
                resetStat(this, ["attack"])
            }
        };
    },
}

Object.freeze(Dark);
Object.freeze(enemy);

export {Dark, enemy};