let trackWidth = 0.25; // Buggy track width in meters (25cm)
let pathWidth = 0.017; // Path width in meters (17mm)
let buggyWidth = 0.25; // Buggy width in meters (25cm)
let buggyLength = 0.3; // Buggy length in meters (30cm)

let pathData = [];
let currentIndex = 0;
let isPlaying = false;
let playbackSpeed = 1;
let scale = 100; // Initial scale factor (1m = 100px)
let zoomFactor = 1; // Zoom factor for scaling
let canvasOffsetX = 0, canvasOffsetY = 0; // For the panning of the canvas
let PathzoomFactor = 1; // Zoom factor for scaling
let PathScale = 400; // Initial scale factor (1m = 100px)
let panOffsetX = 0, panOffsetY = 0; // Panning offsets (used for dragging the canvas)
let isDragging = false; // Flag to check if user is dragging
let lastX = 0, lastY = 0; // Last mouse position for dragging

function computePath(debugData) {
    console.log("Computing path with:", debugData);
    let x = 0, y = 0, theta = 0;
    pathData = [];

    let leftMotor = debugData.MOTOR_LEFT || [];
    let rightMotor = debugData.MOTOR_RIGHT || [];

    let maxLength = Math.min(leftMotor.length, rightMotor.length);

    for (let i = 1; i < maxLength; i++) {
        let leftDist = parseFloat(leftMotor[i]?.distance) - parseFloat(leftMotor[i - 1]?.distance) || 0;
        let rightDist = parseFloat(rightMotor[i]?.distance) - parseFloat(rightMotor[i - 1]?.distance) || 0;

        let leftSpeed = parseFloat(leftMotor[i]?.speed) || 0;
        let rightSpeed = parseFloat(rightMotor[i]?.speed) || 0;
        let avgSpeed = (leftSpeed + rightSpeed) / 2; // Compute average speed

        console.log(`Step ${i}: ΔLeft=${leftDist}, ΔRight=${rightDist}, Speed=${avgSpeed}`);

        let d = (leftDist + rightDist) / 2;
        let deltaTheta = (rightDist - leftDist) / trackWidth;

        theta += deltaTheta;
        x += d * Math.cos(theta);
        y += d * Math.sin(theta);

        pathData.push({ x, y, theta, speed: avgSpeed });
    }

    adjustCanvasZoomAndPan();
    document.getElementById("timeSlider").max = pathData.length - 1;
}

function adjustCanvasZoomAndPan() {
    if (pathData.length === 0) return;

    let minX = Math.min(...pathData.map(p => p.x));
    let maxX = Math.max(...pathData.map(p => p.x));
    let minY = Math.min(...pathData.map(p => p.y));
    let maxY = Math.max(...pathData.map(p => p.y));

    // Calculate canvas boundaries
    let contentWidth = (maxX - minX) * scale;
    let contentHeight = (maxY - minY) * scale;

    // Zoom out to fit the content
    zoomFactor = Math.min(canvas.width / contentWidth, canvas.height / contentHeight);
    scale = zoomFactor * 0.8; // Applying some padding

    // Recalculate offsets for panning
    canvasOffsetX = (canvas.width - contentWidth * scale) / 2;
    canvasOffsetY = (canvas.height - contentHeight * scale) / 2;

    // Update panOffsetX and panOffsetY with current panning
    panOffsetX = canvasOffsetX;
    panOffsetY = canvasOffsetY;

    drawPath();
}

