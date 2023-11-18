const express = require('express');
const { createAudioFile } = require('simple-tts-mp3');
const player = require('play-sound')();
const fs = require('fs');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');

require('dotenv').config();
const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Figure the actual size out later
const fullBlockSize = 87840;

const eventQueue = [];
let isAudioPlaying = false;

// Start Snek
function startSnek() {
    const snekProcess = spawn('snek', [
        '-input-chainsync-address', process.env.INPUT_CHAINSYNC_ADDRESS,
        '-filter-type', 'chainsync.block',
        '-output', 'webhook',
    ], { stdio: 'ignore' });
}
startSnek();

// Function to process the event queue
function processQueue() {
    if (eventQueue.length > 0 && !isAudioPlaying) {
        const eventData = eventQueue.shift();
        const jsonData = eventData.req.body;

        // Extract values from JSON
        const issuerVkey = jsonData.payload.issuerVkey;
        const transactionCount = jsonData.payload.transactionCount;
        const blockBodySize = jsonData.payload.blockBodySize;

        // Convert block size to kilobytes
        const blockBodySizeKB = blockBodySize / 1024;

        // Calculate percentage full based on kilobytes
        const percentageFull = (blockBodySizeKB / (fullBlockSize / 1024)) * 100;

        // Create sentence
        const sentence = `New block with ${transactionCount} transactions and a blockBodySize of ${blockBodySizeKB.toFixed(2)} KB. ${percentageFull.toFixed(2)}% full.`;

        console.log(sentence); // Log the sentence to the console

        // Create an audio file with the sentence
        createAudioFile(sentence, 'output');

        // Adding a delay before playing the sound (adjust as needed)
        const delayBeforePlaying = 2000;
        setTimeout(() => {
            // Adjust the file path to include the extra '.mp3' appended by the library
            const correctedFilePath = 'output.mp3';

            player.play(correctedFilePath, (err) => {
                if (err) {
                    console.error('Error playing sound:', err);
                } else {
                    console.log('Sound played successfully');
                }
                
                // Check if the file exists before trying to unlink it
                if (fs.existsSync(correctedFilePath)) {
                    // Remove the temporary MP3 file
                    fs.unlinkSync(correctedFilePath);
                }

                // Audio played successfully
                eventData.res.status(200).send('MP3 played successfully');

                // Continue processing the queue after a short delay
                setTimeout(processQueue, 500);
            });
        }, delayBeforePlaying);
    } else {
        // Continue processing the queue after a short delay
        setTimeout(processQueue, 500);
    }
}

app.post('/', (req, res) => {
    // Log the received POST data to the console
    console.log(req.body);
    eventQueue.push({ req, res });
    processQueue();
});

app.listen(port, () => {
    console.log(`Webhook listener is running on port ${port}`);
});
