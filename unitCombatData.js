import { sleep, logAction, selectTarget, playerTurn, unitFilter, showMessage, attack, resistDebuff, createMod, updateMod, resetStat, crit, damage, randTarget, enemyTurn, cleanupGlobalHandlers, allUnits, modifiers } from './combatDictionary.js';

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

const dodgeAction = {
    name: "Dodge [physical]",
    description: "Increases evasion for 1 turn",
    code: function() {
        this.previousAction = [true, false, false];
        createMod("Dodge", "Evasion increased",
            { caster: this, targets: [this], duration: 1, stat: "evasion", value: 2 },
            (vars) => {
                    vars.caster.mult[vars.stat] += vars.value;
                    resetStat(vars.caster, [vars.stat]);
                logAction(`${vars.caster.name} dodges.`, "buff");
            },
            (vars, unit) => {
                if (vars.caster === unit) {
                    vars.targets.forEach(unit => {
                        unit.mult[vars.stat] -= vars.value;
                        resetStat(unit, [vars.stat]);
                    });
                    return true;
                }
            }
        );
    }
};

const blockAction = {
    name: "Block",
    description: "Increases defense for 1 turn",
    code: function() {
        createMod("Block", "Defense increased",
            { caster: this, targets: [this], duration: 1, stat: "defense", value: 1 },
            (vars) => {
                vars.caster.mult[vars.stat] += vars.value;
                resetStat(vars.caster, [vars.stat]);
                logAction(`${vars.caster.name} blocks.`, "buff");
            },
            (vars, unit) => {
                if (vars.caster === unit) {
                    vars.targets.forEach(unit => {
                        unit.mult[vars.stat] -= vars.value;
                        resetStat(unit, [vars.stat]);
                    });
                    return true;
                }
            }
        );
    }
};

const darkActionsInit = function() {
    this.actions.spellAttack = {
        name: "Spell Attack [mystic]",
        description: "Attacks a single target 4 times.",
        target: () => { selectTarget(this.actions.spellAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.previousAction = [false, true, false];
            logAction(`${this.name} fires magic projectiles at ${target[0].name}`, "action")
            for (let i = 4; i > 0; i--) { attack(this, target); }
            selectTarget(this.actions.spellAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        }
    };
    this.actions.shootEmUp = {
        name: "Shoot 'em up [mana, physical]",
        cost: { mana: 20 },
        description: "Costs 20 mana\nIncreases evasion by +100% for 1 turn\nHits a single target twice with increased accuracy and damage",
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
            this.attack *= 2;
            this.accuracy *= 1.5;
            logAction(`${this.name} focus fires on ${target[0].name}!`, "action")
            attack(this, target);
            attack(this, target);
            resetStat(this, ["attack", "accuracy"]);
            const self = this;
            const modifier = createMod("Shoot 'em Up Evasion", "Temporary evasion boost",
                { caster: self, targets: [self], duration: 1, stats: ["evasion"], values: [1] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                    logAction(`${vars.caster.name}'s evasion surges!`, "buff");
                },
                (vars, unit) => {
                    if(vars.caster === unit) {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                        return true;
                    }
                }
            );
        }
    };
    this.actions.bulletHell = {
        name: "Bullet Hell [mana]",
        cost: { mana: 40 },
        description: "Costs 40 mana\nDecreases evasion for 1 turn\nHits up to 4 random enemies 8 times with decreased accuracy and damage",
        code: () => {
            if (this.resource.mana < 40) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            this.resource.mana -= 40;
            this.previousAction = [false, true, false];
            this.attack *= .5;
            this.accuracy *= .75;
            logAction(`${this.name} shoots some damaku!`, "action")
            let target = unitFilter("enemy", "front", false);
            while (target.length > 4) { target = target.filter(unit => unit !== randTarget(target, true)) }
            for (let i = 8; i > 0; i--) { attack(this, target); }
            resetStat(this, ["attack", "accuracy"]);
            const self = this;
            createMod("Evasion Penalty", "Evasion reduced during bullet hell",
                { caster: self, targets: [self], duration: 1, stats: ["evasion"], values: [-0.5] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if(vars.caster === unit) {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                        return true;
                    }
                }
            );
        }
    };
    this.actions.dispelMagic = {
        name: "Dispel Magic [mana]",
        cost: { mana: 75 },
        description: "Costs 75 mana\nSets mana of target to 0 and disables mana regeneration for next turn",
        target: () => {
            if (this.resource.mana < 75) {
                showMessage("Not enough mana!", "error", "selection");
                return;
            }
            selectTarget(this.actions.dispelMagic, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        
        },
        code: (target) => {
            this.resource.mana -= 75;
            this.previousAction = [false, true, false];
            const will = resistDebuff(this, target)
            if (target[0].resource.mana !== undefined) {
                if (will[0] > 30) {
                    target[0].resource.mana = 0;
                    target[0].previousAction[1] = true;
                    logAction(`${this.name} dispels ${target[0].name}'s magic!`, "action");
                }
                else {logAction(`${target[0].name} resists dispel magic`, "miss")}
            }
            else { logAction(`${target[0].name} has no magic to dispel!`, "warning"); }
        }
    };
    this.actions.dodge = {
        name: dodgeAction.name,
        description: dodgeAction.description,
        code: dodgeAction.code.bind(this)
    };
};

const electricActionsInit = function() {
    this.actions.electricDischarge = {
        name: "Electric Discharge [mystic, energy]",
        cost: { energy: 60 },
        description: "Costs 60 energy\nDeals 5 attacks to a single target with increased crit and damage",
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
            logAction(`${this.name} channels a powerful electric discharge into ${target[0].name}!`, "action");
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
            logAction(`${this.name} plays sick beats, energizing ${target[0].name}!`, "buff");
            const self = this;
            createMod("Sick Beats Buff", "Rhythmic performance enhancement",
                { caster: self, targets: target, duration: 3, stats: ["speed", "presence"], values: [0.5, 0.7] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if(vars.targets.includes(unit)) {
                        vars.duration--;
                        if(vars.duration <= 0) {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        return true;
                        }
                    }
                }
            );
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
            logAction(`${this.name} generates electricity!`, "heal");
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + 75);
        }
    };
    this.actions.dodge = {
        name: dodgeAction.name,
        description: dodgeAction.description,
        code: dodgeAction.code.bind(this)
    };
    this.actions.block = {
        name: blockAction.name,
        description: blockAction.description,
        code: blockAction.code.bind(this)
    };
};

