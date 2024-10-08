window.addEventListener('DOMContentLoaded', async () => {
    const tf = require('@tensorflow/tfjs');
    const handpose = require('@tensorflow-models/handpose');
    const webcamElement = document.getElementById('webcam');
    const handCanvas = document.getElementById('hand-overlay');
    const handCtx = handCanvas.getContext('2d');

    async function setupCamera() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamElement.srcObject = stream;
            return new Promise((resolve) => {
                webcamElement.onloadedmetadata = () => {
                    resolve();
                };
            });
        } else {
            throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
        }
    }

    async function loadModel() {
        const model = await handpose.load();
        console.log("Handpose model loaded.");
        return model;
    }

    async function main() {
        await setupCamera();
        webcamElement.play();

        const model = await loadModel();
        detectHands(model);
    }

    function drawHand(handLandmarks, videoWidth, videoHeight, canvasWidth, canvasHeight) {
        handCtx.clearRect(0, 0, canvasWidth, canvasHeight);

        handLandmarks.forEach(landmark => {
            if (!isNaN(landmark[0]) && !isNaN(landmark[1])) {
                let x = landmark[0] * (canvasWidth / videoWidth);
                let y = landmark[1] * (canvasHeight / videoHeight);

                // Inverse the x-coordinate to avoid mirror effect
                x = canvasWidth - x;

                // Flip the y-coordinate to correct the upside-down effect
                y = canvasHeight - y;

                // Draw circles on the canvas at the corrected coordinates
                handCtx.beginPath();
                handCtx.arc(x, y, 5, 0, 2 * Math.PI);
                handCtx.fillStyle = 'rgba(39, 174, 96, 1.0)'; // Adjust the color and opacity as needed
                handCtx.fill();
            } else {
                console.error('One of the landmark coordinates is not a number:', landmark);
            }
        });
    }

    function trackFingers(handLandmarks) {
        const fingers = {
            thumb: [],
            index: [],
            middle: [],
            ring: [],
            pinky: []
        };
    
        // Thumb landmarks (0-3)
        for (let i = 0; i < 4; i++) {
            fingers.thumb.push(handLandmarks[i]);
        }
    
        // Index finger landmarks (4-7)
        for (let i = 4; i < 8; i++) {
            fingers.index.push(handLandmarks[i]);
        }
    
        // Middle finger landmarks (8-11)
        for (let i = 8; i < 12; i++) {
            fingers.middle.push(handLandmarks[i]);
        }
    
        // Ring finger landmarks (12-15)
        for (let i = 12; i < 16; i++) {
            fingers.ring.push(handLandmarks[i]);
        }
    
        // Pinky finger landmarks (16-19)
        for (let i = 16; i < 20; i++) {
            fingers.pinky.push(handLandmarks[i]);
        }
    
        return fingers;
    }
    

    async function detectHands(model) {
        const predictions = await model.estimateHands(webcamElement);
        if (predictions.length > 0) {
            console.log("Hands detected!");
            let handLandmark = predictions[0].landmarks;
            // Pass the landmarks as is if they are already in array format
            drawHand(handLandmark, webcamElement.videoWidth, webcamElement.videoHeight, handCanvas.width, handCanvas.height);
            const fingers = trackFingers(handLandmark);
            console.log("Finger positions:", fingers);
        } else {
            handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height); // Clear the canvas if no hands are detected
        }
        requestAnimationFrame(() => detectHands(model)); // Continue the loop
    }

    main();
});
