const Honeycomb = window.Honeycomb;
const grid = { 
  config: { width: 11, height: 11 },
  state: { terrainData: new Map() }
};
const Hex = Honeycomb.defineHex({
    dimensions: { width: 75, height: 64 },
    offset: -1,
    spacing: 1.05,
    orientation: 'flat',
    origin: { x: 48, y: 45 }
});
const Grid = Honeycomb.Grid;

function initHexGrid() {
    const container = document.getElementById('hex-grid');
    const hexes = new Grid(Hex, Honeycomb.rectangle({ 
        width: grid.config.width, 
        height: grid.config.height 
    }));
    hexes.forEach(hex => {
        const point = Honeycomb.hexToPoint(hex);
        const tile = document.createElement('div');
        tile.className = 'hex-tile terrain-plains';
        tile.style.left = `${point.x+5}px`;
        tile.style.top = `${point.y+5}px`;
        tile.dataset.cube = `${hex.q},${hex.r},${hex.s}`;
        grid.state.terrainData.set(tile.dataset.cube, { 
            type: 'plains',
            elevation: 0,
            unit: null,
            isPassable: true
        });
        tile.addEventListener('click', (event) => {
            const cubeStr = event.target.dataset.cube;
            const terrain = grid.state.terrainData.get(cubeStr);
            updateStatusPanel(cubeStr, terrain);
        });
        container.appendChild(tile);
    });
}

function updateStatusPanel(cubeStr, terrain) {
    const panel = document.getElementById('terrain-info');
    panel.innerHTML = `
        <h3>Terrain Info</h3>
        <p>Coordinates: (${cubeStr})</p>
        <p>Type: ${terrain.type}</p>
        <p>Elevation: ${terrain.elevation}</p>
        ${terrain.unit ? `<p>Unit: ${terrain.unit.name}</p>` : ''}
    `;
}

export { initHexGrid, grid, Hex, Grid };