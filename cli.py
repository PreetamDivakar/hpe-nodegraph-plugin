import argparse
import subprocess
import os
import requests

parser = argparse.ArgumentParser()
group = parser.add_mutually_exclusive_group()
group.add_argument("-e", "--enable", help="enable the monitor service", action="store_true")
group.add_argument("-d", "--disable", help="disable the monitor service", action="store_true")
group.add_argument("-s", "--status", help="check the status of the monitor service", action="store_true")
group.add_argument("-st", "--start", help="to start the monitor service", action="store_true")
group.add_argument("-sto", "--stop", help="to stop the monitor service", action="store_true")

args = parser.parse_args()

def run_command(command):
    """Run a system command with sudo and handle errors."""
    try:
        subprocess.run(["sudo"] + command, text=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error executing systemctl command: {e}")

if args.enable:
    run_command(["systemctl", "enable", "monitor"])
if args.disable:
    run_command(["systemctl", "disable", "monitor"])
if args.start:
    run_command(["systemctl", "start", "monitor"])
if args.stop:
    run_command(["systemctl", "stop", "monitor"])
if args.status:
    run_command(["systemctl", "status", "monitor"])
    
    grafana_plugin_path = "/var/lib/grafana/plugins/nodegraph-api-plugin"
    path_exists = "Found" if os.path.exists(grafana_plugin_path) else "Not Found"
    print(f"Node graph API data source plugin: {path_exists}")

    tool_running = ""
    try:
        response = requests.head("http://localhost:5000/api/health")
        if response.status_code == 200:
            tool_running = "Active [running]"
        else:
            tool_running = f"Inactive [HTTP {response.status_code}]"
    except requests.exceptions.RequestException:    
        tool_running = "Inactive [not running]"
    print(f"Visualizer tool: {tool_running}")
