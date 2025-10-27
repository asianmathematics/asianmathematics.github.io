export class Unit {
    constructor(name, stat, elements, actionsInit, passiveInit) {
        this.name = name;
        this.base = {
            hp: stat[0],
            attack: stat[1],
            defense: stat[2],
            accuracy: stat[3],
            evasion: stat[4],
            focus: stat[5],
            resist: stat[6],
            speed: stat[7],
            presence: stat[8],
            position: stat[9],
            elements: elements,
            resource: {
                healFactor: stat[10],
                stamina: stat[11],
                staminaRegen: stat[12],
            }
        };
        this.mult = {
            attack: 0,
            defense: 0,
            accuracy: 0,
            evasion: 0,
            focus: 0,
            resist: 0,
            speed: 0,
            presence: 0,
            resource: {
                healFactor: 0,
                staminaRegen: 0,
            }
        };
        if (stat[13]) { 
            this.base.resource.mana = stat[13];
            this.base.resource.manaRegen = stat[14];
            this.mult.resource.manaRegen = 0;
        }
        if (stat[15]) { 
            this.base.resource.energy = stat[15];
            this.base.resource.energyRegen = stat[16];
            this.mult.resource.energyRegen = 0;
        }
        this.elements = this.base.elements;
        this.hp = this.base.hp;
        this.resource = {...this.base.resource};
        this.actions = {};
        this.previousAction = [false, false, false];
        this.stun = false;
        this.cancel = false;
        this.absorb = [];
        this.shield = [];
        this.actionsInit = actionsInit;
        if (passiveInit) {
            this.passives = {};
            this.passiveInit = passiveInit;
        }
    }
}