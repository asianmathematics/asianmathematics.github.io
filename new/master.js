import { fork } from 'child_process';
const total = 50000, workerNum = 6;
let complete = 0;
for (let i = 0; i < workerNum; i++) {
    const startSeed = i * Math.ceil(total/workerNum)+1, endSeed = Math.min((i+1)*Math.ceil(total/workerNum), total), workerId = i+1;
    const worker = fork('./worker.js');
    worker.send({ startSeed, endSeed, workerId });
    worker.on('message', async (msg) => { if (++complete === workerNum) console.log('Complete'); });
    worker.on('error', (err) => { console.error('Error in Worker ' + workerId + ':', err); });
}