const servantActionsInit = function() {
    this.actions.meleeAttack = {
        name: "Melee Attack",
        description: "Attacks a single target twice with increased damage.",
        target: () => { selectTarget(this.actions.meleeAttack, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]); },
        code: (target) => {
            this.attack *= 2;
            logAction(`${this.name} deals with ${target[0].name}`, "action")
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
            logAction(`${this.name} takes out the trash!`, "action")
            damage(this, target, [4]);
        }
    };
    this.actions.sharpFocus = {
        name: "Sneak Attack [stamina]",
        cost: { stamina: 45 },
        description: "Costs 45 stamina\nLowers presence and increases accuracy and crit for 1 turns",
        code: () => {
            if (this.resource.stamina < 45) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            this.resource.stamina -= 45;
            this.previousAction = [true, false, false];
            const self = this;
            createMod("Sharp Focus Adjustment", "Combat focus modification",
                { caster: self, targets: [self], duration: 1, stats: ["presence", "accuracy", "crit", "lethality"], values: [-0.5, 0.5, 0.9, 1] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                    logAction(`${vars.caster.name} enters a hyper-focused state!`, "buff");
                },
                (vars, unit) => {
                    if(vars.caster === unit) {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] -= vars.values[i];
                            resetStat(unit, [stat]);
                        });
                        return true;
                    }
                }
            );
        }
    };
    this.actions.dodge = {
        name: dodgeAction.name,
        description: dodgeAction.description,
        code: dodgeAction.code.bind(this)
    };
    this.actions.block = {
        name: blockAction.name,
        description: blockAction.description,
        code: blockAction.code.bind(this)
    };
};

