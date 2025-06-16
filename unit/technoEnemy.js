import { Unit } from './unit.js';
import { logAction, unitFilter, attack, createMod, resetStat, randTarget } from '../combatDictionary.js';

export const technoEnemy = new Unit("Techno Drone", [475, 40, 12, 20, 105, 20, 90, 40, 110, 110, "mid", 60, 6, undefined, undefined, 150, 15], function() {
    this.actions.laserBlast = {
        name: "Laser Blast [energy]",
        cost: { energy: 25 },
        description: "Costs 25 energy\nAttacks up to 2 targets",
        code: () => {
            this.previousAction = [false, false, true];
            this.resource.energy -= 25;
            logAction(`${this.name} fires laser beams!`, "action");
            let target = unitFilter("player", "front", false);
            while (target.length > 2) { target = target.filter(unit => unit !== randTarget(target)); }
            attack(this, target);
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
            } else { logAction(`${this.name} tries repairing an ally, but there's no allies to repair.`, "warning"); }
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
        cost: { stamina: 20 },
        description: "Costs 20 stamina\nRecovers 60 energy",
        code: () => {
            this.previousAction = [true, false, false];
            this.resource.stamina -= 20;
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
        name: "Dodge [physical]",
        description: "Increases evasion for 1 turn",
        code: () => {
            this.previousAction = [true, false, false];
            const self = this;
            createMod("Dodge", "Evasion increased",
                { caster: self, targets: [self], duration: 1, stat: "evasion", value: 2 },
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