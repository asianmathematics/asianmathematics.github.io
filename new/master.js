import { fork } from 'child_process';
let nextSeed = Date.now(), finished = 0;
const total = nextSeed+75000, workerNum = 5, batchSize = 32;
for (let i = 0; i < workerNum; i++) {
    const workerId = i + 1;
    const worker = fork('./worker.js');
    worker.on('message', (msg) => {
        if (msg.type === 'ready') {
            if (nextSeed > total) return worker.send({ type: 'done' });
            const startSeed = nextSeed;
            const endSeed = Math.min(nextSeed + batchSize - 1, total);
            nextSeed = endSeed + 1;
            worker.send({ type: 'batch', startSeed, endSeed });
        } else if (msg.type === 'finished' && ++finished === workerNum) console.log('Complete');
    });
    worker.on('error', (err) => console.error('Error in Worker ' + workerId + ':', err));
}