const classicJoyActionsInit = function() {
    this.actions.rapidFire = {
        name: "Rapid Fire [techno]",
        description: "Attacks a single target twice but increases speed by 40% for 1 turn",
        target: () => {
            selectTarget(this.actions.rapidFire, () => { playerTurn(this) }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (targets) => {
            this.previousAction = [false, false, true];
            attack(this, targets);
            attack(this, targets);
            logAction(`${this.name} performs a Rapid Fire, boosting speed for 1 turn!`, "buff");
            const self = this;
            createMod("Rapid Fire Speed", "Temporary speed boost",
                { caster: self, targets: [self], duration: 1, stats: ["speed"], values: [0.4] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars, unit) => {
                    if(vars.caster === unit) {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] -= vars.values[i];
                            resetStat(unit, [stat]);
                        });
                        return true;
                    }
                }
            );
        }
    };
    this.actions.semiAutomatic = {
        name: "Energy Rifle [energy]",
        cost: { energy: 30 },
        description: "Costs 30 energy\nAttacks a single target 3 times with increased accuracy and crit damage",
        target: () => {
            if (this.resource.energy < 30) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.semiAutomatic, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 30;
            this.previousAction = [false, false, true];
            this.accuracy *= 2;
            this.lethality *= 2.2;
            logAction(`${this.name} fires at ${target[0].name}!`, "action")
            for (let i = 4; i > 0; i--) { attack(this, target); }
            resetStat(this, ["accuracy", "lethality"]);
        }
    };
    this.actions.emp = {
        name: "EMP [energy]",
        cost: { energy: 55 },
        description: "Costs 55 energy\nSets energy of target to 0 and disables energy regeneration for next turn",
        target: () => {
            if (this.resource.energy < 55) {
                showMessage("Not enough energy!", "error", "selection");
                return;
            }
            selectTarget(this.actions.emp, () => { playerTurn(this); }, [1, true, unitFilter("enemy", "front", false)]);
        },
        code: (target) => {
            this.resource.energy -= 55;
            this.previousAction = [false, false, true];
            const will = resistDebuff(this, target)
            if (target[0].resource.energy !== undefined) {
                if (will[0] > 35) {
                    target[0].resource.energy = 0;
                    target[0].previousAction[2] = true;
                    logAction(`${this.name} disables ${target[0].name}'s energy!`, "action");
                }
                else {logAction(`${target[0].name} resists the emp`, "miss")}
            }
            else { logAction(`${target[0].name} has no energy to disable!`, "warning"); }
        }
    };
    this.actions.synthesizeMedicine = {
        name: "Synthesize Medicine [techno]",
        description: "Heals target 80 HP",
        target: () => {
            selectTarget(this.actions.synthesizeMedicine, () => { playerTurn(this); }, [1, true, unitFilter("player", "")]);
        },
        code: (target) => {
            this.previousAction = [false, false, true];
            target[0].hp = Math.min(target[0].base.hp, target[0].hp + 80);
            logAction(`${this.name} heals ${target[0].name} for 80 HP!`, "heal");
        }
    };
    this.actions.joy = {
        name: "Joy [stamina]",
        cost: { stamina: 40 },
        description: "Costs 40 stamina & 50 HP\nDelayed consequences",
        target: () => {
            if (this.resource.stamina < 40) {
                showMessage("Not enough stamina!", "error", "selection");
                return;
            }
            selectTarget(this.actions.joy, () => { playerTurn(this); }, [1, true, unitFilter("player", "", false)]);
        },
        code: (target) => {
            this.resource.stamina -= 40;
            this.hp = Math.max(this.hp - 50, 0);
            const self = this;
            createMod("Joy", "Overall increase?",
                { caster: self, targets: target, duration: 9, buffs: ["accuracy", "crit", "defense", "resist", "pierce"], buffValues: [0.25, 0.4, 0.6, 0.4, 0.3], debuffs: ["attack", "defense", "evasion", "speed", "accuracy"], debuffValues: [-0.25, -0.4, -0.25, -0.1, -0.25], self: null },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.buffs.forEach((stat, i) => {
                            unit.mult[stat] += vars.buffValues[i];
                            resetStat(unit, [stat]);
                        });
                    });
                    logAction(`${vars.caster.name} gives ${vars.targets[0].name} some joy!`, "buff");
                    vars.self = modifier;
                },
                (vars, unit) => {
                    if (vars.targets[0] === unit) { vars.duration--; }
                    if (vars.duration === 6) {
                        vars.targets.forEach(unit => {
                            vars.buffs.forEach((stat, i) => {
                                unit.mult[stat] -= vars.buffValues[i];
                                resetStat(unit, [stat]);
                            });
                            vars.debuffs.forEach((stat, i) => {
                                unit.mult[stat] += vars.debuffValues[i];
                                resetStat(unit, [stat]);
                            });
                        });
                        logAction(`${vars.targets[0].name} is feeling the side effects!`, "debuff");
                        vars.self.description = "Long side effect period";
                    }
                    if (vars.duration === 0) {
                        vars.debuffs.forEach((stat, i) => {
                            unit.mult[stat] -= vars.debuffValues[i];
                            resetStat(unit, [stat]);
                        });
                        return true;
                    }
            });
        }
    };
};

