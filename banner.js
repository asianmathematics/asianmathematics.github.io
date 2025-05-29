const protoField = {
    oneStar: {
        rate: 0.70,
        units: ["Artificial", "Human", "Exotic", "Darkener", "Techno", "Mystic", "Goner"],
        rates: [1, 1, 1, 1, 1, 1, 1]
    },
    twoStar: {
        rate: 0.28,
        units: ["Class 1", "Class 2", "Class 3", "IeX (Generic)", "A (Generic)", "Timelinear", "Experiment"],
        rates: [1, 1, 1, 1, 1, 1, 1]
    },
    threeStar: {
        rate: 0.015,
        units: ["Classical", "Chaos", "Order", "3 (Scientist)", "Rebellion (Generic)", "Doll Maker", "Amalgam", "Dandelion", "Servant", "Daisy", "Revolutionary (3rd)", "Masks", "Jester", "Star Dream", "Electric"],
        rates: Array(15).fill(1)
    },
    fourStar: {
        rate: 0.0045,
        units: ["Jack Spades", "Dark", "Void", "Entropy", "Template", "Revolutionary (Collective)", "Classical (Joy)", "Gardener", "Past", "Present", "Future", "Narcissus", "Servant (Gluttony)", "Sunshine (Decadent)", "Puppeteer"],
        rates: Array(15).fill(1)
    },
    fiveStar: {
        rate: 0.0005,
        units: ["Creator (Generic)", "Dark (Space)", "Fate", "R. Random", "Green Knight"],
        rates: [1, 1, 1, 1, 1]
    }
};

const protoSquad = {
    oneStar: {
        rate: 0,
        units: [],
        rates: []
    },
    twoStar: {
        rate: 0,
        units: [],
        rates: []
    },
    threeStar: {
        rate: 0.72,
        units: ["Classical", "Chaos", "Order", "3 (Scientist)", "Rebellion (Generic)", "Doll Maker", "Amalgam", "Dandelion", "Servant", "Daisy", "Revolutionary (3rd)", "Masks", "Jester", "Star Dream", "Electric"],
        rates: Array(15).fill(1)
    },
    fourStar: {
        rate: 0.25,
        units: ["Jack Spades", "Dark", "Void", "Entropy", "Template", "Revolutionary (Collective)", "Classical (Joy)", "Gardener", "Past", "Present", "Future", "Narcissus", "Servant (Gluttony)", "Sunshine (Decadent)", "Puppeteer"],
        rates: Array(15).fill(1)
    },
    fiveStar: {
        rate: 0.03,
        units: ["Creator (Generic)", "Dark (Space)", "Fate", "R. Random", "Green Knight"],
        rates: [1, 1, 1, 1, 1]
    }
};

Object.freeze(protoField);
Object.freeze(protoSquad);

export { protoField, protoSquad };
