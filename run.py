from data import push_data
import threading
import time

topic = "CoolDev"
data_push = push_data(topic)

# Create threads
mqtt_push = threading.Thread(target=data_push.push_data_to_mosquitto, daemon=True)
kafka_push = threading.Thread(target=data_push.kafka_data, daemon=True)

# Start threads
mqtt_push.start()
kafka_push.start()

try:
    while True:
        time.sleep(1)  # Adjust sleep time as needed
except KeyboardInterrupt:
    print("Stopping data push...")
