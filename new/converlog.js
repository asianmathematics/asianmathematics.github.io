import { readFileSync, writeFileSync, existsSync } from 'fs';
const inputPath = '../../greanandin/log.jsonl';
const outputPath = '../../greanandin/test.json';
const content = readFileSync(inputPath, 'utf8');
const objects = content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
console.log(`✅ Parsed ${objects.length} total log events.`);
const newSimulations = {};
for (const obj of objects) {
    if (!obj.id) continue;
    if (!newSimulations[obj.id]) newSimulations[obj.id] = [];
    const { id: _, ...logEventWithoutId } = obj;
    newSimulations[obj.id].push(logEventWithoutId);
}
console.log(`✅ Grouped into ${Object.keys(newSimulations).length} unique simulations.`);
let finalSimulations = {};
if (existsSync(outputPath)) {
    try {
        const existingContent = readFileSync(outputPath, 'utf8');
        finalSimulations = JSON.parse(existingContent);
        console.log(`📂 Loaded existing data with ${Object.keys(finalSimulations).length} simulations.`);
    } catch (e) {
        console.warn('⚠️ Could not parse existing file. Starting fresh.');
    }
}
for (const [id, events] of Object.entries(newSimulations)) {
    finalSimulations[id] = events; 
}
const lines = Object.entries(finalSimulations).map(([key, value]) => { return `"${key}":${JSON.stringify(value)}`; });
const formattedJson = `{\n${lines.join(',\n')}\n}`;
writeFileSync(outputPath, formattedJson);
console.log(`🎉 Successfully wrote the formatted data to ${outputPath}`);