function drawPath(highlightIndex = -1) {
    let canvas = document.getElementById("buggyTrack");
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pathData.length === 0) return;

    // Draw the path with current zoom and pan
    let minX = Math.min(...pathData.map(p => p.x));
    let minY = Math.min(...pathData.map(p => p.y));

    let offsetX = (canvas.width / 2) - (minX * PathScale) + panOffsetX;
    let offsetY = (canvas.height / 2) - (minY * PathScale) + panOffsetY;

    // Compute min/max speed for gradient scaling
    let speeds = pathData.map(p => p.speed);
    let minSpeed = Math.min(...speeds);
    let maxSpeed = Math.max(...speeds);

    ctx.lineWidth = pathWidth * PathScale;

    // Draw path with gradient based on speed
    for (let i = 0; i < pathData.length - 1; i++) {
        let p1 = pathData[i];
        let p2 = pathData[i + 1];

        let px1 = offsetX + p1.x * PathScale;
        let py1 = offsetY - p1.y * PathScale;
        let px2 = offsetX + p2.x * PathScale;
        let py2 = offsetY - p2.y * PathScale;

        let speedNormalized = (p1.speed - minSpeed) / (maxSpeed - minSpeed);
        let color = speedToColor(speedNormalized);

        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.stroke();
    }

    // Draw buggy
    if (highlightIndex >= 0) {
        let { x, y, theta } = pathData[highlightIndex];
        let px = offsetX + x * PathScale;
        let py = offsetY - y * PathScale;
        drawBuggy(ctx, px, py, theta, PathScale);
    }
}

function drawBuggy(ctx, x, y, theta, PathScale) {
    let buggyLengthScaled = buggyLength * PathScale;
    let buggyWidthScaled = buggyWidth * PathScale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-theta);

    ctx.fillStyle = "red";
    ctx.fillRect(-buggyLengthScaled / 2, -buggyWidthScaled / 2, buggyLengthScaled, buggyWidthScaled);

    ctx.fillStyle = "yellow";
    ctx.fillRect(buggyLengthScaled / 2 - 5, -5, 10, 10);

    ctx.restore();
}

function speedToColor(normSpeed) {
    let r = Math.floor(255 * normSpeed); // More red as speed increases
    let g = Math.floor(255 * (1 - normSpeed)); // Less green as speed increases
    return `rgb(${r},${g},255)`; // Blend of red/blue
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

// Mouse drag and zoom
let canvas = document.getElementById("buggyTrack");

// Mouse down event to start dragging
canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grabbing";  // Change cursor to grabbing
});

// Mouse move event to drag
canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
        panOffsetX += (e.clientX - lastX);
        panOffsetY += (e.clientY - lastY);
        lastX = e.clientX;
        lastY = e.clientY;
        console.log(panOffsetX, panOffsetY);
        drawPath(); // Redraw path after moving
    }
});

// Mouse up event to stop dragging
canvas.addEventListener("mouseup", () => {
    isDragging = false;
    canvas.style.cursor = "grab";  // Change cursor back to grab
});

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    PathzoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    console.log(PathzoomFactor);
    PathScale *= PathzoomFactor;
    console.log(PathScale);
    drawPath();
});

window.onload = function () {
    const storedData = localStorage.getItem("buggyData");
    if (storedData) {
        const debugData = JSON.parse(storedData);
        computePath(debugData);
        drawPath();
    } else {
        alert("❌ No buggy data found!");
    }
};

document.getElementById("csvInput").addEventListener("change", handleFileUpload);

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const csvText = e.target.result;
        parseCSV(csvText);
    };
    reader.readAsText(file);
}

function parseCSV(csvText) {
    let lines = csvText.split("\n");
    let leftMotorData = [], rightMotorData = [];
    let mode = "", parameters = {};
    let currentSection = "";

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith("---")) {
            if (line.includes("MOTOR_LEFT")) currentSection = "left";
            else if (line.includes("MOTOR_RIGHT")) currentSection = "right";
            else currentSection = "";
            continue;
        }

        if (line.startsWith("Mode Used:")) {
            mode = line.split(":")[1].trim();
            continue;
        }

        if (line.startsWith("Parameters Used:")) {
            try {
                parameters = JSON.parse(line.split(":")[1].trim());
            } catch (error) {
                console.error("Error parsing parameters:", error);
            }
            continue;
        }

        let values = line.split(",");
        if (values.length >= 3 && currentSection) {
            let timestamp = parseFloat(values[0].replace(/"/g, ""));
            let distance = parseFloat(values[1]);
            let speed = parseFloat(values[2]);

            if (currentSection === "left") {
                leftMotorData.push({ timestamp, distance, speed });
            } else if (currentSection === "right") {
                rightMotorData.push({ timestamp, distance, speed });
            }
        }
    }

    computePath({ MOTOR_LEFT: leftMotorData, MOTOR_RIGHT: rightMotorData });
}
