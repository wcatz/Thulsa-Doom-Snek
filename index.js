require('dotenv').config();
const express = require('express');
const { createAudioFile } = require('simple-tts-mp3');
const player = require('play-sound')();
const fs = require('fs');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const { toBech32PoolId } = require('./bech32Util');
const { fetchPoolMetadata } = require('./poolMetadataFetcher');
const hrp = 'pool';

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const fullBlockSize = 90112;
const eventQueue = [];
let isAudioPlaying = false;
let lastEventTime = null;

// Start Snek
function startSnek() {
    const snekProcess = spawn('snek', [
        '-input-chainsync-address', process.env.INPUT_CHAINSYNC_ADDRESS,
        '-filter-type', 'chainsync.block',
        '-output', 'webhook',
    ], { stdio: 'ignore' });
}
startSnek();

async function processQueue() {
    if (eventQueue.length > 0 && !isAudioPlaying) {
        isAudioPlaying = true;
        const eventData = eventQueue.shift();
        const jsonData = eventData.req.body;

        // Snek timestamp
        const snekEventTime = new Date(jsonData.timestamp).getTime();

        // Calculate the time difference between events in seconds and round to the nearest whole second
        const timeBetweenEvents = lastEventTime
            ? Math.round((snekEventTime - lastEventTime) / 1000)
            : null;
        lastEventTime = snekEventTime;

        // Extract values from Snek
        const issuerVkey = jsonData.payload.issuerVkey;
        const transactionCount = jsonData.payload.transactionCount;
        const blockBodySize = jsonData.payload.blockBodySize;

        // Convert to bech32PoolId
        const bech32PoolId = toBech32PoolId(issuerVkey, hrp);

        try {
            const data = await fetchPoolMetadata(bech32PoolId);
            // Get the ticker
            const ticker = (data[0] && data[0].meta_json && data[0].meta_json.ticker) || 'unknown';
            // Convert block size to kilobytes
            const blockBodySizeKB = blockBodySize / 1024;
            // Calculate percentage full based on kilobytes
            const percentageFull = (blockBodySizeKB / (fullBlockSize / 1024)) * 100;
            // Create sentence to be spoken
            const sentence = `${timeBetweenEvents} seconds ${ticker}, ${transactionCount} transactions, ${blockBodySizeKB.toFixed(2)} KB, ${percentageFull.toFixed(2)}% full.`;
            // Log the time between events in seconds
            //console.log(`Time between events: ${timeBetweenEvents} seconds`);

            // Log the JSON data
            //console.log('Fetched Pool Metadata:', JSON.stringify(data, null, 2));

            // Log the sentence
            console.log(sentence);

            // Create an audio file with the sentence
            createAudioFile(sentence, 'output');

            // Check if the time between events is less than a threshold (e.g., 5 seconds)
            if (timeBetweenEvents < 5) {
                // If events are too close, save to a separate MP3 file
                const closeEventsSentence = `${timeBetweenEvents} seconds ${ticker} block with ${transactionCount} transactions and a size of ${blockBodySizeKB.toFixed(2)} KB, it is ${percentageFull.toFixed(2)}% full.`;
                createAudioFile(closeEventsSentence, 'close_events_output');
            }

            // Adding a delay before playing the sound (adjust as needed)
            const delayBeforePlaying = 2000;
            setTimeout(() => {
                // Adjust the file path to include the extra '.mp3' appended by the library
                const correctedFilePath = 'output.mp3';

                player.play(correctedFilePath, (err, stdout, stderr) => {
                    if (err) {
                        console.error('Error playing sound:', err, stdout, stderr);
                    } else {
                        //console.log('Sound played successfully');
                    }
                    // Check if the file exists before trying to unlink it
                    if (fs.existsSync(correctedFilePath)) {
                        // Remove the temporary MP3 file
                        fs.unlinkSync(correctedFilePath);
                    }
                    //eventData.res.status(200).send('MP3 played successfully');

                    // Continue processing the queue after a short delay
                    setTimeout(() => {
                        isAudioPlaying = false;
                        processQueue();
                    }, 500);
                });
            }, delayBeforePlaying);
        } catch (error) {
            console.error('Error:', error);
            // Continue processing the queue after a short delay even if there's an error
            setTimeout(() => {
                isAudioPlaying = false;
                processQueue();
            }, 500);
        }
    } else {
        // Continue processing the queue after a short delay
        setTimeout(processQueue, 500);
    }
}

// Webhook
app.post('/', (req, res) => {
    // Log the received POST data to the console
        console.log(req.body);
    eventQueue.push({ req, res });
    processQueue();
});

// Start the server
app.listen(port, () => {
    console.log(`Webhook listener is running on port ${port}`);
});