const enemyActionsInit = function() {
    this.actions.basicAttack = {
        name: "Basic Attack",
        description: "Attacks a single target three times.",
        code: () => {
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} attacks ${target[0].name}`, "action");
            attack(this, target);
            attack(this, target);
            attack(this, target);
        }
    };
    this.actions.strongAttack = {
        name: "Strong Attack [stamina]",
        cost: { stamina: 30 },
        description: "Costs 30 stamina\nAttacks a single target twice with increased damage",
        code: () => {
            this.resource.stamina -= 30;
            this.previousAction = [true, false, false];
            this.attack *= 2;
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} unleashes two powerful strikes against ${target[0].name}!`, "action");
            attack(this, target);
            attack(this, target);
            resetStat(this, ["attack"]);
        }
    };
    this.actions.dodge = {
        name: dodgeAction.name,
        description: dodgeAction.description,
        code: dodgeAction.code.bind(this)
    };
    this.actions.block = {
        name: blockAction.name,
        description: blockAction.description,
        code: blockAction.code.bind(this)
    };
    this.actions.actionWeight = { basicAttack: 0.25, strongAttack: 0.6, dodge: 0.1, block: 0.05 };
};

const mysticEnemyActionsInit = function() {
    this.actions.manaBolt = {
        name: "Mana Bolt [mystic]",
        description: "Costs 20 mana\nAttacks a single target twice with increased accuracy",
        code: () => {
            this.previousAction = [false, true, false];
            this.resource.mana -= 20;
            this.accuracy *= 1.5;
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} fires mana bolts at ${target[0].name}!`, "action");
            attack(this, target);
            attack(this, target);
            resetStat(this, ["accuracy"]);
        }
    };
    this.actions.curseField = {
        name: "Curse Field [mana]",
        cost: { mana: 40 },
        description: "Costs 40 mana\nReduces accuracy and evasion of all front-line enemies",
        code: () => {
            this.resource.mana -= 40;
            const self = this;
            createMod("Curse Field", "Reduces accuracy and evasion",
                { caster: self, targets: unitFilter("player", "front", false), duration: 'Indefinite', stats: ["accuracy", "evasion"], values: [-0.15, -0.15] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        if(resistDebuff(vars.caster, unit) > 50) {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] += vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        }
                        else { vars.targets.splice(vars.targets.indexOf(unit), 1); }
                    });
                    logAction(`${vars.caster.name} casts Curse Field!`, "action");
                },
                (vars, unit) => {
                    if (vars.targets.includes(unit)) {
                        if(resistDebuff(vars.caster, unit) > 30) {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                            vars.targets.splice(vars.targets.indexOf(unit), 1);
                        }
                    }
                    if(vars.targets.length === 0) { return true; }
            });
        }
    };
    this.actions.drainLife = {
        name: "Drain Life [mystic]",
        cost: { mana: 30 },
        description: "Costs 30 mana\nAttacks a single target with increased pierce and heals the caster",
        code: () => {
            this.previousAction = [false, true, false];
            this.resource.mana -= 30;
            const target = [randTarget(unitFilter("player", "front", false))];
            const hpCheck = target[0].hp;
            this.pierce *= 1.3;
            logAction(`${this.name} tries to drain ${target[0].name}!`, "action");
            attack(this, target);
            if (hpCheck < target[0].hp) {
                logAction(`${this.name} drains life from ${target[0].name}`, "heal");
                this.hp = Math.min(this.base.hp, this.hp + 25);
            }
            resetStat(this, ["pierce"]);
        }
    };
    this.actions.arcaneShield = {
        name: "Arcane Shield [physical, mana]",
        cost: { mana: 25 },
        description: "Costs 25 mana\nIncreases defense and crit resist for 2 turns",
        code: () => {
            this.previousAction = [true, true, false];
            this.resource.mana -= 25;
            logAction(`${this.name} creates an arcane shield, enhancing their defenses!`, "buff");
            const self = this;
            createMod("Arcane Shield", "Enhanced defenses",
                { caster: this, targets: [this], duration: 2, stats: ["defense", "resist"], values: [0.5, 0.3] },
                    (vars) => {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] += vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                    },
                    (vars) => {
                        vars.duration--;
                        if(vars.duration <= 0) {
                            vars.targets.forEach(unit => {
                                vars.stats.forEach((stat, i) => {
                                    unit.mult[stat] -= vars.values[i];
                                    resetStat(unit, [stat]);
                                });
                            });
                        return true;
                    }
                }
            );
        }
    };
    this.actions.meditate = {
        name: "Meditate [physical]",
        description: "Recovers 50 mana",
        code: () => {
            this.previousAction = [true, false, false];
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + 50);
            logAction(`${this.name} meditates and recovers mana!`, "heal");
        }
    };
    this.actions.actionWeight = { manaBolt: 0.3, curseField: 0.25, drainLife: 0.2, arcaneShield: 0.15, meditate: 0.1 };
};

const technoEnemyActionsInit = function() {
    this.actions.laserBlast = {
        name: "Laser Blast [energy]",
        cost: { energy: 25 },
        description: "Costs 25 energy\nAttacks up to 2 targets with increased pierce",
        code: () => {
            this.previousAction = [false, false, true];
            this.resource.energy -= 25;
            this.pierce *= 2;
            logAction(`${this.name} fires laser beams!`, "action");
            let target = unitFilter("player", "front", false);
            while (target.length > 2) { target = target.filter(unit => unit !== randTarget(target)) }
            attack(this, target);
            resetStat(this, ["pierce"]);
        }
    };
    this.actions.shieldDisruptor = {
        name: "Shield Disruptor [energy]",
        cost: { energy: 35 },
        description: "Costs 35 energy\nReduces defense and resist of target for 2 turns",
        code: () => {
            this.previousAction = [false, false, true];
            this.resource.energy -= 35;
            const target = [randTarget(unitFilter("player", "front", false))];
            logAction(`${this.name} disrupts ${target[0].name}'s defenses!`, "action");
            const self = this;
            createMod("Shield Disruption", "Defense reduction",
                { caster: self, targets: target, duration: 2, stats: ["defense", "resist"], values: [-0.3, -0.3] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                },
                (vars) => {
                    vars.duration--;
                    if(vars.duration <= 0) {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                    return true;
                    }
                }
            );
        }
    };
    this.actions.naniteRepair = {
        name: "Nanite Repair [energy]",
        cost: { energy: 40 },
        description: "Costs 40 energy\nHeals an ally for 60 HP",
        code: () => {
            this.previousAction = [false, false, true];
            this.resource.energy -= 40;
            const allies = unitFilter("enemy", "", false).filter(unit => unit.hp < unit.base.hp);
            if (allies.length > 0) {
                const target = [randTarget(allies)];
                target[0].hp = Math.min(target[0].base.hp, target[0].hp + 60);
                logAction(`${this.name} repairs ${target[0].name}!`, "heal");
            }
            else { logAction(`${this.name} tries repairing an aliy, but there's no allies to repair.`, "warning"); }
        }
    };
    this.actions.overcharge = {
        name: "Overcharge [stamina, energy]",
        cost: { stamina: 10, energy: 30 },
        description: "Costs 10 stamina & 30 energy\nIncreases attack and speed for 2 turns",
        code: () => {
            this.previousAction = [true, false, true];
            this.resource.stamina -= 10;
            this.resource.energy -= 30;
            const self = this;
            createMod("Overcharge Boost", "Power surge",
                { caster: self, targets: [self], duration: 2, stats: ["attack", "speed"], values: [0.4, 0.3] },
                (vars) => {
                    vars.targets.forEach(unit => {
                        vars.stats.forEach((stat, i) => {
                            unit.mult[stat] += vars.values[i];
                            resetStat(unit, [stat]);
                        });
                    });
                    logAction(`${vars.caster.name}'s systems overcharge!`, "buff");
                },
                (vars) => {
                    vars.duration--;
                    if(vars.duration <= 0) {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] -= vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                        return true;
                    }
                }
            );
        }
    };
    this.actions.backupPower = {
        name: "Backup Power [stamina]",
        description: "Costs 20 stamina\nRecovers 60 energy",
        code: () => {
            this.previousAction = [true, false, false];
            this.resource.stamina -= 60;
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + 60);
            logAction(`${this.name} activates the backup power generation and recovers energy!`, "heal");
        }
    };
    this.actions.switchPosition = {
        name: "Switch Position [physical]",
        description: "Switch between front and back line positions",
        code: () => {
            this.previousAction = [true, false, false];
            if (this.position === "back") {
                this.position = "front";
                logAction(`${this.name} moves to the frontline.`, "info");
                this.base.defense = 10;
                this.base.pierce = 10;
                this.base.lethality = 26;
                this.base.evasion = 16;
                this.base.speed = 15;
                this.base.presence = 125;
                this.actions.actionWeight = {laserBlast: 0.2, shieldDisruptor: 0.3, naniteRepair: 0.25, overcharge: 0.2, backupPower: 0, switchPosition: 0.05, dodge: 0.1 };
            } else {
                this.position = "back";
                logAction(`${this.name} moves to the backline.`, "info");
                this.base.defense = 12;
                this.base.pierce = 8;
                this.base.lethality = 20;
                this.base.evasion = 20;
                this.base.speed = 12;
                this.base.presence = 110;
                this.actions.actionWeight = {laserBlast: 0.5, shieldDisruptor: 0, naniteRepair: 0, overcharge: 0.25, backupPower: 0.2, switchPosition: 0.05, dodge: 0 };
            }
            resetStat(this, ["defense", "pierce", "lethality", "evasion", "speed", "presence"])
        }
    };
    this.actions.dodge = {
        name: dodgeAction.name,
        description: dodgeAction.description,
        code: dodgeAction.code.bind(this)
    };
    this.actions.actionWeight = {laserBlast: 0.5, shieldDisruptor: 0, naniteRepair: 0, overcharge: 0.25, backupPower: 0.2, switchPosition: 0.05, dodge: 0 }
};

