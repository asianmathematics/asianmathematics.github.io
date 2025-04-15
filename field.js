const Honeycomb = window.Honeycomb;
const grid = { config: { width: 11, height: 11 }, state: { terrainData: new Map() } };
const Hex = Honeycomb.defineHex({
    dimensions: { width: 75, height: 64 },
    offset: -1,
    spacing: 1.05,
    orientation: 'flat',
    origin: { x: 48, y: 45 }
});
const Grid = Honeycomb.Grid;

function createHex(hex, terrainData = { type: 'plains', elevation: 0, unit: null, isPassable: true}) {
    const tile = document.createElement('div');
    const point = Honeycomb.hexToPoint(hex);
    tile.className = `hex-tile terrain-${terrainData.type}`;
    tile.style.left = `${point.x}px`;
    tile.style.top = `${point.y}px`;
    tile.dataset.cube = `${hex.q},${hex.r},${hex.s}`;
    tile.addEventListener('click', (event) => { updateStatusPanel(event.target.dataset.cube, grid.state.terrainData.get(event.target.dataset.cube)); });
    return tile;
}

function initHexGrid() {
    const hexes = new Grid(Hex, Honeycomb.rectangle({ width: grid.config.width, height: grid.config.height }));
    const fragment = document.createDocumentFragment();
    hexes.forEach(hex => {
        const tile = createHex(hex);
        grid.state.terrainData.set(tile.dataset.cube, { 
            type: 'plains', 
            elevation: 0, 
            unit: null, 
            isPassable: true 
        });
        fragment.appendChild(tile);
    });
    document.getElementById('hex-grid').appendChild(fragment);
}

function updateStatusPanel(cubeStr, terrain) {
    document.getElementById('terrain-info').innerHTML = `
        <h3>Terrain Info</h3>
        <p>Coordinates: (${cubeStr})</p>
        <p>Type: ${terrain.type}</p>
        <p>Elevation: ${terrain.elevation}</p>
        ${terrain.unit ? `<p>Unit: ${terrain.unit.name}</p>` : ''}
    `;
}

function exportMap() {
    const exportData = { config: { ...grid.config }, terrainData: Array.from(grid.state.terrainData.entries()) };
    return JSON.stringify(exportData);
}

function importMap(jsonString) {
    const data = JSON.parse(jsonString);
    grid.config = { ...data.config }
    document.getElementById('hex-grid').innerHTML = '';
    initHexGrid();
    grid.state.terrainData = new Map(data.terrainData);
    document.querySelectorAll('.hex-tile').forEach(tile => { tile.className = `hex-tile terrain-${grid.state.terrainData.get(tile.dataset.cube).type}`; });
}

const TERRAIN_TYPES = {
    FOREST: { 
        type: 'forest', 
        elevation: 0,
        isPassable: true,
        defenseBonus: 0.3
    },
    HILL: {
        type: 'hill',
        elevation: 2,
        isPassable: true,
        rangeBonus: 1
    },
    RIVER: {
        type: 'water',
        elevation: -1,
        isPassable: false
    }
};

function generateStrategicMap() {
    const hexGrid = document.getElementById('hex-grid');
    hexGrid.innerHTML = '';
    const riverPath = [
        '1,9,-10', '2,8,-10', '3,7,-10', '3,6,-9', '3,5,-8',
        '3,4,-7', '3,3,-6', '4,2,-6', '5,1,-6', '5,-1,-4', '5,-2,-3'
    ];
    const specialLocations = {
        '5,0,-5': { type: 'bridge' },
        '5,3,-8': { type: 'treehouse' },
        '1,7,-8': { type: 'cave' }
    };
    const hexes = new Grid(Hex, Honeycomb.rectangle({ width: grid.config.width, height: grid.config.height }));
    const fragment = document.createDocumentFragment();
    hexes.forEach(hex => {
        const cubeStr = `${hex.q},${hex.r},${hex.s}`;
        const terrain = specialLocations[cubeStr] || 
                        (riverPath.includes(cubeStr) ? TERRAIN_TYPES.RIVER :
                        (hex.q < 4 && hex.r > 5 ? TERRAIN_TYPES.HILL :
                        (hex.q < 7 && hex.r > 1 ? TERRAIN_TYPES.FOREST :
                        { type: 'plains' })));
        const tile = createHex(hex, terrain);
        grid.state.terrainData.set(cubeStr, {
            type: terrain.type,
            elevation: terrain.elevation || 0,
            unit: null,
            isPassable: terrain.isPassable ?? true
        });
        fragment.appendChild(tile);
    });
    hexGrid.appendChild(fragment);
}

export { initHexGrid, generateStrategicMap, grid, Hex, Grid };