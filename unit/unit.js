export class Unit {
    constructor(name, stat, elements, actionsInit) {
        this.name = name;
        this.base = {
            hp: stat[0],
            attack: stat[1],
            defense: stat[2],
            lethality: stat[3],
            accuracy: stat[4],
            evasion: stat[5],
            focus: stat[6],
            resist: stat[7],
            speed: stat[8],
            presence: stat[9],
            position: stat[10],
            elements: elements,
            resource: {
                stamina: stat[11],
                staminaRegen: stat[12],
            }
        };
        this.mult = {
            attack: 1,
            defense: 1,
            lethality: 1,
            accuracy: 1,
            evasion: 1,
            focus: 1,
            resist: 1,
            speed: 1,
            presence: 1,
            resource: {
                staminaRegen: 1,
            }
        };
        if (stat[13]) { 
            this.base.resource.mana = stat[13];
            this.base.resource.manaRegen = stat[14];
            this.mult.resource.manaRegen = 1;
        }
        if (stat[15]) { 
            this.base.resource.energy = stat[15];
            this.base.resource.energyRegen = stat[16];
            this.mult.resource.energyRegen = 1;
        }
        this.elements = this.base.elements;
        this.hp = this.base.hp;
        this.resource = {...this.base.resource};
        this.actions = {};
        this.previousAction = [false, false, false];
        this.stun = false;
        this.absorb = [];
        this.shield = [];
        this.actionsInit = actionsInit;
    }
}