const magitechEnemyActionsInit = function() {
    this.actions.arcaneCannon = {
        name: "Arcane Cannon [mana, techno]",
        cost: { mana: 20, },
        description: "Costs 20 mana\nAttacks a single target twice with increased damage",
        code: () => {
            this.previousAction = [false, true, true];
            this.resource.mana -= 20;
            this.attack *= 1.5;
            this.pierce *= 1.5;
            const target = [randTarget(unitFilter("player", "", false))];
            logAction(`${this.name} fires an arcane cannon at ${target[0].name}!`, "action");
            attack(this, target);
            attack(this, target);
            resetStat(this, ["attack", "pierce"]);
        }
    };
    this.actions.elementalShift = {
        name: "Elemental Shift [mystic]",
        description: "Shifts to fire or ice element, gaining different bonuses",
        code: () => {
            this.previousAction = [false, true, false];
            const self = this;
            if (Math.random() < .5) {
                logAction(`${this.name} shifts to fire element, becoming more aggressive!`, "buff");
                createMod("Fire Element", "Offensive enhancement",
                    { caster: self, targets: [self], duration: 2, stats: ["attack", "speed"], values: [0.3, 0.2] },
                    (vars) => {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] += vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                    },
                    (vars) => {
                        vars.duration--;
                        if(vars.duration <= 0) {
                            vars.targets.forEach(unit => {
                                vars.stats.forEach((stat, i) => {
                                    unit.mult[stat] -= vars.values[i];
                                    resetStat(unit, [stat]);
                                });
                            });
                            return true;
                        }
                    }
                );
            } else {
                logAction(`${this.name} shifts to ice element, becoming more defensive!`, "buff");
                createMod("Ice Element", "Defensive enhancement",
                    { caster: self, targets: [self], duration: 2, stats: ["defense", "resist"], values: [0.3, 0.2] },
                    (vars) => {
                        vars.targets.forEach(unit => {
                            vars.stats.forEach((stat, i) => {
                                unit.mult[stat] += vars.values[i];
                                resetStat(unit, [stat]);
                            });
                        });
                    },
                    (vars) => {
                        vars.duration--;
                        if(vars.duration <= 0) {
                            vars.targets.forEach(unit => {
                                vars.stats.forEach((stat, i) => {
                                    unit.mult[stat] -= vars.values[i];
                                    resetStat(unit, [stat]);
                                });
                            });
                            return true;
                        }
                    }
                );
            }
        }
    };
    this.actions.magitechBarrier = {
        name: "Magitech Barrier [mana, energy]",
        cost: { mana: 25, energy: 25 },
        description: "Costs 25 mana & 25 energy\nIncreases defense of all allies",
        code: () => {
            this.resource.mana -= 25;
            this.resource.energy -= 25;
            createMod("Magitech Barrier", "Defensive field",
            { caster: this, targets: unitFilter("enemy", "", false), duration: 1, stat: "defense", value: 0.25 },
            (vars) => {
                vars.targets.forEach(unit => {
                    unit.mult[vars.stat] += vars.value;
                    resetStat(unit, [vars.stat]);
                });
                logAction(`${vars.caster.name} creates a protective barrier!`, "buff");
            },
            (vars, unit) => {
                if(vars.caster === unit) {
                    vars.targets.forEach(unit => {
                        unit.mult[vars.stat] -= vars.value;
                        resetStat(unit, [vars.stat]);
                    });
                    return true;
                }
            });
        }
    };
    this.actions.essenceAbsorption = {
        name: "Essence Absorption",
        description: "Recovers 40 mana and energy",
        code: () => {
            this.resource.mana = Math.min(this.base.resource.mana, this.resource.mana + 40);
            this.resource.energy = Math.min(this.base.resource.energy, this.resource.energy + 40);
            logAction(`${this.name} absorbs ambient essence, replenishing resources!`, "heal");
        }
    };
    this.actions.energyWave = {
        name: "Energy Wave [energy]",
        cost: { energy: 30 },
        description: "Costs 30 energy\nAttacks all front-line enemies with reduced accuracy and damage",
        code: () => {
            this.previousAction = [false, false, true];
            this.resource.energy -= 30;
            this.accuracy *= 0.8;
            this.attack *= 0.8;
            logAction(`${this.name} releases an energy wave across the battlefield!`, "action");
            attack(this, unitFilter("player", "front", false));
            resetStat(this, ["accuracy", "attack"]);
        }
    };
    this.actions.coreOverload = {
        name: "Core Overload [mana, energy]",
        cost: { mana: 40, energy: 40 },
        description: "Costs 40 mana & 40 energy\nOnly usable when below 30% HP, otherwise does Arcane Cannon\nAttacks all front-line enemies with increased attack",
        code: () => {
            if (this.hp >= this.base.hp * 0.3) {
                this.actions.arcaneCannon.code();
                return;
            }
            this.previousAction = [false, true, true];
            this.resource.mana -= 40;
            this.resource.energy -= 40;
            this.attack *= 2;
            logAction(`${this.name}'s core overloads in a desperate attack!`, "crit");
            attack(this, unitFilter("player", "front", false));
            resetStat(this, ["attack"]);
        }
    };
    this.actions.actionWeight = { arcaneCannon: 0.10, elementalShift: 0.20, magitechBarrier: 0.20, essenceAbsorption: 0.15, energyWave: 0.10, coreOverload: 0.25 };
};

