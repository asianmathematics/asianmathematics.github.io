const protoField = {
    oneStar: {
        rate: 0.800033,
        units: ["Artificial", "Human", "Exotic", "Darkener", "Techno", "Mystic", "Goner"],
        rates: [1, 1, 1, 1, 1, 1, 1]
    },
    twoStar: {
        rate: 0.16016,
        units: ["Class 1", "Class 2", "Class 3", "Class 4", "HeX", "DeX", "IeX", "A", "Timelinear", "Experiment", "Forgotten"],
        rates: Array(11).fill(1)
    },
    threeStar: {
        rate: 0.03208,
        units: ["Classical (Joy)", "Righty001", "2 (Soldier)", "Clone 2 (Soldier)", "3 (Scientist)", "Rebellion", "4 (Butler)", "4 (Archer)", "HeX (Soldier)", "DeX (Soldier)", "Prodigy", "Electric", "Prince"],
        rates: Array(13).fill(1)
    },
    fourStar: {
        rate: 0.00644,
        units: ["Classical", "Sunshine", "Revolutionary (3rd)", "4 (Bartender)", "Fear", "Jester", "Amalgam", "Gardener", "Dandelion", "Servant"],
        rates: Array(10).fill(1)
    },
    fiveStar: {
        rate: 0.0013,
        units: ["Jack Spades", "Sunshine (Decadent)", "Past", "Present", "Future", "Revolutionary (Collective)", "Narcissus", "Librarian", "Star Dream", "Daisy", "Doll Maker", "Puppeteer", "Void", "Entropy", "Masks", "Template", "Dark", "Servant (Gluttony)"],
        rates: Array(18).fill(1)
    },
    sixStar: {
        rate: 0.000266,
        units: ["Creator (Generic)", "Fate", "Green Knight", "Amalgam (Broken Dream)", "R. Random", "Dark (Space)"],
        rates: [1, 1, 1, 1, 1, 1]
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
        rate: 0.65,
        units: ["Classical (Joy)", "Righty001", "2 (Soldier)", "Clone 2 (Soldier)", "3 (Scientist)", "Rebellion", "4 (Butler)", "4 (Archer)", "HeX (Soldier)", "DeX (Soldier)", "Prodigy", "Electric", "Prince"],
        rates: Array(13).fill(1)
    },
    fourStar: {
        rate: 0.25,
        units: ["Classical", "Sunshine", "Revolutionary (3rd)", "4 (Bartender)", "Fear", "Jester", "Amalgam", "Gardener", "Dandelion", "Servant"],
        rates: Array(10).fill(1)
    },
    fiveStar: {
        rate: 0.075,
        units: ["Jack Spades", "Sunshine (Decadent)", "Past", "Present", "Future", "Revolutionary (Collective)", "Narcissus", "Librarian", "Star Dream", "Daisy", "Doll Maker", "Puppeteer", "Void", "Entropy", "Masks", "Template", "Dark", "Servant (Gluttony)"],
        rates: Array(18).fill(1)
    },
    sixStar: {
        rate: 0.025,
        units: ["Creator (Generic)", "Fate", "Green Knight", "Amalgam (Broken Dream)", "R. Random", "Dark (Space)"],
        rates: [1, 1, 1, 1, 1, 1]
    }
};

Object.freeze(protoField);
Object.freeze(protoSquad);

export { protoField, protoSquad };
