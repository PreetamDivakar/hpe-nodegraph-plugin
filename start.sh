#!/bin/bash
echo "Starting services..."

sudo systemctl start kafka
sudo systemctl start mosquitto
sudo systemctl start logstash
sudo systemctl start opensearch.service
sudo systemctl start grafana-server
python cli.py -st

echo "Setup complete!"
