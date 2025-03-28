let trackWidth = 0.25; // Buggy track width in meters (25cm)
let pathWidth = 0.017; // Path width in meters (17mm)
let buggyWidth = 0.25; // Buggy width in meters (25cm)
let buggyLength = 0.3; // Buggy length in meters (30cm)

let pathData = [];
let currentIndex = 0;
let isPlaying = false;
let playbackSpeed = 1;
let scale = 100; // Initial scale factor (1m = 100px)

function computePath(accumulatedDebugData) {
    let x = 0, y = 0, theta = 0;
    pathData = [];

    accumulatedDebugData.forEach((data) => {
        let leftDist = parseFloat(data.Left_Distance);
        let rightDist = parseFloat(data.Right_Distance);

        let d = (leftDist + rightDist) / 2; // Average distance
        let deltaTheta = (rightDist - leftDist) / trackWidth;

        theta += deltaTheta;
        x += d * Math.cos(theta);
        y += d * Math.sin(theta);

        pathData.push({ x, y, theta });
    });

    adjustCanvasSize(); // Resize canvas to fit path
    document.getElementById("timeSlider").max = pathData.length - 1;
}

function adjustCanvasSize() {
    if (pathData.length === 0) return;

    // Get min/max X and Y values
    let minX = Math.min(...pathData.map(p => p.x));
    let maxX = Math.max(...pathData.map(p => p.x));
    let minY = Math.min(...pathData.map(p => p.y));
    let maxY = Math.max(...pathData.map(p => p.y));

    let width = (maxX - minX) * scale + 100; // Extra padding
    let height = (maxY - minY) * scale + 100; // Extra padding

    let canvas = document.getElementById("buggyTrack");
    canvas.width = Math.max(width, 500); // Minimum size of 500px
    canvas.height = Math.max(height, 500);
}

function drawPath(highlightIndex = -1) {
    let canvas = document.getElementById("buggyTrack");
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pathData.length === 0) return;

    // Find min/max to center the path
    let minX = Math.min(...pathData.map(p => p.x));
    let minY = Math.min(...pathData.map(p => p.y));

    let offsetX = -minX * scale + 50; // Centering offset
    let offsetY = -minY * scale + 50;

    // Draw the path
    ctx.beginPath();
    pathData.forEach((point, index) => {
        let px = offsetX + point.x * scale;
        let py = offsetY - point.y * scale;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });

    ctx.strokeStyle = "blue";
    ctx.lineWidth = pathWidth * scale; // Path width is 17mm scaled
    ctx.stroke();

    // Draw the buggy icon at the current position
    if (highlightIndex >= 0) {
        let { x, y, theta } = pathData[highlightIndex];

        let px = offsetX + x * scale;
        let py = offsetY - y * scale;

        drawBuggy(ctx, px, py, theta, scale);
    }
}

function drawBuggy(ctx, x, y, theta, scale) {
    let buggyLengthScaled = buggyLength * scale;
    let buggyWidthScaled = buggyWidth * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-theta);

    // Draw the buggy body
    ctx.fillStyle = "red";
    ctx.fillRect(-buggyLengthScaled / 2, -buggyWidthScaled / 2, buggyLengthScaled, buggyWidthScaled);

    // Draw front indicator
    ctx.fillStyle = "yellow";
    ctx.fillRect(buggyLengthScaled / 2 - 5, -5, 10, 10);

    ctx.restore();
}

function updateSliderAndDraw() {
    currentIndex = parseInt(document.getElementById("timeSlider").value);
    drawPath(currentIndex);
}

function playPath() {
    if (isPlaying) return;
    isPlaying = true;

    function step() {
        if (currentIndex < pathData.length - 1) {
            currentIndex++;
            document.getElementById("timeSlider").value = currentIndex;
            drawPath(currentIndex);
            setTimeout(() => requestAnimationFrame(step), 100 / playbackSpeed);
        } else {
            isPlaying = false;
        }
    }

    step();
}

document.getElementById("playButton").addEventListener("click", () => {
    if (!isPlaying) playPath();
});

document.getElementById("timeSlider").addEventListener("input", updateSliderAndDraw);

document.getElementById("speedControl").addEventListener("input", (event) => {
    playbackSpeed = parseFloat(event.target.value);
    document.getElementById("speedValue").innerText = `${playbackSpeed.toFixed(1)}x`;
});

// Load data from localStorage when page loads
window.onload = function() {
    const storedData = localStorage.getItem("buggyData");
    if (storedData) {
        const debugData = JSON.parse(storedData);
        computePath(debugData);
        drawPath();
    } else {
        alert("❌ No buggy data found!");
    }
};
