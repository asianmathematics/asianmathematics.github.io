import { init, drainIfBusy, flush } from './mc.js';
process.on('message', async (msg) => {
    const { startSeed, endSeed, workerId } = msg;
    for (let seed = startSeed; seed <= endSeed; seed++) {
        init(seed);
        await drainIfBusy();
    }
    await flush();
    process.send({ workerId, status: 'completed' });
    process.exit(0);
});