const Dark = new Unit("Dark", [400, 60, 12, 7, 45, 115, 45, 120, 25, 20, 175, "front", 150, 18, 200, 25], darkActionsInit);
const Electric = new Unit("Electric", [450, 50, 8, 12, 35, 105, 25, 110, 30, 25, 150, "front", 100, 15, 75, 10, 200, 20], electricActionsInit);
const Servant = new Unit("Servant", [700, 55, 15, 6, 60, 110, 35, 125, 30, 15, 60, "front", 120, 14], servantActionsInit);
const ClassicJoy = new Unit ("Classical (Joy)", [380, 75, 10, 15, 75, 120, 15, 130, 30, 8, 110, "back", 120, 15, undefined, undefined, 90, 10], classicJoyActionsInit);
const enemy = new Unit("Basic Enemy", [500, 40, 10, 4, 25, 100, 20, 100, 35, 10, 100, "front", 100, 10], enemyActionsInit);
const mysticEnemy = new Unit("Mystic Fiend", [425, 35, 8, 9, 35, 110, 30, 115, 25, 15, 100, "front", 80, 8, 180, 20], mysticEnemyActionsInit);
const technoEnemy = new Unit("Techno Drone", [475, 40, 12, 8, 20, 105, 20, 90, 40, 12, 110, "mid", 60, 6, undefined, undefined, 150, 15], technoEnemyActionsInit);
const magitechEnemy = new Unit("Magitech Golem", [550, 45, 15, 10, 30, 100, 15, 95, 45, 8, 140, "front", 90, 9, 120, 12, 120, 12], magitechEnemyActionsInit);

export { Dark, Electric, Servant, ClassicJoy, enemy, mysticEnemy, technoEnemy, magitechEnemy };