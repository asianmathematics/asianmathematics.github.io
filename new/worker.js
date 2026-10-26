import { init, drainIfBusy, flush } from './mc.js';
process.on('message', async (msg) => {
    if (msg.type === 'batch') {
        for (let seed = msg.startSeed; seed <= msg.endSeed; seed++) {
            init(seed);
            await drainIfBusy();
        }
        process.send({ type: 'ready' });
    } else if (msg.type === 'done') {
        await flush();
        process.send({ type: 'finished' }, () => process.exit(0));
    }
});
process.send({ type: 'ready' });