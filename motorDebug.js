import { updateSpeedCommand } from "./BuggyCommands.js";

export async function startMotorDebug() {
    console.log("Entering Motor Debug Mode...");

    try {
        // Show the Motor data container
        document.getElementById("motorDebugContainer").style.display = "block";
;

        console.log("✅ Motor Debug Mode Activated");
    } catch (error) {
        console.error("❌ Error starting Motor debug mode:", error);
    }
}

export async function stopMotorDebug() {
    console.log("Exiting Motor Debug Mode...");

    try {
        // Hide the Motor data container
        document.getElementById("motorDebugContainer").style.display = "none";

        console.log("✅ Motor Debug Mode Deactivated");
    } catch (error) {
        console.error("❌ Error stopping Motor debug mode:", error);
    }
}

export function updateMotorTable(motorData) {

    const timeElapsed = motorData.time;
    const leftMotor_Speed = motorData.leftSpeed;
    const rightMotor_Speed = motorData.rightSpeed;


    // Get table body and bar graph container
    const tableBody = document.querySelector("#motorDataTable tbody");


    // ---- Update Raw Data Table ----
    tableBody.innerHTML = ""; // Clear previous rows (only show latest)
    const row = document.createElement("tr");

    // Time Column
    const timeCell = document.createElement("td");
    timeCell.innerText = timeElapsed;
    row.appendChild(timeCell);

    const leftMotor_Speed_Cell = document.createElement("td");
    leftMotor_Speed_Cell.innerText = leftMotor_Speed.toFixed(2);
    row.appendChild(leftMotor_Speed_Cell);

    const rightMotor_Speed_Cell = document.createElement("td");
    rightMotor_Speed_Cell.innerText = rightMotor_Speed.toFixed(2);
    row.appendChild(rightMotor_Speed_Cell);

    // Append row to table
    tableBody.appendChild(row);
};


export async function updateSpeeds() {
    const speedInputs = document.querySelectorAll(".speed-input"); 
    const leftSpeed = parseInt(speedInputs[0].value);
    const rightSpeed = parseInt(speedInputs[1].value);
    await updateSpeedCommand("left", leftSpeed);
    await updateSpeedCommand("right", rightSpeed);
}