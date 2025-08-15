export class Unit {
    constructor(name, stat, grow, actionsInit, passivesInit, elements, level, power) {
        this.name = name;
        this.base = { position: stat[10] }
        this.prime = {
            hp: stat[0],
            attack: stat[1],
            defense: stat[2],
            lethality: stat[3],
            accuracy: stat[4],
            evasion: stat[5],
            crit: stat[6],
            resist: stat[7],
            speed: stat[8],
            presence: stat[9],
            resource: {
                stamina: stat[11],
                staminaRegen: stat[12],
            },
            level: level,
            power: power
        };
        this.grow = {
            hp: grow[0],
            attack: grow[1],
            defense: grow[2],
            lethality: grow[3],
            accuracy: grow[4],
            evasion: grow[5],
            crit: grow[6],
            resist: grow[7],
            speed: grow[8],
            presence: grow[9],
            resource: {
                stamina: grow[10],
                staminaRegen: grow[11],
            }
        };
        this.mult = {
            attack: 1,
            defense: 1,
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
        if (stat[13]) { 
            this.prime.resource.mana = stat[13];
            this.prime.resource.manaRegen = stat[14];
            this.grow.resource.mana = grow[12];
            this.grow.resource.manaRegen = grow[13];
            this.mult.resource.manaRegen = 1;
        }
        if (stat[15]) { 
            this.prime.resource.energy = stat[15];
            this.prime.resource.energyRegen = stat[16];
            this.grow.resource.energy = grow[14];
            this.grow.resource.energyRegen = grow[15];
            this.mult.resource.energyRegen = 1;
        }
        for (const stat in this.grow) {
            if (typeof this.prime[stat] === 'object') { continue; }
                  this.base[stat] = this.prime[stat] * ( 1 + this.prime.power * this.grow[stat] );
            }
        for (const stat in this.prime.resource) {
                  this.base.resource[stat] = this.prime.resource[stat] * ( 1 + this.prime.power * this.grow.resource[stat] );
            }
        this.actions = {};
        this.previousAction = [false, false, false];
        this.actionsInit = actionsInit;
        this.stun = false;
    }
}