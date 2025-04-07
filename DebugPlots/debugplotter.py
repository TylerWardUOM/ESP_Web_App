import matplotlib.pyplot as plt
import pandas as pd

# Function to parse the CSV based on the structure
def parse_csv(file_path):
    motor_left_data = []
    motor_right_data = []
    current_section = None

    with open(file_path, 'r') as file:
        lines = file.readlines()

        for line in lines:
            line = line.strip()

            if line.startswith('--- MOTOR_LEFT'):
                current_section = 'MOTOR_LEFT'
            elif line.startswith('--- MOTOR_RIGHT'):
                current_section = 'MOTOR_RIGHT'
            elif line.startswith('Timestamp'):
                # Skip the header row
                continue
            elif line:
                # Parse data rows for both MOTOR_LEFT and MOTOR_RIGHT sections
                if current_section == 'MOTOR_LEFT':
                    motor_left_data.append(line)
                elif current_section == 'MOTOR_RIGHT':
                    motor_right_data.append(line)

    # Convert data to DataFrame for easy access
    motor_left_df = pd.DataFrame([x.split(',') for x in motor_left_data],
                                 columns=['Timestamp', 'distance', 'speed', 'target_speed', 'error', 'adjustment', 'persistent_error', 'newSpeed', 'originalSpeed'])
    motor_right_df = pd.DataFrame([x.split(',') for x in motor_right_data],
                                  columns=['Timestamp', 'distance', 'speed', 'target_speed', 'error', 'adjustment', 'persistent_error', 'newSpeed', 'originalSpeed'])

    # Clean the Timestamp column (remove quotes) and convert to integer
    motor_left_df['Timestamp'] = motor_left_df['Timestamp'].str.replace('"', '').astype(int)
    motor_right_df['Timestamp'] = motor_right_df['Timestamp'].str.replace('"', '').astype(int)

    # Convert other columns to appropriate types
    motor_left_df['target_speed'] = motor_left_df['target_speed'].astype(float)
    motor_left_df['speed'] = motor_left_df['speed'].astype(float)
    
    motor_right_df['target_speed'] = motor_right_df['target_speed'].astype(float)
    motor_right_df['speed'] = motor_right_df['speed'].astype(float)
    
    return motor_left_df, motor_right_df

# Read the CSV data
file_path = "C:/Users/tman0/Downloads/PowerSUpplyMotorMax.csv"  # Update with the correct path to your file
motor_left_df, motor_right_df = parse_csv(file_path)

# Plotting the target speed and speed against the Timestamp for motor-left and motor-right data
plt.figure(figsize=(12, 6))

# Left Motor Plot
plt.subplot(1, 2, 1)
plt.plot(motor_left_df['Timestamp'], motor_left_df['target_speed'], label="Target Speed (Left)", color='b')
plt.plot(motor_left_df['Timestamp'], motor_left_df['speed'], label="Speed (Left)", color='g')
plt.title('Motor Left: Target Speed and Speed vs Time')
plt.xlabel('Timestamp')
plt.ylabel('Speed')
plt.grid(True)
plt.legend()

# Right Motor Plot
plt.subplot(1, 2, 2)
plt.plot(motor_right_df['Timestamp'], motor_right_df['target_speed'], label="Target Speed (Right)", color='r')
plt.plot(motor_right_df['Timestamp'], motor_right_df['speed'], label="Speed (Right)", color='orange')
plt.title('Motor Right: Target Speed and Speed vs Time')
plt.xlabel('Timestamp')
plt.ylabel('Speed')
plt.grid(True)
plt.legend()

plt.tight_layout()  # Adjust spacing between plots
plt.show()
