#!/bin/bash
sudo systemctl stop grafana-server opensearch.service kafka logstash mosquitto 
python cli.py -sto

echo "Stop complete"
